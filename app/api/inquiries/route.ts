import { after, NextResponse } from "next/server";
import { db, leads, leadAi } from "@/lib/db";
import { inquirySchema } from "@/lib/validation";
import { triage } from "@/lib/triage";
import { classify } from "@/lib/classify";
import { applyGuards } from "@/lib/guard";
import { recordClassification, runAutomations } from "@/lib/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Empty optional fields arrive from the form as "". Store the absence, not an empty string. */
function orNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // The same schema the form validates against. The browser check is for the guest's benefit;
  // this one is the one that counts.
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some of those details did not look right.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const inquiry = parsed.data;

  /*
    The guest's enquiry is written down before anything else happens, and certainly before we call
    a third party. If Anthropic is slow, rate limiting us, or down, the spa still has the enquiry
    and the guest still gets an answer from the form. The classification is an improvement on top
    of a lead, never a condition of having one.
  */
  let leadId: string;
  try {
    const [row] = await db
      .insert(leads)
      .values({
        firstName: inquiry.firstName,
        lastName: inquiry.lastName,
        phone: inquiry.phone,
        email: inquiry.email,
        heardAbout: orNull(inquiry.heardAbout),
        hasGroupon: inquiry.hasGroupon,
        serviceCategory: orNull(inquiry.serviceCategory),
        preferredDate: orNull(inquiry.preferredDate),
        preferredTime: orNull(inquiry.preferredTime),
        contactMethod: inquiry.contactMethod,
        message: inquiry.message,
      })
      .returning({ id: leads.id });
    leadId = row.id;
  } catch (error) {
    console.error("Could not save the enquiry:", error);
    return NextResponse.json({ error: "We could not save that. Please try again." }, { status: 500 });
  }

  // Everything past this point runs after the guest already has their confirmation. Reading the
  // enquiry takes the model several seconds and there is no reason to make someone sit through it.
  after(async () => {
    try {
      const t = triage(inquiry.message, inquiry.hasGroupon);
      const outcome = await classify(inquiry);
      const guarded = applyGuards(outcome.result, t, inquiry.hasGroupon, outcome.offered);

      await db
        .insert(leadAi)
        .values({
          leadId,
          summary: guarded.summary,
          category: guarded.category,
          serviceInterest: guarded.serviceInterest,
          priority: guarded.priority,
          needsStaff: guarded.needsStaff,
          escalationReason: guarded.escalationReason,
          draftResponse: guarded.draftResponse,
          nextAction: guarded.nextAction,
          proposedSlots: guarded.slots.length > 0 ? JSON.stringify(guarded.slots) : null,
          model: outcome.model,
        })
        // Re-reading an enquiry should replace the previous reading rather than fail on the
        // primary key, so this stays safe to run again.
        .onConflictDoUpdate({
          target: leadAi.leadId,
          set: {
            summary: guarded.summary,
            category: guarded.category,
            serviceInterest: guarded.serviceInterest,
            priority: guarded.priority,
            needsStaff: guarded.needsStaff,
            escalationReason: guarded.escalationReason,
            draftResponse: guarded.draftResponse,
            nextAction: guarded.nextAction,
            proposedSlots: guarded.slots.length > 0 ? JSON.stringify(guarded.slots) : null,
            model: outcome.model,
          },
        });

      await recordClassification(leadId, outcome.model, outcome.failure);
      await runAutomations(leadId, { firstName: inquiry.firstName, email: inquiry.email }, guarded);
    } catch (error) {
      // The lead is already saved, so the worst case here is an enquiry a person has to read
      // unaided. Say so in the log rather than failing quietly.
      console.error(`Could not classify lead ${leadId}:`, error);
    }
  });

  return NextResponse.json({ ok: true, id: leadId }, { status: 201 });
}
