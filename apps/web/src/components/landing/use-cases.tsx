"use client";

import { motion } from "framer-motion";
import { Building2, Heart, Palette } from "lucide-react";
import { SpotlightCard } from "../spotlight-card";

const useCases = [
  {
    icon: Building2,
    title: "Museums & Galleries",
    description:
      "Professional collection management for institutions of all sizes. Complete with accession workflows, loan tracking, and public publishing.",
  },
  {
    icon: Heart,
    title: "Private Collectors",
    description:
      "Organize and showcase your personal collection with professional tools. Perfect for art, antiques, memorabilia, and more.",
  },
  {
    icon: Palette,
    title: "Artists & Studios",
    description:
      "Track your works from creation to exhibition. Manage inventory, sales, and loans with studio-focused workflows.",
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="py-32 px-4 relative bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 text-white"
          >
            Built for Everyone
          </motion.h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Scalable solutions for every type of collection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {useCases.map((useCase, i) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group"
            >
              <SpotlightCard
                className="p-8 h-full hover:bg-white/10 transition-all hover:-translate-y-2 duration-300"
                spotlightColor="rgba(188, 19, 254, 0.2)"
              >
                <div className="w-14 h-14 rounded-2xl bg-neon-purple/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <useCase.icon className="w-7 h-7 text-neon-purple" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {useCase.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {useCase.description}
                </p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
