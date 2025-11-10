"use client";

import { motion } from "framer-motion";
import { IconHover3D } from "@v1/ui/icon-3d-hover";
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {useCases.map((useCase, index) => {
            const IconComponent = useCase.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex flex-col h-full"
              >
                {/* 3D Hover Icon Component - Now fills card */}
                <div className="flex-1 min-h-[280px]">
                  <IconHover3D
                    heading={useCase.title}
                    text={useCase.description}
                    icon={<IconComponent size={40} strokeWidth={1.5} />}
                  />
                </div>

                {/* Features List */}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
