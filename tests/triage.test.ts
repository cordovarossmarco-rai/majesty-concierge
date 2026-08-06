import { describe, it, expect } from "vitest";
import { triage } from "../lib/triage";

describe("triage", () => {
  it("escalates the service complaint from the brief", () => {
    const r = triage("I had a service yesterday and need a manager to contact me about a concern", false);
    expect(r.forceEscalate).toBe(true);
    expect(r.reason).toContain("manager");
  });

  it("leaves an ordinary booking request alone", () => {
    const r = triage("I purchased a Groupon for a massage and would like to come Saturday afternoon", false);
    expect(r.forceEscalate).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("leaves a package question alone", () => {
    const r = triage("My anniversary is next week and I want to plan something for two people", false);
    expect(r.forceEscalate).toBe(false);
  });

  it("escalates an allergy so nobody automates a reply to it", () => {
    const r = triage("Do your facials use nut oils? I have a severe allergy", false);
    expect(r.forceEscalate).toBe(true);
  });

  it("escalates a reported reaction", () => {
    const r = triage("My skin had a reaction after the facial on Tuesday", false);
    expect(r.forceEscalate).toBe(true);
  });

  it("lists every reason when more than one applies", () => {
    const r = triage("I want a refund and I would like to speak to a manager", false);
    expect(r.reason).toContain("manager");
    expect(r.reason).toContain("refund");
  });

  it("catches Groupon from the message when the box is not ticked", () => {
    const r = triage("I bought a groupon last week", false);
    expect(r.mentionsGroupon).toBe(true);
  });

  it("trusts the checkbox when the message does not mention it", () => {
    const r = triage("Looking for a massage on Saturday", true);
    expect(r.mentionsGroupon).toBe(true);
  });
});
