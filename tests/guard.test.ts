import { describe, it, expect } from "vitest";
import { applyGuards, type AiResult } from "../lib/guard";
import type { Slot } from "../lib/availability";
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
  proposedSlots: [],
};

// Saturday, offered to a guest. Late enough in the day that a half day package would not finish.
const offered: Slot[] = [
  { id: "2026-08-15T10:00", date: "2026-08-15", time: "10:00", label: "Saturday 15 August, 10:00am" },
  { id: "2026-08-15T16:00", date: "2026-08-15", time: "16:00", label: "Saturday 15 August, 4:00pm" },
];

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

  it("keeps a time that was actually offered", () => {
    const ai = { ...base, serviceInterest: "swedish-60", proposedSlots: ["2026-08-15T10:00"] };
    const r = applyGuards(ai, clean, false, offered);
    expect(r.slots.map((s) => s.id)).toEqual(["2026-08-15T10:00"]);
    expect(r.needsStaff).toBe(false);
  });

  it("drops a time that was never on the list", () => {
    const ai = { ...base, serviceInterest: "swedish-60", proposedSlots: ["2026-08-15T07:00"] };
    const r = applyGuards(ai, clean, false, offered);
    expect(r.slots).toEqual([]);
  });

  it("drops a time the treatment could not finish in", () => {
    // The half day escape runs 210 minutes, so a 4pm start would run well past closing.
    const ai = { ...base, serviceInterest: "half-day-escape", proposedSlots: ["2026-08-15T16:00"] };
    const r = applyGuards(ai, clean, false, offered);
    expect(r.slots).toEqual([]);
    expect(r.needsStaff).toBe(true);
    expect(r.escalationReason).toContain("too late in the day");
  });

  it("does not offer appointment times to someone raising a complaint", () => {
    const ai = { ...base, serviceInterest: "swedish-60", proposedSlots: ["2026-08-15T10:00"] };
    const r = applyGuards(ai, escalating, false, offered);
    expect(r.slots).toEqual([]);
    expect(r.escalationReason).toContain("withheld");
  });
});
