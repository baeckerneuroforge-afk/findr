"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const modules = [
  { name: "Sales Intel", phase: "Phase 1" },
  { name: "CS Health", phase: "Phase 2" },
  { name: "Discovery", phase: "Phase 3" },
  { name: "Research", phase: "Phase 4" },
];

const sources = [
  { name: "CRM Activity", detail: "Hubspot, Salesforce" },
  { name: "Sales Calls", detail: "Gong, Chorus, Zoom" },
  { name: "AI Interviews", detail: "Voice, Text, Video" },
];

export function PlatformVisualization() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="platform" className="relative py-32 overflow-hidden">
      {/* Atmospheric background: dark violet base, not pure black */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-violet-950/20 to-obsidian" />

      {/* Radial violet glow behind core */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/10 rounded-full blur-[120px]" />

      {/* Subtle mesh overlay */}
      <div className="absolute inset-0 gradient-mesh opacity-40" />

      {/* Decorative grid pattern (very subtle) */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium tracking-wide mb-4 backdrop-blur-sm">
            THE PLATFORM
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            One brain. Four applications.
          </h2>
          <p className="text-lg text-mist/70 max-w-2xl mx-auto">
            Instead of 4 disconnected tools, Findr builds one platform with a shared Conversation Intelligence Core.
            Data compounds. Insights cross-flow. NRR explodes.
          </p>
        </motion.div>

        {/* Top tier: Modules */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="relative rounded-2xl p-6 text-center group cursor-default"
              style={{
                background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(124, 58, 237, 0.02) 100%)",
                border: "1px solid rgba(124, 58, 237, 0.2)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl group-hover:bg-violet-500/30 transition-all duration-500" />
              <div className="relative">
                <div className="text-xs text-violet-300/90 mb-2 tracking-wider font-medium">{mod.phase}</div>
                <div className="text-lg font-semibold text-white">{mod.name}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Connectors with glow */}
        <div className="relative flex justify-center mb-12 h-16">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={inView ? { scaleY: 1, opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
              className="relative w-px h-16 mx-12 origin-top"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-violet-400/60 via-violet-500/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-violet-400/40 via-violet-500/20 to-transparent blur-sm" />
            </motion.div>
          ))}
        </div>

        {/* Core box with prominent glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="relative mb-12"
        >
          {/* Outer glow halo */}
          <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 via-violet-400/30 to-red-500/20 rounded-3xl blur-2xl opacity-60" />

          {/* Main core container */}
          <div className="relative rounded-3xl p-8 md:p-12 overflow-hidden"
               style={{
                 background: "linear-gradient(135deg, rgba(15, 8, 35, 0.95) 0%, rgba(30, 15, 60, 0.85) 50%, rgba(15, 8, 35, 0.95) 100%)",
                 border: "1px solid rgba(124, 58, 237, 0.4)",
                 boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 0 80px -20px rgba(124, 58, 237, 0.4)"
               }}>

            {/* Inner glow accents */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
            <div className="absolute -top-32 left-1/4 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 right-1/4 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="text-center mb-10">
                <div className="text-xs text-violet-300 tracking-widest mb-3 font-medium">
                  CONVERSATION INTELLIGENCE CORE
                </div>
                <h3 className="text-3xl md:text-4xl font-bold text-white">One shared AI brain</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "AI Engine", detail: "Voice + Text + Vision · Multilingual · EU AI Act compliant", icon: "◆" },
                  { name: "Knowledge Graph", detail: "Customer + Deal Memory · Cross-Module Context", icon: "◈" },
                  { name: "Pattern Engine", detail: "Cross-Source Signals · Risk + Insights · Auto-Detection", icon: "◇" },
                ].map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                    className="relative rounded-xl p-6 text-center group"
                    style={{
                      background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(124, 58, 237, 0.05) 100%)",
                      border: "1px solid rgba(124, 58, 237, 0.2)",
                    }}
                  >
                    <div className="text-2xl text-violet-400/80 mb-3">{item.icon}</div>
                    <div className="text-white font-semibold mb-2">{item.name}</div>
                    <div className="text-xs text-mist/60 leading-relaxed">{item.detail}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Connectors down to data sources */}
        <div className="relative flex justify-center mb-12 h-16">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={inView ? { scaleY: 1, opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 1.0 + i * 0.08 }}
              className="relative w-px h-16 mx-20 origin-top"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-violet-500/40 via-violet-400/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-violet-500/20 via-violet-400/40 to-transparent blur-sm" />
            </motion.div>
          ))}
        </div>

        {/* Bottom tier: Data sources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sources.map((src, i) => (
            <motion.div
              key={src.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 1.1 + i * 0.1 }}
              className="relative rounded-2xl p-6 text-center group cursor-default overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-all" />
              <div className="relative">
                <div className="text-sm font-semibold text-white mb-1">{src.name}</div>
                <div className="text-xs text-mist/50">{src.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
