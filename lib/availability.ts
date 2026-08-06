/**
 * A stand-in for the spa's booking calendar.
 *
 * Majesty runs on Booker/Mindbody and the brief rules out touching it, so this generates sample
 * slots instead. It is deliberately deterministic: the same date always produces the same free and
 * taken times, so a demonstration can be run twice and look the same both times.
 *
 * The reason this file exists at all is the same reason the catalog does. The assistant is not
 * allowed to invent an appointment time, so it has to be given real ones to choose from. Swapping
 * this for a live availability call is described in the README.
 */

export type Slot = {
  /** Stable identifier, also what the assistant picks from. */
  id: string;
  date: string;
  time: string;
  /** How it should be written to a guest. */
  label: string;
};

const OPEN_HOUR = 9;
const CLOSE_HOUR = 19;
const CLOSED_WEEKDAY = 1; // The spa is closed on Mondays.
const SLOT_GRID_MINUTES = 30;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parsed as a local calendar date. Using the Date constructor on "YYYY-MM-DD" would read it as UTC. */
function parseDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(date: Date) {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Small deterministic hash, so "which slots are taken" is stable rather than random per run. */
function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(h, 31) + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function formatTime(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${`${minute}`.padStart(2, "0")}${suffix}`;
}

function formatDay(date: Date) {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

/**
 * Free slots on one day for a treatment of the given length.
 *
 * A treatment has to finish before closing, so a 210 minute package simply has fewer possible
 * start times than a 45 minute one. That falls out of the arithmetic rather than being a rule.
 */
export function slotsFor(dateIso: string, durationMinutes: number): Slot[] {
  const date = parseDate(dateIso);
  if (!date) return [];
  if (date.getDay() === CLOSED_WEEKDAY) return [];

  const lastStart = CLOSE_HOUR * 60 - durationMinutes;
  const slots: Slot[] = [];

  for (let minutes = OPEN_HOUR * 60; minutes <= lastStart; minutes += SLOT_GRID_MINUTES) {
    const time = `${`${Math.floor(minutes / 60)}`.padStart(2, "0")}:${`${minutes % 60}`.padStart(2, "0")}`;
    // Roughly half of the day is already booked, which is what a spa's calendar actually looks
    // like. Weekend afternoons are busier, since that is when people want to come.
    const busy = date.getDay() === 0 || date.getDay() === 6 ? 65 : 45;
    if (hash(`${dateIso}T${time}`) % 100 < busy) continue;
    slots.push({ id: `${dateIso}T${time}`, date: dateIso, time, label: `${formatDay(date)}, ${formatTime(minutes)}` });
  }

  return slots;
}

/**
 * What to put in front of the guest.
 *
 * Their preferred day comes first when they named one and something is free on it. The rest fills
 * from the following days, so there is always something to offer rather than a dead end.
 */
export function offerSlots(
  preferredDate: string | null | undefined,
  durationMinutes: number,
  options: { from?: Date; limit?: number } = {},
): Slot[] {
  const { from = new Date(), limit = 4 } = options;
  const today = startOfDay(from);
  const offered: Slot[] = [];

  const preferred = preferredDate ? parseDate(preferredDate) : null;
  if (preferred && startOfDay(preferred) >= today) {
    offered.push(...slotsFor(toIso(preferred), durationMinutes).slice(0, 2));
  }

  // Guests book ahead, not same day, so start from tomorrow and look a fortnight out.
  for (let dayOffset = 1; dayOffset <= 14 && offered.length < limit; dayOffset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset);
    const iso = toIso(day);
    if (preferred && iso === toIso(preferred)) continue;
    const [first] = slotsFor(iso, durationMinutes);
    if (first) offered.push(first);
  }

  return offered.slice(0, limit);
}

export function findSlot(offered: Slot[], id: string | null | undefined): Slot | null {
  if (!id) return null;
  return offered.find((s) => s.id === id) ?? null;
}

/**
 * Whether a treatment of this length actually finishes before closing from this start time.
 *
 * Times are offered before the treatment has been chosen, rounded up to the longest candidate, so
 * this normally passes. It earns its place when the assistant recommends across categories, say a
 * half day to someone who ticked "massage", where the slot was only ever long enough for a massage.
 */
export function slotFits(slot: Slot, durationMinutes: number) {
  const [hours, minutes] = slot.time.split(":").map(Number);
  return hours * 60 + minutes + durationMinutes <= CLOSE_HOUR * 60;
}
