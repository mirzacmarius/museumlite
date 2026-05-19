"use client";

import { Button } from "@v1/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-32 px-4 relative bg-black overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-neon-blue/10 via-transparent to-transparent pointer-events-none" />

      {/* Glowing Orb */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-neon-blue/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-7xl font-bold mb-8 text-white tracking-tight">
            Ready to step into the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">
              future?
            </span>
          </h2>

          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">
            Join the revolution in collection management. Start your free trial
            today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="https://app.museumlite.com/register">
              <Button className="h-14 px-10 rounded-full bg-white text-black hover:bg-zinc-200 text-lg font-bold transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                Get Started Now
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </Link>

            <Link href="#pricing">
              <Button
                variant="outline"
                className="h-14 px-10 rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 text-lg font-medium backdrop-blur-sm"
              >
                View Pricing
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
