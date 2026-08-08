import { InquiryForm } from "@/components/inquiry-form";

export default function Home() {
  return (
    <>
      <div className="page-ground" aria-hidden />

      <main className="mx-auto w-full max-w-[760px] px-5 py-12 sm:px-8 sm:py-16">
        <header className="rise mb-8 px-1 sm:mb-10">
          <p className="font-display text-[13px] tracking-[0.3em] text-ink-soft uppercase">
            Majesty Day Spa
          </p>
          <h1 className="mt-5 font-display text-[2.5rem] leading-[1.05] font-light sm:text-[3.5rem]">
            Tell us what you are looking for
          </h1>
          <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.75] text-ink-soft">
            Whether you know exactly which treatment you want or you would rather we helped you
            choose, send us a note. Someone will read it and come back to you.
          </p>
        </header>

        <InquiryForm />

        <footer className="mt-8 px-1 text-[13px] leading-relaxed text-ink-soft">
          We use what you tell us here to prepare for your visit and nothing else.
        </footer>
      </main>
    </>
  );
}
