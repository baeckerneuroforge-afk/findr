"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const modules = [
  { name: "Sales Intel", phase: "Phase 1", color: "from-violet-500 to-violet-600" },
  { name: "CS Health", phase: "Phase 2", color: "from-violet-500 to-violet-600" },
  { name: "Discovery", phase: "Phase 3", color: "from-violet-500 to-violet-600" },
  { name: "Research", phase: "Phase 4", color: "from-violet-500 to-violet-600" },
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
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-obsidian/95 to-obsidian" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium tracking-wide mb-4">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="glass-card glass-card-hover rounded-2xl p-6 text-center relative overflow-hidden group"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-all" />
              <div className="relative">
                <div className="text-xs text-violet-400/80 mb-2 tracking-wide">{mod.phase}</div>
                <div className="text-lg font-semibold text-white">{mod.name}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mb-12">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.05 }}
              className="w-px h-12 bg-gradient-to-b from-violet-500/40 to-transparent mx-12 origin-top"
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="relative rounded-3xl glow-border p-8 md:p-12 mb-12"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-3xl" />
          <div className="relative">
            <div className="text-center mb-8">
              <div className="text-xs text-violet-400 tracking-wide mb-2">CONVERSATION INTELLIGENCE CORE</div>
              <h3 className="text-2xl md:text-3xl font-bold text-white">One shared AI brain</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: "AI Engine", detail: "Voice + Text + Vision · Multilingual · EU AI Act compliant" },
                { name: "Knowledge Graph", detail: "Customer + Deal Memory · Cross-Module Context" },
                { name: "Pattern Engine", detail: "Cross-Source Signals · Risk + Insights · Auto-Detection" },
              ].map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                  className="bg-white/[0.02] border border-violet-500/10 rounded-xl p-5 text-center"
                >
                  <div className="text-white font-semibold mb-2">{item.name}</div>
                  <div className="text-xs text-mist/60 leading-relaxed">{item.detail}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="flex justify-center mb-12">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 0.4, delay: 1.0 + i * 0.05 }}
              className="w-px h-12 bg-gradient-to-b from-violet-500/40 to-transparent mx-20 origin-top"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sources.map((src, i) => (
            <motion.div
              key={src.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 1.1 + i * 0.1 }}
              className="glass-card rounded-2xl p-6 text-center"
            >
              <div className="text-sm font-semibold text-white mb-1">{src.name}</div>
              <div className="text-xs text-mist/50">{src.detail}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
