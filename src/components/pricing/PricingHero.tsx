"use client";

import { motion } from "framer-motion";

export function PricingHero() {
  return (
    <section className="relative pt-32 pb-16 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-obsidian/50 to-obsidian" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-6"
        >
          <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse-glow" />
          <span className="text-xs text-mist/80 font-medium tracking-wide">
            Transparent pricing — built for European B2B SaaS
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-tight"
        >
          Pay for outcomes,
          <br />
          not for seats.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-mist/70 max-w-2xl mx-auto mb-4"
        >
          Start with Sales Intelligence today. Activate CS Health, Discovery, and Research as your team grows.
          One platform. One contract. Linear cost, compounding value.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-sm text-mist/40"
        >
          14-day free trial · No credit card required · Cancel anytime
        </motion.p>
      </div>
    </section>
  );
}
