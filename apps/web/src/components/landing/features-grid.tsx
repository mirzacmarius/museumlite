"use client";

import { motion } from "framer-motion";
import {
  Archive,
  FileCheck,
  MapPinned,
  Repeat,
  Image as ImageIcon,
  ShieldCheck,
} from "lucide-react";
import { FeatureCard } from "./feature-card";

const features = [
  {
    icon: Archive,
    title: "Object Cataloging",
    description:
      "Comprehensive cataloging with unlimited media attachments, detailed metadata, and custom fields.",
  },
  {
    icon: FileCheck,
    title: "Accession Workflows",
    description:
      "Streamlined accession & deaccession processes with automated numbering and approval workflows.",
  },
  {
    icon: MapPinned,
    title: "Location Tracking",
    description:
      "Real-time object location and complete movement history with QR/RFID integration.",
  },
  {
    icon: Repeat,
    title: "Loan Management",
    description:
      "Manage loans with automated tracking, reminders, and condition reports.",
  },
  {
    icon: ImageIcon,
    title: "Digital Assets",
    description:
      "High-resolution image management with metadata, watermarking, and batch processing.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description:
      "Granular permissions for your entire team with custom roles and audit logs.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function FeaturesGrid() {
  return (
    <section id="features" className="py-24 px-4 relative scroll-mt-20">
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
            Everything you need
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Professional collection management tools designed for museums,
            galleries, and collectors of all sizes.
          </p>
        </motion.div>

        {/* Features Grid - Using Efferd Feature Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <FeatureCard
                feature={feature}
                className="h-full rounded-2xl border border-border bg-background hover:border-muted-foreground/20 transition-all duration-300"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
