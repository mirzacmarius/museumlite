import { SectionLabel } from "@/components/site/section-label";
import { Reveal } from "@/components/site/reveal";

export function HomePhilosophy() {
  return (
    <section className="relative py-32 md:py-44">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12">
        <Reveal className="md:col-span-5">
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
        </Reveal>
        <Reveal className="md:col-span-6 md:col-start-7 space-y-6 text-soft-foreground text-lg leading-relaxed" delay={120}>
          <p>
            A museum is not a warehouse. Yet most collection software treats it
            as one — endless rows, brittle forms, the texture of a tax return.
          </p>
          <p>
            MuseumLite brings accession, location tracking, loans, exhibitions,
            conservation treatments, and environmental readings onto a single
            object record — so your team spends less time hunting files and more
            time caring for the collection.
          </p>
          <p>
            From spreadsheet chaos to structured provenance chains, condition
            history, and IIIF-ready media — every screen is deliberate, quiet
            where it should be quiet.
          </p>
          <p className="font-display text-xl text-gold/90 pt-4 border-t border-border leading-snug">
            Built for stewardship, not warehouse throughput — with modules your
            team can adopt as you grow, including a public catalogue when you
            are ready.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
