import { describe, it, expect } from "vitest";
import { applyGuards, type AiResult } from "../lib/guard";
import type { TriageResult } from "../lib/triage";

const clean: TriageResult = { forceEscalate: false, reason: null, mentionsGroupon: false };
const escalating: TriageResult = {
  forceEscalate: true,
  reason: "Guest asks for a manager.",
  mentionsGroupon: false,
};

const base: AiResult = {
  summary: "Wants a massage on Saturday.",
  category: "booking",
  serviceInterest: null,
  priority: "warm",
  needsStaff: false,
  draftResponse: "Thanks for getting in touch.",
  nextAction: "continue_to_booking",
};

describe("applyGuards", () => {
  it("drops a treatment the model invented and says so", () => {
    const r = applyGuards({ ...base, serviceInterest: "bamboo-fusion-120" }, clean, false);
    expect(r.serviceInterest).toBeNull();
    expect(r.needsStaff).toBe(true);
    expect(r.escalationReason).toContain("not in the catalog");
  });

  it("keeps a treatment that exists", () => {
    const r = applyGuards({ ...base, serviceInterest: "swedish-60" }, clean, false);
    expect(r.serviceInterest).toBe("swedish-60");
    expect(r.needsStaff).toBe(false);
    expect(r.escalationReason).toBeNull();
  });

  it("escalates when triage says so even though the model was happy", () => {
    const r = applyGuards(base, escalating, false);
    expect(r.needsStaff).toBe(true);
    expect(r.nextAction).toBe("escalate_to_management");
    expect(r.escalationReason).toContain("manager");
  });

  it("never un-escalates something the model flagged", () => {
    const r = applyGuards({ ...base, needsStaff: true }, clean, false);
    expect(r.needsStaff).toBe(true);
  });

  it("flags a voucher pointed at a service the voucher does not cover", () => {
    const r = applyGuards({ ...base, serviceInterest: "couples-retreat" }, clean, true);
    expect(r.serviceInterest).toBe("couples-retreat");
    expect(r.needsStaff).toBe(true);
    expect(r.escalationReason).toContain("not voucher eligible");
  });

  it("leaves a voucher alone when the service is eligible", () => {
    const r = applyGuards({ ...base, serviceInterest: "swedish-60" }, clean, true);
    expect(r.needsStaff).toBe(false);
    expect(r.escalationReason).toBeNull();
  });

  it("stops sending a guest to online booking once a person needs to look at it", () => {
    const r = applyGuards({ ...base, needsStaff: true, nextAction: "continue_to_booking" }, clean, false);
    expect(r.nextAction).toBe("schedule_staff_callback");
  });
});
