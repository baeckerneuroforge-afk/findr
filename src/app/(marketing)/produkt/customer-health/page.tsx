import type { Metadata } from "next";
import {
  Container,
  Section,
  Eyebrow,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import {
  ModuleHero,
  HowItWorks,
  DemoPlaceholder,
  ExampleCard,
  ProofPoints,
  ModuleCrossLinks,
  type HowStep,
  type Proof,
} from "@/components/marketing/module-template";
import { CTASection } from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  TargetIcon,
  RadarIcon,
  CheckIcon,
  TrendingUpIcon,
  NetworkIcon,
  CpuIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/produkt/customer-health";
const OG_TITLE = "Customer Success Health — findr.";
const DESCRIPTION =
  "Churn-Früherkennung aus echten Kunden-Calls: Health-Score pro Account, belegte Risiko-Signale, Save-Plays, Account-Value und ein deterministischer Renewal-Forecast — DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Customer Success Health",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Customer Success Health",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const STEPS: HowStep[] = [
  {
    phase: "Beobachten",
    title: "Calls & Reviews verbinden",
    body: "findr. liest deine Success-Reviews, Onboarding- und Support-Calls automatisch mit — über dieselben Konnektoren wie Sales (Gong, Slack, Kalender). Kein Upload, kein Tagging.",
  },
  {
    phase: "Beobachten",
    title: "Health-Score pro Account",
    body: "Jeder Account bekommt einen Health-Score, aktualisiert nach jedem Gespräch. Risiko-Signale sind am exakten Transkript-Moment belegt — du siehst, worauf der Score sich stützt.",
    tag: "Live",
  },
  {
    phase: "Handeln",
    title: "Save-Plays, wenn es zählt",
    body: "Steht ein Account auf der Kippe, schlägt findr. konkrete Save-Plays vor: belegte Maßnahmen samt Zitat und nächstem Schritt — keine generischen Ratschläge.",
    tag: "Live",
  },
  {
    phase: "Rechnen",
    title: "Renewal-Forecast, der rechnet",
    body: "Account-Value — monatlich, jährlich oder einmalig — und Churn fließen in einen deterministischen Renewal-Forecast. Keine KI-Schätzung: die vollständige NRR-Kurve baut sich ab der nächsten Vertragsperiode auf.",
    tag: "Live",
  },
  {
    phase: "Lernen",
    title: "Voice-Nachfass bei Churn",
    body: "Kündigt ein Account trotzdem, fragt findr.s Voice-Agent nach dem echten Grund — und schärft jeden zukünftigen Health-Score.",
    tag: "Bald",
  },
];

const PROOFS: Proof[] = [
  {
    title: "Health-Score pro Account",
    body: "Ein Score je Account, aktualisiert nach jedem Kunden-Call — ohne Tagging, ohne manuelle Dateneingabe.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Belegte Risiko-Signale",
    body: "Jedes Churn-Signal ist am exakten Transkript-Moment verankert — du siehst genau, warum ein Account kippt.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Save-Plays",
    body: "Pro Risiko eine konkrete Rettungs-Maßnahme samt Beleg und nächstem Schritt — keine Floskeln, sondern Handlung.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Account-Value & Value-Typ",
    body: "Monatlich, jährlich oder einmalig — findr. rechnet jeden Vertrag richtig, statt alles pauschal als MRR zu behandeln.",
    Icon: TrendingUpIcon,
    tag: "Live",
  },
  {
    title: "Deterministischer Renewal-Forecast",
    body: "Renewal und Net Revenue Retention werden gerechnet, nicht geschätzt. Die volle NRR-Kurve baut sich ab der nächsten Periode auf.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Voice-Nachfass bei Churn",
    body: "Kündigt ein Account, fragt findr.s Voice-Agent nach dem echten Grund — und macht jeden zukünftigen Score schärfer.",
    Icon: CpuIcon,
    tag: "Bald",
  },
];

export default function CustomerHealthPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

      <ModuleHero
        eyebrow="Customer Success Health"
        title={
          <>
            Erkenne gefährdete Accounts — bevor sie kündigen.
          </>
        }
        subhead="Health-Score pro Account aus echten Kunden-Calls: belegte Risiko-Signale, konkrete Save-Plays und ein Renewal-Forecast, der rechnet statt rät."
        audience="Customer-Success-Leads & CS-Teams in B2B-SaaS, die Net Revenue Retention halten und ausbauen wollen."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />

      <HowItWorks
        eyebrow="So funktioniert Customer Success Health"
        title={
          <>
            Vom Kunden-Call zum gehaltenen Account.
          </>
        }
        lead="Fünf verbundene Schritte. Keine Dateneingabe, kein manuelles Health-Scoring — nur die Signale, die über Renewal und Churn entscheiden."
        steps={STEPS}
      />

      <DemoPlaceholder
        eyebrow="Produkt-Vorschau"
        title={
          <>
            Der Health-Score, an jedem Account.
          </>
        }
        lead="Accounts nach Risiko sortiert, jedes Signal auf das Transkript zurückführbar — der Platzhalter zeigt, wo später das echte Customer-Health-Dashboard steht."
        label="Customer-Health-Dashboard"
      />

      {/* Solution layer — ExampleCard makes the "belegt, nicht geraten" promise visible */}
      <Section>
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="flex flex-col gap-5">
                <Eyebrow>Customer Health · Lösungsebene</Eyebrow>
                <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
                  findr. zeigt nicht nur das Risiko —{" "}
                  es zeigt den Weg raus.
                </h2>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  Ein gewonnener Deal in Sales Intelligence übergibt den Account
                  direkt an Customer Success — das KI-Gehirn kennt die
                  Vorgeschichte ab Tag eins. Und es bleibt nicht beim Risiko:
                  findr. erkennt auch Upsell- und Expansions-Chancen aus dem
                  Gespräch, bevor sie im Forecast auftauchen.
                </p>
                <div className="rounded border-l-2 border-primary-300 bg-primary-50/50 py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
                  <strong className="font-semibold text-neutral-900">
                    Belegt, nicht geraten.
                  </strong>
                  <br />
                  Jedes Risiko-Signal zitiert, was der Kunde wirklich gesagt hat
                  — und jeder Save-Play nennt den konkreten nächsten Schritt.
                </div>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  Der Renewal-Forecast rechnet deterministisch: Account-Value
                  und Churn ergeben die Prognose, ohne KI-Schätzung. Die
                  vollständige NRR-Kurve baut sich ehrlich ab der nächsten
                  Vertragsperiode auf.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ExampleCard
                badge="Renewal-Risiko · Hoch"
                rows={[
                  {
                    label: "Signal",
                    value:
                      "Power-User abgewandert — der ursprüngliche Sponsor nutzt das Produkt seit dem Reorg nicht mehr.",
                  },
                  {
                    label: "Save-Play",
                    value:
                      "Neuen wirtschaftlichen Sponsor identifizieren und einen Quartals-Business-Review ansetzen, der den bisherigen ROI sichtbar macht — bevor die Renewal-Frage auf den Tisch kommt.",
                  },
                  {
                    label: "Beleg aus dem Call",
                    quote: true,
                    value:
                      "„Ehrlich, seit Marco weg ist, schaut bei uns keiner mehr richtig rein — wir nutzen gerade nur noch das Reporting.“",
                  },
                ]}
              />
            </Reveal>
          </div>
        </Container>
      </Section>

      <ProofPoints
        eyebrow="Belegt, nicht geraten"
        title={
          <>
            Was Customer Success Health konkret liefert.
          </>
        }
        lead="Jede Fähigkeit ist am echten Gespräch verankert — Live, was Live ist, Bald, was kommt."
        points={PROOFS}
      />

      <ModuleCrossLinks current="customer-health" />

      <CTASection
        title={
          <>
            Sieh den Churn kommen, bevor er passiert.
          </>
        }
        lead="Buch eine Demo und sieh, welche deiner Accounts findr. heute schon als gefährdet markieren würde — belegt am echten Gespräch."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
