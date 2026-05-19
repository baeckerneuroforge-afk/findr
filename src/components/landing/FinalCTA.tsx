"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

export function FinalCTA() {
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
          className="text-4xl md:text-6xl font-bold text-gradient mb-6 tracking-tight"
        >
          Bereit, deine Conversations zu verstehen?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg text-mist/70 mb-10 max-w-2xl mx-auto"
        >
          30 Min Discovery-Call. Wir zeigen dir Findr live an deinen echten Daten.
          Keine Pitches, kein Sales-Druck.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link href="/sign-up" className="relative group inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-violet-400 to-red-500 rounded-xl blur-lg opacity-70 group-hover:opacity-100 transition-opacity animate-pulse-glow" />
            <button className="relative bg-violet-500 hover:bg-violet-400 text-white font-semibold px-10 py-5 rounded-xl text-lg transition-all">
              Demo buchen →
            </button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 text-sm text-mist/40"
        >
          Built in Germany · Hosted in Frankfurt · EU AI Act compliant
        </motion.div>
      </div>
    </section>
  );
}
