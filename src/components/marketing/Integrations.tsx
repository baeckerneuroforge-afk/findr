import { Container, Section, SectionHeading, StatusTag } from "./primitives";
import { Reveal } from "./Reveal";

/**
 * Integrations grid (§4.2). Connectors with honest Live/Bald status, lifted from
 * landing.html:1429–1433 (Gong/HubSpot/Slack = Live, Salesforce/Zoom = Bald).
 * Bidirectional-sync claim from landing.html:1393–1397. Server component.
 */

type Connector = { name: string; status: "Live" | "Bald" };

const CONNECTORS: Connector[] = [
  { name: "Gong", status: "Live" },
  { name: "HubSpot", status: "Live" },
  { name: "Slack", status: "Live" },
  { name: "Salesforce", status: "Bald" },
  { name: "Zoom", status: "Bald" },
];

const POINTS = [
  "Native Konnektoren für Tools, die du schon nutzt",
  "Echtzeit-Daten fließen ins gemeinsame KI-Gehirn",
  "Bidirektionaler Sync — Insights fließen zurück ins CRM",
];

export function Integrations() {
  return (
    <Section>
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <div className="flex flex-col gap-6">
              <SectionHeading
                align="left"
                eyebrow="Integrationen"
                title="Live-Daten aus allen Quellen."
                lead="findr. sitzt im Zentrum deines Revenue-Stacks. Jedes Gespräch, jedes CRM-Update, jedes Signal fließt in eine gemeinsame Intelligenz — so wird aus einem Churn-Signal eine Research-Frage, und ein Research-Insight schärft das Risiko-Modell."
              />
              <ul className="flex flex-col gap-2.5">
                {POINTS.map((p) => (
                  <li
                    key={p}
                    className="relative pl-6 text-[15px] leading-relaxed text-neutral-700"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-[10px] h-px w-3.5 bg-primary-500"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
              {CONNECTORS.map((c) => (
                <div
                  key={c.name}
                  className="flex flex-col items-start gap-3 bg-white p-5"
                >
                  <StatusTag status={c.status} />
                  <span className="font-marketing text-lg font-semibold text-neutral-900">
                    {c.name}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-center bg-neutral-50 p-5 text-center text-[13px] leading-snug text-neutral-400">
                Weitere Konnektoren in Arbeit
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
