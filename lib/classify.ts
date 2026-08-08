import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { catalogForPrompt, longestDurationFor, POLICIES, serviceIds } from "./catalog";
import { offerSlots, type Slot } from "./availability";
import type { AiResult } from "./guard";
import type { InquiryInput } from "./validation";

const MODEL = "claude-opus-5";

/*
  The shape the model has to fill in. Constraining serviceInterest to the catalog ids here means
  the API itself rejects an invented treatment before it ever reaches us; the guard step still
  checks, because a schema is a contract with the API and the guard is a contract with the spa.
*/
const aiResultSchema = z.object({
  summary: z
    .string()
    .describe("One or two sentences a receptionist could read at a glance. No greeting, no sign off."),
  category: z
    .string()
    .describe(
      "A few words naming what this enquiry is really about, for example 'first visit, wants a recommendation' or 'gift for a birthday'.",
    ),
  serviceInterest: z
    .enum(serviceIds as [string, ...string[]])
    .nullable()
    .describe("The single catalog id that best fits, or null when nothing clearly fits."),
  priority: z
    .enum(["hot", "warm", "general"])
    .describe(
      "hot when they name a specific date within about a week or are ready to book now, warm when they are choosing between treatments or planning further ahead, general when there is no timing in the enquiry at all.",
    ),
  needsStaff: z
    .boolean()
    .describe("True when a person should read this before anything goes back to the guest."),
  draftResponse: z
    .string()
    .describe("A reply addressed to the guest for a staff member to review, edit and send."),
  nextAction: z.enum([
    "continue_to_booking",
    "request_more_information",
    "send_groupon_instructions",
    "schedule_staff_callback",
    "escalate_to_management",
  ]),
});

/**
 * The offered times become the only values the field will accept, so a time the spa cannot
 * honour is refused by the API rather than caught afterwards. Same idea as pinning the treatment
 * to the catalog: the way to stop something being made up is to leave no room to make it up in.
 */
function buildSchema(offered: Slot[]) {
  const slotIds = offered.map((s) => s.id);
  if (slotIds.length === 0) {
    return aiResultSchema.extend({
      proposedSlots: z.array(z.never()).max(0).describe("Nothing is free to offer, so this must be empty."),
    });
  }
  return aiResultSchema.extend({
    proposedSlots: z
      .array(z.enum(slotIds as [string, ...string[]]))
      .max(2)
      .describe("Up to two of the offered times. Empty when no time should be offered yet."),
  });
}

export type ClassifyOutcome = {
  result: AiResult;
  model: string;
  /** The times the assistant was shown, so the guard can check what it picked against them. */
  offered: Slot[];
  /** Null when the model answered. A short reason when we fell back, for the automation log. */
  failure: string | null;
};

function systemPrompt(offered: Slot[]) {
  const availability =
    offered.length > 0
      ? [
          "These appointment times are free, and they are the only ones you may offer:",
          offered.map((s) => `- ${s.id} : ${s.label}`).join("\n"),
          "",
          "Put the ids in proposedSlots and write those same times into the draft. Offer at most two,",
          "and offer none at all when the enquiry is a complaint or when you do not yet know enough",
          "to suggest a treatment. Say that the time is held only once the spa confirms it.",
          "",
          "The draft must name exactly the times in proposedSlots and no others. A time mentioned to",
          "the guest but missing from proposedSlots leaves the front desk looking at a shorter list",
          "than the guest was sent, which is how a spa double books itself.",
        ]
      : [
          "Nothing is free in the period you can see, so leave proposedSlots empty and say in the",
          "draft that the front desk will find a time with them.",
        ];

  return [
    "You read enquiries sent to Majesty Day Spa and prepare them for the front desk. You are not",
    "talking to the guest. A member of staff reads everything you write before any of it is sent.",
    "",
    "These are the only treatments the spa offers:",
    JSON.stringify(catalogForPrompt(), null, 2),
    "",
    "These are the only policies you may state:",
    POLICIES.map((p) => `- ${p}`).join("\n"),
    "",
    ...availability,
    "",
    "Rules, and what to do instead:",
    "- You have no price list. Never quote or estimate a price. Say the front desk will confirm cost when they call.",
    "- Never offer a time that is not on the list above, and never say a time is booked.",
    "- The list is what is free in the next few days, NOT the whole calendar. If the day they asked",
    "  for is not on it, do not tell them that day is unavailable, because you were never shown it.",
    "  Offer what you have and say the front desk can check other dates.",
    "- Never name a treatment that is not in the list above. If nothing fits, set serviceInterest to null and ask in the draft what they are looking for.",
    "- Never state a policy that is not in the list above. If the guest asks about anything else, set needsStaff to true and leave the question for a person.",
    "- Never confirm a booking. The draft should say someone will be in touch to confirm.",
    "",
    "needsStaff means this enquiry needs someone's judgement before a reply goes back. Set it to",
    "true for complaints, injuries, allergies, refunds, anything you are unsure of, and any",
    "question you cannot answer from the two lists above.",
    "",
    "Set it to false for a straightforward enquiry. The front desk confirms the time and the cost",
    "on every booking, so that on its own is not a reason to flag one. A guest who knows what they",
    "want, or who wants a recommendation you can make from the list, is routine.",
    "",
    "Write the draft the way a good receptionist writes: plain, warm, short. Two to four sentences.",
    "Use the guest's first name once. No emoji, no exclamation marks, no marketing language.",
  ].join("\n");
}

function userPrompt(inquiry: InquiryInput) {
  const lines = [
    `Name: ${inquiry.firstName} ${inquiry.lastName}`,
    `Preferred contact: ${inquiry.contactMethod}`,
    `Holds a Groupon voucher: ${inquiry.hasGroupon ? "yes" : "no"}`,
  ];
  if (inquiry.serviceCategory) lines.push(`Treatment type they picked: ${inquiry.serviceCategory}`);
  if (inquiry.preferredDate) lines.push(`Preferred date: ${inquiry.preferredDate}`);
  if (inquiry.preferredTime) lines.push(`Preferred time: ${inquiry.preferredTime}`);
  if (inquiry.heardAbout) lines.push(`How they heard about the spa: ${inquiry.heardAbout}`);
  lines.push("", "What they wrote:", inquiry.message);
  return lines.join("\n");
}

/*
  Constructed on first use rather than at import, so that a missing key surfaces as a handled
  fallback on one enquiry instead of taking down every module that imports this file.
*/
let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/** What we store when the model could not be reached. The lead is never lost, it just waits for a person. */
function fallback(inquiry: InquiryInput, failure: string, offered: Slot[] = []): ClassifyOutcome {
  return {
    model: MODEL,
    failure,
    offered,
    result: {
      proposedSlots: [],
      summary: `Enquiry from ${inquiry.firstName} ${inquiry.lastName}. Not yet summarised, please read it in full.`,
      category: "needs review",
      serviceInterest: null,
      priority: "warm",
      needsStaff: true,
      draftResponse:
        `Hi ${inquiry.firstName}, thank you for getting in touch with Majesty Day Spa. ` +
        `We have your enquiry and someone will be back to you shortly to go through the details ` +
        `and find a time that suits you.`,
      nextAction: "schedule_staff_callback",
    },
  };
}

export async function classify(inquiry: InquiryInput): Promise<ClassifyOutcome> {
  const offered = offerSlots(inquiry.preferredDate, longestDurationFor(inquiry.serviceCategory));

  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(offered),
      messages: [{ role: "user", content: userPrompt(inquiry) }],
      // Low effort is deliberate. This is a short classification with a deterministic guard behind
      // it, so the tokens are better spent on being quick than on deliberating.
      output_config: { effort: "low", format: zodOutputFormat(buildSchema(offered)) },
    });

    if (response.stop_reason === "refusal") {
      return fallback(inquiry, "The model declined to answer this enquiry.", offered);
    }
    if (!response.parsed_output) {
      return fallback(inquiry, `No parsable result returned (stop reason: ${response.stop_reason}).`, offered);
    }

    return { result: response.parsed_output, model: MODEL, offered, failure: null };
  } catch (error) {
    // Every branch below ends in the same place: a lead that waits for a person. The distinction is
    // only so the automation log says something useful when someone comes to look.
    if (error instanceof Anthropic.AuthenticationError) {
      return fallback(inquiry, "The Anthropic API key is missing or rejected.", offered);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return fallback(inquiry, "Rate limited by the Anthropic API.", offered);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return fallback(inquiry, "Could not reach the Anthropic API.", offered);
    }
    if (error instanceof Anthropic.APIError) {
      return fallback(inquiry, `Anthropic API error ${error.status}: ${error.message}`, offered);
    }
    return fallback(inquiry, error instanceof Error ? error.message : "Unknown classification error.", offered);
  }
}
