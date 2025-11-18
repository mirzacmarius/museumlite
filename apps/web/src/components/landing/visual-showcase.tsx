"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const screenshots = [
  {
    title: "Dashboard Overview",
    description: "Get insights at a glance",
    image: "/screenshots/dashboard.png",
  },
  {
    title: "Object Details",
    description: "Comprehensive cataloging",
    image: "/screenshots/object-detail.png",
  },
  {
    title: "Collection Grid",
    description: "Visual collection browser",
    image: "/screenshots/collection-grid.png",
  },
  {
    title: "Mobile Ready",
    description: "Access anywhere",
    image: "/screenshots/mobile.png",
  },
];

export function VisualShowcase() {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
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
            Designed for efficiency
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Beautiful, intuitive interfaces that make collection management a
            pleasure.
          </p>
        </motion.div>

        {/* Screenshot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {screenshots.map((screenshot, index) => (
            <motion.div
              key={screenshot.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="rounded-2xl border border-border bg-accent/50 overflow-hidden hover:border-muted-foreground/20 transition-all duration-300">
                {/* Placeholder for actual screenshots */}
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative">
                  <div className="text-center p-8">
                    <p className="text-lg font-semibold mb-2">
                      {screenshot.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {screenshot.description}
                    </p>
                  </div>
                  
                  {/* Decorative Grid Pattern */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20" />
                </div>

                {/* Caption */}
                <div className="p-4 border-t border-border">
                  <p className="text-sm font-medium">{screenshot.title}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Note: Replace placeholder divs with actual screenshots when available */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center text-xs text-muted-foreground mt-8"
        >
          Screenshots will be added as the application develops
        </motion.p>
      </div>
    </section>
  );
}
