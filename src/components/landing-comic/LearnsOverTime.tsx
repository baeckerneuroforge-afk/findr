import { Reveal } from "./Reveal";
import { TargetIcon, TrendingUpIcon, HexagonIcon } from "./icons";

const cards = [
  {
    Icon: TargetIcon,
    iconWrap: "bg-comic-yellow text-ink",
    title: "Calibrates to you",
    body: "Forecasts and risk signals adjust to your real win rates and deal patterns — not industry averages.",
    rotate: "-0.7deg",
  },
  {
    Icon: TrendingUpIcon,
    iconWrap: "bg-comic-red text-white",
    title: "Sharper with every deal",
    body: "Each closed deal feeds back into the model. Call analysis, risk detection, and predictions improve continuously.",
    rotate: "0.6deg",
  },
  {
    Icon: HexagonIcon,
    iconWrap: "bg-comic-purple text-white",
    title: "Yours alone",
    body: "The model reflects your market, your sales motion, your customers. A compounding advantage competitors can't copy.",
    rotate: "-0.5deg",
  },
];

export function LearnsOverTime() {
  return (
    <section className="py-[84px]">
      <div className="max-w-[1180px] mx-auto px-7">
        <Reveal>
          <div className="text-center max-w-[660px] mx-auto mb-[56px]">
            <span className="inline-block bg-comic-green text-white text-[12px] font-semibold tracking-[0.12em] uppercase px-[14px] py-[5px] rounded-[8px] rotate-[-1deg] mb-[22px]">
              Gets smarter over time
            </span>
            <h2 className="font-display font-bold text-[clamp(34px,5vw,56px)] mb-[18px]">
              Findr learns your business.
            </h2>
            <p className="text-[18px] text-comic-muted font-medium leading-[1.55]">
              Risk scoring, loss prediction, and forecasting calibrate to your historical deals — the
              more you close, the sharper Findr gets for your team.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-[22px] max-w-[980px] mx-auto">
          {cards.map((card, i) => {
            const { Icon } = card;
            return (
              <Reveal key={card.title} delay={i * 0.08} className="h-full">
                <div
                  style={{ transform: `rotate(${card.rotate})` }}
                  className="bg-white border-[2.5px] border-ink rounded-[18px] px-6 py-[26px] shadow-hard h-full"
                >
                  <div
                    className={`w-[46px] h-[46px] border-[2.5px] border-ink rounded-[12px] flex items-center justify-center mb-4 ${card.iconWrap}`}
                  >
                    <Icon className="w-[22px] h-[22px]" />
                  </div>
                  <h3 className="font-display font-bold text-[21px] mb-[9px]">{card.title}</h3>
                  <p className="text-[14px] text-comic-muted font-medium leading-[1.5]">{card.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
