import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, leads, leadAi } from "@/lib/db";
import { PriorityPill, Pill, SectionHeader, actionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "booked", "closed"] as const;
const PRIORITIES = ["hot", "warm", "general"] as const;

function when(iso: Date) {
  return iso.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Preserves the filters already applied while changing one of them. */
function href(current: Record<string, string | undefined>, change: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...change })) if (v) params.set(k, v);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>;
}) {
  const params = await searchParams;
  const { status, priority, q } = params;

  const filters: SQL[] = [];
  if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
    filters.push(eq(leads.status, status as (typeof STATUSES)[number]));
  }
  if (priority && PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
    filters.push(eq(leadAi.priority, priority as (typeof PRIORITIES)[number]));
  }
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    const match = or(
      ilike(leads.firstName, term),
      ilike(leads.lastName, term),
      ilike(leads.email, term),
      ilike(leads.message, term),
      ilike(leadAi.summary, term),
    );
    if (match) filters.push(match);
  }

  // A left join, because a lead that has only just arrived has no reading yet and still has to
  // appear in this list. Dropping it until the model catches up would look like losing enquiries.
  const rows = await db
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      createdAt: leads.createdAt,
      status: leads.status,
      hasGroupon: leads.hasGroupon,
      summary: leadAi.summary,
      category: leadAi.category,
      priority: leadAi.priority,
      needsStaff: leadAi.needsStaff,
      nextAction: leadAi.nextAction,
      serviceInterest: leadAi.serviceInterest,
    })
    .from(leads)
    .leftJoin(leadAi, eq(leadAi.leadId, leads.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(leads.createdAt));

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      flagged: sql<number>`count(*) filter (where ${leadAi.needsStaff})::int`,
      hot: sql<number>`count(*) filter (where ${leadAi.priority} = 'hot')::int`,
      unread: sql<number>`count(*) filter (where ${leadAi.leadId} is null)::int`,
    })
    .from(leads)
    .leftJoin(leadAi, eq(leadAi.leadId, leads.id));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <header className="mb-8">
        <p className="font-display text-[13px] tracking-[0.2em] text-ink-soft uppercase">Majesty Day Spa</p>
        <h1 className="mt-3 font-display text-3xl font-light sm:text-4xl">Enquiries</h1>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        <Figure label="Enquiries" value={totals.total} />
        <Figure label="Needing a person" value={totals.flagged} />
        <Figure label="Hot" value={totals.hot} />
        <Figure label="Still being read" value={totals.unread} />
      </section>

      <section className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-soft">Status</span>
          <FilterLink label="All" active={!status} to={href(params, { status: undefined })} />
          {STATUSES.map((s) => (
            <FilterLink key={s} label={s} active={status === s} to={href(params, { status: s })} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-soft">Priority</span>
          <FilterLink label="All" active={!priority} to={href(params, { priority: undefined })} />
          {PRIORITIES.map((p) => (
            <FilterLink key={p} label={p} active={priority === p} to={href(params, { priority: p })} />
          ))}
        </div>
        <form action="/admin" className="flex flex-wrap gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {priority && <input type="hidden" name="priority" value={priority} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, email or message"
            aria-label="Search enquiries"
            className="min-w-0 flex-1 border border-line bg-paper-raised px-3 py-2 text-[14px] focus:border-line-strong"
          />
          <button type="submit" className="border border-line-strong px-4 py-2 text-[14px] hover:border-ink">
            Search
          </button>
          {q && (
            <Link href={href(params, { q: undefined })} className="px-3 py-2 text-[14px] text-ink-soft underline">
              Clear
            </Link>
          )}
        </form>
      </section>

      <SectionHeader>
        {rows.length} {rows.length === 1 ? "enquiry" : "enquiries"}
      </SectionHeader>

      {rows.length === 0 ? (
        <p className="border border-line bg-paper-raised px-5 py-10 text-center text-[15px] text-ink-soft">
          Nothing matches that. Try clearing the filters.
        </p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[860px] border-collapse bg-paper-raised text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] tracking-[0.08em] text-ink-soft uppercase">
                <Th>Guest</Th>
                <Th>Arrived</Th>
                <Th>Priority</Th>
                <Th>What they want</Th>
                <Th>Next step</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <Td>
                    <Link href={`/admin/${row.id}`} className="font-medium underline-offset-2 hover:underline">
                      {row.firstName} {row.lastName}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {row.needsStaff && <Pill tone="flag">needs a person</Pill>}
                      {row.hasGroupon && <Pill tone="quiet">Groupon</Pill>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">{when(row.createdAt)}</Td>
                  <Td>
                    <PriorityPill priority={row.priority} />
                  </Td>
                  <Td>
                    {row.summary ? (
                      <>
                        <span className="line-clamp-2">{row.summary}</span>
                        <span className="mt-1 block text-[13px] text-ink-soft">
                          {row.category}
                          {row.serviceInterest ? ` · ${row.serviceInterest}` : ""}
                        </span>
                      </>
                    ) : (
                      // The reading happens after the guest is thanked, so for a few seconds
                      // there is a lead with nothing attached to it. Say what is going on.
                      <span className="text-ink-soft italic">Being read…</span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">{actionLabel(row.nextAction)}</Td>
                  <Td>
                    <Pill tone={row.status === "closed" || row.status === "booked" ? "done" : "quiet"}>
                      {row.status}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper-raised px-4 py-4">
      <div className="font-display text-3xl font-light">{value}</div>
      <div className="mt-1 text-[13px] text-ink-soft">{label}</div>
    </div>
  );
}

function FilterLink({ label, active, to }: { label: string; active: boolean; to: string }) {
  return (
    <Link
      href={to}
      className={`border px-3 py-1 text-[13px] capitalize transition-colors ${
        active ? "border-accent bg-accent text-paper-raised" : "border-line text-ink hover:border-line-strong"
      }`}
    >
      {label}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
