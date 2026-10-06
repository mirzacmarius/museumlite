import Image from "next/image";
import { SectionLabel } from "@/components/site/section-label";
import { getWebI18n } from "@/locales/server";

export async function ExhibitionsShowcase() {
  const { t } = await getWebI18n();
  const highlights = [
    {
      title: t("marketing.exhibitions.floorplan"),
      detail: t("marketing.exhibitions.detail1"),
    },
    {
      title: t("marketing.exhibitions.labelExport"),
      detail: t("marketing.exhibitions.detail2"),
    },
    {
      title: t("marketing.exhibitions.installSchedule"),
      detail: t("marketing.exhibitions.detail3"),
    },
  ];
  return (
    <section
      id="exhibitions"
      className="relative scroll-mt-24 py-16 md:py-28 border-b border-border overflow-hidden"
    >
      <div className="absolute inset-0 bg-spotlight pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-3xl mb-12 md:mb-16">
          <SectionLabel index="II." title={t("marketing.exhibitions.alt")} />
          <h2 className="mt-6 font-display text-4xl md:text-5xl lg:text-6xl text-ivory text-balance leading-[0.95]">
            {t("marketing.exhibitions.headingStart")}{" "}
            <em className="not-italic text-gold">
              {t("marketing.exhibitions.headingEnd")}
            </em>
          </h2>
          <p className="mt-6 text-lg text-soft-foreground leading-relaxed">
            {t("marketing.exhibitions.body")}
          </p>
        </div>

        <div className="exhibitions-showcase-grid">
          <div className="exhibitions-showcase-media relative min-h-[280px] sm:min-h-[360px] lg:min-h-full">
            <Image
              src="/marketing/artifact-frame.jpg"
              alt={t("marketing.exhibitions.imageAlt")}
              fill
              loading="lazy"
              quality={70}
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-vignette opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-background/40" />
          </div>

          <article className="feature-module-card exhibitions-showcase-panel flex flex-col justify-center gap-6 p-8 md:p-10 lg:p-12">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-gold">
                {t("marketing.exhibitions.sectionTitle")}
              </p>
              <h3 className="font-display text-3xl md:text-4xl text-ivory leading-[1.05]">
                {t("marketing.exhibitions.sectionHeading")}
              </h3>
              <p className="text-soft-foreground leading-relaxed">
                {t("marketing.exhibitions.sectionBody")}
              </p>
            </div>
            <ul className="pt-6 border-t border-gold/20 space-y-3">
              {highlights.map((item) => (
                <li
                  key={item.title}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="text-ivory uppercase tracking-[0.2em] text-xs">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground text-[10px] uppercase tracking-[0.18em] text-right">
                    {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
