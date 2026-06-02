import type { ComponentType, SVGProps } from "react";
import { Container, Section, SectionHeading } from "./primitives";
import { Reveal } from "./Reveal";
import { FileCheckIcon, CpuIcon, ShieldCheckIcon, LayersIcon } from "./icons";

/**
 * Four key features, one sentence each — the "why findr." in a glance. Each
 * claim is anchored to something the product actually does (evidence-anchored
 * extraction, one shared engine across modules, EU-native data handling,
 * deterministic cross-study synthesis). No numbers invented.
 */
const FEATURES: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
}[] = [
  {
    Icon: FileCheckIcon,
    title: "Belegt, nicht geraten",
    body: "Jede Aussage hängt am exakten Transkript-Moment — kein KI-Bauchgefühl, keine erfundenen Zahlen.",
  },
  {
    Icon: CpuIcon,
    title: "Vier Module, eine Engine",
    body: "Sales, Customer Success, Product Discovery und Market Research teilen sich ein Gehirn statt vier Datensilos.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "DSGVO-nativ",
    body: "In Deutschland gebaut, in der EU gehostet — Datenschutz ist die Grundlage, nicht das Add-on.",
  },
  {
    Icon: LayersIcon,
    title: "Cross-Study-Synthese",
    body: "Frag über alle Gespräche und Studien hinweg — exakt gezählt und je Quelle mit Zitat belegt.",
  },
];

export function HomeFeatures() {
  return (
    <Section>
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Warum findr."
            // Single-ink heading — emphasis comes from size + whitespace, not a
            // two-tone colour split (the violet stays on the eyebrow + icons).
            title="Tiefe aus echten Gesprächen — mit Beleg."
            lead="Qualitative Tiefe und nachprüfbare Schärfe in einem Werkzeug. Vier Prinzipien ziehen sich durch jedes Modul."
          />
        </Reveal>

        {/* Staggered tile reveal: each card fades in on its own ~60ms delay. Pure
            opacity (y=0) so the gap-px hairline grid never exposes its neutral-200
            backing mid-transform. Reduced motion → all tiles render instantly. */}
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              y={0}
              delay={i * 0.06}
              className="flex h-full flex-col gap-4 border-l-2 border-primary-600 bg-white p-7"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded border border-primary-100 bg-primary-50 text-primary-600">
                <f.Icon className="h-5 w-5" />
              </span>
              <h3 className="font-marketing text-lg font-semibold leading-tight tracking-[-0.01em] text-neutral-900">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                {f.body}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
