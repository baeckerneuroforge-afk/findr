import type { CSSProperties } from "react";
import { Reveal } from "./Reveal";
import { CheckIcon } from "./icons";
import { DoodleArrow, DoodleAsterisk, DoodleSquiggle } from "./doodles";
import { DEMO_BOOKING_URL } from "./constants";

type Tier = {
  name: string;
  desc: string;
  price: string;
  reps: string;
  checkBg: string;
  features: string[];
  cta: string;
  btnClass: string;
  rotate?: string;
  popular?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Starter",
    desc: "For small sales teams getting started with AI-powered intelligence.",
    price: "€499",
    reps: "Up to 5 sales reps",
    checkBg: "bg-comic-green",
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
    btnClass: "bg-white text-ink",
    rotate: "-0.8deg",
  },
  {
    name: "Growth",
    desc: "For scaling sales teams that need predictive intelligence and coaching.",
    price: "€999",
    reps: "Up to 15 sales reps",
    checkBg: "bg-comic-purple",
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
    btnClass: "bg-comic-purple text-white",
    popular: true,
  },
  {
    name: "Scale",
    desc: "For high-velocity revenue teams running 30+ reps and complex deal flows.",
    price: "€1,999",
    reps: "Up to 30 sales reps",
    checkBg: "bg-comic-red",
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
    btnClass: "bg-white text-ink",
    rotate: "0.7deg",
  },
];

const btnBase =
  "block text-center w-full py-[13px] border-[2.5px] border-ink rounded-[11px] font-grotesk font-semibold text-[15px] shadow-hard transition-transform duration-150 hover:-translate-x-px hover:-translate-y-px";

export function PricingTiers() {
  return (
    <div className="relative grid grid-cols-1 max-w-[440px] mx-auto min-[860px]:max-w-none min-[860px]:grid-cols-3 gap-[22px] items-start pt-[46px] pb-[30px]">
      {/* hand-drawn pointer + note at the popular card (desktop only) */}
      <DoodleArrow
        className="pointer-events-none absolute z-[4] max-[860px]:hidden w-[90px] h-[70px] top-[-58px] left-1/2"
        style={{ transform: "translateX(-130px)" }}
      />
      <span
        className="pointer-events-none absolute z-[3] max-[860px]:hidden font-display font-semibold text-[15px] text-ink whitespace-nowrap"
        style={{ top: "-66px", left: "calc(50% - 230px)", transform: "rotate(-7deg)" }}
      >
        best value!
      </span>
      <DoodleAsterisk
        stroke="#FFE34D"
        className="pointer-events-none absolute z-[2] max-[860px]:hidden doodle-float w-[26px] h-[26px] top-[30px] left-[-18px]"
        style={{ "--rot": "-12deg" } as CSSProperties}
      />
      <DoodleSquiggle
        stroke="#7C5CFF"
        className="pointer-events-none absolute z-[2] max-[860px]:hidden doodle-float2 w-[38px] h-[20px] bottom-[40px] right-[-20px]"
        style={{ "--rot": "8deg" } as CSSProperties}
      />

      {tiers.map((tier, i) => (
        <Reveal key={tier.name} delay={i * 0.08}>
          <div
            style={tier.rotate ? { transform: `rotate(${tier.rotate})` } : undefined}
            className={`relative bg-white border-[2.5px] border-ink rounded-[18px] px-[26px] py-7 ${
              tier.popular ? "shadow-hard-purple-lg min-[860px]:scale-[1.02]" : "shadow-hard"
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 rotate-[-2deg] bg-comic-purple text-white text-[12px] font-semibold border-[2.5px] border-ink rounded-full px-4 py-1 whitespace-nowrap shadow-hard-sm">
                ★ Most popular
              </div>
            )}
            <h2 className="font-display font-bold text-[28px] mb-2">{tier.name}</h2>
            <div className="text-[14px] text-comic-muted font-medium leading-[1.45] min-h-[42px]">
              {tier.desc}
            </div>
            <div className="flex items-baseline gap-[7px] mt-5 mb-1">
              <span className="font-display font-extrabold text-[46px] leading-none">{tier.price}</span>
              <span className="text-[15px] text-comic-muted font-semibold">/month</span>
            </div>
            <div className="text-[13px] font-semibold text-comic-purple mb-[22px]">{tier.reps}</div>
            <ul className="border-t-[2.5px] border-ink pt-5 mb-6">
              {tier.features.map((feat) => (
                <li key={feat} className="flex items-start gap-[10px] text-[14px] font-medium mb-3 leading-[1.4]">
                  <span
                    className={`flex-shrink-0 w-[19px] h-[19px] rounded-[6px] flex items-center justify-center mt-[1px] border-2 border-ink text-white ${tier.checkBg}`}
                  >
                    <CheckIcon className="w-3 h-3" />
                  </span>
                  {feat}
                </li>
              ))}
            </ul>
            <a
              href={DEMO_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnBase} ${tier.btnClass}`}
            >
              {tier.cta}
            </a>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
