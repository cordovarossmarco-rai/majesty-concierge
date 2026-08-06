import { InquiryForm } from "@/components/inquiry-form";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <header className="mb-12">
        <p className="font-display text-[15px] tracking-[0.2em] text-ink-soft uppercase">
          Majesty Day Spa
        </p>
        <h1 className="mt-5 font-display text-4xl font-light leading-[1.1] sm:text-5xl">
          Tell us what you are looking for
        </h1>
        <p className="mt-5 max-w-[54ch] text-[15px] leading-relaxed text-ink-soft">
          Whether you know exactly which treatment you want or you would rather we helped you
          choose, send us a note and someone will come back to you.
        </p>
      </header>

      <InquiryForm />

      <footer className="mt-14 border-t border-line pt-6 text-[13px] leading-relaxed text-ink-soft">
        We use what you tell us here to prepare for your visit and nothing else.
      </footer>
    </main>
  );
}
