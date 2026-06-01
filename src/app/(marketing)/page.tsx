import type { Metadata } from "next";
import { Hero } from "@/components/marketing/Hero";
import { HeroDealCard } from "@/components/marketing/HeroDealCard";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { StatBand } from "@/components/marketing/StatBand";
import { CTASection } from "@/components/marketing/CTASection";
import { Accent } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const TITLE = "findr. — Conversation-Intelligence-Plattform für B2B-SaaS";
const DESCRIPTION =
  "Ein KI-Gehirn, vier Produkte: Sales Intelligence, Customer Success Health, Product Discovery und Market Research. findr. liest jedes Kundengespräch und macht es über alle Produkte hinweg nutzbar — DSGVO-nativ, in Frankfurt gehostet.";

export const metadata: Metadata = {
  // absolute → skip the "%s — findr." template for the homepage title.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Full openGraph object (Befund 1: per-key REPLACE, never a partial).
  openGraph: { ...ogDefaults, title: TITLE, url: "/" },
};

const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "findr.",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description: DESCRIPTION,
  areaServed: "DACH",
  foundingLocation: "Frankfurt am Main, Deutschland",
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={ORGANIZATION_JSONLD} />

      <Hero
        eyebrow="Conversation-Intelligence-Plattform"
        title={
          <>
            Ein <Accent>KI-Gehirn.</Accent> Vier Produkte.{" "}
            <Accent>Keine Datensilos.</Accent>
          </>
        }
        subhead="findr. liest jedes Kundengespräch — Sales-Calls, Success-Reviews, Nutzer-Interviews — und macht es über vier Produkte hinweg nutzbar. Ein gemeinsames Gehirn statt vier getrennter Tools. DSGVO-nativ und in der EU gehostet."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
        trust={["DSGVO-nativ", "EU-gehostet · Frankfurt", "EU AI Act"]}
        visual={<HeroDealCard />}
      />

      <PlatformModules />

      <StatBand />

      <CTASection />
    </>
  );
}
