import type { ReactNode } from "react";

/*
  The small pieces the staff screens are built from.

  They live here rather than being written inline in each page so that a priority looks the same
  colour everywhere, and so changing how a status reads is one edit rather than six.
*/

type Tone = "hot" | "warm" | "general" | "flag" | "quiet" | "done";

const TONE: Record<Tone, string> = {
  hot: "bg-[#8c2f21] text-white",
  warm: "bg-[#a8681f] text-white",
  general: "border border-line-strong text-ink-soft",
  flag: "bg-[#8c2f21] text-white",
  quiet: "border border-line text-ink-soft",
  done: "bg-accent text-paper-raised",
};

export function Pill({ tone = "quiet", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-ink-soft">–</span>;
  const tone = priority === "hot" ? "hot" : priority === "warm" ? "warm" : "general";
  return <Pill tone={tone}>{priority}</Pill>;
}

/** Next actions read badly as raw enum values on a screen someone uses all day. */
const ACTION_LABEL: Record<string, string> = {
  continue_to_booking: "Continue to booking",
  request_more_information: "Ask for more detail",
  send_groupon_instructions: "Send Groupon instructions",
  schedule_staff_callback: "Call the guest back",
  escalate_to_management: "Escalate to management",
};

export function actionLabel(action: string | null) {
  if (!action) return "–";
  return ACTION_LABEL[action] ?? action;
}

const RUN_TONE: Record<string, string> = {
  ok: "text-accent",
  skipped: "text-ink-soft",
  failed: "text-[#8c2f21]",
};

export function RunStatus({ status }: { status: string }) {
  return <span className={`text-[13px] font-medium ${RUN_TONE[status] ?? ""}`}>{status}</span>;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[12px] font-semibold tracking-[0.12em] text-ink-soft uppercase">{children}</h2>
  );
}

/**
 * A quiet aside next to something that could otherwise be misread.
 *
 * Most of these say out loud that a step did not really happen, because a dashboard that looks
 * convincing is exactly the thing that gets mistaken for proof that a guest was contacted.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-soft">{children}</p>
  );
}
