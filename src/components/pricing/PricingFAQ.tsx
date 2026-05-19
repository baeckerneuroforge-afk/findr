"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const faqs = [
  {
    q: "How does the 14-day free trial work?",
    a: "Sign up, connect your CRM and call recording tool, and Findr starts analyzing immediately. No credit card required. After 14 days you decide whether to convert to a paid plan or walk away with the insights you gathered.",
  },
  {
    q: "What if my team is between two tiers?",
    a: "We size flexibly. If you have 7 reps you're between Starter (5) and Growth (15) — we typically offer Growth at a prorated rate during your first year. Book a demo and we'll work it out together.",
  },
  {
    q: "Can I switch from seat-based to outcome-based pricing later?",
    a: "Yes. Most customers start with seat-based to validate the product, then switch to outcome-based once they trust Findr's risk-detection accuracy. Switching takes 5 minutes.",
  },
  {
    q: "What happens when Phase 2-4 modules launch?",
    a: "Existing customers get early access at locked-in pricing. Founding customers get free 90-day pilots on every new module. You can activate or skip any module — no forced upgrades.",
  },
  {
    q: "Is my data GDPR and EU AI Act compliant?",
    a: "Yes, by default. All data is hosted in Frankfurt (Supabase EU). We're SOC 2 Type II in progress, ISO 27001 on roadmap. Full DPA available for every plan. We never train external models on your data.",
  },
  {
    q: "What if Clari or Gong matches your price?",
    a: "They won't — their cost structure doesn't allow it. But even if they tried, our wedge isn't price. It's AI-native architecture, EU-native compliance, and one platform replacing four tools. Pricing is just the visible part.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Monthly plans cancel anytime, no questions asked. Annual plans (15% discount) lock in for 12 months. Founding customer terms are 12 months minimum to qualify for lifetime discount.",
  },
  {
    q: "Do you offer non-profit or startup discounts?",
    a: "Yes. YC, Techstars, and EU-funded startups get 30% off for the first year. Non-profits get 50% off. Email founders@findr.io with proof.",
  },
];

export function PricingFAQ() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32">
      <div className="max-w-4xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium tracking-wide mb-4">
            QUESTIONS
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Frequently asked
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.details
              key={faq.q}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className="glass-card rounded-xl group"
            >
              <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                <span className="text-white font-medium pr-4">{faq.q}</span>
                <svg className="w-5 h-5 text-violet-400 transition-transform group-open:rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-5 text-mist/70 text-sm leading-relaxed">
                {faq.a}
              </div>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}
