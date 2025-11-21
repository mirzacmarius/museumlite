"use client";

import { motion } from "framer-motion";

export function VisualShowcase() {
  return (
    <section className="py-32 px-4 relative bg-black overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-neon-purple/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 text-white"
          >
            Immersive Interface
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Experience a workspace that feels like the future.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 10 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl"
          style={{ perspective: "1000px" }}
        >
          {/* Browser Frame */}
          <div className="relative rounded-xl bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
            {/* Header */}
            <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <div className="ml-4 h-6 w-64 rounded-full bg-white/5" />
            </div>

            {/* Content Area (Mockup) */}
            <div className="aspect-video w-full bg-black/50 relative overflow-hidden group">
              {/* Abstract UI Mockup */}
              <div className="absolute inset-0 p-8 grid grid-cols-12 gap-6">
                 {/* Sidebar */}
                 <div className="col-span-2 h-full rounded-lg bg-white/5 border border-white/5" />
                 
                 {/* Main Content */}
                 <div className="col-span-10 h-full flex flex-col gap-6">
                    {/* Top Bar */}
                    <div className="h-16 w-full rounded-lg bg-white/5 border border-white/5 flex items-center px-6 justify-between">
                       <div className="h-4 w-32 bg-white/10 rounded" />
                       <div className="h-8 w-8 rounded-full bg-neon-blue/20" />
                    </div>
                    
                    {/* Grid */}
                    <div className="flex-1 grid grid-cols-3 gap-6">
                       {[1, 2, 3, 4, 5, 6].map((i) => (
                         <div key={i} className="rounded-lg bg-white/5 border border-white/5 relative overflow-hidden group/card">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                            
                            {/* Animated Content Inside Cards */}
                            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
                              <div className="h-2 w-12 bg-white/10 rounded" />
                              <motion.div 
                                initial={{ height: "20%" }}
                                whileInView={{ height: `${Math.random() * 60 + 20}%` }}
                                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", ease: "easeInOut", delay: i * 0.2 }}
                                className="w-2 bg-neon-blue/40 rounded-t"
                              />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Scanning Line Animation */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-blue/5 to-transparent h-[20%] w-full animate-scan pointer-events-none" />
            </div>
          </div>
          
          {/* Glow Underneath */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[90%] h-20 bg-neon-blue/20 blur-[60px] -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
