"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

const taglines = [
  "Stop losing deals you should win.",
  "Know your customers before they churn.",
  "Build what users actually need.",
  "Get insights at the speed of decision.",
];

export function Hero() {
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      <div className="absolute inset-0 gradient-mesh" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-obsidian/50 to-obsidian" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-8"
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse-glow" />
          <span className="text-xs text-mist/80 font-medium tracking-wide">
            Conversation Intelligence Platform — Built for Europe
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-gradient mb-6 leading-[1.05]"
        >
          One AI brain.
          <br />
          Four products.
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-red-400 bg-clip-text text-transparent">
            Zero data silos.
          </span>
        </motion.h1>

        <div className="h-8 mb-10 relative">
          <motion.p
            key={taglineIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-lg md:text-xl text-mist/70 italic absolute inset-0"
          >
            {taglines[taglineIndex]}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/sign-up" className="relative group w-full sm:w-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-violet-400 to-red-500 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity animate-pulse-glow" />
            <button className="relative w-full sm:w-auto bg-violet-500 hover:bg-violet-400 text-white font-semibold px-8 py-4 rounded-xl transition-all">
              Demo buchen → 30 Min
            </button>
          </Link>
          <Link href="#platform" className="text-mist/70 hover:text-white px-6 py-4 transition-colors">
            Wie es funktioniert →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-xs text-mist/40 tracking-wider uppercase"
        >
          Built for B2B SaaS · EU-Hosted · DSGVO + EU AI Act compliant
        </motion.div>
      </div>
    </section>
  );
}
