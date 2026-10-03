import Image from "next/image";
import Link from "next/link";
import { getWebI18n } from "@/locales/server";

export async function HomeHero() {
  const { t } = await getWebI18n();
  const capabilities = [
    {
      title: t("marketing.home.capabilityCollections"),
      detail: t("marketing.home.capabilityAccession"),
      href: "/features#collections",
    },
    {
      title: t("marketing.home.capabilityExhibitions"),
      detail: t("marketing.home.capabilityLoans"),
      href: "/features#exhibitions",
    },
    {
      title: t("marketing.home.capabilityConservation"),
      detail: t("marketing.home.capabilityTreatments"),
      href: "/features#conservation",
    },
    {
      title: t("marketing.home.capabilityPortal"),
      detail: t("marketing.home.capabilityPublish"),
      href: "/features",
    },
  ];
  return (
    <section className="hero-overlay relative flex min-h-dvh flex-col overflow-hidden bg-background grain">
      <Image
        src="/marketing/hero-gallery.jpg"
        alt={t("marketing.home.heroAlt")}
        fill
        priority
        quality={65}
        sizes="(max-width: 768px) 100vw, 1920px"
        className="hero-photo object-cover"
      />
      <div className="hero-vignette absolute inset-0 bg-vignette" aria-hidden />
      <div className="hero-fade absolute inset-0 bg-hero-fade" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 lg:px-10 pt-44 pb-8 md:pb-10">
        <div className="animate-hero-enter flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-gold mb-10">
          <span className="hero-rule-animate h-px w-10 bg-gold/60" />
          {t("marketing.home.heroEyebrow")}
        </div>

        <h1 className="animate-hero-enter animate-hero-delay-1 font-display text-[12vw] sm:text-[10vw] md:text-[8rem] leading-[0.88] text-balance text-ivory max-w-5xl">
          {t("marketing.home.heroTitleStart")}
          <br />
          <em className="not-italic text-gold">
            {t("marketing.home.heroTitleMiddle")}
          </em>{" "}
          {t("marketing.home.heroTitleBehind")}
          <br />
          {t("marketing.home.heroTitleEnd")}
        </h1>

        <div className="mt-auto grid gap-8 pt-10 md:grid-cols-12 md:pt-12 items-end">
          <p className="animate-hero-enter animate-hero-delay-2 md:col-span-5 text-lg leading-relaxed text-soft-foreground max-w-md">
            {t("marketing.home.heroBody")}
          </p>
          <div className="animate-hero-enter animate-hero-delay-3 md:col-span-4 md:col-start-9 flex flex-col gap-4">
            <Link
              href="/contact"
              className="btn-marketing group inline-flex h-14 w-full items-center justify-between border border-gold bg-gold/95 px-6 text-ink text-xs uppercase tracking-[0.3em] hover:bg-transparent hover:text-gold transition-colors"
            >
              {t("marketing.home.requestTour")}
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
              {t("marketing.home.tourPlatform")}
            </Link>
          </div>
        </div>
      </div>

      <div className="hero-cap-bar hero-cap-bar-enter relative z-10 shrink-0 border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8 md:py-10">
          <p className="text-center text-[10px] uppercase tracking-[0.45em] text-gold/80 mb-6 md:mb-8">
            {t("marketing.home.disciplines")}
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
