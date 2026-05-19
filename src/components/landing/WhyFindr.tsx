"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const reasons = [
  {
    title: "AI-Native, nicht AI-Bolt-on",
    desc: "Clari + Gong wurden 2015 gebaut. Keyword-Matching, kein Context. Findr ist von Tag 1 GenAI-native.",
    metric: "10x",
    metricLabel: "präziser",
  },
  {
    title: "EU-Native, nicht Translation",
    desc: "Hosting in Frankfurt. DSGVO + EU AI Act compliant by default. Deutsche AI-Models für DACH-Sales-Sprache.",
    metric: "100%",
    metricLabel: "compliant",
  },
  {
    title: "One Platform, nicht Tool-Stack",
    desc: "Companies geben €450/User für Clari+Gong aus. Findr ersetzt 4 Tools mit einem Core. Brutal effizient.",
    metric: "60%",
    metricLabel: "günstiger",
  },
  {
    title: "DACH-First, nicht US-Bias",
    desc: "Wir verstehen deutsche Buyer-Patterns. Längere Cycles. Mehr Stakeholder. Compliance-Heavy. Findr ist dafür gebaut.",
    metric: "5x",
    metricLabel: "Founder-Market-Fit",
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
            WARUM FINDR
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Vier strukturelle Wedges.
          </h2>
          <p className="text-lg text-mist/70 max-w-2xl mx-auto">
            Nicht Features. Nicht Marketing. Echte Architektur-Entscheidungen die unsere Konkurrenz nicht kopieren kann.
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
