"use client";

import { Button } from "@v1/ui/button";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0">
      <div className="rounded-2xl bg-zinc-900/80 border border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-sm">
        <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2">
          <div className="size-2.5 rounded-full bg-zinc-700" />
          <div className="size-2.5 rounded-full bg-zinc-700" />
          <div className="size-2.5 rounded-full bg-zinc-700" />
          <div className="ml-3 h-5 w-48 rounded bg-white/5" />
        </div>

        <div className="p-5 grid grid-cols-12 gap-4">
          <div className="col-span-3 space-y-3">
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-3 w-3/4 rounded bg-white/5" />
            <div className="h-3 w-full rounded bg-accent/20" />
            <div className="h-3 w-3/4 rounded bg-white/5" />
            <div className="h-3 w-full rounded bg-white/5" />
          </div>

          <div className="col-span-9 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-white/10" />
              <div className="flex gap-2">
                <div className="h-7 w-16 rounded-md bg-accent/20 border border-accent/30" />
                <div className="h-7 w-7 rounded-md bg-white/5" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                <div className="h-2 w-12 rounded bg-white/10 mb-2" />
                <div className="text-lg font-mono font-semibold text-white/80">
                  2,847
                </div>
                <div className="mt-1 h-1.5 w-16 rounded-full bg-accent/30" />
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                <div className="h-2 w-10 rounded bg-white/10 mb-2" />
                <div className="text-lg font-mono font-semibold text-white/80">
                  142
                </div>
                <div className="mt-1 h-1.5 w-10 rounded-full bg-white/10" />
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                <div className="h-2 w-14 rounded bg-white/10 mb-2" />
                <div className="text-lg font-mono font-semibold text-white/80">
                  98.7%
                </div>
                <div className="mt-1 h-1.5 w-20 rounded-full bg-accent/30" />
              </div>
            </div>

            <div className="space-y-2">
              {[
                { id: "full", w: "w-full", accent: true },
                { id: "mid", w: "w-[92%]", accent: false },
                { id: "short", w: "w-[78%]", accent: false },
              ].map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5"
                >
                  <div className="size-8 rounded bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className={`h-2 ${row.w} rounded bg-white/10`} />
                    <div className="h-2 w-1/2 rounded bg-white/5" />
                  </div>
                  {row.accent && (
                    <div className="size-2 rounded-full bg-accent shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-accent/10 blur-[40px] rounded-full" />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] w-full flex items-center overflow-hidden bg-zinc-950 pt-20">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <div className="max-w-xl">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-8"
            >
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-medium tracking-wide text-accent uppercase">
                Now in Public Beta
              </span>
            </m.div>

            <m.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-6 text-white"
            >
              Collection management,{" "}
              <span className="text-accent">simplified</span>
            </m.h1>

            <m.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-[50ch] mb-10"
            >
              The modern platform for museums, galleries, and private
              collectors. Catalog objects, track locations, manage loans, and
              publish your collection online.
            </m.p>

            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-col sm:flex-row items-start gap-4"
            >
              <Link href="https://app.museumlite.com/register">
                <Button className="h-12 px-7 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-semibold transition-all active:scale-[0.98] group">
                  Start free trial
                  <ArrowRight className="ml-2 size-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>

              <Link href="#features">
                <Button
                  variant="ghost"
                  className="h-12 px-7 rounded-full text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                >
                  See how it works
                </Button>
              </Link>
            </m.div>

            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-12 flex items-center gap-6 text-xs text-zinc-500"
            >
              <span className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-accent/60" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-accent/60" />
                Free for up to 100 objects
              </span>
            </m.div>
          </div>

          <m.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <DashboardMockup />
          </m.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
    </section>
  );
}
