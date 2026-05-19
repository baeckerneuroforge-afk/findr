"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const modules = [
  {
    phase: "Phase 1",
    name: "Sales Intelligence",
    status: "Available now",
    statusColor: "text-emerald-400",
    statusBg: "bg-emerald-500/10",
    description: "Real-time deal risk scoring, AI loss-reason detection, pipeline forecasting.",
    pricing: "from €499/month",
    available: true,
  },
  {
    phase: "Phase 2",
    name: "Customer Success Health",
    status: "Q2 2027",
    statusColor: "text-violet-400",
    statusBg: "bg-violet-500/10",
    description: "Cross-source health scores, churn risk prediction, expansion opportunity detection.",
    pricing: "+ €499/month",
    available: false,
  },
  {
    phase: "Phase 3",
    name: "Product Discovery",
    status: "Q1 2028",
    statusColor: "text-violet-400",
    statusBg: "bg-violet-500/10",
    description: "AI-moderated user interviews at scale, continuous discovery, auto persona builder.",
    pricing: "+ €499/month",
    available: false,
  },
  {
    phase: "Phase 4",
    name: "Market Research",
    status: "Q3 2028",
    statusColor: "text-violet-400",
    statusBg: "bg-violet-500/10",
    description: "1000 parallel interviews, auto-synthesis reports, brand perception tracking.",
    pricing: "+ €999/month",
    available: false,
  },
];

export function PlatformRoadmap() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32">
      <div className="max-w-6xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium tracking-wide mb-4">
            THE PLATFORM ROADMAP
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            One contract. Four modules. Compounding value.
          </h2>
          <p className="text-lg text-mist/70 max-w-2xl mx-auto">
            Start with Sales Intelligence today. As we ship Phase 2-4, your platform expands automatically.
            Founding customers get early access and locked-in pricing.
          </p>
        </motion.div>

        <div className="space-y-4">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className={`glass-card rounded-2xl p-6 ${
                mod.available ? "border-violet-500/30" : "opacity-80"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="md:w-32 shrink-0">
                  <div className="text-xs text-mist/50 tracking-wide mb-1">{mod.phase}</div>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${mod.statusBg}`}>
                    {mod.available && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-glow" />}
                    <span className={`text-xs font-medium ${mod.statusColor}`}>{mod.status}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-1">{mod.name}</h3>
                  <p className="text-sm text-mist/70 leading-relaxed">{mod.description}</p>
                </div>

                <div className="md:w-32 md:text-right shrink-0">
                  <div className="text-sm text-violet-400 font-medium">{mod.pricing}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
