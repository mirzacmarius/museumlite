import Link from "next/link";
import { Reveal } from "@/components/site/reveal";

export function HomeFinalCta() {
  return (
    <section className="relative py-32 md:py-44 overflow-hidden border-t border-border">
      <div className="absolute inset-0 bg-spotlight opacity-60" />
      <Reveal className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="flex justify-center mb-10">
          <div className="h-px w-24 bg-gold" />
        </div>
        <h2 className="font-display text-5xl md:text-7xl lg:text-8xl text-ivory leading-[0.95] text-balance">
          The doors are
          <br />
          <em className="not-italic text-gold">open.</em>
        </h2>
        <p className="mt-10 text-soft-foreground text-lg max-w-xl mx-auto leading-relaxed">
          See MuseumLite on your collection — accession, exhibition planning, or
          conservation — in a focused 30-minute walkthrough with our team.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/contact"
            className="btn-marketing bg-gold text-ink px-8 py-4 text-xs uppercase tracking-[0.3em] hover:bg-ivory transition-colors"
          >
            Request a private tour
          </Link>
          <Link
            href="/pricing"
            className="btn-marketing border border-ivory/40 text-ivory px-8 py-4 text-xs uppercase tracking-[0.3em] hover:border-gold hover:text-gold transition-colors"
          >
            View pricing
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
