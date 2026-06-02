import type { Metadata } from "next";
import {
  Container,
  Section,
  SectionHeading,
  Eyebrow,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import {
  ModuleHero,
  HowItWorks,
  ExampleCard,
  ProofPoints,
  ModuleCrossLinks,
  type HowStep,
  type Proof,
} from "@/components/marketing/module-template";
import { SalesLiveDemo } from "@/components/marketing/SalesLiveDemo";
import { CTASection } from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  TargetIcon,
  RadarIcon,
  NetworkIcon,
  TrendingUpIcon,
  CheckIcon,
  CpuIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/produkt/sales-intelligence";
const OG_TITLE = "Sales Intelligence — findr.";
const DESCRIPTION =
  "Deal-Risiko aus echten Gesprächen: 0–100-Risiko-Score nach jedem Call, acht belegte Signale, automatische Verlustgrund-Erkennung und risiko-adjustierte Pipeline-Prognose — DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Sales Intelligence",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Sales Intelligence",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

// HowItWorks steps — verbatim from landing.html:1243–1274.
const STEPS: HowStep[] = [
  {
    phase: "Beobachten",
    title: "Calls verbinden",
    body: "Verbinde findr. mit Gong, Slack oder deinem Kalender. Gespräche fließen automatisch ein — kein Upload, kein Tagging.",
  },
  {
    phase: "Beobachten",
    title: "findr. bewertet das Risiko",
    body: "Jeder Deal bekommt einen Risiko-Score von 0–100, aktualisiert nach jedem Call. Acht Risiko-Signale, jedes mit dem exakten Transkript-Moment belegt.",
  },
  {
    phase: "Beobachten",
    title: "Dein Forecast aktualisiert sich",
    body: "Risiko-adjustierte Pipeline — Best Case, wahrscheinlich, Worst Case — fließt direkt in HubSpot. Die Montags-Reviews sagen endlich die Wahrheit.",
  },
  {
    phase: "Handeln",
    title: "findr. sagt dir, wie du ihn rettest",
    body: "Wenn ein Deal in Gefahr ist, erzeugt findr. konkrete, belegte Empfehlungen zur Rettung — spezifische Maßnahmen und nächste Schritte, verankert in dem, was tatsächlich gesagt wurde.",
    tag: "Live",
  },
  {
    phase: "Lernen",
    title: "findr. schließt den Kreis",
    body: "Geht der Deal trotzdem verloren, fragt findr.s Voice-Agent nach, was wirklich passiert ist. Diese ehrliche Antwort schärft jeden zukünftigen Risiko-Score.",
    tag: "Bald",
  },
];

const PROOFS: Proof[] = [
  {
    title: "0–100-Risiko-Score nach jedem Call",
    body: "Jeder Deal bekommt einen Score, aktualisiert nach jedem Gespräch — ohne Tagging, ohne Dateneingabe.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Acht belegte Risiko-Signale",
    body: "Jedes Signal mit dem exakten Transkript-Moment belegt — du siehst genau, worauf sich der Score stützt.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Automatische Verlustgrund-Erkennung",
    body: "CRM-Tag „Verloren wegen Preis“ gegen die Realität im Gespräch — findr. nennt den echten Grund.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Risiko-adjustierte Pipeline",
    body: "Best Case, wahrscheinlich, Worst Case — direkt in HubSpot. Die Montags-Reviews sagen die Wahrheit.",
    Icon: TrendingUpIcon,
    tag: "Live",
  },
  {
    title: "Lösungs-Report als PDF",
    body: "Pro Risiko-Signal eine konkrete Maßnahme samt Beleg — als sauberes 1–2-seitiges PDF, kein Login nötig.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Voice-Loss-Loop",
    body: "Geht ein Deal verloren, fragt findr.s Voice-Agent nach dem echten Grund — und schärft jeden zukünftigen Score.",
    Icon: CpuIcon,
    tag: "Bald",
  },
];

export default function SalesIntelligencePage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

      <ModuleHero
        eyebrow="Sales Intelligence"
        title={
          <>
            Sieh einem Deal beim Zerfallen zu — in 30 Sekunden.
          </>
        }
        subhead="Deal-Risiko aus echten Gesprächen: Echtzeit-Risiko-Score, automatische Verlustgrund-Erkennung und risiko-adjustierte Pipeline-Prognose."
        audience="VP Sales & RevOps, die wissen wollen, warum Deals wirklich kippen."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Live-Demo testen", href: "#live-demo" }}
      />

      <HowItWorks
        eyebrow="So funktioniert Sales Intelligence"
        title={
          <>
            Vom rohen Call zur klaren Entscheidung.
          </>
        }
        lead="Fünf verbundene Schritte. Keine Dateneingabe. Kein „KI-Zusammenfassung“-Rauschen — nur die Risiko-Signale, die Deals wirklich bewegen."
        steps={STEPS}
      />

      {/* Interactive demo — fills the template's demo slot with a 'use client' island */}
      <Section id="live-demo" tone="muted">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Live-Analyse"
              title={
                <>
                  Ein echter Call. Ein Klick.
                </>
              }
              lead="Ein echtes Verkaufsgespräch — und eines von vier Produkten auf der Plattform. Klick auf Analysieren und findr. fängt die Signale, die ein menschlicher Reviewer übersehen hat."
            />
          </Reveal>
          <Reveal className="mt-12">
            <SalesLiveDemo />
          </Reveal>
        </Container>
      </Section>

      {/* Solution layer — ExampleCard makes the "belegt, nicht geraten" promise visible */}
      <Section>
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="flex flex-col gap-5">
                <Eyebrow>Sales Intelligence · Lösungsebene</Eyebrow>
                <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
                  findr. diagnostiziert nicht nur das Risiko —{" "}
                  es liefert die Lösung.
                </h2>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  Generische Ratschläge bringen in komplexen B2B-Deals nichts.
                  findr. verankert jede Empfehlung im echten Gespräch: pro
                  Risiko-Signal bekommst du eine konkrete Maßnahme, einen klaren
                  nächsten Schritt (wer macht was bis wann) und das exakte Zitat,
                  das es ausgelöst hat.
                </p>
                <div className="rounded border-l-2 border-primary-300 bg-primary-50/50 py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
                  <strong className="font-semibold text-neutral-900">
                    Keine Floskeln. Kein Raten.
                  </strong>
                  <br />
                  Jede Empfehlung zitiert, was der Kunde wirklich gesagt hat — so
                  weiß dein Team, <em>warum</em> diese Maßnahme zählt, und handelt
                  mit Sicherheit.
                </div>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  Und weil Deals schnell laufen, exportiert sich der ganze
                  Lösungs-Report als sauberes 1–2-seitiges PDF — bereit fürs
                  nächste Deal-Review oder zum Weiterleiten an Legal, Finance oder
                  Product.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ExampleCard
                badge="Champion-Verlust · Hohes Risiko"
                rows={[
                  {
                    label: "Empfehlung",
                    value:
                      "Sichere eine warme Übergabe mit der Nachfolge, bevor der Champion geht — als Kontinuität framen, nicht als Neustart.",
                  },
                  {
                    label: "Nächster Schritt",
                    value:
                      "Schreib der Nachfolge (mit dem scheidenden Champion in CC) und vereinbare diese Woche einen 30-minütigen Übergabe-Call. Nutze die Einführung des Champions, um Vertrauen aufzubauen.",
                  },
                  {
                    label: "Beleg aus dem Call",
                    quote: true,
                    value:
                      "„Sarah war eigentlich die treibende Kraft auf unserer Seite — seit sie letzte Woche gegangen ist, liegt das Thema etwas auf Eis.“",
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
            Was Sales Intelligence konkret liefert.
          </>
        }
        lead="Jede Fähigkeit ist am echten Gespräch verankert — Live, was Live ist, Bald, was kommt."
        points={PROOFS}
      />

      <ModuleCrossLinks current="sales-intelligence" />

      <CTASection
        title={
          <>
            Sieh, was findr. in deinen Deals findet.
          </>
        }
        lead="Lade ein echtes Gespräch hoch oder buch eine Demo — in 30 Sekunden zum ersten Risiko-Score."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
