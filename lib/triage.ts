/**
 * Deterministic checks that run before the model sees anything.
 *
 * The point is that escalation should not depend on the model getting it right. If a guest writes
 * in about a complaint, an injury or a refund, that goes to a person whatever the model decides.
 *
 * These patterns are deliberately loose. A lead escalated when it did not need to be costs a staff
 * member thirty seconds of reading. A complaint the assistant tries to answer on its own costs a
 * lot more, so this errs toward escalating.
 */

type Pattern = { label: string; test: RegExp };

const SENSITIVE: Pattern[] = [
  { label: "asks for a manager", test: /\bmanager\b|\bsupervisor\b|\bowner\b/i },
  { label: "raises a complaint", test: /\bcomplain(t|ts|ed|ing)?\b|\bconcern(s|ed)?\b/i },
  { label: "asks about a refund", test: /\brefund(s|ed)?\b|\bmoney back\b|\bcharged twice\b/i },
  { label: "reports dissatisfaction", test: /\bunhappy\b|\bdisappoint(ed|ing|ment)?\b|\bterrible\b|\bawful\b/i },
  { label: "mentions an allergy", test: /\baller(gy|gic|gies)\b/i },
  // Guests rarely use the word "reaction". They describe what they can see, so match that too.
  {
    label: "reports a possible injury or reaction",
    test: /\b(burn|burned|burnt|injur(y|ed)|rash|bruis(e|ed|ing)|reaction|hurt|irritat(ed|ion|ing)|redness|swell(ing|ed|s)?|swollen|blister(s|ed|ing)?|itch(y|ing|ed)?|break(ing)? out|broke out|breakout)\b/i,
  },
  { label: "raises a legal issue", test: /\blegal\b|\blawyer\b|\battorney\b|\bsue\b|\bsuing\b/i },
];

export type TriageResult = {
  forceEscalate: boolean;
  reason: string | null;
  mentionsGroupon: boolean;
};

export function triage(message: string, hasGrouponFlag: boolean): TriageResult {
  const hits = SENSITIVE.filter((p) => p.test.test(message));

  return {
    forceEscalate: hits.length > 0,
    reason: hits.length > 0 ? `Guest ${hits.map((h) => h.label).join(", ")}.` : null,
    // The checkbox is the primary signal, but guests mention it in the message and forget to tick
    // the box often enough to be worth catching both ways.
    mentionsGroupon: hasGrouponFlag || /\bgroupon\b/i.test(message),
  };
}
