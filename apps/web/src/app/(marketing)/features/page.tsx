import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader, SectionLabel } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "Features — MuseumLite",
  description:
    "Modules for collections, exhibitions, conservation, library and the public portal — woven into one quiet platform.",
  openGraph: {
    title: "Features — MuseumLite",
    description: "One platform. Every department.",
  },
};

const modules = [
  {
    n: "01",
    title: "Object Catalog",
    desc: "Museum-grade records with provenance chains, condition history, IIIF imagery and AAT/ULAN reconciliation.",
    items: [
      "Versioned revisions",
      "Bulk accession import",
      "Linked agents & places",
    ],
  },
  {
    n: "02",
    title: "Accessions & Deaccessions",
    desc: "Workflow-driven intake with committee approvals, legal documentation and audit trail.",
    items: [
      "Configurable approval steps",
      "Generated paperwork",
      "Board-ready reports",
    ],
  },
  {
    n: "03",
    title: "Location & Tracking",
    desc: "Know where every object lives, from vault shelf to vitrine, with RFID and barcode support.",
    items: ["Move history", "Storage hierarchy", "Audit reconciliation"],
  },
  {
    n: "04",
    title: "Loans & Transit",
    desc: "Outgoing and incoming loans with courier briefs, crate manifests and condition checks at every hop.",
    items: ["Couriered transit log", "Facility reports", "Insurance riders"],
  },
  {
    n: "05",
    title: "Exhibitions & Installations",
    desc: "Plan walls, labels, vitrines and lighting on a visual timeline. Generate the show in a single export.",
    items: ["Floorplan editor", "Label PDF export", "Install schedule"],
  },
  {
    n: "06",
    title: "Conservation",
    desc: "Treatments, environmental readings and risk flags — MuseumLite watches RH, light and pests for you.",
    items: ["Treatment dossiers", "Sensor ingest", "Risk scoring"],
  },
  {
    n: "07",
    title: "Library & Research",
    desc: "MARC-compatible catalogue, patrons, circulation, fines and acquisitions for the institutional library.",
    items: ["Z39.50 import", "Self-checkout", "Reading rooms"],
  },
  {
    n: "08",
    title: "Public Portal",
    desc: "Publish a beautiful, IIIF-enabled public catalogue with embargo controls and editorial features.",
    items: ["Custom domains", "SEO-ready", "Editorial pages"],
  },
];

export default function FeaturesPage() {
  return (
    <main className="bg-background text-foreground">
      <Nav />
      <PageHeader
        eyebrow="The Platform"
        title={
          <>
            One platform.
            <br />
            <em className="not-italic text-gold">Every department.</em>
          </>
        }
        lede="MuseumLite replaces the patchwork of spreadsheets, file servers and ageing databases that hold most museums together. Eight integrated modules, one canonical record."
      />

      <section className="bg-border py-24 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-px px-6 md:grid-cols-2 lg:px-10">
          {modules.map((m) => (
            <article
              key={m.n}
              className="bg-background p-8 md:p-12 flex flex-col gap-5 hover:bg-card transition-colors"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl text-gold">{m.n}</span>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Module
                </span>
              </div>
              <h3 className="font-display text-4xl text-ivory">{m.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{m.desc}</p>
              <ul className="mt-2 space-y-2 text-sm text-soft-foreground">
                {m.items.map((i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 border-b border-border/60 pb-2"
                  >
                    <span className="text-gold">✦</span>
                    {i}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="relative py-32 overflow-hidden border-t border-border">
        <div className="absolute inset-0 bg-spotlight" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <div className="relative aspect-[4/5] max-w-xl overflow-hidden shadow-gallery shadow-gold">
              <Image
                src="/marketing/artifact-mask.jpg"
                alt="Specimen"
                fill
                loading="lazy"
                quality={70}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 42vw, 500px"
                className="object-cover"
              />
            </div>
          </div>
          <div className="md:col-span-5">
            <SectionLabel index="✦" title="One canonical record" />
            <h2 className="mt-8 font-display text-5xl md:text-6xl text-ivory text-balance">
              Every object,
              <br />
              <em className="not-italic text-gold">its own story.</em>
            </h2>
            <p className="mt-8 text-soft-foreground text-lg leading-relaxed">
              Linked provenance, condition history, exhibition cycles, loan
              agreements, high-resolution imagery and live environmental
              readings — all on one unhurried page.
            </p>
            <Link
              href="/contact"
              className="mt-10 inline-flex border border-gold text-gold px-6 py-4 text-xs uppercase tracking-[0.3em] hover:bg-gold hover:text-ink transition-colors"
            >
              See it on your collection →
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
