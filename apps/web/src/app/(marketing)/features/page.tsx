import Image from "next/image";
import { ExhibitionsShowcase } from "@/components/marketing/exhibitions-showcase";
import {
  type FeatureModule,
  FeatureModuleCard,
  FeatureModuleGrid,
} from "@/components/marketing/feature-module-card";
import { PrimaryButton } from "@/components/site/buttons";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader, SectionLabel } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";
import type { WebMessageKey } from "@/locales/messages";
import { getWebI18n } from "@/locales/server";

export async function generateMetadata() {
  const { locale, t } = await getWebI18n();
  return createPageMetadata({
    title: t("marketing.features.title"),
    description: t("marketing.features.description"),
    path: "/features",
    locale,
  });
}

export default async function FeaturesPage() {
  const { t } = await getWebI18n();
  const module = (
    title: string,
    desc: string,
    itemKeys: readonly WebMessageKey[],
  ): FeatureModule => ({
    title,
    desc,
    items: itemKeys.map((key) => t(key)),
  });
  const collectionModules: FeatureModule[] = [
    module(
      t("marketing.features.objectCatalog"),
      t("marketing.features.recordBody"),
      [
        "marketing.features.catalogItem1",
        "marketing.features.catalogItem2",
        "marketing.features.catalogItem3",
        "marketing.features.catalogItem4",
      ],
    ),
    module(
      t("marketing.features.accessions"),
      t("marketing.features.collectionBody"),
      [
        "marketing.features.accessionItem1",
        "marketing.features.accessionItem2",
        "marketing.features.accessionItem3",
      ],
    ),
    module(
      t("marketing.features.locations"),
      t("marketing.features.collectionBody"),
      [
        "marketing.features.locationItem1",
        "marketing.features.locationItem2",
        "marketing.features.locationItem3",
      ],
    ),
    module(
      t("marketing.features.loans"),
      t("marketing.exhibitions.sectionBody"),
      [
        "marketing.features.loanItem1",
        "marketing.features.loanItem2",
        "marketing.features.loanItem3",
      ],
    ),
  ];
  const conservationModules: FeatureModule[] = [
    module(
      t("marketing.features.conservation"),
      t("marketing.features.careBody"),
      [
        "marketing.features.conservationItem1",
        "marketing.features.conservationItem2",
        "marketing.features.conservationItem3",
      ],
    ),
    module(t("marketing.features.library"), t("marketing.features.careBody"), [
      "marketing.features.libraryItem1",
      "marketing.features.libraryItem2",
      "marketing.features.libraryItem3",
    ]),
    module(
      t("marketing.features.publicPortal"),
      t("marketing.features.careBody"),
      [
        "marketing.features.portalItem1",
        "marketing.features.portalItem2",
        "marketing.features.portalItem3",
      ],
    ),
  ];
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow={t("marketing.features.title")}
          title={
            <>
              {t("marketing.features.onePlatform")}
              <br />
              <span className="text-gold">
                {t("marketing.features.everyDepartment")}
              </span>
            </>
          }
          lede={t("marketing.features.lede")}
        />

        <section
          id="collections"
          className="scroll-mt-24 py-16 md:py-28 border-b border-border"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-10 mb-12 md:mb-16">
            <SectionLabel
              index="I."
              title={t("marketing.features.collections")}
            />
            <h2 className="mt-6 font-display text-4xl md:text-5xl text-ivory text-balance max-w-2xl">
              {t("marketing.features.catalogueAccession")}
            </h2>
            <p className="mt-4 max-w-xl text-soft-foreground leading-relaxed">
              {t("marketing.features.collectionBody")}
            </p>
          </div>
          <FeatureModuleGrid modules={collectionModules} />
        </section>

        <ExhibitionsShowcase />

        <section
          id="conservation"
          className="scroll-mt-24 py-16 md:py-28 border-b border-border"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-10 mb-12 md:mb-16">
            <SectionLabel
              index="III."
              title={t("marketing.features.conservation")}
            />
            <h2 className="mt-6 font-display text-4xl md:text-5xl text-ivory text-balance max-w-2xl">
              {t("marketing.features.care")}{" "}
              <em className="not-italic text-gold">
                {t("marketing.features.publicFace")}
              </em>
            </h2>
            <p className="mt-4 max-w-xl text-soft-foreground leading-relaxed">
              {t("marketing.features.careBody")}
            </p>
          </div>
          <div className="feature-module-grid cols-3 mx-auto max-w-7xl px-6 lg:px-10">
            {conservationModules.map((m) => (
              <FeatureModuleCard key={m.title} module={m} />
            ))}
          </div>
        </section>

        <section className="py-20 md:py-28 bg-spotlight border-t border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-6">
              <div className="relative aspect-[4/5] max-w-md overflow-hidden border border-border shadow-gallery">
                <Image
                  src="/marketing/artifact-mask.jpg"
                  alt={t("marketing.features.conservationImageAlt")}
                  fill
                  loading="lazy"
                  quality={70}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <SectionLabel
                index="✦"
                title={t("marketing.features.canonicalRecord")}
              />
              <h2 className="mt-6 font-display text-3xl md:text-4xl text-ivory text-balance">
                {t("marketing.features.objectStory")}
              </h2>
              <p className="mt-6 text-soft-foreground leading-relaxed">
                {t("marketing.features.recordBodyLong")}
              </p>
              <PrimaryButton href="/contact" className="mt-8">
                {t("marketing.features.seeCollection")}
              </PrimaryButton>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
