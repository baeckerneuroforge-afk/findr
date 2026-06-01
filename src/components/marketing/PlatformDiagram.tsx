import { Container, Section, SectionHeading, Accent, CornerBrackets } from "./primitives";
import { Reveal } from "./Reveal";
import { CpuIcon, NetworkIcon, RadarIcon } from "./icons";
import type { ComponentType, SVGProps } from "react";

/**
 * Platform architecture diagram (§2.2 / §4.2): the four modules feed a shared
 * Conversation-Intelligence-Core, which in turn draws from the data sources.
 * Array-driven. The STRUCTURE (phases → core(coreCards) → inputs with static SVG
 * connectors) is lifted from the dead `landing-comic/PlatformArchitecture.tsx`,
 * but re-authored: light surface, brand tokens (no obsidian/comic/rotate),
 * editorial restraint, DE copy. Server component — no interactivity.
 */

type Phase = { phase: string; name: string };
type CoreCard = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
};
type Input = { title: string; sources: string };

// The four modules, given equal weight (same card) — top row.
const PHASES: Phase[] = [
  { phase: "Modul 01", name: "Sales Intelligence" },
  { phase: "Modul 02", name: "Customer Success Health" },
  { phase: "Modul 03", name: "Product Discovery" },
  { phase: "Modul 04", name: "Market Research" },
];

// The shared brain — three capabilities that every module draws on.
const CORE_CARDS: CoreCard[] = [
  {
    Icon: CpuIcon,
    title: "KI-Engine",
    body: "Voice · Text · Vision — mehrsprachig, EU-AI-Act-konform.",
  },
  {
    Icon: NetworkIcon,
    title: "Wissensgraph",
    body: "Kunden- & Deal-Gedächtnis — modulübergreifender Kontext.",
  },
  {
    Icon: RadarIcon,
    title: "Muster-Engine",
    body: "Signale über alle Quellen — Risiko + Insights, automatisch erkannt.",
  },
];

// The data sources that flow into the brain.
const INPUTS: Input[] = [
  { title: "CRM-Aktivität", sources: "HubSpot · Salesforce" },
  { title: "Gespräche & Calls", sources: "Gong · Slack · Zoom" },
  { title: "KI-Interviews", sources: "Voice · Text · Video" },
];

/** Dashed connector band — purely decorative, hidden on small screens. */
function Connector({ paths }: { paths: string[] }) {
  return (
    <div className="hidden h-10 justify-center md:flex">
      <svg
        className="h-10 w-full max-w-[680px] overflow-visible text-primary-300"
        viewBox="0 0 680 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        {paths.map((d) => (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="3 6"
          />
        ))}
      </svg>
    </div>
  );
}

export function PlatformDiagram() {
  return (
    <Section tone="muted">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Architektur"
            title={
              <>
                Ein gemeinsames Gehirn. <Accent>Keine Datensilos.</Accent>
              </>
            }
            lead="Vier Module ziehen aus demselben Conversation-Intelligence-Core. Die Daten kumulieren über Module hinweg, statt in vier getrennten Tools zu verschwinden."
          />
        </Reveal>

        <div className="mt-14">
          {/* Modules (top) */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {PHASES.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.06}>
                <div className="rounded border border-neutral-200 bg-white px-4 py-4 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-600">
                    {p.phase}
                  </div>
                  <div className="mt-1.5 font-marketing text-[15px] font-semibold leading-tight text-neutral-900">
                    {p.name}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* connector: modules → core */}
          <Connector
            paths={[
              "M85 2 C 85 22, 340 18, 340 38",
              "M255 2 C 255 24, 340 20, 340 38",
              "M425 2 C 425 24, 340 20, 340 38",
              "M595 2 C 595 22, 340 18, 340 38",
            ]}
          />

          {/* Core (middle) */}
          <Reveal>
            <div className="relative mx-auto max-w-[920px] rounded border border-primary-200 bg-primary-50/60 px-5 py-7 text-center sm:px-7">
              <CornerBrackets className="border-primary-300" />
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-600">
                Conversation-Intelligence-Core
              </div>
              <h3 className="mt-1.5 font-marketing text-2xl font-semibold text-neutral-900">
                Ein gemeinsames KI-Gehirn
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {CORE_CARDS.map((c, i) => (
                  <Reveal key={c.title} delay={i * 0.06}>
                    <div className="flex h-full flex-col items-center gap-2.5 rounded border border-neutral-200 bg-white px-4 py-5 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded border border-primary-200 bg-primary-50 text-primary-600">
                        <c.Icon className="h-5 w-5" />
                      </span>
                      <h4 className="font-marketing text-base font-semibold text-neutral-900">
                        {c.title}
                      </h4>
                      <p className="text-[13px] leading-relaxed text-neutral-500">
                        {c.body}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          {/* connector: core → inputs */}
          <Connector
            paths={[
              "M340 2 C 340 22, 150 20, 150 38",
              "M340 2 L 340 38",
              "M340 2 C 340 22, 530 20, 530 38",
            ]}
          />

          {/* Inputs (bottom) */}
          <div className="mx-auto grid max-w-[920px] grid-cols-1 gap-4 sm:grid-cols-3">
            {INPUTS.map((input, i) => (
              <Reveal key={input.title} delay={i * 0.06}>
                <div className="h-full rounded border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-center">
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {input.title}
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    {input.sources}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
