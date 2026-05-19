"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  { n: "01", title: "Connect", desc: "Hubspot, Salesforce, Gong, Chorus, Zoom. 5-minute setup, zero friction." },
  { n: "02", title: "Listen", desc: "Findr analyzes every sales call, every CS touchpoint, every CRM update — automatically and in real time." },
  { n: "03", title: "Predict", desc: "Risk scores for every deal. Churn risk for every customer. Insights for every decision." },
  { n: "04", title: "Act", desc: "Slack alerts on risk spikes. Auto-interviews after closed-lost. Coaching briefings for sales managers." },
];

export function HowItWorks() {
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
            HOW IT WORKS
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Four steps. Live in hours.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="relative"
            >
              <div className="glass-card rounded-2xl p-6 h-full">
                <div className="text-3xl font-bold bg-gradient-to-br from-violet-400 to-violet-600 bg-clip-text text-transparent mb-4">
                  {s.n}
                </div>
                <div className="text-lg font-semibold text-white mb-2">{s.title}</div>
                <div className="text-sm text-mist/70 leading-relaxed">{s.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
