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
  CpuIcon,
  CheckIcon,
  RadarIcon,
  HexagonIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/produkt/product-discovery";
const OG_TITLE = "Product Discovery — findr.";
const DESCRIPTION =
  "Voice of Customer aus deinen bestehenden Gesprächen: KI-geführte Interviews, Studien-Synthese verankert im Transkript und ein Research-Agent, der nur sagt, was belegt ist — DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Product Discovery",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Product Discovery",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const STEPS: HowStep[] = [
  {
    phase: "Sammeln",
    title: "Gespräche, die du schon hast",
    body: "findr. zieht Voice of Customer aus deinen bestehenden Sales-, Success- und Interview-Calls — dasselbe KI-Gehirn, kein separates Tool, kein neues Studien-Setup.",
  },
  {
    phase: "Verstehen",
    title: "Synthese, verankert im Transkript",
    body: "Aus rohen Interviews wird eine strukturierte Studien-Synthese — Themen, Pains und Feature-Wünsche, jede mit dem exakten Zitat belegt statt aus dem Bauchgefühl.",
    tag: "Live",
  },
  {
    phase: "Fragen",
    title: "Der Research-Agent antwortet",
    body: "Stell eine Frage zur Studie — der Research-Agent baut Zusammenfassung oder Ranking selbst auf. Was nicht im Transkript steht, sagt er nicht.",
    tag: "Live",
  },
  {
    phase: "Entscheiden",
    title: "Von Evidenz zur Roadmap",
    body: "Jede Aussage ist auf ihre Quelle zurück-klickbar. Dein Team priorisiert auf Belegen — nicht auf der lautesten Meinung im Raum.",
  },
];

const PROOFS: Proof[] = [
  {
    title: "KI-geführte Nutzer-Interviews",
    body: "findr. führt strukturierte Interviews selbst — auf Deutsch und Englisch — und hakt nicht nur ab, sondern fragt nach.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Synthese, verankert im Transkript",
    body: "Themen, Pains und Feature-Wünsche, jede am exakten Zitat belegt — nicht aus dem Bauchgefühl abgeleitet.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Research-Agent auf Zuruf",
    body: "Frag deine Studie in natürlicher Sprache; der Agent baut Zusammenfassung oder Ranking auf und nennt nur, was belegt ist.",
    Icon: CpuIcon,
    tag: "Live",
  },
  {
    title: "Quelle bei jeder Aussage",
    body: "Jede Aussage ist auf das Transkript zurück-klickbar — was nicht belegt ist, sagt findr. nicht.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Voice of Customer aus bestehenden Calls",
    body: "Kein neues Studien-Setup nötig: dasselbe KI-Gehirn nutzt deine Sales- und Success-Calls als Discovery-Quelle.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Themen-Trends über Studien hinweg",
    body: "Wiederkehrende Muster über mehrere Discovery-Studien hinweg, automatisch zusammengeführt.",
    Icon: HexagonIcon,
    tag: "Bald",
  },
];

export default function ProductDiscoveryPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

      <ModuleHero
        eyebrow="Product Discovery"
        title={
          <>
            Was Kunden wirklich brauchen — belegt, nicht
            geraten.
          </>
        }
        subhead="findr. macht aus deinen bestehenden Calls und Interviews echte Produkt-Evidenz: KI-geführte Nutzer-Interviews, automatische Studien-Synthese und ein Research-Agent, der jede Aussage am Transkript verankert."
        audience="Product- & Research-Teams in B2B-SaaS, die Voice of Customer aus ihren bestehenden Gesprächen ziehen — ohne eine neue Studie aufzusetzen."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />

      <HowItWorks
        eyebrow="So funktioniert Product Discovery"
        title={
          <>
            Vom rohen Interview zur belegten Roadmap.
          </>
        }
        lead="Vier verbundene Schritte. Kein neues Tool, kein Bauchgefühl — nur Aussagen, die jederzeit auf ihre Quelle zurückführen."
        steps={STEPS}
        tone="muted"
      />

      <DemoPlaceholder
        eyebrow="Produkt-Vorschau"
        title={
          <>
            Jede Aussage führt zur Quelle zurück.
          </>
        }
        lead="Synthese links, Beleg-Zitat rechts — der Platzhalter zeigt, wo später die echte Studien-Ansicht mit klickbaren Transkript-Belegen steht."
        label="Studien-Synthese"
      />

      {/* Solution layer — ExampleCard makes the "belegt, nicht geraten" promise
          visible. On a muted band so the white card pops and the page keeps the
          homepage's alternating section rhythm (W-M-W-M-W-M). */}
      <Section tone="muted">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="flex flex-col gap-5">
                <Eyebrow>Product Discovery · Lösungsebene</Eyebrow>
                <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
                  Voice of Customer steckt schon in deinen{" "}
                  Gesprächen.
                </h2>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  Du musst keine neue Studie aufsetzen, um zu wissen, was Kunden
                  brauchen. findr. liest die Calls und Interviews, die du schon
                  führst, und macht daraus strukturierte Produkt-Evidenz — Themen,
                  Pains, Feature-Wünsche, jede am Transkript verankert.
                </p>
                <div className="rounded border-l-2 border-primary-300 bg-white py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
                  <strong className="font-semibold text-neutral-900">
                    Was nicht belegt ist, sagt er nicht.
                  </strong>
                  <br />
                  Der Research-Agent baut Zusammenfassungen und Rankings auf Zuruf
                  — aber jede Aussage zitiert ihre Quelle. Keine erfundenen
                  Mehrheiten, keine Halluzination.
                </div>
                <p className="text-[16px] leading-relaxed text-neutral-500">
                  So entscheidet dein Team auf Belegen statt auf der lautesten
                  Stimme — und jeder Insight ist mit einem Klick nachprüfbar.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ExampleCard
                tone="neutral"
                badge="Feature-Signal · belegt"
                rows={[
                  {
                    label: "Befund",
                    value:
                      "Onboarding-Reibung blockiert die Aktivierung — quer durch das Segment genannt, nicht nur ein Einzelfall.",
                  },
                  {
                    label: "Häufigkeit in der Studie",
                    value:
                      "In 4 von 6 Interviews dieser Studie genannt — jede Nennung mit Zitat belegt.",
                  },
                  {
                    label: "Beleg aus dem Interview",
                    quote: true,
                    value:
                      "„Wir waren startklar, aber die Datenmigration hat zwei Wochen gekostet — fast hätten wir’s liegen lassen.“",
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
            Was Product Discovery konkret liefert.
          </>
        }
        lead="Jede Fähigkeit ist am echten Interview verankert — Live, was Live ist, Bald, was kommt."
        points={PROOFS}
      />

      <ModuleCrossLinks current="product-discovery" />

      <CTASection
        title={
          <>
            Frag deine Gespräche — belegt, nicht geraten.
          </>
        }
        lead="Buch eine Demo und sieh, welche Produkt-Signale in deinen bestehenden Calls schon stecken — jede Aussage am Transkript verankert."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
