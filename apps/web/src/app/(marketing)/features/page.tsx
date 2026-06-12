import Image from "next/image";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader, SectionLabel } from "@/components/site/section-label";
import { PrimaryButton } from "@/components/site/buttons";
import { ExhibitionsShowcase } from "@/components/marketing/exhibitions-showcase";
import {
  FeatureModuleCard,
  FeatureModuleGrid,
  type FeatureModule,
} from "@/components/marketing/feature-module-card";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Features",
  description:
    "MuseumLite modules for collections, exhibitions, conservation, library, and public portals — integrated around one object record.",
  path: "/features",
});

const collectionModules: FeatureModule[] = [
  {
    title: "Object Catalog",
    desc: "Museum-grade records with provenance chains, condition history, rich media, and linked agents and places.",
    items: [
      "Versioned revisions",
      "Bulk accession import",
      "Dublin Core import/export",
      "Linked agents & places",
    ],
  },
  {
    title: "Accessions & Deaccessions",
    desc: "Workflow-driven intake with committee approvals, legal documentation and audit trail.",
    items: [
      "Configurable approval steps",
      "Generated paperwork",
      "Board-ready reports",
    ],
  },
  {
    title: "Location & Tracking",
    desc: "Know where every object lives, from vault shelf to vitrine, with barcode support.",
    items: ["Move history", "Storage hierarchy", "Audit reconciliation"],
  },
  {
    title: "Loans & Transit",
    desc: "Outgoing and incoming loans with courier briefs, crate manifests and condition checks at every hop.",
    items: ["Transit log", "Facility reports", "Insurance riders"],
  },
];

const conservationModules: FeatureModule[] = [
  {
    title: "Conservation",
    desc: "Treatments, environmental readings and condition alerts — tied to the object record your team already trusts.",
    items: ["Treatment dossiers", "Environmental readings", "Condition alerts"],
  },
  {
    title: "Library & Research",
    desc: "Catalogue holdings, patrons, circulation, and acquisitions for the institutional library.",
    items: ["ISBN lookup", "Barcode circulation", "Holds & fines"],
  },
  {
    title: "Public Portal",
    desc: "Publish a public catalogue with embargo controls and editorial pages when you are ready.",
    items: ["Branded portal pages", "SEO-ready pages", "High-res imagery"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow="Platform"
          title={
            <>
              One platform.
              <br />
              <span className="text-gold">Every department.</span>
            </>
          }
          lede="Replace the patchwork of spreadsheets and ageing databases with integrated modules around a single canonical object record."
        />

        <section
          id="collections"
          className="scroll-mt-24 py-16 md:py-28 border-b border-border"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-10 mb-12 md:mb-16">
            <SectionLabel index="I." title="Collections" />
            <h2 className="mt-6 font-display text-4xl md:text-5xl text-ivory text-balance max-w-2xl">
              Catalogue & <em className="not-italic text-gold">accession</em>
            </h2>
            <p className="mt-4 max-w-xl text-soft-foreground leading-relaxed">
              Everything that happens before and after an object enters your
              walls — recorded with museum register depth and modern search.
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
            <SectionLabel index="III." title="Conservation" />
            <h2 className="mt-6 font-display text-4xl md:text-5xl text-ivory text-balance max-w-2xl">
              Care, library & <em className="not-italic text-gold">public face</em>
            </h2>
            <p className="mt-4 max-w-xl text-soft-foreground leading-relaxed">
              Stewardship, research holdings, and the catalogue you choose to
              share — without maintaining a second database.
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
                  alt="Collection object in conservation review"
                  fill
                  loading="lazy"
                  quality={70}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <SectionLabel index="✦" title="One canonical record" />
              <h2 className="mt-6 font-display text-3xl md:text-4xl text-ivory text-balance">
                Every object, its own story
              </h2>
              <p className="mt-6 text-soft-foreground leading-relaxed">
                Linked provenance, condition history, exhibition cycles, loan
                agreements, imagery, and environmental readings — on one page
                your whole team can trust.
              </p>
              <PrimaryButton href="/contact" className="mt-8">
                See it on your collection →
              </PrimaryButton>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
