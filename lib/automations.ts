import { db, automationRuns } from "./db";
import type { GuardedResult } from "./guard";

/*
  Everything in here is simulated, and says so in the text it writes to the log.

  The trial brief asks for no connection to Majesty's production systems, so nothing is sent, and
  nothing is written anywhere outside this database. The detail on every row is worded so that a
  person reading the log, or a screenshot of it, cannot come away thinking a guest was emailed.

  What matters for the demonstration is the decision each step takes, not the delivery. Swapping
  the body of a step for a real send is a small change; deciding correctly which guests should be
  emailed at all is the part worth showing.
*/

type StepResult = string | { skipped: string };

/** The only place a run status is written. Four steps, one insert. */
async function record(leadId: string, step: string, status: "ok" | "failed" | "skipped", detail: string) {
  try {
    await db.insert(automationRuns).values({ leadId, step, status, detail });
  } catch (error) {
    // A step that worked but could not be logged should not take down the steps after it.
    console.error(`Could not log ${step} for lead ${leadId}:`, error);
  }
}

/**
 * Runs one step and records what happened to it.
 *
 * A step that decides not to act is recorded as skipped with its reason, rather than leaving no
 * row at all. That is the difference between "the automation never ran" and "it ran and decided
 * this guest should not be emailed", which look identical if you only log successes.
 */
async function step(leadId: string, name: string, run: () => Promise<StepResult> | StepResult) {
  try {
    const result = await run();
    if (typeof result === "object") {
      await record(leadId, name, "skipped", result.skipped);
    } else {
      await record(leadId, name, "ok", result);
    }
  } catch (error) {
    await record(leadId, name, "failed", error instanceof Error ? error.message : "Unknown error.");
  }
}

/** Recorded for the classification itself, so a failed reading is visible next to the steps. */
export async function recordClassification(leadId: string, model: string, failure: string | null) {
  await record(
    leadId,
    "classification",
    failure ? "failed" : "ok",
    failure ? `${failure} The enquiry was kept and flagged for a person.` : `Read by ${model}.`,
  );
}

type Recipient = { firstName: string; email: string };

export async function runAutomations(leadId: string, guest: Recipient, ai: GuardedResult) {
  await step(leadId, "confirmation_email", () => {
    // A guest who has complained should hear from a manager, not from an acknowledgement that
    // reads as though nobody noticed what they wrote.
    if (ai.nextAction === "escalate_to_management") {
      return { skipped: "Held back so a manager makes contact first." };
    }
    return `Simulated. Draft acknowledgement prepared for ${guest.email}. Nothing is sent until a staff member approves it.`;
  });

  await step(leadId, "hot_lead_notification", () => {
    if (ai.priority !== "hot") {
      return { skipped: `Priority is ${ai.priority}, so the front desk was not interrupted.` };
    }
    // Urgent and ready to book are not the same thing. A complaint is urgent precisely because it
    // is not a booking, and telling the front desk otherwise would read badly to whoever picks it up.
    return ai.needsStaff
      ? `Simulated. The front desk would be told that ${guest.firstName} needs attention now.`
      : `Simulated. The front desk would be told that ${guest.firstName} is ready to book.`;
  });

  await step(leadId, "followup_task", () => {
    if (!ai.needsStaff) {
      return { skipped: "Nothing here needs a person before a reply goes out." };
    }
    return `Simulated. Task created: ${ai.escalationReason ?? "a staff member should read this before replying."}`;
  });

  await step(leadId, "crm_sync", () => {
    return `Simulated. ${guest.firstName}'s details and the enquiry would be upserted to the spa's booking system.`;
  });
}
