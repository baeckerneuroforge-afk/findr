import type { CSSProperties } from "react";
import { Reveal } from "./Reveal";
import { DoodleStar } from "./doodles";
import { DEMO_BOOKING_URL } from "./constants";

export function EnterpriseBand() {
  return (
    <Reveal>
      <div className="relative bg-ink text-paper rounded-[18px] px-8 py-[30px] shadow-hard-red flex flex-col items-start gap-6 flex-wrap min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between mt-[14px] mb-20">
        <DoodleStar
          fill="#FF5436"
          className="pointer-events-none absolute z-[2] max-[860px]:hidden doodle-float w-[42px] h-[42px] top-[-26px] right-[46px]"
          style={{ "--rot": "10deg" } as CSSProperties}
        />
        <div>
          <div className="inline-flex items-center gap-[9px] mb-[9px]">
            <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#b8b3a3]">
              Enterprise
            </span>
            <span className="text-[12px] font-semibold text-comic-red bg-comic-red/15 border-[1.5px] border-comic-red rounded-full px-[10px] py-px">
              Custom
            </span>
          </div>
          <h3 className="font-display font-bold text-[26px] text-paper mb-3">Need more? Let&apos;s talk.</h3>
          <div className="text-[13px] text-[#b8b3a3] font-medium leading-[1.6] max-w-[680px]">
            Custom seats · Multi-module bundles · Outcome-based pricing · SOC 2 · ISO 27001 · BYOK ·
            Custom AI models · Dedicated CSM · 24/7 SLA support
          </div>
        </div>
        <a
          href={DEMO_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-block border-[2.5px] border-ink rounded-[11px] px-[18px] py-[9px] text-[15px] font-grotesk font-semibold bg-comic-red text-white shadow-hard transition-transform duration-150 hover:-translate-x-px hover:-translate-y-px"
        >
          Talk to sales →
        </a>
      </div>
    </Reveal>
  );
}
