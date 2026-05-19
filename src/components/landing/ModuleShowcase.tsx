"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

const modules = [
  {
    phase: "Phase 1 · M0–12",
    name: "Sales Intelligence",
    tagline: "Stop losing deals you should win.",
    buyer: "VP Sales, RevOps",
    pain: "Forecast accuracy stuck at 60%. Lost deals tagged 'Pricing' in CRM. No one knows the real reason.",
    features: [
      "Real-time deal risk scoring",
      "AI post-loss voice interviews",
      "Pipeline forecasting (90% accuracy)",
      "Auto loss-reason detection",
    ],
    pricing: "from €499/month",
    accent: "violet",
  },
  {
    phase: "Phase 2 · M12–24",
    name: "Customer Success Health",
    tagline: "Know your customers before they churn.",
    buyer: "VP Customer Success",
    pain: "You find out your customer is unhappy at the renewal call. Too late. 60–90 days too late.",
    features: [
      "Cross-source health score",
      "Churn risk prediction 60–90 days out",
      "Sales-to-CS bridge",
      "Expansion opportunity detection",
    ],
    pricing: "+€499/month",
    accent: "violet",
  },
  {
    phase: "Phase 3 · M24–36",
    name: "Product Discovery",
    tagline: "Build what users actually need.",
    buyer: "VP Product",
    pain: "You build features no one wants. User interviews are 1-on-1, slow, expensive.",
    features: [
      "AI-moderated interviews at scale",
      "Continuous discovery pipeline",
      "Sales-lost-to-product-backlog link",
      "Auto persona builder",
    ],
    pricing: "+€499/month",
    accent: "violet",
  },
  {
    phase: "Phase 4 · M36+",
    name: "Market Research",
    tagline: "Insights at the speed of decision.",
    buyer: "CMO, Insights",
    pain: "Market research takes 8 weeks, costs €50k per study. You need answers in 48 hours.",
    features: [
      "1000 parallel interviews",
      "Auto-synthesis reports in 2h",
      "Brand perception tracking",
      "Visual intelligence",
    ],
    pricing: "+€999/month",
    accent: "violet",
  },
];

export function ModuleShowcase() {
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="modules" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian to-obsidian-light" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium tracking-wide mb-4">
            THE FOUR MODULES
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Land with one. Expand to four.
          </h2>
          <p className="text-lg text-mist/70 max-w-2xl mx-auto">
            Start with Sales Intelligence. Activate CS Health when ready. Grow organically into Discovery + Research.
            Net Revenue Retention: 130–150%.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {modules.map((mod, i) => (
              <motion.button
                key={mod.name}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                onClick={() => setActive(i)}
                className={`w-full text-left p-5 rounded-xl border transition-all ${
                  active === i
                    ? "bg-violet-500/10 border-violet-500/40"
                    : "bg-white/[0.02] border-white/5 hover:border-violet-500/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-violet-400/80 tracking-wide">{mod.phase}</div>
                  <div className="text-xs text-mist/40">{mod.pricing}</div>
                </div>
                <div className="text-lg font-semibold text-white mb-1">{mod.name}</div>
                <div className="text-sm text-mist/60 italic">{mod.tagline}</div>
              </motion.button>
            ))}
          </div>

          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card rounded-2xl p-8 relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="text-xs text-mist/50 mb-1 tracking-wide">FOR</div>
              <div className="text-white font-semibold mb-6">{modules[active].buyer}</div>

              <div className="text-xs text-mist/50 mb-1 tracking-wide">THE PAIN</div>
              <div className="text-mist/80 mb-6 leading-relaxed">{modules[active].pain}</div>

              <div className="text-xs text-mist/50 mb-3 tracking-wide">WHAT FINDR DELIVERS</div>
              <div className="space-y-2">
                {modules[active].features.map((f, i) => (
                  <motion.div
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    <div className="text-sm text-mist/80">{f}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
