import { Reveal } from "./Reveal";
import { CpuIcon, NetworkIcon, RadarIcon } from "./icons";

const phases = [
  { ph: "Phase 1", nm: "Sales Intel", rotate: "-1deg" },
  { ph: "Phase 2", nm: "CS Health", rotate: "0.8deg" },
  { ph: "Phase 3", nm: "Discovery", rotate: "-0.6deg" },
  { ph: "Phase 4", nm: "Research", rotate: "1deg" },
];

const coreCards = [
  {
    Icon: CpuIcon,
    bg: "bg-comic-red",
    title: "AI Engine",
    body: "Voice + Text + Vision · Multilingual · EU AI Act compliant",
    rotate: "-0.8deg",
  },
  {
    Icon: NetworkIcon,
    bg: "bg-comic-purple",
    title: "Knowledge Graph",
    body: "Customer + Deal Memory · Cross-Module Context",
    rotate: "0.6deg",
  },
  {
    Icon: RadarIcon,
    bg: "bg-comic-green",
    title: "Pattern Engine",
    body: "Cross-Source Signals · Risk + Insights · Auto-Detection",
    rotate: "-0.5deg",
  },
];

const inputs = [
  { t: "CRM Activity", s: "Hubspot, Salesforce", rotate: "-0.7deg" },
  { t: "Sales Calls", s: "Gong, Chorus, Zoom", rotate: "0.6deg" },
  { t: "AI Interviews", s: "Voice, Text, Video", rotate: "-0.5deg" },
];

export function PlatformArchitecture() {
  return (
    <section id="platform" className="relative bg-ink text-paper py-[84px] overflow-hidden">
      <div className="absolute inset-0 comic-grid opacity-[0.06] pointer-events-none" />

      <div className="max-w-[1180px] mx-auto px-7 relative z-10">
        <Reveal>
          <div className="text-center max-w-[660px] mx-auto mb-[56px]">
            <span className="inline-block bg-comic-yellow text-ink text-[12px] font-semibold tracking-[0.12em] uppercase px-[14px] py-[5px] rounded-[8px] rotate-[-1deg] mb-[22px]">
              The platform
            </span>
            <h2 className="font-display font-bold text-[clamp(34px,5vw,56px)] mb-[18px] text-paper">
              One brain. Four applications.
            </h2>
            <p className="text-[18px] font-medium leading-[1.55] text-[#b8b3a3]">
              Instead of 4 disconnected tools, Findr builds one platform with a shared Conversation
              Intelligence Core. Data compounds. Insights cross-flow. NRR explodes.
            </p>
          </div>
        </Reveal>

        {/* phases */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-[14px]">
          {phases.map((phase, i) => (
            <Reveal key={phase.nm} delay={i * 0.08}>
              <div
                style={{ transform: `rotate(${phase.rotate})` }}
                className="bg-[#26262e] border-[2.5px] border-paper rounded-[14px] px-[14px] py-4 text-center shadow-hard-purple"
              >
                <div className="text-[12px] font-semibold text-comic-yellow uppercase tracking-[0.05em]">
                  {phase.ph}
                </div>
                <div className="font-display font-bold text-[20px] mt-[5px] text-paper">{phase.nm}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* connector: phases → core */}
        <div className="hidden md:flex justify-center h-[42px]">
          <svg
            className="w-full max-w-[680px] h-[42px] overflow-visible"
            viewBox="0 0 680 42"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d="M85 2 C 85 22, 340 18, 340 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
            <path d="M255 2 C 255 24, 340 20, 340 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
            <path d="M425 2 C 425 24, 340 20, 340 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
            <path d="M595 2 C 595 22, 340 18, 340 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
          </svg>
        </div>

        {/* core */}
        <Reveal>
          <div className="bg-[#26262e] border-[2.5px] border-paper rounded-[18px] shadow-hard-purple-lg px-[26px] py-[30px] text-center mt-[6px] mx-auto max-w-[920px]">
            <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-comic-yellow">
              Conversation Intelligence Core
            </div>
            <h3 className="font-display font-bold text-[32px] text-paper mt-2 mb-6">One shared AI brain</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {coreCards.map((card, i) => {
                const { Icon } = card;
                return (
                  <Reveal key={card.title} delay={i * 0.08}>
                    <div
                      style={{ transform: `rotate(${card.rotate})` }}
                      className="bg-paper text-ink border-[2.5px] border-paper rounded-[14px] px-4 py-[18px] text-center h-full"
                    >
                      <div
                        className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center mx-auto mb-3 border-[2.5px] border-ink text-white ${card.bg}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="font-display font-bold text-[19px] mb-[7px]">{card.title}</h4>
                      <p className="text-[13px] text-comic-muted font-medium leading-[1.45]">{card.body}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* connector: core → inputs */}
        <div className="hidden md:flex justify-center h-[42px]">
          <svg
            className="w-full max-w-[680px] h-[42px] overflow-visible"
            viewBox="0 0 680 42"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d="M340 2 C 340 22, 150 20, 150 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
            <path d="M340 2 L 340 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
            <path d="M340 2 C 340 22, 530 20, 530 40" stroke="#FFF8E7" strokeWidth="2.5" fill="none" strokeDasharray="3 7" />
          </svg>
        </div>

        {/* inputs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-[6px] max-w-[920px] mx-auto">
          {inputs.map((input, i) => (
            <Reveal key={input.t} delay={i * 0.08}>
              <div
                style={{ transform: `rotate(${input.rotate})` }}
                className="border-[2.5px] border-dashed border-paper rounded-[14px] p-4 text-center h-full"
              >
                <div className="font-semibold text-[16px] text-paper">{input.t}</div>
                <div className="text-[12px] text-[#b8b3a3] font-medium mt-[3px]">{input.s}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
