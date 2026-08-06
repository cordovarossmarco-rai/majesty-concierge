import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, leads, leadAi, automationRuns } from "@/lib/db";
import { findService } from "@/lib/catalog";
import type { Slot } from "@/lib/availability";
import { PriorityPill, Pill, RunStatus, SectionHeader, SimulatedNote, actionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "booked", "closed"] as const;

function parseSlots(raw: string | null): Slot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(leads)
    .leftJoin(leadAi, eq(leadAi.leadId, leads.id))
    .where(eq(leads.id, id));

  if (!row) notFound();

  const lead = row.leads;
  const ai = row.lead_ai;
  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.leadId, id))
    .orderBy(asc(automationRuns.ranAt));

  const service = findService(ai?.serviceInterest ?? null);
  const slots = parseSlots(ai?.proposedSlots ?? null);

  async function setStatus(formData: FormData) {
    "use server";
    const next = String(formData.get("status"));
    if (!STATUSES.includes(next as (typeof STATUSES)[number])) return;
    await db
      .update(leads)
      .set({ status: next as (typeof STATUSES)[number] })
      .where(eq(leads.id, id));
    revalidatePath(`/admin/${id}`);
    revalidatePath("/admin");
  }

  async function saveDraft(formData: FormData) {
    "use server";
    const text = String(formData.get("draftResponse") ?? "").trim();
    if (!text) return;
    await db.update(leadAi).set({ draftResponse: text }).where(eq(leadAi.leadId, id));
    revalidatePath(`/admin/${id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <Link href="/admin" className="text-[14px] text-ink-soft underline-offset-2 hover:underline">
        ← All enquiries
      </Link>

      <header className="mt-6 mb-8 border-b border-line pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-light sm:text-4xl">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              {lead.email} · {lead.phone} · prefers {lead.contactMethod}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <PriorityPill priority={ai?.priority ?? null} />
            {ai?.needsStaff && <Pill tone="flag">needs a person</Pill>}
            {lead.hasGroupon && <Pill tone="quiet">Groupon</Pill>}
          </div>
        </div>
      </header>

      {ai?.escalationReason && (
        <section className="mb-8 border border-line-strong bg-paper-raised px-5 py-4">
          <SectionHeader>Why this was held back</SectionHeader>
          <p className="text-[15px] leading-relaxed">{ai.escalationReason}</p>
        </section>
      )}

      <section className="mb-8">
        <SectionHeader>What they wrote</SectionHeader>
        <blockquote className="border-l-2 border-line-strong bg-paper-raised px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap">
          {lead.message}
        </blockquote>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-3">
          <Detail label="Treatment type" value={lead.serviceCategory} />
          <Detail label="Preferred date" value={lead.preferredDate} />
          <Detail label="Preferred time" value={lead.preferredTime} />
          <Detail label="Heard about us" value={lead.heardAbout} />
        </dl>
      </section>

      {!ai ? (
        <section className="mb-8 border border-line bg-paper-raised px-5 py-6">
          <p className="text-[15px] text-ink-soft italic">
            This enquiry is still being read. The guest has already been thanked, so nothing is
            waiting on it. Refresh in a moment.
          </p>
        </section>
      ) : (
        <>
          <section className="mb-8">
            <SectionHeader>What the assistant made of it</SectionHeader>
            <p className="text-[15px] leading-relaxed">{ai.summary}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-3">
              <Detail label="Category" value={ai.category} />
              <Detail label="Suggested treatment" value={service?.name ?? null} />
              <Detail label="Next step" value={actionLabel(ai.nextAction)} />
            </dl>
          </section>

          <section className="mb-8">
            <SectionHeader>Times offered</SectionHeader>
            {slots.length > 0 ? (
              <ul className="space-y-1.5 text-[15px]">
                {slots.map((slot) => (
                  <li key={slot.id} className="border border-line bg-paper-raised px-4 py-2.5">
                    {slot.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-soft">
                None. Either nothing suitable was free, or this enquiry needed a person first.
              </p>
            )}
            <div className="mt-3">
              <SimulatedNote>
                Availability is generated for the prototype, not read from the spa&apos;s calendar,
                and no time is held.
              </SimulatedNote>
            </div>
          </section>

          <section className="mb-8">
            <SectionHeader>Draft reply</SectionHeader>
            <form action={saveDraft}>
              <textarea
                name="draftResponse"
                defaultValue={ai.draftResponse}
                rows={7}
                aria-label="Draft reply to the guest"
                className="w-full border border-line bg-paper-raised px-4 py-3 text-[15px] leading-relaxed focus:border-line-strong"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="bg-accent px-5 py-2.5 text-[14px] font-medium text-paper-raised transition-all hover:bg-accent-hover active:translate-y-px"
                >
                  Save edits
                </button>
                <SimulatedNote>
                  Edit before it goes anywhere. Nothing is sent from this prototype.
                </SimulatedNote>
              </div>
            </form>
          </section>

          <section className="mb-8">
            <SectionHeader>What ran</SectionHeader>
            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[520px] border-collapse bg-paper-raised text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] tracking-[0.08em] text-ink-soft uppercase">
                    <th className="px-4 py-2.5 font-semibold">Step</th>
                    <th className="px-4 py-2.5 font-semibold">Result</th>
                    <th className="px-4 py-2.5 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-ink-soft">
                        Nothing has run yet.
                      </td>
                    </tr>
                  ) : (
                    runs.map((run) => (
                      <tr key={run.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 align-top font-medium whitespace-nowrap">
                          {run.step.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <RunStatus status={run.status} />
                        </td>
                        <td className="px-4 py-3 align-top text-ink-soft">{run.detail}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="border-t border-line pt-6">
        <SectionHeader>Status</SectionHeader>
        <form action={setStatus} className="flex flex-wrap items-center gap-3">
          <label htmlFor="status" className="sr-only">
            Lead status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={lead.status}
            className="border border-line bg-paper-raised px-3 py-2 text-[15px] capitalize focus:border-line-strong"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit" className="border border-line-strong px-4 py-2 text-[14px] hover:border-ink">
            Update
          </button>
        </form>
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-ink-soft">—</span>}</dd>
    </div>
  );
}
