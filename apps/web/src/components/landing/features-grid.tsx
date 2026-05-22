"use client";

import { m } from "framer-motion";
import {
  Archive,
  Globe,
  Image as ImageIcon,
  MapPinned,
  Search,
} from "lucide-react";

const features = [
  {
    icon: Archive,
    title: "Object Cataloging",
    description:
      "Comprehensive cataloging with unlimited media attachments, custom fields, and detailed provenance tracking.",
    area: "span-2",
  },
  {
    icon: Search,
    title: "Smart Search",
    description:
      "Find anything instantly across your entire collection with full-text and faceted search.",
    area: "span-1",
  },
  {
    icon: MapPinned,
    title: "Location Tracking",
    description:
      "Know where every object is at all times. Track movements, storage, and exhibition history.",
    area: "span-1",
  },
  {
    icon: Globe,
    title: "Public Portal",
    description:
      "Share your collection with the world through a customizable public-facing portal, published in one click.",
    area: "span-2",
  },
  {
    icon: ImageIcon,
    title: "Digital Asset Management",
    description:
      "High-resolution image management with automatic thumbnailing, watermarking, and metadata extraction. Attach unlimited files to any record.",
    area: "span-full",
  },
];

export function FeaturesGrid() {
  return (
    <section
      id="features"
      className="py-28 md:py-36 px-6 md:px-12 relative bg-zinc-950"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-2xl mb-16 md:mb-20">
          <m.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-accent text-sm font-medium tracking-wide uppercase mb-4"
          >
            Capabilities
          </m.p>
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mb-5"
          >
            Everything your collection needs
          </m.h2>
          <m.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-[50ch]"
          >
            Purpose-built tools for managing physical and digital collections at
            any scale.
          </m.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
          {features.map((feature, i) => (
            <m.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className={`bg-zinc-950 p-8 md:p-10 group transition-colors hover:bg-zinc-900/50 ${
                feature.area === "span-2"
                  ? "md:col-span-2"
                  : feature.area === "span-full"
                    ? "md:col-span-3"
                    : "md:col-span-1"
              }`}
            >
              <div className="size-10 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mb-6 group-hover:border-accent/30 transition-colors">
                <feature.icon className="size-5 text-zinc-400 group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-[45ch]">
                {feature.description}
              </p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
