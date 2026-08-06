/**
 * The only place service facts live.
 *
 * The assistant is not allowed to name a treatment that is not in this list, and the guard step
 * drops anything it invents. Prices and appointment availability are deliberately absent, because
 * the assistant has no reliable source for either and a wrong price quoted to a guest is worse
 * than no price at all.
 *
 * This is representative test data, not Majesty's real menu. In production it moves to a table so
 * the front desk can edit it without a deploy.
 */

export type ServiceCategory = "massage" | "facial" | "body" | "package";

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  blurb: string;
  durationMinutes: number;
  grouponEligible: boolean;
  forTwo: boolean;
};

export const CATALOG: Service[] = [
  {
    id: "swedish-60",
    name: "Swedish Massage, 60 minutes",
    category: "massage",
    blurb: "Light to medium pressure for general relaxation. The usual first visit.",
    durationMinutes: 60,
    grouponEligible: true,
    forTwo: false,
  },
  {
    id: "deep-tissue-60",
    name: "Deep Tissue Massage, 60 minutes",
    category: "massage",
    blurb: "Firmer pressure aimed at specific tension and knots.",
    durationMinutes: 60,
    grouponEligible: true,
    forTwo: false,
  },
  {
    id: "hot-stone-90",
    name: "Hot Stone Massage, 90 minutes",
    category: "massage",
    blurb: "Heated stones with a full body massage.",
    durationMinutes: 90,
    grouponEligible: false,
    forTwo: false,
  },
  {
    id: "signature-facial",
    name: "Signature Facial",
    category: "facial",
    blurb: "Cleanse, exfoliate, extract and hydrate, adjusted to the skin on the day.",
    durationMinutes: 60,
    grouponEligible: true,
    forTwo: false,
  },
  {
    id: "body-polish",
    name: "Sea Salt Body Polish",
    category: "body",
    blurb: "Full body exfoliation finished with a hydrating wrap.",
    durationMinutes: 45,
    grouponEligible: false,
    forTwo: false,
  },
  {
    id: "couples-retreat",
    name: "Couples Retreat",
    category: "package",
    blurb: "Side by side massage for two in a private room, with time in the relaxation lounge.",
    durationMinutes: 120,
    grouponEligible: false,
    forTwo: true,
  },
  {
    id: "half-day-escape",
    name: "Half Day Escape",
    category: "package",
    blurb: "Massage, facial and body treatment across an afternoon. Available for one or two.",
    durationMinutes: 210,
    grouponEligible: false,
    forTwo: true,
  },
];

export const serviceIds = CATALOG.map((s) => s.id);

export function findService(id: string | null): Service | null {
  if (!id) return null;
  return CATALOG.find((s) => s.id === id) ?? null;
}

/**
 * The only policies the assistant may state. Anything a guest asks that is not covered here has to
 * go to a person.
 */
export const POLICIES = [
  "Groupon vouchers are redeemed at the front desk and cannot be applied to package bookings.",
  "Please arrive fifteen minutes before your appointment so we can get you settled.",
  "Appointments cancelled inside 24 hours may be charged.",
  "Gift cards can be bought in person or over the phone.",
] as const;

/** What gets injected into the prompt. Keeps the prompt and the catalog from drifting apart. */
export function catalogForPrompt() {
  return CATALOG.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    blurb: s.blurb,
    durationMinutes: s.durationMinutes,
    grouponEligible: s.grouponEligible,
    forTwo: s.forTwo,
  }));
}
