"use client";

import { m } from "framer-motion";
import { Building2, Heart, Palette } from "lucide-react";

const useCases = [
  {
    icon: Building2,
    title: "Museums & Galleries",
    description:
      "Complete accession workflows, loan management, exhibition planning, and public publishing. Designed for institutions of every size, from local history museums to national galleries.",
    stats: [
      { label: "Objects managed", value: "500K+" },
      { label: "Active institutions", value: "120+" },
    ],
  },
  {
    icon: Heart,
    title: "Private Collectors",
    description:
      "Organize and document your personal collection with the same professional tools used by top institutions. Ideal for art, antiques, rare books, and memorabilia.",
    stats: [
      { label: "Collections built", value: "2,400+" },
      { label: "Avg. catalog time", value: "< 2min" },
    ],
  },
  {
    icon: Palette,
    title: "Artists & Studios",
    description:
      "Track your works from creation to exhibition. Manage inventory, consignment, and sales with studio-focused workflows that let you focus on your art.",
    stats: [
      { label: "Works tracked", value: "80K+" },
      { label: "Studios onboarded", value: "340+" },
    ],
  },
];

export function UseCases() {
  return (
    <section
      id="use-cases"
      className="py-28 md:py-36 px-6 md:px-12 relative bg-zinc-950"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-2xl mb-16 md:mb-24">
          <m.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-accent text-sm font-medium tracking-wide uppercase mb-4"
          >
            Use Cases
          </m.p>
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl md:text-5xl font-semibold tracking-tighter text-white"
          >
            Built for every kind of collection
          </m.h2>
        </div>

        <div className="space-y-px">
          {useCases.map((useCase, i) => {
            const isReversed = i % 2 !== 0;
            return (
              <m.div
                key={useCase.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center py-16 md:py-20 ${
                  i < useCases.length - 1 ? "border-b border-white/[0.06]" : ""
                }`}
              >
                <div className={isReversed ? "md:order-2" : ""}>
                  <div className="size-12 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mb-6">
                    <useCase.icon className="size-6 text-accent" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-white mb-4 tracking-tight">
                    {useCase.title}
                  </h3>
                  <p className="text-zinc-400 text-base leading-relaxed max-w-[50ch]">
                    {useCase.description}
                  </p>
                </div>

                <div className={isReversed ? "md:order-1" : ""}>
                  <div className="grid grid-cols-2 gap-4">
                    {useCase.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6"
                      >
                        <div className="text-2xl md:text-3xl font-semibold font-mono text-white tracking-tight mb-1">
                          {stat.value}
                        </div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
