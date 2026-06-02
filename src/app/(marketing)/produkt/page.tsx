import type { Metadata } from "next";
import { Hero } from "@/components/marketing/Hero";
import { PlatformDiagram } from "@/components/marketing/PlatformDiagram";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { Integrations } from "@/components/marketing/Integrations";
import { StatBand } from "@/components/marketing/StatBand";
import { CTASection } from "@/components/marketing/CTASection";
import {
  Container,
  Section,
  SectionHeading,
  CornerBrackets,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/produkt";
const OG_TITLE = "Plattform — findr.";
const DESCRIPTION =
  "Vier gleichwertige Produkte auf einem gemeinsamen KI-Gehirn: Sales Intelligence, Customer Success Health, Product Discovery und Market Research. Die Module reden miteinander, Daten kumulieren statt in Silos zu verschwinden — DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Plattform",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  featureList: [
    "Sales Intelligence",
    "Customer Success Health",
    "Product Discovery",
    "Market Research",
  ],
};

// Cross-module flows (landing.html:1452) — the modules feed each other.
const FLOWS = [
  {
    from: "Churn-Signal",
    to: "Research-Frage",
    body: "Ein Risiko-Signal aus einem Success-Call wird automatisch zur nächsten Research-Frage.",
  },
  {
    from: "Gewonnener Deal",
    to: "CS-Onboarding",
    body: "Ein in Sales gewonnener Deal übergibt den Account direkt an Customer Success — mit voller Vorgeschichte.",
  },
  {
    from: "Research-Insight",
    to: "Risiko-Modell",
    body: "Ein belegter Research-Insight schärft das Risiko-Modell, das Deals und Accounts bewertet.",
  },
];

export default function ProduktPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

      <Hero
        eyebrow="Die Plattform"
        title={
          <>
            Ein KI-Gehirn. Vier Produkte. Ein System.
          </>
        }
        subhead="findr. ist keine Sammlung von Tools, sondern eine Conversation-Intelligence-Engine mit vier gleichwertigen Produkten. Jedes Gespräch fließt in ein gemeinsames Gehirn — DSGVO-nativ und in der EU gehostet."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Module ansehen", href: "#module" }}
        trust={["DSGVO-nativ", "EU-gehostet · Frankfurt", "EU AI Act"]}
      />

      <PlatformDiagram />

      {/* `title` passed explicitly (single ink colour) to drop the component
          default's two-tone <Accent> split — matches the homepage pattern. */}
      <PlatformModules title="Ein KI-Gehirn. Vier Produkte." />

      <Integrations tone="muted" />

      {/* Module reden miteinander — the cross-module flows. On white so the page
          keeps the homepage's alternating rhythm (diagram M → modules W →
          integrations M → flows W → statband M → cta wash). */}
      <Section>
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Ein System"
              title={
                <>
                  Die Module reden miteinander.
                </>
              }
              lead="Weil alle vier Produkte aus demselben Gehirn lesen, fließen Signale zwischen ihnen — statt in vier getrennten Tools zu versanden."
            />
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 md:grid-cols-3">
            {FLOWS.map((f, i) => (
              <Reveal key={f.from} y={0} delay={i * 0.06}>
                <div className="relative flex h-full flex-col gap-4 bg-white p-7">
                  <CornerBrackets className="border-primary-200" />
                  <div className="flex flex-wrap items-center gap-2 font-marketing text-lg font-semibold text-neutral-900">
                    {f.from}
                    <span aria-hidden className="text-primary-600">
                      →
                    </span>
                    {f.to}
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section rhythm: the band sits on neutral-50 (like the homepage) so it
          reads as its own muted step between the white flows grid and the
          violet closing CTA. */}
      <div className="bg-neutral-50">
        <StatBand />
      </div>

      <CTASection
        title={
          <>
            Vier Produkte. Ein gemeinsames Gehirn.
          </>
        }
        lead="Sieh, was findr. in deinen Gesprächen findet — über alle vier Produkte hinweg, auf einer Plattform."
      />
    </>
  );
}
