"use client";

// import { AnimatedText } from "@/components/animated-text";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Building2, 
  Image as ImageIcon, 
  MapPin, 
  Package 
} from "lucide-react";
import Link from "next/link";

const floatingIcons = [
  { Icon: Building2, delay: 0, x: "-20%", y: "-30%" },
  { Icon: ImageIcon, delay: 0.2, x: "20%", y: "-20%" },
  { Icon: MapPin, delay: 0.4, x: "-15%", y: "20%" },
  { Icon: Package, delay: 0.6, x: "25%", y: "30%" },
];

export function HeroSection() {
  return (
    <section className="relative h-screen w-screen flex flex-col items-center justify-center overflow-hidden">
      {/* 3D Grid Background - Top */}
      <div className="absolute -top-[118px] inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(1000px)_rotateX(-63deg)] h-[80%] pointer-events-none" />
      
      {/* Gradient Overlay - Top */}
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent pointer-events-none -z-10" />

      {/* Floating Icons */}
      <div className="absolute inset-0 pointer-events-none -z-5">
        {floatingIcons.map(({ Icon, delay, x, y }, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: [0.1, 0.2, 0.1], 
              scale: [1, 1.1, 1],
              x: [0, 10, 0],
              y: [0, -10, 0]
            }}
            transition={{
              duration: 4,
              delay,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="absolute"
            style={{ 
              left: `calc(50% + ${x})`, 
              top: `calc(50% + ${y})`,
            }}
          >
            <Icon className="w-16 h-16 md:w-24 md:h-24 text-muted-foreground/20" strokeWidth={1} />
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-departure text-[40px] md:text-[84px] leading-tight h-[120px] md:h-auto">
            {/* <AniinstamatedText text="Museum Management, Simplified" /> */}
            Museum Management, Simplified
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 text-center md:text-xl max-w-[80%] mx-auto mt-2 md:mt-6 text-muted-foreground"
        >
          Complete collection management for museums, galleries, and collectors. 
          Track accessions, manage locations, and publish your collection online.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 mb-8"
        >
          <Link
            href={process.env.NEXT_PUBLIC_APP_URL || "/"}
            className="group px-8 py-3 bg-primary text-secondary rounded-full font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          
          <button
            className="px-8 py-3 bg-secondary text-primary rounded-full font-medium text-sm border border-border hover:bg-accent transition-colors"
          >
            View Demo
          </button>
        </motion.div>

        {/* Trust Badge */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-xs text-muted-foreground"
        >
          Trusted by museums and collectors worldwide
        </motion.p>
      </div>

      {/* 3D Grid Background - Bottom */}
      <div className="absolute -bottom-[280px] inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(560px)_rotateX(63deg)] pointer-events-none" />
      
      {/* Gradient Overlay - Bottom */}
      <div className="absolute w-full bottom-[100px] h-1/2 bg-gradient-to-b from-background to-transparent pointer-events-none -z-10" />
    </section>
  );
}
