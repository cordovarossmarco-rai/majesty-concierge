"use client";

import { useState, type ReactNode } from "react";
import { inquirySchema, serviceCategories, type InquiryInput } from "@/lib/validation";

const empty: InquiryInput = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  heardAbout: "",
  hasGroupon: false,
  serviceCategory: undefined,
  preferredDate: "",
  preferredTime: "",
  message: "",
  contactMethod: "email",
};

const CATEGORY_LABEL: Record<string, string> = {
  massage: "Massage",
  facial: "Facial",
  body: "Body treatment",
  package: "Package or spa day",
};

/*
  One field style, one label style. Repeating these inline is how two inputs end up a pixel apart.
  Fields are translucent so they read as part of the tile rather than white cards floating on it,
  and they share the one radius scale defined alongside the tiles.
*/
const field =
  "w-full rounded-[var(--r-field)] bg-[var(--field-bg)] border border-line px-3.5 py-3 " +
  "text-[15px] text-ink placeholder:text-ink-soft/60 hover:border-line-strong " +
  "transition-[border-color,box-shadow] duration-200";
const label = "block text-[13px] font-medium tracking-[0.01em] text-ink mb-2";

export function InquiryForm() {
  const [values, setValues] = useState<InquiryInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function set<K extends keyof InquiryInput>(key: K, value: InquiryInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inquirySchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      // Put the first problem in view rather than leaving them to hunt for it.
      document
        .querySelector<HTMLElement>(`[data-field="${Object.keys(next)[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rise glass px-7 py-14 sm:px-14 sm:py-20">
        <h2 className="font-display text-[2rem] leading-tight font-light sm:text-[2.75rem]">
          Thank you, {values.firstName}.
        </h2>
        <p className="mt-5 max-w-[54ch] text-[15px] leading-[1.75] text-ink-soft">
          We have your enquiry. Someone from the spa will be in touch by{" "}
          {values.contactMethod === "email" ? "email" : values.contactMethod} to confirm the details
          and find a time that works.
        </p>
        <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-ink-soft">
          Nothing is booked yet. A person reads every enquiry before we confirm anything.
        </p>
      </div>
    );
  }

  const busy = state === "sending";

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      <Tile title="Your details" className="rise">
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="firstName" label="First name" error={errors.firstName}>
              <input id="firstName" className={field} value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
            </Field>
            <Field id="lastName" label="Last name" error={errors.lastName}>
              <input id="lastName" className={field} value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="phone" label="Phone" error={errors.phone}>
              <input id="phone" type="tel" className={field} value={values.phone}
                onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <input id="email" type="email" className={field} value={values.email}
                onChange={(e) => set("email", e.target.value)} autoComplete="email" />
            </Field>
          </div>

          <Field id="heardAbout" label="How did you hear about us" hint="Optional">
            <input id="heardAbout" className={field} value={values.heardAbout ?? ""}
              onChange={(e) => set("heardAbout", e.target.value)} />
          </Field>
        </fieldset>
      </Tile>

      <Tile title="What you are looking for" className="rise" delay="70ms">
        <fieldset disabled={busy} className="space-y-5">
          <Field id="serviceCategory" label="Type of treatment" hint="Optional, we can help you choose">
            <select id="serviceCategory" className={field} value={values.serviceCategory ?? ""}
              onChange={(e) =>
                set("serviceCategory", (e.target.value || undefined) as InquiryInput["serviceCategory"])
              }>
              <option value="">Not sure yet</option>
              {serviceCategories.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
              ))}
            </select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="preferredDate" label="Preferred date" hint="Optional">
              <input id="preferredDate" type="date" className={field} value={values.preferredDate ?? ""}
                onChange={(e) => set("preferredDate", e.target.value)} />
            </Field>
            <Field id="preferredTime" label="Preferred time" hint="Optional">
              <input id="preferredTime" type="time" className={field} value={values.preferredTime ?? ""}
                onChange={(e) => set("preferredTime", e.target.value)} />
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" checked={values.hasGroupon}
              onChange={(e) => set("hasGroupon", e.target.checked)}
              className="mt-1 h-4 w-4 accent-accent" />
            <span>I have a Groupon voucher</span>
          </label>
        </fieldset>
      </Tile>

      <Tile title="Tell us what you need" className="rise lg:col-span-2" delay="140ms">
        <fieldset disabled={busy}>
          <Field id="message" label="In your own words" error={errors.message}>
            <textarea id="message" rows={5} className={field} value={values.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="What you are hoping for, anything we should know, and when you would like to come in." />
          </Field>
        </fieldset>
      </Tile>

      <Tile className="rise lg:col-span-2" delay="210ms">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          {/* legend has to be the first child of its own fieldset, so the button sits outside it */}
          <fieldset disabled={busy}>
            <legend className={label}>How should we reach you</legend>
            <div className="flex flex-wrap gap-2">
              {(["phone", "text", "email"] as const).map((m) => (
                <label key={m}
                  className={`cursor-pointer rounded-full border px-5 py-2.5 text-[15px] capitalize transition-all duration-200 ${
                    values.contactMethod === m
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-line bg-[var(--field-bg)] text-ink hover:border-line-strong"
                  }`}>
                  <input type="radio" name="contactMethod" value={m} className="sr-only"
                    checked={values.contactMethod === m}
                    onChange={() => set("contactMethod", m)} />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" disabled={busy}
            className="w-full rounded-full bg-accent px-8 py-3.5 text-[15px] font-medium
              tracking-[0.01em] text-white transition-all duration-200 hover:bg-accent-hover
              active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto">
            {busy ? "Sending" : "Send enquiry"}
          </button>
        </div>
      </Tile>

      {state === "error" && (
        <p role="alert"
          className="glass lg:col-span-2 px-5 py-4 text-[14px]">
          Something went wrong sending that. Please try again, or call the spa directly.
        </p>
      )}
    </form>
  );
}

function Tile({
  title,
  children,
  className = "",
  delay,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  delay?: string;
}) {
  return (
    <section className={`glass px-6 py-7 sm:px-8 sm:py-8 ${className}`} style={delay ? { animationDelay: delay } : undefined}>
      {title && (
        <h2 className="mb-6 text-[12px] font-semibold tracking-[0.14em] text-ink-soft uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Field({ id, label: text, hint, error, children }: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div data-field={id}>
      <label htmlFor={id} className={label}>
        {text}
        {hint && <span className="ml-2 font-normal text-ink-soft">{hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-[13px] text-ink">{error}</p>}
    </div>
  );
}
