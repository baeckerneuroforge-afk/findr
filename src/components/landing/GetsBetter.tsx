"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const cards = [
  {
    title: "Calibrates to you",
    desc: "Forecasts and risk signals adjust to your real win rates and deal patterns — not industry averages.",
  },
  {
    title: "Sharper with every deal",
    desc: "Each closed deal feeds back into the model. Call analysis, risk detection, and predictions improve continuously.",
  },
  {
    title: "Yours alone",
    desc: "The model reflects your market, your sales motion, your customers. It becomes a compounding advantage competitors can't copy.",
  },
];

export function GetsBetter() {
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
            GETS SMARTER OVER TIME
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Findr learns your business.
          </h2>
          <p className="text-sm md:text-base text-mist/70 max-w-2xl mx-auto leading-relaxed">
            Risk scoring, loss prediction, and forecasting calibrate to your
            historical deals — the more you close, the sharper Findr gets for
            your team.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="relative"
            >
              <div className="glass-card rounded-2xl p-6 h-full">
                <div className="text-lg font-semibold text-white mb-2">
                  {card.title}
                </div>
                <div className="text-sm text-mist/70 leading-relaxed">
                  {card.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
