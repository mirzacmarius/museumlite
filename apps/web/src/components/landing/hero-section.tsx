"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { 
  ArrowRight, 
  Building2, 
  Image as ImageIcon, 
  MapPin, 
  Package,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { Button } from "@v1/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";

const floatingIcons = [
  { Icon: Building2, delay: 0, x: "-20%", y: "-30%" },
  { Icon: ImageIcon, delay: 0.2, x: "20%", y: "-20%" },
  { Icon: MapPin, delay: 0.4, x: "-15%", y: "20%" },
  { Icon: Package, delay: 0.6, x: "25%", y: "30%" },
];

const features = [
  "No credit card required",
  "Free 14-day trial",
  "Cancel anytime"
];

export function HeroSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section className="relative h-screen w-screen flex flex-col items-center justify-center overflow-hidden group">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/10 -z-20" />
      
      {/* Spotlight Effect - Follows Mouse */}
      <motion.div
        className="pointer-events-none absolute inset-0 -z-10 transition duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`,
        }}
      />

      {/* 3D Grid Background - Top */}
      <div className="absolute -top-[118px] inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(1000px)_rotateX(-63deg)] h-[80%] pointer-events-none opacity-40" />
      
      {/* Gradient Overlay - Top */}
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent pointer-events-none -z-10" />

      {/* Floating Icons with Enhanced Animation */}
      <div className="absolute inset-0 pointer-events-none -z-5">
        {floatingIcons.map(({ Icon, delay, x, y }, index) => (
          <motion.div
            key={`${x}-${y}-${delay}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: [0.05, 0.15, 0.05], 
              scale: [1, 1.2, 1],
              x: [0, 15, 0],
              y: [0, -15, 0],
              rotate: [0, 5, 0]
            }}
            transition={{
              duration: 6,
              delay,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
            className="absolute"
            style={{ 
              left: `calc(50% + ${x})`, 
              top: `calc(50% + ${y})`,
            }}
          >
            <Icon className="w-16 h-16 md:w-28 md:h-28 text-primary/10" strokeWidth={0.5} />
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Trusted by 500+ institutions</span>
          </div>
        </motion.div>

        {/* Heading with Gradient */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="font-departure text-[40px] md:text-[84px] leading-[1.1] tracking-tight">
            <span className="inline-block bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Museum Management,
            </span>
            <br />
            <span className="inline-block bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Simplified
            </span>
          </h1>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 text-center text-lg md:text-xl max-w-3xl mx-auto mt-6 md:mt-8 text-muted-foreground leading-relaxed"
        >
          Complete collection management for museums, galleries, and collectors. 
          Track accessions, manage locations, and publish your collection online.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
        >
          <Link
            href="https://app.museumlite.com/register"
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-base hover:shadow-lg hover:shadow-primary/50 transition-all duration-300 hover:scale-105"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
          </Link>
          
          <Button
            className="px-8 py-4 bg-transparent text-foreground rounded-full font-semibold text-base border-2 border-border hover:border-primary/50 hover:bg-accent transition-all duration-300"
          >
            Watch Demo
          </Button>
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-8"
        >
          {features.map((feature) => (
            <div
              key={feature}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50 border border-border/50 backdrop-blur-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{feature}</span>
            </div>
          ))}
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex items-center justify-center gap-8 text-muted-foreground/60"
        >
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-foreground">500+</div>
            <div className="text-xs">Institutions</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-foreground">50k+</div>
            <div className="text-xs">Items Catalogued</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-foreground">99.9%</div>
            <div className="text-xs">Uptime</div>
          </div>
        </motion.div>
      </div>

      {/* 3D Grid Background - Bottom */}
      <div className="absolute -bottom-[280px] inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(560px)_rotateX(63deg)] pointer-events-none opacity-40" />
      
      {/* Gradient Overlay - Bottom */}
      <div className="absolute w-full bottom-[100px] h-1/2 bg-gradient-to-b from-background to-transparent pointer-events-none -z-10" />
    </section>
  );
}
