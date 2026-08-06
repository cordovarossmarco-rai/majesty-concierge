import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { catalogForPrompt, POLICIES, serviceIds } from "./catalog";
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

export type ClassifyOutcome = {
  result: AiResult;
  model: string;
  /** Null when the model answered. A short reason when we fell back, for the automation log. */
  failure: string | null;
};

function systemPrompt() {
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
    "Rules, and what to do instead:",
    "- You have no price list. Never quote or estimate a price. Say the front desk will confirm cost when they call.",
    "- You have no calendar. Never say a date or time is free or booked. Say the front desk will confirm the time.",
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
function fallback(inquiry: InquiryInput, failure: string): ClassifyOutcome {
  return {
    model: MODEL,
    failure,
    result: {
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
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(inquiry) }],
      // Low effort is deliberate. This is a short classification with a deterministic guard behind
      // it, so the tokens are better spent on being quick than on deliberating.
      output_config: { effort: "low", format: zodOutputFormat(aiResultSchema) },
    });

    if (response.stop_reason === "refusal") {
      return fallback(inquiry, "The model declined to answer this enquiry.");
    }
    if (!response.parsed_output) {
      return fallback(inquiry, `No parsable result returned (stop reason: ${response.stop_reason}).`);
    }

    return { result: response.parsed_output, model: MODEL, failure: null };
  } catch (error) {
    // Every branch below ends in the same place: a lead that waits for a person. The distinction is
    // only so the automation log says something useful when someone comes to look.
    if (error instanceof Anthropic.AuthenticationError) {
      return fallback(inquiry, "The Anthropic API key is missing or rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return fallback(inquiry, "Rate limited by the Anthropic API.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return fallback(inquiry, "Could not reach the Anthropic API.");
    }
    if (error instanceof Anthropic.APIError) {
      return fallback(inquiry, `Anthropic API error ${error.status}: ${error.message}`);
    }
    return fallback(inquiry, error instanceof Error ? error.message : "Unknown classification error.");
  }
}
