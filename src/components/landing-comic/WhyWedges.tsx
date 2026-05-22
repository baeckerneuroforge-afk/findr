import { Reveal } from "./Reveal";

const wedges = [
  {
    big: "10x",
    small: "more accurate",
    title: "AI-native, not AI bolt-on",
    body: "Clari + Gong were built in 2015. Keyword matching, no context. Findr is GenAI-native from day one.",
    rotate: "-0.8deg",
  },
  {
    big: "100%",
    small: "compliant",
    title: "EU-native, not translated",
    body: "Hosted in Frankfurt. GDPR + EU AI Act compliant by default. German AI models trained on DACH sales language.",
    rotate: "0.7deg",
  },
  {
    big: "60%",
    small: "cheaper",
    title: "One platform, not a tool stack",
    body: "Companies spend €450/user on Clari+Gong stacks. Findr replaces 4 tools with one core. Brutally efficient.",
    rotate: "0.6deg",
  },
  {
    big: "5x",
    small: "founder-market fit",
    title: "DACH-first, not US-biased",
    body: "We understand German buyer patterns. Longer cycles. More stakeholders. Compliance-heavy. Findr is built for it.",
    rotate: "-0.7deg",
  },
];

export function WhyWedges() {
  return (
    <section id="why" className="bg-comic-red py-[84px]">
      <div className="max-w-[1180px] mx-auto px-7">
        <Reveal>
          <div className="text-center max-w-[660px] mx-auto mb-[56px]">
            <span className="inline-block bg-ink text-paper text-[12px] font-semibold tracking-[0.12em] uppercase px-[14px] py-[5px] rounded-[8px] rotate-[-1deg] mb-[22px]">
              Why Findr
            </span>
            <h2 className="font-display font-bold text-[clamp(34px,5vw,56px)] mb-[18px] text-white">
              Four structural wedges.
            </h2>
            <p className="text-[18px] font-medium leading-[1.55] text-[#ffe2d8]">
              Not features. Not marketing. Real architecture decisions our competition can&apos;t copy.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-[22px] max-w-[980px] mx-auto">
          {wedges.map((wedge, i) => (
            <Reveal key={wedge.title} delay={i * 0.08} className="h-full">
              <div
                style={{ transform: `rotate(${wedge.rotate})` }}
                className="bg-paper border-[2.5px] border-ink rounded-[18px] px-[26px] py-[26px] shadow-hard h-full"
              >
                <div className="font-display font-extrabold text-[54px] leading-none text-comic-red flex items-baseline gap-[10px]">
                  {wedge.big}
                  <small className="font-grotesk text-[14px] font-semibold text-comic-muted uppercase tracking-[0.04em]">
                    {wedge.small}
                  </small>
                </div>
                <h3 className="font-display font-bold text-[22px] mt-[14px] mb-2">{wedge.title}</h3>
                <p className="text-[15px] text-comic-muted font-medium leading-[1.5]">{wedge.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
