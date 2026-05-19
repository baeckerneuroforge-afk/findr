"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

const tiers = [
  {
    name: "Starter",
    price: "€499",
    period: "/month",
    description: "For small sales teams getting started with AI-powered intelligence",
    seats: "Up to 5 sales reps",
    features: [
      "Real-time deal risk scoring",
      "AI loss-reason detection",
      "Hubspot or Salesforce integration",
      "Gong, Chorus, or Zoom integration",
      "Slack alerts",
      "Email support",
      "GDPR + EU AI Act compliant",
    ],
    cta: "Start free trial",
    href: "/sign-up?plan=starter",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "€999",
    period: "/month",
    description: "For scaling sales teams that need predictive intelligence and coaching",
    seats: "Up to 15 sales reps",
    features: [
      "Everything in Starter",
      "AI post-loss voice interviews",
      "Pipeline forecasting (90% accuracy)",
      "Coaching recommendations",
      "Multi-CRM + multi-call-source",
      "MS Teams integration",
      "Priority support",
      "Founding customer eligible",
    ],
    cta: "Book a demo",
    href: "/sign-up?plan=growth",
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Scale",
    price: "€1,999",
    period: "/month",
    description: "For high-velocity revenue teams running 30+ reps and complex deal flows",
    seats: "Up to 30 sales reps",
    features: [
      "Everything in Growth",
      "Custom risk-signal models",
      "Quarterly competitor intelligence reports",
      "Dedicated customer success manager",
      "SLA-backed uptime",
      "Custom integrations on request",
      "Quarterly business reviews",
    ],
    cta: "Book a demo",
    href: "/sign-up?plan=scale",
    highlighted: false,
  },
];

export function PricingTable() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-16">
      <div className="max-w-7xl mx-auto px-6" ref={ref}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className={`relative rounded-2xl p-8 ${
                tier.highlighted
                  ? "glow-border"
                  : "glass-card glass-card-hover"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-violet-500 to-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {tier.badge}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-sm text-mist/60 leading-relaxed">{tier.description}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-violet-500/10">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">{tier.price}</span>
                  <span className="text-mist/50 text-sm">{tier.period}</span>
                </div>
                <div className="text-xs text-mist/50 mt-2">{tier.seats}</div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-mist/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={tier.href} className="block">
                {tier.highlighted ? (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-red-500 rounded-xl blur-sm opacity-70 group-hover:opacity-100 transition-opacity" />
                    <button className="relative w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold py-3 rounded-xl transition-colors">
                      {tier.cta}
                    </button>
                  </div>
                ) : (
                  <button className="w-full border border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5 text-white font-medium py-3 rounded-xl transition-all">
                    {tier.cta}
                  </button>
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 glass-card rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-red-400 tracking-wide font-medium">ENTERPRISE</div>
              <div className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">Custom</div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Need more? Let&apos;s talk.</h3>
            <p className="text-sm text-mist/70 leading-relaxed">
              Custom seats · Multi-module bundles · Outcome-based pricing · SOC 2 · ISO 27001 · BYOK · Custom AI models · Dedicated CSM · 24/7 SLA support
            </p>
          </div>
          <Link href="/sign-up?plan=enterprise" className="shrink-0">
            <button className="bg-white/5 hover:bg-white/10 border border-violet-500/30 hover:border-violet-500/60 text-white font-semibold px-6 py-3 rounded-xl transition-all whitespace-nowrap">
              Talk to sales →
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
