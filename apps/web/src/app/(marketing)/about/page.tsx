import type { Metadata } from "next";
import Image from "next/image";
import { Nav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { PageHeader, SectionLabel } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "About — MuseumLite",
  description:
    "Built in Florence and Edinburgh alongside conservators at three national institutions — for the keepers of cultural memory.",
  openGraph: {
    title: "About — MuseumLite",
    description: "For the keepers of cultural memory.",
  },
};

const team = [
  { name: "Helena Vasari", role: "Co-founder · Curatorial", note: "Former Head of Collections, Museo Aurelia." },
  { name: "Tomás Bergström", role: "Co-founder · Engineering", note: "Built collection systems at the National Gallery of Sweden." },
  { name: "Amara Okafor", role: "Conservation Lead", note: "Paper conservator, trained at the Courtauld." },
  { name: "Jean-Pierre Marchand", role: "Head of Design", note: "Editorial design, ex Phaidon and Pentagram." },
];

const milestones = [
  ["MMXIX", "Founded in a studio above the Bargello, Florence."],
  ["MMXXI", "First three institutions go live with the Atelier release."],
  ["MMXXIII", "Edinburgh studio opens. Library module ships."],
  ["MMXXV", "1,240 institutions across 62 countries trust MuseumLite."],
];

export default function AboutPage() {
  return (
    <main className="bg-background text-foreground">
      <Nav />
      <PageHeader
        eyebrow="The Institution"
        title={<>For the keepers of <em className="not-italic text-gold">cultural memory.</em></>}
        lede="MuseumLite was founded by conservators and engineers who were tired of software that treated a Tang dynasty horse the same as a warehouse pallet."
      />

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-6">
            <div className="relative aspect-[4/5] overflow-hidden shadow-gallery">
              <Image
                src="/marketing/hero-gallery.jpg"
                alt="The studio"
                fill
                loading="lazy"
                quality={70}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-cover grayscale-[30%]"
              />
            </div>
          </div>
          <div className="md:col-span-6 space-y-6 text-ivory/75 text-lg leading-relaxed md:pt-12">
            <SectionLabel index="I." title="A studio, not a startup" />
            <h2 className="font-display text-5xl text-ivory">
              We design for <em className="not-italic text-gold">stewardship</em>, not scale.
            </h2>
            <p>
              MuseumLite is a small, deliberate company. We work directly with
              the conservators, registrars and curators who use the software
              every day. We ship slowly and we ship well.
            </p>
            <p>
              Our offices are above a frame shop in Florence and across from
              the National Library in Edinburgh. We don't take growth-stage
              funding. We answer to museums, not investors.
            </p>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <SectionLabel index="II." title="The People" />
          <h2 className="mt-6 font-display text-5xl md:text-6xl text-ivory mb-16">
            Hands that know the work.
          </h2>
          <div className="grid md:grid-cols-4 gap-px bg-border">
            {team.map((p) => (
              <div key={p.name} className="bg-background p-8">
                <div className="aspect-square bg-card mb-6 flex items-center justify-center font-display text-5xl text-gold/40">
                  {p.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div className="font-display text-2xl text-ivory">{p.name}</div>
                <div className="text-xs uppercase tracking-[0.25em] text-gold mt-2">{p.role}</div>
                <p className="mt-4 text-sm text-ivory/60 leading-relaxed">{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-border">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <SectionLabel index="III." title="The Years" />
          <h2 className="mt-6 font-display text-5xl text-ivory mb-12">A short history.</h2>
          <ol className="space-y-px bg-border">
            {milestones.map(([y, t]) => (
              <li key={y} className="bg-background p-6 grid grid-cols-12 gap-6 items-baseline">
                <span className="col-span-3 font-display text-3xl text-gold">{y}</span>
                <span className="col-span-9 text-ivory/80 text-lg">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
