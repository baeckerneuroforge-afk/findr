"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";
import { CheckIcon } from "./icons";

const modules = [
  {
    phase: "Phase 1 · M0–12",
    price: "from €499/month",
    name: "Sales Intelligence",
    tag: "Stop losing deals you should win.",
    who: "VP Sales, RevOps",
    pain: 'Forecast accuracy stuck at 60%. Lost deals tagged "Pricing" in CRM. No one knows the real reason.',
    deliver: [
      "Real-time deal risk scoring",
      "AI post-loss voice interviews",
      "Pipeline forecasting",
      "Automated loss-reason detection",
    ],
  },
  {
    phase: "Phase 2 · M12–24",
    price: "+€499/month",
    name: "Customer Success Health",
    tag: "Know your customers before they churn.",
    who: "VP Customer Success",
    pain: "Churn shows up in the renewal forecast — when it's already too late to act. Health scores are guesswork.",
    deliver: [
      "Conversation-based health scoring",
      "Early churn-signal detection",
      "At-risk account alerts",
      "Expansion-opportunity surfacing",
    ],
  },
  {
    phase: "Phase 3 · M24–36",
    price: "+€499/month",
    name: "Product Discovery",
    tag: "Build what users actually need.",
    who: "Head of Product",
    pain: "Feature requests live in 12 tools. The loudest customer wins — not the most important signal.",
    deliver: [
      "Auto-clustered feature themes",
      "Cross-call demand signals",
      "Priority scoring by revenue impact",
      "Voice-of-customer evidence",
    ],
  },
  {
    phase: "Phase 4 · M36+",
    price: "+€999/month",
    name: "Market Research",
    tag: "Insights at the speed of decision.",
    who: "Founders, Strategy",
    pain: "Market shifts hide in thousands of conversations no human has time to read end to end.",
    deliver: [
      "Cross-conversation trend detection",
      "Competitive-mention tracking",
      "Segment-level insight synthesis",
      "Decision-ready briefings",
    ],
  },
];

export function Modules() {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const current = modules[active];

  return (
    <section id="modules" className="py-[84px]">
      <div className="max-w-[1180px] mx-auto px-7">
        <Reveal>
          <div className="text-center max-w-[660px] mx-auto mb-[56px]">
            <span className="inline-block bg-comic-purple text-white text-[12px] font-semibold tracking-[0.12em] uppercase px-[14px] py-[5px] rounded-[8px] rotate-[-1deg] mb-[22px]">
              The four modules
            </span>
            <h2 className="font-display font-bold text-[clamp(34px,5vw,56px)] mb-[18px]">
              Land with one. Expand to four.
            </h2>
            <p className="text-[18px] text-comic-muted font-medium leading-[1.55]">
              Start with Sales Intelligence. Activate CS Health when ready. Grow organically into
              Discovery + Research. Net Revenue Retention: 130–150%.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-9 items-start">
          {/* selectable module list */}
          <div className="flex flex-col gap-4">
            {modules.map((mod, i) => (
              <Reveal key={mod.name} delay={i * 0.06}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={active === i}
                  className={`w-full text-left bg-white border-[2.5px] border-ink rounded-[14px] px-5 py-[18px] cursor-pointer transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 ${
                    active === i ? "shadow-hard-red" : "shadow-hard hover:shadow-hard-lg"
                  }`}
                >
                  <div className="flex justify-between items-baseline mb-[6px]">
                    <span className="text-[12px] font-semibold text-comic-purple uppercase tracking-[0.04em]">
                      {mod.phase}
                    </span>
                    <span className="text-[13px] font-semibold text-comic-muted">{mod.price}</span>
                  </div>
                  <h3 className="font-display font-bold text-[23px]">{mod.name}</h3>
                  <div className="text-[14px] text-comic-muted font-medium italic mt-[3px]">{mod.tag}</div>
                </button>
              </Reveal>
            ))}
          </div>

          {/* detail panel */}
          <div className="bg-comic-yellow border-[2.5px] border-ink rounded-[18px] px-[26px] py-7 shadow-hard-lg relative top-0 md:sticky md:top-[90px]">
            <motion.div
              key={active}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-ink/60">For</div>
              <div className="font-display font-bold text-[24px] mt-1 mb-[22px]">{current.who}</div>

              <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-ink/60 mb-[7px]">
                The pain
              </div>
              <div className="text-[16px] font-medium leading-[1.5] pb-[22px] mb-[22px] border-b-[2.5px] border-ink">
                {current.pain}
              </div>

              <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-ink/60 mb-[7px]">
                What Findr delivers
              </div>
              <ul>
                {current.deliver.map((item) => (
                  <li key={item} className="list-none flex items-start gap-[10px] text-[15px] font-medium mb-[11px]">
                    <span className="flex-shrink-0 w-5 h-5 bg-ink text-comic-yellow rounded-[6px] flex items-center justify-center mt-[1px]">
                      <CheckIcon className="w-3 h-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
