import { Container, Section, SectionHeading } from "./primitives";
import { Reveal } from "./Reveal";
import { WorkflowSteps } from "./WorkflowSteps";

/**
 * "So läuft es" — the real five-step flow (Guide → Teilnehmer → KI-Interview →
 * Synthese → Teilen), anchored to features that actually ship: guide builder,
 * single-invite + open link with optional screening gate, German AI interviews,
 * deterministic synthesis, shared results / CRM sync.
 *
 * No fabricated product screenshots — the repo ships none. Each step renders a
 * clearly-marked placeholder frame instead.
 * TODO: drop real dashboard screenshots in via next/image once exported
 *   (public/screenshots/*) and replace the dashed placeholders below.
 */
const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Guide erstellen",
    body: "Ziel und Leitfaden festlegen — oder findr. aus deinen Calls einen Vorschlag bauen lassen.",
  },
  {
    n: "02",
    title: "Teilnehmer einladen",
    body: "Per Einzel-Einladung oder offenem Link — mit optionalem Screening-Gate davor.",
  },
  {
    n: "03",
    title: "KI-Interview",
    body: "findr. führt das Gespräch auf Deutsch, hakt nach und bleibt am Transkript.",
  },
  {
    n: "04",
    title: "Synthese",
    body: "Themen, Signale und Zitate werden automatisch verdichtet — deterministisch gezählt.",
  },
  {
    n: "05",
    title: "Teilen",
    body: "Als geteilte Synthese, im Dashboard oder zurück in dein CRM.",
  },
];

export function HomeWorkflow() {
  return (
    <Section tone="muted">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="So läuft es"
            // Single-ink heading (no two-tone split) — the violet now lives in
            // the timeline below, where it animates the connecting thread.
            title="Von der Frage zur belegten Antwort."
            lead="Fünf Schritte, ein durchgehender Faden — von der ersten Frage bis zum geteilten Ergebnis."
          />
        </Reveal>

        {/* The "durchgehender Faden": the violet thread DRAWS through the five
            markers on scroll-in and the nodes light up in sequence (client
            component; reduced-motion → final state, no movement). */}
        <WorkflowSteps steps={STEPS} />

        {/* Placeholder for a real product walk-through — honest, clearly marked.
            A Remotion walk-through video lands here later; for now a standalone
            dashed card that fits the new section rhythm.
            TODO: replace with exported dashboard screenshots / the video. */}
        <Reveal>
          <div className="mt-14 flex min-h-[260px] flex-col items-center justify-center gap-3 rounded border border-dashed border-neutral-300 bg-white p-8 text-center sm:min-h-[320px]">
            <span className="rounded bg-neutral-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Produkt-Vorschau folgt
            </span>
            <p className="max-w-[42ch] text-sm leading-relaxed text-neutral-500">
              Hier zeigen wir bald den echten Ablauf im Dashboard — Guide,
              Live-Interview und Synthese in Originalansichten.
            </p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
