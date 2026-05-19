"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

export function PricingFinalCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh" />
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-transparent to-obsidian" />

      <div className="relative max-w-4xl mx-auto px-6 text-center" ref={ref}>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight"
        >
          Still on the fence?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg text-mist/70 mb-10 max-w-2xl mx-auto"
        >
          Book a 30-minute demo. We connect to your real data, show you exactly what Findr would flag,
          and you decide. No pitches, no pressure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/sign-up" className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-violet-400 to-red-500 rounded-xl blur-lg opacity-70 group-hover:opacity-100 transition-opacity animate-pulse-glow" />
            <button className="relative bg-violet-500 hover:bg-violet-400 text-white font-semibold px-10 py-5 rounded-xl text-lg transition-all">
              Book a demo →
            </button>
          </Link>
          <Link href="mailto:founders@findr.io" className="text-mist/70 hover:text-white px-6 py-5 transition-colors">
            Email the founder →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
