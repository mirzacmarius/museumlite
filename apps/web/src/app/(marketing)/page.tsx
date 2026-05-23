import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { SectionLabel } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "MuseumLite — Museum Management, Reimagined",
  description:
    "MuseumLite is the operating system for modern museums — collections, exhibitions, conservation, and library in one elegant platform.",
  openGraph: {
    title: "MuseumLite — Museum Management, Reimagined",
    description: "The operating system for modern museums.",
    images: [{ url: "/marketing/hero-gallery.jpg" }],
  },
};

const pillars = [
  {
    n: "01",
    title: "Collections",
    img: "/marketing/artifact-bust.jpg",
    body: "Catalogue every object with the depth of a museum register and the speed of modern search. Provenance chains, condition reports, IIIF imagery — all linked, all versioned.",
  },
  {
    n: "02",
    title: "Exhibitions",
    img: "/marketing/artifact-frame.jpg",
    body: "Plan loans, walls, vitrines and labels on a visual timeline. Generate condition reports, courier briefs and crate manifests with one keystroke.",
  },
  {
    n: "03",
    title: "Conservation",
    img: "/marketing/artifact-mask.jpg",
    body: "Track treatments, environmental readings and risk assessments. MuseumLite flags drift in humidity, light or pest activity before harm is done.",
  },
];

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden grain">
      <img
        src="/marketing/hero-gallery.jpg"
        alt="Grand museum gallery illuminated at dusk"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-vignette" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 pt-44 pb-32">
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-gold mb-10">
          <span className="h-px w-10 bg-gold/60" />
          Est. MMXXV · Collection Stewardship
        </div>

        <h1 className="font-display text-[14vw] md:text-[10rem] leading-[0.88] text-balance text-ivory">
          The quiet
          <br />
          <em className="not-italic text-gold">order</em> behind
          <br />
          great museums.
        </h1>

        <div className="mt-12 grid md:grid-cols-12 gap-8 items-end">
          <p className="md:col-span-5 text-lg leading-relaxed text-ivory/75 max-w-md">
            MuseumLite unifies your collections, exhibitions, conservation
            records and library into a single, considered platform — built for
            curators, not spreadsheets.
          </p>
          <div className="md:col-span-4 md:col-start-9 flex flex-col gap-4">
            <Link
              href="/contact"
              className="group relative inline-flex items-center justify-between border border-gold bg-gold/95 px-6 py-4 text-ink text-xs uppercase tracking-[0.3em] hover:bg-transparent hover:text-gold transition-colors"
            >
              Begin the Tour
              <span className="ml-4">→</span>
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ivory/70 hover:text-gold px-2"
            >
              <span className="h-9 w-9 rounded-full border border-ivory/40 flex items-center justify-center">
                ▶
              </span>
              Tour the platform
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-border/60 bg-ink/40 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-xs uppercase tracking-[0.25em] text-ivory/60">
          <Stat n="1,240+" l="Institutions" />
          <Stat n="38M" l="Objects catalogued" />
          <Stat n="62" l="Countries" />
          <Stat n="ISO 27001" l="Compliant" />
        </div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-2xl text-gold normal-case tracking-normal">
        {n}
      </span>
      <span>{l}</span>
    </div>
  );
}

function Philosophy() {
  return (
    <section className="relative py-32 md:py-44">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <SectionLabel index="I." title="Philosophy" />
          <h2 className="mt-8 font-display text-5xl md:text-7xl leading-[0.95] text-ivory text-balance">
            Software with
            <br />
            <span className="whitespace-nowrap">
              the <em className="not-italic text-gold">patience</em>
            </span>
            <br />
            of a curator.
          </h2>
        </div>
        <div className="md:col-span-6 md:col-start-7 space-y-6 text-ivory/75 text-lg leading-relaxed">
          <p>
            A museum is not a warehouse. Yet most collection software treats it
            as one — endless rows, brittle forms, the texture of a tax return.
          </p>
          <p>
            MuseumLite was designed alongside conservators at three national
            institutions. Every screen behaves like a well-lit room: generous,
            deliberate, quiet where it should be quiet.
          </p>
          <p className="font-display italic text-2xl text-gold/90 pt-4 border-t border-border">
            "At last, a system that respects the object."
            <span className="block not-italic font-sans text-xs uppercase tracking-[0.3em] text-ivory/50 mt-3">
              — Dr. Helena Vasari, Chief Conservator, Museo Aurelia
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className="relative py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex items-end justify-between mb-16">
          <div>
            <SectionLabel index="II." title="The Galleries" />
            <h2 className="mt-6 font-display text-5xl md:text-6xl text-ivory">
              Three rooms.
              <em className="not-italic text-gold"> One institution.</em>
            </h2>
          </div>
          <p className="hidden md:block max-w-xs text-sm text-ivory/60 leading-relaxed">
            Modules built for the people who actually do the work — and
            integrated so they finally speak the same language.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-border">
          {pillars.map((p) => (
            <article
              key={p.n}
              className="group relative bg-background p-8 md:p-10 flex flex-col gap-8 hover:bg-card transition-colors"
            >
              <div className="relative aspect-[4/5] overflow-hidden shadow-gallery">
                <img
                  src={p.img}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-[1.03] transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
                <span className="absolute top-4 left-4 font-display text-3xl text-gold">
                  {p.n}
                </span>
              </div>
              <div>
                <h3 className="font-display text-4xl text-ivory mb-4">
                  {p.title}
                </h3>
                <p className="text-ivory/65 leading-relaxed">{p.body}</p>
              </div>
              <Link
                href="/features"
                className="mt-auto text-xs uppercase tracking-[0.3em] text-gold hover:text-ivory inline-flex items-center gap-3 group/link"
              >
                Enter the room
                <span className="h-px w-8 bg-gold group-hover/link:w-14 transition-all" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Logos() {
  const insts = [
    "MUSÉE D'ORSAY",
    "TATE",
    "PRADO",
    "RIJKSMUSEUM",
    "GETTY",
    "MET",
  ];
  return (
    <section className="relative py-20 border-y border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="text-center text-[10px] uppercase tracking-[0.4em] text-ivory/50 mb-10">
          Entrusted by stewards of cultural memory
        </p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 items-center">
          {insts.map((n) => (
            <div
              key={n}
              className="font-display text-center text-lg text-ivory/60 tracking-[0.15em]"
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative py-32 md:py-44 overflow-hidden border-t border-border">
      <div className="absolute inset-0 bg-spotlight opacity-60" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="flex justify-center mb-10">
          <div className="h-px w-24 bg-gold" />
        </div>
        <h2 className="font-display text-6xl md:text-8xl text-ivory leading-[0.95] text-balance">
          The doors are
          <br />
          <em className="not-italic text-gold">open.</em>
        </h2>
        <p className="mt-10 text-ivory/70 text-lg max-w-xl mx-auto">
          See MuseumLite guide a real collection through accession, exhibition
          and conservation in a private 30-minute walkthrough with our team.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/contact"
            className="bg-gold text-ink px-8 py-4 text-xs uppercase tracking-[0.3em] hover:bg-ivory transition-colors"
          >
            Request a private tour
          </Link>
          <Link
            href="/pricing"
            className="border border-ivory/40 text-ivory px-8 py-4 text-xs uppercase tracking-[0.3em] hover:border-gold hover:text-gold transition-colors"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <Nav floating />
      <Hero />
      <Philosophy />
      <Pillars />
      <Logos />
      <CTA />
      <SiteFooter />
    </main>
  );
}
