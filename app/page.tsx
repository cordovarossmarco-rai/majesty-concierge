import Image from "next/image";
import { InquiryForm } from "@/components/inquiry-form";

/*
  Two columns on a wide screen: the form on the left, the room itself on the right. On anything
  narrower the imagery drops away rather than being squeezed, because a photograph shrunk into a
  phone-width strip stops being atmosphere and starts being clutter above the thing the guest
  actually came to do.
*/
export default function Home() {
  return (
    <>
      <div className="page-ground" aria-hidden />

      <main className="mx-auto w-full max-w-[1500px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
          <section className="rise glass px-6 py-10 sm:px-10 sm:py-14">
            <header className="mb-12">
              <p className="font-display text-[13px] tracking-[0.3em] text-ink-soft uppercase">
                Majesty Day Spa
              </p>
              <h1 className="mt-6 font-display text-[2.5rem] leading-[1.05] font-light sm:text-[3.5rem]">
                Tell us what you are
                <br />
                looking for
              </h1>
              <p className="mt-6 max-w-[50ch] text-[15px] leading-[1.75] text-ink-soft">
                Whether you know exactly which treatment you want or you would rather we helped you
                choose, send us a note. Someone will read it and come back to you.
              </p>
            </header>

            <InquiryForm />

            <footer className="mt-14 border-t border-line pt-6 text-[13px] leading-relaxed text-ink-soft">
              We use what you tell us here to prepare for your visit and nothing else.
            </footer>
          </section>

          <aside className="rise hidden lg:block" style={{ animationDelay: "120ms" }}>
            <div className="sticky top-14 space-y-5">
              <Figure
                src="/images/spa-pool.jpg"
                alt="Sunlight across the water of the spa's indoor pool"
                width={736}
                height={1104}
                className="aspect-[3/4]"
                priority
              />
              <div className="grid grid-cols-2 gap-5">
                <Figure
                  src="/images/treatment.jpg"
                  alt="Warm oil poured for a massage treatment"
                  width={736}
                  height={1103}
                  className="aspect-square"
                />
                <Figure
                  src="/images/water.jpg"
                  alt="A guest floating at the surface of the pool"
                  width={663}
                  height={993}
                  className="aspect-square"
                />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Figure({
  src,
  alt,
  width,
  height,
  className,
  priority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(max-width: 1024px) 0px, 40vw"
        className="h-full w-full object-cover"
      />
      {/* A hairline over the photograph so it sits in the same material language as the glass. */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/20 ring-inset" />
    </div>
  );
}
