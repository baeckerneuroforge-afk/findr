"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const reasons = [
  {
    title: "AI-native, not AI bolt-on",
    desc: "Clari + Gong were built in 2015. Keyword matching, no context. Findr is GenAI-native from day one.",
    metric: "10x",
    metricLabel: "more accurate",
  },
  {
    title: "EU-native, not translated",
    desc: "Hosted in Frankfurt. GDPR + EU AI Act compliant by default. German AI models trained on DACH sales language.",
    metric: "100%",
    metricLabel: "compliant",
  },
  {
    title: "One platform, not a tool stack",
    desc: "Companies spend €450/user on Clari+Gong stacks. Findr replaces 4 tools with one core. Brutally efficient.",
    metric: "60%",
    metricLabel: "cheaper",
  },
  {
    title: "DACH-first, not US-biased",
    desc: "We understand German buyer patterns. Longer cycles. More stakeholders. Compliance-heavy. Findr is built for it.",
    metric: "5x",
    metricLabel: "founder-market fit",
  },
];

export function WhyFindr() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="why" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-obsidian/95 to-obsidian" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium tracking-wide mb-4">
            WHY FINDR
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Four structural wedges.
          </h2>
          <p className="text-lg text-mist/70 max-w-2xl mx-auto">
            Not features. Not marketing. Real architecture decisions our competition can't copy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {reasons.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="glass-card glass-card-hover rounded-2xl p-8 relative overflow-hidden group"
            >
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-all" />
              <div className="relative">
                <div className="flex items-baseline gap-3 mb-4">
                  <div className="text-5xl font-bold bg-gradient-to-br from-violet-300 to-violet-500 bg-clip-text text-transparent">
                    {r.metric}
                  </div>
                  <div className="text-sm text-mist/50">{r.metricLabel}</div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{r.title}</h3>
                <p className="text-mist/70 leading-relaxed">{r.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
