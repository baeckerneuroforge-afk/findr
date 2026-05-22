import type { CSSProperties } from "react";
import { Reveal } from "./Reveal";
import { DoodleStar, DoodleAsterisk, DoodleSquiggle, DoodleDot } from "./doodles";

const DOODLE = "pointer-events-none absolute z-[2] max-[860px]:hidden";

export function PricingHeader() {
  return (
    <header className="relative text-center pt-[70px] pb-[30px]">
      <DoodleStar
        fill="#FFE34D"
        className={`${DOODLE} doodle-float w-[44px] h-[44px] top-[54px] left-[7%]`}
        style={{ "--rot": "-8deg" } as CSSProperties}
      />
      <DoodleAsterisk
        stroke="#7C5CFF"
        className={`${DOODLE} doodle-twirl w-[34px] h-[34px] top-[90px] right-[9%]`}
      />
      <DoodleSquiggle
        stroke="#FF5436"
        className={`${DOODLE} doodle-float2 w-[40px] h-[22px] top-[150px] left-[13%]`}
        style={{ "--rot": "6deg" } as CSSProperties}
      />
      <DoodleDot
        fill="#16B36A"
        className={`${DOODLE} doodle-float w-[30px] h-[30px] top-[120px] right-[14%]`}
        style={{ "--rot": "-4deg" } as CSSProperties}
      />

      <div className="max-w-[1180px] mx-auto px-7">
        <Reveal>
          <span className="inline-block bg-ink text-paper text-[12px] font-semibold tracking-[0.12em] uppercase px-[14px] py-[5px] rounded-[8px] rotate-[-1deg] mb-[22px]">
            Pricing
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="font-display font-bold text-[clamp(38px,6vw,64px)] mb-[18px]">
            Land with Sales Intel.
            <br />
            Grow into the platform.
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-[18px] text-comic-muted font-medium max-w-[540px] mx-auto leading-[1.55]">
            Start with Sales Intelligence. Add CS Health, Discovery, and Research as your team grows.
            One platform. One contract. Linear cost, compounding value.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="inline-flex items-center gap-2 bg-comic-yellow border-[2.5px] border-ink rounded-full px-[17px] py-[7px] text-[13px] font-semibold shadow-hard-sm mt-[26px]">
            <span className="w-2 h-2 rounded-full bg-comic-green border-[1.5px] border-ink" />
            14-day free trial · No credit card required · Cancel anytime
          </div>
        </Reveal>
      </div>
    </header>
  );
}
