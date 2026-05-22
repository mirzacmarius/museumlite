"use client";

import { m } from "framer-motion";

export function VisualShowcase() {
  return (
    <section className="py-28 md:py-36 px-6 md:px-12 relative bg-zinc-950 overflow-hidden">
      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-20">
          <m.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-accent text-sm font-medium tracking-wide uppercase mb-4"
          >
            Interface
          </m.p>
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mb-5"
          >
            A workspace that works for you
          </m.h2>
          <m.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-base md:text-lg leading-relaxed"
          >
            Clean, fast, and purposeful. Every detail designed to help you focus
            on what matters.
          </m.p>
        </div>

        <m.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-5xl"
        >
          <div className="relative rounded-2xl bg-zinc-900/60 border border-white/[0.08] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="h-10 border-b border-white/[0.06] flex items-center px-4 gap-2 bg-white/[0.02]">
              <div className="size-2.5 rounded-full bg-zinc-700" />
              <div className="size-2.5 rounded-full bg-zinc-700" />
              <div className="size-2.5 rounded-full bg-zinc-700" />
              <div className="ml-4 h-5 w-56 rounded bg-white/[0.04]" />
            </div>

            <div className="aspect-video w-full bg-zinc-950 relative overflow-hidden">
              <div className="absolute inset-0 p-6 md:p-8 grid grid-cols-12 gap-4 md:gap-6">
                <div className="col-span-2 h-full rounded-lg bg-white/[0.03] border border-white/[0.04] p-3 space-y-3">
                  {[
                    "dashboard",
                    "objects",
                    "collections",
                    "loans",
                    "media",
                    "settings",
                  ].map((label, idx) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="size-4 rounded bg-white/[0.06]" />
                      <div
                        className={`h-2 rounded bg-white/${idx === 2 ? "10" : "04"} ${idx === 2 ? "w-full" : "w-3/4"}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="col-span-10 h-full flex flex-col gap-4 md:gap-5">
                  <div className="h-14 w-full rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center px-5 justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-24 bg-white/10 rounded" />
                      <div className="h-5 w-px bg-white/[0.06]" />
                      <div className="h-3 w-16 bg-white/[0.04] rounded" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-7 w-20 rounded-md bg-accent/15 border border-accent/20" />
                      <div className="h-7 w-7 rounded-md bg-white/[0.04]" />
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {[
                      "vase-ming",
                      "portrait-oil",
                      "bronze-figure",
                      "textile-silk",
                      "marble-bust",
                      "ceramic-bowl",
                      "scroll-ink",
                      "jade-pendant",
                    ].map((id) => (
                      <div
                        key={id}
                        className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 flex flex-col justify-between"
                      >
                        <div className="aspect-[4/3] rounded bg-white/[0.04] mb-3" />
                        <div className="space-y-1.5">
                          <div className="h-2 w-3/4 rounded bg-white/10" />
                          <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 bg-accent/8 blur-[50px] rounded-full" />
        </m.div>
      </div>
    </section>
  );
}
