"use client";

import { useState } from "react";
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

const field = "w-full bg-paper-raised border border-line px-3 py-2.5 text-[15px] text-ink " +
  "placeholder:text-ink-soft/70 focus:border-line-strong transition-colors";
const label = "block text-[13px] font-medium text-ink mb-1.5";

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
      document.querySelector<HTMLElement>(`[data-field="${Object.keys(next)[0]}"]`)
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
      <div className="border border-line bg-paper-raised px-6 py-10 sm:px-10">
        <h2 className="font-display text-3xl font-light">Thank you, {values.firstName}.</h2>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
          We have your enquiry. Someone from the spa will be in touch by{" "}
          {values.contactMethod === "email" ? "email" : values.contactMethod} to confirm the details
          and find a time that works.
        </p>
        <p className="mt-6 border-t border-line pt-6 text-[13px] text-ink-soft">
          Nothing is booked yet. A person reads every enquiry before we confirm anything.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <fieldset className="space-y-5" disabled={state === "sending"}>
        <legend className="sr-only">Your details</legend>

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

      <fieldset className="space-y-5 border-t border-line pt-8" disabled={state === "sending"}>
        <legend className="font-display text-xl font-light">What you are looking for</legend>

        <Field id="serviceCategory" label="Type of treatment" hint="Optional, we can help you choose">
          <select id="serviceCategory" className={field} value={values.serviceCategory ?? ""}
            onChange={(e) => set("serviceCategory", (e.target.value || undefined) as InquiryInput["serviceCategory"])}>
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

        <Field id="message" label="Tell us what you need" error={errors.message}>
          <textarea id="message" rows={5} className={field} value={values.message}
            onChange={(e) => set("message", e.target.value)} />
        </Field>

        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" checked={values.hasGroupon}
            onChange={(e) => set("hasGroupon", e.target.checked)}
            className="mt-1 h-4 w-4 accent-accent" />
          <span>I have a Groupon voucher</span>
        </label>

        <fieldset>
          <legend className={label}>How should we reach you</legend>
          <div className="flex flex-wrap gap-2">
            {(["phone", "text", "email"] as const).map((m) => (
              <label key={m}
                className={`cursor-pointer border px-4 py-2 text-[15px] capitalize transition-colors ${
                  values.contactMethod === m
                    ? "border-accent bg-accent text-paper-raised"
                    : "border-line text-ink hover:border-line-strong"
                }`}>
                <input type="radio" name="contactMethod" value={m} className="sr-only"
                  checked={values.contactMethod === m}
                  onChange={() => set("contactMethod", m)} />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      {state === "error" && (
        <p role="alert" className="border border-line-strong px-4 py-3 text-[14px]">
          Something went wrong sending that. Please try again, or call the spa directly.
        </p>
      )}

      <button type="submit" disabled={state === "sending"}
        className="w-full bg-accent px-6 py-3.5 text-[15px] font-medium text-paper-raised
          transition-all hover:bg-accent-hover active:translate-y-px disabled:opacity-60 sm:w-auto">
        {state === "sending" ? "Sending" : "Send enquiry"}
      </button>
    </form>
  );
}

function Field({ id, label: text, hint, error, children }: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
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
