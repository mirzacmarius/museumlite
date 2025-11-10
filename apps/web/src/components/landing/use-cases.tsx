"use client";

import { motion } from "framer-motion";
import { Building2, Heart, Palette } from "lucide-react";

const useCases = [
  {
    icon: Building2,
    title: "Museums & Galleries",
    description:
      "Professional collection management for institutions of all sizes. Complete with accession workflows, loan tracking, and public publishing.",
    features: [
      "Multi-user collaboration",
      "Advanced cataloging",
      "Public web portal",
      "Conservation tracking",
    ],
  },
  {
    icon: Heart,
    title: "Private Collectors",
    description:
      "Organize and showcase your personal collection with professional tools. Perfect for art, antiques, memorabilia, and more.",
    features: [
      "Personal dashboard",
      "Valuation tracking",
      "Insurance reports",
      "Digital gallery",
    ],
  },
  {
    icon: Palette,
    title: "Artists & Studios",
    description:
      "Track your works from creation to exhibition. Manage inventory, sales, and loans with studio-focused workflows.",
    features: [
      "Work-in-progress tracking",
      "Exhibition management",
      "Sales & consignment",
      "Client relationships",
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
    },
  },
};

export function UseCases() {
  return (
    <section id="use-cases" className="py-24 px-4 relative bg-accent/30 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-departure text-3xl md:text-5xl mb-4">
            Built for everyone
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Whether you're running a museum, managing a private collection, or
            tracking your artistic output.
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group"
            >
              <div className="h-full p-8 rounded-2xl border border-border bg-background hover:border-muted-foreground/20 transition-all duration-300">
                {/* Icon */}
                <div className="mb-6 p-4 rounded-2xl bg-accent w-fit group-hover:scale-110 transition-transform duration-300">
                  <useCase.icon className="w-8 h-8" strokeWidth={1.5} />
                </div>

                {/* Title & Description */}
                <h3 className="text-2xl font-semibold mb-3">{useCase.title}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {useCase.description}
                </p>

                {/* Features List */}
                <ul className="space-y-2">
                  {useCase.features.map((feature, fIndex) => (
                    <li
                      key={fIndex}
                      className="flex items-center text-sm text-muted-foreground"
                    >
                      <div className="w-1 h-1 rounded-full bg-primary mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
