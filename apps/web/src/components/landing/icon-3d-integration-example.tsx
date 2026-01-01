"use client";

import { motion } from "framer-motion";
import { IconHover3D } from "@v1/ui/icon-3d-hover";

/**
 * Example: How to integrate IconHover3D component in your landing page
 *
 * This shows different use cases for the 3D hover icon component
 */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
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

export function IconHover3DSection() {
  return (
    <section className="py-24 px-4 relative">
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
            Powerful Features
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Everything you need to manage and showcase your collections
          </p>
        </motion.div>

        {/* Features with 3D Icons */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-8"
        >
          <motion.div variants={itemVariants}>
            <IconHover3D
              heading="Collection Management"
              text="Comprehensive tools to catalog, organize, and track your entire collection with professional-grade features and intuitive workflows."
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <IconHover3D
              heading="Digital Archive"
              text="Secure digital preservation with high-resolution imaging, detailed metadata, and long-term accessibility for future generations."
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <IconHover3D
              heading="Public Gallery"
              text="Share your collection with the world through beautiful, customizable online galleries with advanced search and filtering."
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// Alternative: Grid layout
export function IconHover3DGrid() {
  const features = [
    {
      heading: "Museums & Galleries",
      text: "Professional collection management for institutions of all sizes with complete workflows and tracking.",
    },
    {
      heading: "Private Collectors",
      text: "Organize and showcase your personal collection with professional tools perfect for any collection type.",
    },
    {
      heading: "Artists & Studios",
      text: "Track your works from creation to exhibition with studio-focused workflows and client management.",
    },
  ];

  return (
    <section className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.heading}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <IconHover3D heading={feature.heading} text={feature.text} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Alternative: Compact inline version
export function IconHover3DInline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
      <IconHover3D
        heading="Quick Demo"
        text="Hover over this component to see the 3D animation effect in action."
        width={500}
        height={120}
      />
    </div>
  );
}
