import { findService, serviceIds } from "./catalog";
import type { TriageResult } from "./triage";

export type NextAction =
  | "continue_to_booking"
  | "request_more_information"
  | "send_groupon_instructions"
  | "schedule_staff_callback"
  | "escalate_to_management";

export type AiResult = {
  summary: string;
  category: string;
  serviceInterest: string | null;
  priority: "hot" | "warm" | "general";
  needsStaff: boolean;
  draftResponse: string;
  nextAction: NextAction;
};

export type GuardedResult = AiResult & { escalationReason: string | null };

/**
 * Everything the model returns passes through here before it is stored or shown to anyone.
 *
 * The rule the whole step is built on: a guard can add caution, never remove it. If either the
 * model or the deterministic triage thinks a person should look at this, a person looks at it.
 */
export function applyGuards(ai: AiResult, t: TriageResult, hasGroupon: boolean): GuardedResult {
  // The model is given a list of service ids and asked to pick one. If it returns something that
  // is not on that list it has invented a treatment, so drop it. No recommendation is better than
  // a recommendation for something the spa does not offer.
  let serviceInterest = ai.serviceInterest && serviceIds.includes(ai.serviceInterest) ? ai.serviceInterest : null;
  const invented = Boolean(ai.serviceInterest) && serviceInterest === null;

  const reasons: string[] = [];
  if (t.reason) reasons.push(t.reason);
  if (invented) reasons.push("Assistant suggested a treatment that is not in the catalog, so it was removed.");

  // A guest holding a voucher who gets pointed at something the voucher does not cover is a
  // front desk argument waiting to happen. Keep the suggestion, flag it for a person.
  const service = findService(serviceInterest);
  if (hasGroupon && service && !service.grouponEligible) {
    reasons.push(`Guest has a Groupon but ${service.name} is not voucher eligible.`);
  }

  const needsStaff = ai.needsStaff || t.forceEscalate || reasons.length > 0;

  const nextAction: NextAction = t.forceEscalate
    ? "escalate_to_management"
    : needsStaff && ai.nextAction === "continue_to_booking"
      ? "schedule_staff_callback"
      : ai.nextAction;

  return {
    ...ai,
    serviceInterest,
    needsStaff,
    nextAction,
    escalationReason: reasons.length > 0 ? reasons.join(" ") : null,
  };
}
