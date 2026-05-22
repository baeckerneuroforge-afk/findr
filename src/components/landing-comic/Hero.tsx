import Link from "next/link";
import { Reveal } from "./Reveal";
import { DEMO_BOOKING_URL } from "./constants";

const btnBase =
  "font-grotesk font-semibold ink-border rounded-[11px] px-7 py-[14px] text-[16px] inline-block transition-transform duration-150 hover:-translate-x-px hover:-translate-y-px";

const trustChips = [
  { name: "Nordbank", rotate: "-1.5deg" },
  { name: "Helven", rotate: "1.2deg" },
  { name: "RheinWerk", rotate: "-0.8deg" },
];

export function Hero() {
  return (
    <header className="relative text-center pt-20 pb-[70px] md:pt-20 md:pb-[70px]">
      {/* decorative floaters */}
      <svg
        className="absolute top-[120px] left-[8%] z-0 hidden sm:block"
        width="40"
        height="40"
        viewBox="0 0 46 46"
        aria-hidden
      >
        <path
          d="M23 3 L27 17 L41 14 L30 24 L40 35 L25 31 L23 44 L20 31 L6 34 L16 23 L5 13 L20 18 Z"
          fill="#FFE34D"
          stroke="#1a1a1a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        className="absolute top-[210px] right-[9%] z-0 rotate-[18deg] hidden sm:block"
        width="30"
        height="30"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          d="M12 2 L12 22 M2 12 L22 12 M5 5 L19 19 M19 5 L5 19"
          stroke="#7C5CFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      <div className="max-w-[1180px] mx-auto px-7 relative z-10">
        <Reveal>
          <span className="inline-flex items-center gap-2 bg-comic-yellow ink-border rounded-full px-[17px] py-[7px] text-[13px] font-semibold shadow-hard-sm">
            <span className="w-2 h-2 rounded-full bg-comic-green border-[1.5px] border-ink" />
            Conversation Intelligence Platform — Built for Europe
          </span>
        </Reveal>

        <Reveal delay={0.05}>
          <h1 className="font-display font-bold text-[clamp(44px,7vw,86px)] leading-[1.0] tracking-[-0.03em] mt-[30px]">
            One AI brain.
            <br />
            Four products.
            <br />
            <span className="relative whitespace-nowrap inline-block">
              Zero data silos.
              <svg
                className="absolute left-[-2%] bottom-[-0.18em] w-[104%] h-[0.3em]"
                viewBox="0 0 300 16"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M4 10 C 70 3, 140 14, 210 6 S 290 11, 296 7"
                  stroke="#FF5436"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-[clamp(17px,2vw,21px)] text-comic-muted font-medium max-w-[560px] mx-auto mt-[34px] leading-[1.55]">
            Findr reads every customer conversation and turns it into decisions —{" "}
            <span className="bg-comic-yellow px-[6px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              at the speed of decision.
            </span>
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex gap-[14px] justify-center mt-10 flex-wrap">
            <a
              href={DEMO_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnBase} bg-comic-red text-white shadow-hard`}
            >
              Book a demo — 30 min
            </a>
            <Link href="#platform" className={`${btnBase} bg-white text-ink shadow-hard`}>
              See how it works →
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.25}>
          <div className="flex items-center justify-center gap-[14px] mt-[54px] flex-wrap">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-comic-muted">
              Trusted by revenue teams at
            </span>
            {trustChips.map((chip) => (
              <span
                key={chip.name}
                style={{ transform: `rotate(${chip.rotate})` }}
                className="font-semibold text-[15px] bg-white border-2 border-ink rounded-[9px] px-[13px] py-[5px]"
              >
                {chip.name}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <p className="mt-[34px] text-[12px] font-semibold tracking-[0.1em] uppercase text-comic-muted">
            Built for B2B SaaS · EU-hosted · GDPR + EU AI Act compliant
          </p>
        </Reveal>
      </div>
    </header>
  );
}
