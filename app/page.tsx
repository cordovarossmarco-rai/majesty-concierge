import { InquiryForm } from "@/components/inquiry-form";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-8 sm:py-24">
      <header className="rise mb-14 sm:mb-16">
        <p className="font-display text-[13px] tracking-[0.28em] text-ink-soft uppercase">
          Majesty Day Spa
        </p>
        <h1 className="mt-6 font-display text-[2.5rem] leading-[1.08] font-light sm:text-[3.25rem]">
          Tell us what you are
          <br />
          looking for
        </h1>
        <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.7] text-ink-soft">
          Whether you know exactly which treatment you want or you would rather we helped you
          choose, send us a note. Someone will read it and come back to you.
        </p>
      </header>

      <div className="rise" style={{ animationDelay: "80ms" }}>
        <InquiryForm />
      </div>

      <footer className="mt-16 border-t border-line pt-6 text-[13px] leading-relaxed text-ink-soft">
        We use what you tell us here to prepare for your visit and nothing else.
      </footer>
    </main>
  );
}
