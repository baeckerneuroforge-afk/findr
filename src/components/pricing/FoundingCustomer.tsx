"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

const benefits = [
  { icon: "%", title: "50% lifetime discount", desc: "On every tier, forever. Lock in your price now." },
  { icon: "↗", title: "Direct founder access", desc: "WhatsApp line to André. Real conversations, no support tickets." },
  { icon: "◇", title: "Shape the roadmap", desc: "Monthly calls. Your input directly influences what we build next." },
  { icon: "★", title: "Priority everything", desc: "Support, features, integrations. You jump every queue." },
  { icon: "◎", title: "Case study spotlight", desc: "Featured prominently in our marketing. Free brand exposure." },
  { icon: "✦", title: "Founders dinner annually", desc: "Real-life meetup with all founding customers. Berlin or Munich." },
];

export function FoundingCustomer() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-transparent to-obsidian" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse-glow" />
            <span className="text-xs text-red-400 font-medium tracking-wide">
              LIMITED — 10 SPOTS FOR DACH B2B SaaS
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Founding Customer Program
          </h2>
          <p className="text-lg text-mist/70 max-w-2xl mx-auto">
            The first 10 companies to commit get more than software. You become co-founders of what Findr becomes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className="glass-card glass-card-hover rounded-2xl p-6 relative overflow-hidden group"
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all" />
              <div className="relative">
                <div className="text-3xl text-violet-400 mb-3 font-bold">{b.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-sm text-mist/70 leading-relaxed">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <Link href="/sign-up?plan=founding" className="relative group inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-violet-400 to-red-500 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity animate-pulse-glow" />
            <button className="relative bg-violet-500 hover:bg-violet-400 text-white font-semibold px-8 py-4 rounded-xl transition-all">
              Apply as founding customer →
            </button>
          </Link>
          <p className="text-xs text-mist/40 mt-4">
            Applications reviewed within 48 hours · Decision call with founder
          </p>
        </motion.div>
      </div>
    </section>
  );
}
