import { Reveal } from "./Reveal";
import { DEMO_BOOKING_URL } from "./constants";

export function FinalCta() {
  return (
    <section className="bg-comic-purple text-center py-[84px]">
      <div className="max-w-[1180px] mx-auto px-7">
        <Reveal>
          <h2 className="font-display font-bold text-[clamp(36px,5.5vw,62px)] text-white max-w-[760px] mx-auto mb-5">
            Ready to understand your conversations?
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="text-[18px] text-[#ece7ff] font-medium max-w-[540px] mx-auto mb-[34px] leading-[1.55]">
            30-minute discovery call. We show you Findr live on your real data. No pitches, no sales
            pressure.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <a
            href={DEMO_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-grotesk font-semibold ink-border rounded-[11px] px-[34px] py-4 text-[17px] bg-comic-red text-white shadow-hard-lg inline-block transition-transform duration-150 hover:-translate-x-px hover:-translate-y-px"
          >
            Book a demo →
          </a>
        </Reveal>
      </div>
    </section>
  );
}
