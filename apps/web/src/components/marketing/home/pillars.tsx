import Image from "next/image";
import Link from "next/link";
import { SectionLabel } from "@/components/site/section-label";
import { Reveal } from "@/components/site/reveal";

const pillars = [
  {
    n: "01",
    title: "Collections",
    img: "/marketing/artifact-bust.jpg",
    body: "Catalogue objects with museum-grade fields — accession numbers, provenance chains, agents, locations, and rich media. Bulk import, versioned revisions, and board-ready accession workflows.",
    href: "/features#collections",
  },
  {
    n: "02",
    title: "Exhibitions",
    img: "/marketing/artifact-frame.jpg",
    body: "Plan loans, walls, vitrines, and labels on a timeline tied to the same catalogue your registrars maintain. Generate install schedules, label exports, and courier briefs from live records.",
    href: "/features#exhibitions",
  },
  {
    n: "03",
    title: "Conservation",
    img: "/marketing/artifact-mask.jpg",
    body: "Log treatments and environmental readings alongside the object — so risk stays visible to the whole team before humidity, light, or pest drift becomes damage.",
    href: "/features#conservation",
  },
] as const;

export function HomePillars() {
  return (
    <section className="relative py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="flex items-end justify-between mb-16 gap-8">
          <div>
            <SectionLabel index="III." title="The Galleries" />
            <h2 className="mt-6 font-display text-5xl md:text-6xl text-ivory">
              Three rooms.
              <em className="not-italic text-gold"> One institution.</em>
            </h2>
          </div>
          <p className="hidden md:block max-w-xs text-sm text-muted-foreground leading-relaxed">
            Start with the modules you need today — add library holdings and a
            public portal when your team is ready.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-px bg-border">
          {pillars.map((p, i) => (
            <Reveal key={p.n} delay={i * 100}>
            <article
              className="group relative bg-background p-8 md:p-10 flex flex-col gap-8 hover:bg-card transition-colors h-full"
            >
              <div className="relative aspect-[4/5] overflow-hidden shadow-gallery">
                <Image
                  src={p.img}
                  alt={p.title}
                  fill
                  loading="lazy"
                  quality={65}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover grayscale-[20%] transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
                <span className="absolute top-4 left-4 font-display text-3xl text-gold">
                  {p.n}
                </span>
              </div>
              <div>
                <h3 className="font-display text-4xl text-ivory mb-4">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
              <Link
                href={p.href}
                className="mt-auto text-xs uppercase tracking-[0.3em] text-gold hover:text-ivory inline-flex items-center gap-3 group/link"
              >
                Enter the room
                <span className="h-px w-8 bg-gold group-hover/link:w-14 transition-all" />
              </Link>
            </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
