"use client";

import { cn } from "@v1/ui/utils";
import { motion } from "framer-motion";
import {
  Archive,
  FileCheck,
  Globe,
  Image as ImageIcon,
  MapPinned,
  Repeat,
  Search,
  ShieldCheck,
} from "lucide-react";
import { SpotlightCard } from "../spotlight-card";

const features = [
  {
    icon: Archive,
    title: "Object Cataloging",
    description:
      "Comprehensive cataloging with unlimited media attachments and detailed metadata.",
    className: "md:col-span-2",
  },
  {
    icon: Search,
    title: "Smart Search",
    description: "Find anything instantly with AI-powered semantic search.",
    className: "md:col-span-1",
  },
  {
    icon: MapPinned,
    title: "Location Tracking",
    description: "Real-time object location and complete movement history.",
    className: "md:col-span-1",
  },
  {
    icon: Globe,
    title: "Public Portal",
    description: "Publish your collection online with a single click.",
    className: "md:col-span-2",
  },
  {
    icon: ImageIcon,
    title: "Digital Assets",
    description: "High-res image management with auto-watermarking.",
    className: "md:col-span-3",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-32 px-4 relative bg-zinc-950">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500"
          >
            Powering the Future
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-lg max-w-2xl mx-auto"
          >
            Advanced tools designed for the next generation of museums and
            galleries.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={feature.className}
            >
              <SpotlightCard className="h-full p-8 hover:bg-white/10 transition-colors">
                <div className="relative z-10">
                  <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="size-6 text-neon-blue" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
