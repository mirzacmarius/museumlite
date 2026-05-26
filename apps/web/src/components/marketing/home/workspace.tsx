import Image from "next/image";
import Link from "next/link";
import { SectionLabel } from "@/components/site/section-label";
import { Reveal } from "@/components/site/reveal";

export function HomeWorkspace() {
  return (
    <section className="workspace-section relative py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12 items-center">
        <Reveal className="md:col-span-5 order-2 md:order-1">
          <SectionLabel index="II." title="The workspace" />
          <h2 className="mt-8 font-display text-4xl md:text-5xl text-ivory text-balance leading-[0.95]">
            Every object on one{" "}
            <em className="not-italic text-gold">considered</em> page.
          </h2>
          <p className="mt-6 text-soft-foreground text-lg leading-relaxed">
            Provenance, condition reports, exhibition cycles, loan agreements,
            high-resolution imagery, and environmental readings — linked on one
            canonical record your registrars, curators, and conservators share.
          </p>
          <Link
            href="/features"
            className="mt-10 inline-flex text-xs uppercase tracking-[0.3em] text-gold hover:text-ivory transition-colors"
          >
            Explore all modules →
          </Link>
        </Reveal>
        <Reveal className="md:col-span-6 md:col-start-7 order-1 md:order-2" delay={140}>
          <div className="relative aspect-[4/3] overflow-hidden shadow-gallery border border-border group">
            <Image
              src="/marketing/artifact-frame.jpg"
              alt="MuseumLite object record with catalogue metadata and linked documents"
              fill
              loading="lazy"
              quality={70}
              sizes="(max-width: 768px) 100vw, 560px"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
