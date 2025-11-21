"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, PlayCircle } from "lucide-react";
import { Button } from "@v1/ui/button";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black selection:bg-neon-purple/30">
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      {/* Particles / Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-white rounded-full opacity-20"
            initial={{
              x: Math.random() * 100 + "%",
              y: Math.random() * 100 + "%",
              scale: Math.random() * 0.5 + 0.5,
            }}
            animate={{
              y: [null, Math.random() * -100 + "%"],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            style={{
              width: Math.random() * 4 + "px",
              height: Math.random() * 4 + "px",
            }}
          />
        ))}
      </div>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-neon-blue/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[20%] w-[600px] h-[600px] bg-neon-purple/20 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-pointer group"
        >
          <Sparkles className="w-4 h-4 text-neon-blue group-hover:animate-spin" />
          <span className="text-sm font-medium text-gray-300">The Future of Collection Management</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-8xl font-bold tracking-tighter mb-6 drop-shadow-2xl"
        >
          <span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Museum</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-white to-neon-purple animate-gradient-x drop-shadow-[0_0_25px_rgba(0,243,255,0.4)]">
            Lite
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Experience the next generation of museum software. 
          <span className="text-white font-medium drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"> AI-powered</span>, 
          <span className="text-white font-medium drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"> lightning fast</span>, and 
          <span className="text-white font-medium drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"> beautifully designed</span> for the modern curator.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="https://app.museumlite.com/register">
            <Button className="relative overflow-hidden h-14 px-8 rounded-full bg-white text-black hover:bg-gray-200 text-lg font-semibold transition-all hover:scale-105 group">
              <span className="relative z-10 flex items-center">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-shimmer group-hover:animate-none" />
            </Button>
          </Link>
          
          <Button variant="outline" className="h-14 px-8 rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 text-lg font-medium backdrop-blur-sm transition-all hover:scale-105">
            <PlayCircle className="mr-2 w-5 h-5" />
            Watch Demo
          </Button>
        </motion.div>

        {/* Floating UI Elements (Decorative) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-6xl pointer-events-none z-[-1]">
           {/* Left Card */}
           <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="absolute top-[20%] left-[5%] hidden md:block p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl rotate-[-6deg] w-64"
           >
             <div className="flex items-center gap-3 mb-3">
               <div className="w-10 h-10 rounded-full bg-neon-blue/20 flex items-center justify-center">
                 <Sparkles className="w-5 h-5 text-neon-blue" />
               </div>
               <div>
                 <div className="h-2 w-20 bg-white/20 rounded mb-1" />
                 <div className="h-2 w-12 bg-white/10 rounded" />
               </div>
             </div>
             <div className="h-20 bg-white/5 rounded-lg border border-white/5" />
           </motion.div>

           {/* Right Card */}
           <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="absolute bottom-[30%] right-[5%] hidden md:block p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl rotate-[6deg] w-64"
           >
             <div className="flex items-center justify-between mb-3">
               <div className="h-2 w-24 bg-white/20 rounded" />
               <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
             </div>
             <div className="space-y-2">
               <div className="h-2 w-full bg-white/5 rounded" />
               <div className="h-2 w-[80%] bg-white/5 rounded" />
               <div className="h-2 w-[60%] bg-white/5 rounded" />
             </div>
           </motion.div>
        </div>

      </div>
      
      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </section>
  );
}
