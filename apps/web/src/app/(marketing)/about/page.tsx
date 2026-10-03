import Image from "next/image";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader, SectionLabel } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";
import { getWebI18n } from "@/locales/server";

export async function generateMetadata() {
  const { locale, t } = await getWebI18n();
  return createPageMetadata({
    title: t("marketing.about.title"),
    description: t("marketing.about.description"),
    path: "/about",
    locale,
  });
}

export default async function AboutPage() {
  const { t } = await getWebI18n();
  const principles = (
    [
      ["marketing.about.principle1Title", "marketing.about.principle1Body"],
      ["marketing.about.principle2Title", "marketing.about.principle2Body"],
      ["marketing.about.principle3Title", "marketing.about.principle3Body"],
    ] as const
  ).map(([titleKey, bodyKey]) => ({
    title: t(titleKey),
    body: t(bodyKey),
  }));
  const milestones = [
    ["2024", t("marketing.about.milestone2024")],
    ["2025", t("marketing.about.milestone2025")],
    [t("marketing.about.whereHeading"), t("marketing.about.milestoneToday")],
  ] as const;
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow={t("marketing.about.title")}
          title={
            <>
              {t("marketing.about.titleLine1")}{" "}
              <span className="text-gold">
                {t("marketing.about.titleLine2")}
              </span>
            </>
          }
          lede={t("marketing.about.lede")}
        />

        <section className="py-16 md:py-24 border-b border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-6">
              <div className="relative aspect-[4/3] overflow-hidden border border-border shadow-gallery">
                <Image
                  src="/marketing/hero-gallery.jpg"
                  alt={t("marketing.about.imageAlt")}
                  fill
                  loading="lazy"
                  quality={70}
                  sizes="(max-width: 768px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="md:col-span-6 space-y-5 text-soft-foreground leading-relaxed md:pt-4">
              <SectionLabel
                index={t("marketing.about.mission")}
                title={t("marketing.about.kicker")}
              />
              <h2 className="font-display text-3xl text-ivory">
                {t("marketing.about.heading")}
              </h2>
              <p>{t("marketing.about.body")}</p>
              <p>{t("marketing.about.stage")}</p>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 border-b border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <SectionLabel
              index={t("marketing.about.values")}
              title={t("marketing.about.workHeading")}
            />
            <div className="mt-10 grid md:grid-cols-3 gap-6">
              {principles.map((p) => (
                <article
                  key={p.title}
                  className="border border-border bg-card p-8"
                >
                  <h3 className="font-display text-xl text-ivory">{p.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {p.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <SectionLabel
              index={t("marketing.about.timeline")}
              title={t("marketing.about.whereHeading")}
            />
            <h2 className="mt-6 font-display text-3xl text-ivory mb-10">
              {t("marketing.about.historyHeading")}
            </h2>
            <ol className="space-y-0 border border-border overflow-hidden divide-y divide-border">
              {milestones.map(([y, t]) => (
                <li
                  key={y}
                  className="bg-card p-6 grid sm:grid-cols-12 gap-4 items-baseline"
                >
                  <span className="sm:col-span-3 font-display text-2xl text-gold">
                    {y}
                  </span>
                  <span className="sm:col-span-9 text-soft-foreground">
                    {t}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
