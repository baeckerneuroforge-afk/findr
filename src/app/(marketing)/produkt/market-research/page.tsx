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
  NetworkIcon,
  CheckIcon,
  RadarIcon,
  HexagonIcon,
  CpuIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/produkt/market-research";
const OG_TITLE = "Market Research — findr.";
const DESCRIPTION =
  "Dedizierte KI-Interview-Studien auf Deutsch: offener Studien-Link für Walk-ins, Screening-Gate und eine Cross-Study-Synthese, die exakt zählt und jede Zahl je Studie belegt — DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Market Research",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const STEPS: HowStep[] = [
  {
    phase: "Aufsetzen",
    title: "Studie & Screening definieren",
    body: "Leg eine Interview-Studie an und setz ein Screening-Gate davor — nur passende Teilnehmer:innen kommen ins Interview, der Rest wird sauber und DSGVO-konform abgewiesen.",
    tag: "Live",
  },
  {
    phase: "Einsammeln",
    title: "Offener Link & Walk-ins",
    body: "Teil einen offenen Studien-Link — anonyme Teilnehmer:innen starten selbst ein KI-Interview, auf Deutsch. Kein Kalender-Ping-Pong, kein Moderator nötig.",
    tag: "Live",
  },
  {
    phase: "Verstehen",
    title: "Synthese je Studie",
    body: "Aus jedem Interview wird belegte Evidenz — Themen, Kaufabsicht, Preis-Signale, Wettbewerb — verankert im Transkript statt im Bauchgefühl.",
    tag: "Live",
  },
  {
    phase: "Vergleichen",
    title: "Cross-Study, exakt gezählt",
    body: "Frag über alle Studien hinweg. findr. zählt deterministisch — „in 3 von 7 Studien“ — und belegt jede Zahl mit einem Zitat aus der jeweiligen Studie. Keine erfundenen Trends.",
    tag: "Live",
  },
];

const PROOFS: Proof[] = [
  {
    title: "KI-Interviews auf Deutsch",
    body: "Strukturierte Interviews in DACH-Gesprächssprache — dort, wo rein englischsprachige Tools an ihre Grenzen kommen.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Offener Studien-Link & Walk-ins",
    body: "Teil einen Link; anonyme Teilnehmer:innen starten selbst ein Interview — mit Kontingent und Ablaufdatum gegen Missbrauch.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Screening-Gate",
    body: "Qualifizier Teilnehmer:innen vor dem Interview — passende kommen rein, der Rest wird sauber und DSGVO-konform abgewiesen.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Deterministische Cross-Study-Zählung",
    body: "„In 3 von 7 Studien“ — exakt gezählt, nicht geschätzt; jede Zahl mit Zitat je Studie belegt. Keine erfundenen Trends.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Markt-Linse",
    body: "Markt-Studien extrahieren Preis-Signale, Kaufabsicht, Segment und Wettbewerb — getrennt von der Discovery-Linse.",
    Icon: HexagonIcon,
    tag: "Live",
  },
  {
    title: "Highlight-Reels",
    body: "Belegte Interview-Ausschnitte automatisch zu einem Themen-Reel zusammengeschnitten — für das nächste Stakeholder-Review.",
    Icon: CpuIcon,
    tag: "Bald",
  },
];

export default function MarketResearchPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

      <ModuleHero
        eyebrow="Market Research"
        title={
          <>
            Echte Interviews. Exakt gezählt. Je Studie belegt.
          </>
        }
        subhead="Fahre dedizierte KI-Interview-Studien mit echten Endnutzer:innen — auf Deutsch, über einen offenen Studien-Link. findr. synthetisiert über alle Studien hinweg, zählt deterministisch und erfindet keine Trends."
        audience="Markt- & Insights-Teams, die mit echten Endnutzer:innen sprechen wollen — dedizierte Studien, offener Link, Walk-ins, auf Deutsch."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />

      <HowItWorks
        eyebrow="So funktioniert Market Research"
        title={
          <>
            Von der Studie zur belegten Zahl.
          </>
        }
        lead="Vier verbundene Schritte. Kein Moderator, kein Kalender-Ping-Pong — und am Ende eine Zahl, die je Studie mit Zitat belegt ist."
        steps={STEPS}
        tone="muted"
      />

      <DemoPlaceholder
        eyebrow="Produkt-Vorschau"
        title={
          <>
            „In 3 von 7 Studien“ — je belegt.
          </>
        }
        lead="Eine Frage über die ganze Studien-Bibliothek, jede Zahl auf ihre Studie und ihr Zitat zurückführbar — der Platzhalter zeigt, wo später die echte Cross-Study-Ansicht steht."
        label="Cross-Study-Synthese"
      />

      {/* Solution layer — ExampleCard makes the "exakt gezählt, je belegt"
          promise visible. On a muted band so the white card pops and the page
          keeps the homepage's alternating section rhythm (W-M-W-M-W-M). */}
      <Section tone="muted">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="flex flex-col gap-5">
                <Eyebrow>Market Research · Lösungsebene</Eyebrow>
                <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
                  Exakt gezählt. Je Studie belegt.{" "}
                  Keine erfundenen Trends.
                </h2>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  Während Product Discovery aus deinen <em>bestehenden</em> B2B-Calls
                  liest, fährt Market Research <em>dedizierte</em> Studien mit
                  echten Endnutzer:innen: ein offener Link, ein Screening-Gate
                  davor, KI-Interviews auf Deutsch — ganz ohne Moderator.
                </p>
                <div className="rounded border-l-2 border-primary-300 bg-primary-50/50 py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
                  <strong className="font-semibold text-neutral-900">
                    Zahlen, die du belegen kannst.
                  </strong>
                  <br />
                  Fragst du „in wie vielen Studien kam das auf?“, zählt findr.
                  deterministisch und legt zu jeder Zahl das Zitat aus der
                  jeweiligen Studie daneben — nichts wird hochgerechnet.
                </div>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  In Deutschland gebaut, in Frankfurt gehostet, DSGVO-nativ —
                  damit du auch mit anonymen Teilnehmer:innen sauber arbeitest.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ExampleCard
                tone="neutral"
                badge="Cross-Study · exakt gezählt"
                rows={[
                  {
                    label: "Frage",
                    value: "In wie vielen Studien kam Self-Service auf?",
                  },
                  {
                    label: "Antwort",
                    value:
                      "In 3 von 7 Studien — jede mit einem Zitat aus der jeweiligen Studie belegt.",
                  },
                  {
                    label: "Beleg aus einer Studie",
                    quote: true,
                    value:
                      "„Ich will mich nicht durch ein Sales-Gespräch quälen — lass mich es einfach selbst ausprobieren.“",
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
            Was Market Research konkret liefert.
          </>
        }
        lead="Jede Fähigkeit ist an echten Interviews verankert — Live, was Live ist, Bald, was kommt."
        points={PROOFS}
      />

      <ModuleCrossLinks current="market-research" />

      <CTASection
        title={
          <>
            Eine Frage über alle Studien — exakt beantwortet.
          </>
        }
        lead="Buch eine Demo und sieh, wie findr. eine ganze Studien-Bibliothek befragt — deterministisch gezählt, je Studie belegt."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
