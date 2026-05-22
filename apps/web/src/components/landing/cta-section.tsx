"use client";

import { Button } from "@v1/ui/button";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-28 md:py-36 px-6 md:px-12 relative bg-zinc-950 overflow-hidden">
      <div className="max-w-[1400px] mx-auto relative z-10">
        <m.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 md:p-20"
        >
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mb-6">
              Start managing your collection today
            </h2>

            <p className="text-zinc-400 text-base md:text-lg leading-relaxed mb-10 max-w-[50ch]">
              Free for small collections. No credit card required. Set up in
              under two minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="https://app.museumlite.com/register">
                <Button className="h-12 px-8 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-semibold transition-all active:scale-[0.98] group">
                  Get started free
                  <ArrowRight className="ml-2 size-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>

              <Link href="#pricing">
                <Button
                  variant="ghost"
                  className="h-12 px-8 rounded-full text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Compare plans
                </Button>
              </Link>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
