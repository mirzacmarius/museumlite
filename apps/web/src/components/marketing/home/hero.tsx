import Image from "next/image";
import Link from "next/link";

const capabilities = [
  {
    title: "Collections",
    detail: "Accessions & catalog",
    href: "/features#collections",
  },
  {
    title: "Exhibitions",
    detail: "Loans & installations",
    href: "/features#exhibitions",
  },
  {
    title: "Conservation",
    detail: "Treatments & environment",
    href: "/features#conservation",
  },
  {
    title: "Public portal",
    detail: "Publish when ready",
    href: "/features",
  },
] as const;

export function HomeHero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background grain">
      <Image
        src="/marketing/hero-gallery.jpg"
        alt="Grand museum gallery illuminated at dusk"
        fill
        priority
        quality={65}
        sizes="(max-width: 768px) 100vw, 1920px"
        className="hero-photo object-cover"
      />
      <div className="hero-vignette absolute inset-0 bg-vignette" aria-hidden />
      <div className="hero-fade absolute inset-0 bg-hero-fade" aria-hidden />
      <div className="hero-text-scrim pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(72vh,720px)]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 pt-44 pb-52 md:pb-60">
        <div className="animate-hero-enter flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-gold mb-10">
          <span className="hero-rule-animate h-px w-10 bg-gold/60" />
          Museum collection management
        </div>

        <h1 className="animate-hero-enter animate-hero-delay-1 font-display text-[12vw] sm:text-[10vw] md:text-[8rem] leading-[0.88] text-balance text-ivory max-w-5xl">
          The quiet
          <br />
          <em className="not-italic text-gold">order</em> behind
          <br />
          great museums.
        </h1>

        <div className="mt-12 grid md:grid-cols-12 gap-8 items-end">
          <p className="animate-hero-enter animate-hero-delay-2 md:col-span-5 text-lg leading-relaxed text-soft-foreground max-w-md">
            MuseumLite unifies collections, exhibitions, conservation, and
            library workflows in one workspace — structured records instead of
            scattered spreadsheets, built for registrars and curators.
          </p>
          <div className="animate-hero-enter animate-hero-delay-3 md:col-span-4 md:col-start-9 flex flex-col gap-4">
            <Link
              href="/contact"
              className="btn-marketing group inline-flex h-14 w-full items-center justify-between border border-gold bg-gold/95 px-6 text-ink text-xs uppercase tracking-[0.3em] hover:bg-transparent hover:text-gold transition-colors"
            >
              Request a tour
              <span className="ml-4">→</span>
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-gold px-2"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ivory/40 text-ivory"
              >
                <svg
                  width="10"
                  height="12"
                  viewBox="0 0 10 12"
                  fill="currentColor"
                  className="translate-x-[1.5px]"
                >
                  <path d="M0 0v12l10-6L0 0z" />
                </svg>
              </span>
              Tour the platform
            </Link>
          </div>
        </div>
      </div>

      <div className="hero-cap-bar hero-cap-bar-enter absolute bottom-0 left-0 right-0 z-10 border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8 md:py-10">
          <p className="text-center text-[10px] uppercase tracking-[0.45em] text-gold/80 mb-6 md:mb-8">
            One workspace · Four disciplines
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/50">
            {capabilities.map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="hero-cap-item group flex flex-col gap-1.5 px-5 py-6 md:px-7 md:py-7 transition-colors"
              >
                <span className="text-xs uppercase tracking-[0.28em] text-ivory group-hover:text-gold transition-colors">
                  {c.title}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {c.detail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
