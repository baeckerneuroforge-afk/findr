import type { ComponentType, SVGProps } from "react";
import { Container, Section, SectionHeading } from "./primitives";
import { Reveal } from "./Reveal";
import {
  LayersIcon,
  CpuIcon,
  TargetIcon,
  NetworkIcon,
  FileCheckIcon,
  RadarIcon,
} from "./icons";

/**
 * "Was am Ende rauskommt" — the synthesis payoff, findr's actual wow. Sits after
 * the four methods (PlatformModules) and before the StatBand: methods gather the
 * conversations, this section shows what they are automatically condensed INTO.
 *
 * Built deliberately in the HomeFeatures mould — same Section/SectionHeading, the
 * same hairline gap-px card grid with a primary-600 left edge + primary-50 icon
 * badge, the same staggered Reveal (y=0, delay = i·60ms) — so it reads as part of
 * the existing homepage rhythm, not a bolt-on. Six capabilities, copy verbatim
 * from the brief. Icons are reused from the existing marketing set (no new set).
 */
const CAPABILITIES: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
}[] = [
  {
    Icon: LayersIcon,
    title: "Automatische Verdichtung",
    body: "Themen, Lager und Originalzitate über alle Interviews hinweg, ohne manuelles Tagging.",
  },
  {
    Icon: CpuIcon,
    title: "Mit den Daten chatten",
    body: "Stell dem gesamten Studien-Korpus Rückfragen und bekomme belegte Antworten.",
  },
  {
    Icon: TargetIcon,
    title: "Highlight-Reels",
    body: "Die aussagekräftigsten Momente als teilbarer Zusammenschnitt.",
  },
  {
    Icon: NetworkIcon,
    title: "Teilbare Ergebnis-Links",
    body: "Synthese per Link an Stakeholder, auch extern, im eigenen Branding.",
  },
  {
    Icon: FileCheckIcon,
    title: "PDF-Export",
    body: "Ein klarer Report für Entscheider.",
  },
  {
    Icon: RadarIcon,
    title: "Studienübergreifende Muster",
    body: "Erkenne, was sich über mehrere Studien hinweg wiederholt.",
  },
];

export function HomeSynthesis() {
  return (
    <Section>
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Synthese"
            title="Aus hunderten Gesprächen werden klare Insights — automatisch."
            lead="Findr verdichtet jedes Interview und über alle hinweg — du bekommst Themen, Belege und teilbare Ergebnisse, ohne manuelles Auswerten."
          />
        </Reveal>

        {/* Staggered tile reveal: each card fades in on its own ~60ms delay. Pure
            opacity (y=0) so the gap-px hairline grid never exposes its neutral-200
            backing mid-transform. Reduced motion → all tiles render instantly. */}
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => (
            <Reveal
              key={c.title}
              y={0}
              delay={i * 0.06}
              className="flex h-full flex-col gap-4 border-l-2 border-primary-600 bg-white p-7"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded border border-primary-100 bg-primary-50 text-primary-600">
                <c.Icon className="h-5 w-5" />
              </span>
              <h3 className="font-marketing text-lg font-semibold leading-tight tracking-[-0.01em] text-neutral-900">
                {c.title}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                {c.body}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
