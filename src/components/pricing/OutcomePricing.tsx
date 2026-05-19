"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

export function OutcomePricing() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-20" />

      <div className="relative max-w-5xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="glass-card rounded-3xl p-10 md:p-16 relative overflow-hidden"
        >
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium tracking-wide mb-4">
                CFO-FAVORITE
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
                Outcome-based pricing.
              </h2>
              <p className="text-mist/70 leading-relaxed mb-6">
                Tired of paying for software whether it delivers or not? Pay a low base fee plus a small share of the deals Findr helps you recover.
              </p>
              <Link href="/sign-up?plan=outcome" className="relative group inline-block">
                <button className="bg-white/5 hover:bg-white/10 border border-violet-500/30 hover:border-violet-500/60 text-white font-medium px-6 py-3 rounded-xl transition-all">
                  Talk to us about outcome pricing →
                </button>
              </Link>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5">
                <div className="text-xs text-mist/50 tracking-wide mb-1">BASE FEE</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">€399</span>
                  <span className="text-mist/50 text-sm">/month</span>
                </div>
                <div className="text-xs text-mist/60 mt-1">50% off standard tier pricing</div>
              </div>

              <div className="flex justify-center text-violet-400">+</div>

              <div className="glass-card rounded-xl p-5">
                <div className="text-xs text-mist/50 tracking-wide mb-1">PERFORMANCE</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">1.5%</span>
                  <span className="text-mist/50 text-sm">of recovered ARR</span>
                </div>
                <div className="text-xs text-mist/60 mt-1">Only on deals Findr flagged as at-risk and you closed</div>
              </div>

              <div className="text-center text-xs text-mist/40 mt-4">
                Capped at 3x standard tier · No surprise bills
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
