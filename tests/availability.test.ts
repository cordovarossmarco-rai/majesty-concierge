import { describe, it, expect } from "vitest";
import { slotsFor, offerSlots, findSlot } from "../lib/availability";

// A fixed reference day so these assertions mean the same thing next month.
const FROM = new Date(2026, 7, 7); // Friday 7 August 2026

describe("slotsFor", () => {
  it("returns nothing on a Monday, because the spa is closed", () => {
    expect(slotsFor("2026-08-10", 60)).toEqual([]);
  });

  it("gives the same answer every time it is asked", () => {
    expect(slotsFor("2026-08-15", 60)).toEqual(slotsFor("2026-08-15", 60));
  });

  it("never starts a treatment that would run past closing", () => {
    const slots = slotsFor("2026-08-15", 210);
    for (const slot of slots) {
      const [h, m] = slot.time.split(":").map(Number);
      expect(h * 60 + m + 210).toBeLessThanOrEqual(19 * 60);
    }
  });

  it("offers a long package fewer start times than a short treatment", () => {
    expect(slotsFor("2026-08-15", 210).length).toBeLessThan(slotsFor("2026-08-15", 45).length);
  });

  it("ignores a date it cannot read", () => {
    expect(slotsFor("next Tuesday", 60)).toEqual([]);
  });

  it("writes times the way a person would say them", () => {
    const [slot] = slotsFor("2026-08-15", 60);
    expect(slot.label).toMatch(/^Saturday 15 August, \d{1,2}:\d{2}(am|pm)$/);
  });
});

describe("offerSlots", () => {
  it("leads with the day the guest asked for", () => {
    const offered = offerSlots("2026-08-15", 60, { from: FROM });
    expect(offered[0].date).toBe("2026-08-15");
  });

  it("still offers something when the guest names a day the spa is closed", () => {
    const offered = offerSlots("2026-08-10", 60, { from: FROM });
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((s) => s.date !== "2026-08-10")).toBe(true);
  });

  it("offers something when the guest names no date at all", () => {
    expect(offerSlots(null, 60, { from: FROM }).length).toBeGreaterThan(0);
  });

  it("does not offer a date that has already passed", () => {
    const offered = offerSlots("2026-08-01", 60, { from: FROM });
    expect(offered.every((s) => s.date > "2026-08-07")).toBe(true);
  });

  it("never offers a Monday", () => {
    const offered = offerSlots(null, 60, { from: FROM, limit: 10 });
    expect(offered.every((s) => new Date(`${s.date}T00:00`).getDay() !== 1)).toBe(true);
  });
});

describe("findSlot", () => {
  it("only recognises a slot that was actually offered", () => {
    const offered = offerSlots("2026-08-15", 60, { from: FROM });
    expect(findSlot(offered, offered[0].id)).toEqual(offered[0]);
    expect(findSlot(offered, "2026-08-15T03:00")).toBeNull();
    expect(findSlot(offered, null)).toBeNull();
  });
});
