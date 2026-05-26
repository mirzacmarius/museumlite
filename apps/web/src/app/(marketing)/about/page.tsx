import Image from "next/image";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader, SectionLabel } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "About",
  description:
    "MuseumLite is an early-stage museum collection management product built with registrars, curators, and conservators in mind.",
  path: "/about",
});

const principles = [
  {
    title: "Stewardship over scale",
    body: "We optimise for careful cataloguing and long-term record quality — not vanity metrics or growth-at-all-costs features.",
  },
  {
    title: "Direct relationships",
    body: "Early partners work directly with the people building the product. Feedback shapes the roadmap, not a distant product committee.",
  },
  {
    title: "Honest scope",
    body: "We ship modules when they are ready for real museum workflows. No fabricated customer logos or inflated usage statistics.",
  },
] as const;

const milestones = [
  ["2024", "MuseumLite founded to replace spreadsheet-heavy collection workflows."],
  ["2025", "First partner museums onboarded for pilot programmes."],
  ["Today", "Actively building collections, exhibitions, and conservation modules with partner feedback."],
] as const;

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow="About"
          title={
            <>
              Software for people who keep{" "}
              <span className="text-gold">cultural memory.</span>
            </>
          }
          lede="A small team building museum collection management software — deliberate releases, museum-first design, and no enterprise theatre."
        />

        <section className="py-16 md:py-24 border-b border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-6">
              <div className="relative aspect-[4/3] overflow-hidden border border-border shadow-gallery">
                <Image
                  src="/marketing/hero-gallery.jpg"
                  alt="Museum gallery space"
                  fill
                  loading="lazy"
                  quality={70}
                  sizes="(max-width: 768px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="md:col-span-6 space-y-5 text-soft-foreground leading-relaxed md:pt-4">
              <SectionLabel index="Mission" title="Why we exist" />
              <h2 className="font-display text-3xl text-ivory">
                Built with museums, not around them
              </h2>
              <p>
                Most collection software was designed decades ago — or treats a
                museum like a warehouse. MuseumLite is our attempt to give
                registrars and curators a modern workspace without losing the
                care those records deserve.
              </p>
              <p>
                We are early stage. That means direct access, honest timelines,
                and a product that improves because real teams use it every week.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 border-b border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <SectionLabel index="Values" title="How we work" />
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
            <SectionLabel index="Timeline" title="Where we are" />
            <h2 className="mt-6 font-display text-3xl text-ivory mb-10">
              A short history
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
                  <span className="sm:col-span-9 text-soft-foreground">{t}</span>
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
