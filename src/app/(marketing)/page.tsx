import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/marketing/primitives";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Reveal } from "@/components/marketing/Reveal";
import { HeroAnalysisDemo } from "@/components/marketing/HeroAnalysisDemo";
import { TrustBar } from "@/components/marketing/TrustBar";
import { HomeFeatures } from "@/components/marketing/HomeFeatures";
import { HomeWorkflow } from "@/components/marketing/HomeWorkflow";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { StatBand } from "@/components/marketing/StatBand";
import { CTASection } from "@/components/marketing/CTASection";
import { HeroAtmosphere } from "@/components/marketing/HeroAtmosphere";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const TITLE = "findr. — Qualitative Marktforschung mit KI, DSGVO-nativ & auf Deutsch";
const DESCRIPTION =
  "findr. führt hunderte qualitative Tiefeninterviews mit deiner Zielgruppe — KI-geführt, auf Deutsch und DSGVO-nativ in Frankfurt gehostet. Vier Methoden, eine Engine: Bedarf & Verhalten, Markenwahrnehmung, Konzept- und Creative-Test, verdichtet zu belegten Insights.";

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

      {/* ── HERO + interactive demo (the above-the-fold composition) ───── */}
      <section className="relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24">
        {/* De-glassed atmosphere: warm off-white canvas + a faint neutral dot
            texture (the violet wash + blur blob were removed in the Farbsystem
            pass). Shared verbatim with every subpage hero. */}
        <HeroAtmosphere />

        <Container>
          <Reveal>
            <div className="flex max-w-4xl flex-col items-start gap-6 sm:gap-7">
              <Eyebrow>Qualitative Marktforschung mit KI</Eyebrow>
              {/* Single-colour ink headline — the contrast comes from size +
                  whitespace + the product window below, not from a two-tone
                  split (kept consistent with the marketing font-semibold scale). */}
              <h1 className="font-marketing text-[clamp(38px,6.6vw,72px)] font-semibold leading-[1.03] tracking-[-0.035em] text-neutral-900">
                {/* Forced two-line break only at sm+ (clean editorial pair). On
                    the narrowest phones the break is dropped so the headline
                    wraps naturally. The {" "} keeps a real space between the two
                    sentences when the <br> is display:none (else they'd run
                    together on mobile). */}
                Echte Gespräche.{" "}
                <br className="hidden sm:inline" />
                Belegte Entscheidungen.
              </h1>
              <p className="max-w-xl text-[18px] leading-relaxed text-neutral-500">
                Hunderte qualitative Tiefeninterviews mit deiner Zielgruppe —
                KI-geführt, die nachbohrt wie ein erfahrener Researcher.
                DSGVO-nativ, auf Deutsch und in der EU gehostet, verdichtet zu
                klaren, belegten Insights.
              </p>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <CtaLink href="/demo" variant="primary" size="lg">
                  Demo buchen →
                </CtaLink>
                <CtaLink href="/produkt" variant="secondary" size="lg">
                  Plattform ansehen
                </CtaLink>
              </div>
              {/* TODO D3: UWG-Claims — "DSGVO-nativ" / "EU AI Act" sind werbliche
                  Trust-Aussagen, vor Live belegen oder entschärfen (André). Bewusst
                  als ruhige Fließtext-Zeile statt farbiger Badge-Pills. */}
              <p className="max-w-xl text-[13px] leading-relaxed text-neutral-500">
                DSGVO-nativ, in der EU gehostet (Frankfurt am Main), ausgerichtet
                am EU AI Act.
              </p>
            </div>
          </Reveal>

          {/* The interactive demo as the hero's prominent product window — the
              visual anchor that now carries the contrast the headline gave up. */}
          <Reveal delay={0.12} className="mt-14 sm:mt-20">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Beispiel-Analyse — klick „Analysieren“, kein Login nötig
            </p>
            <HeroAnalysisDemo />
          </Reveal>
        </Container>
      </section>

      <TrustBar />

      <HomeFeatures />

      <HomeWorkflow />

      {/* `accent` is homepage-only (opt-in prop, default off elsewhere) — the
          violet card edge ties the module grid into the page's accent motif.
          `title` is passed explicitly (single ink colour) to drop the shared
          default's two-tone <Accent> split on the homepage only — /produkt keeps
          the component default unchanged. */}
      <PlatformModules accent title="Vier Methoden, eine Engine." />

      {/* Section rhythm: the band sits on the warm cream so it reads as its own
          step between the module grid and the closing CTA. */}
      <div className="bg-warm">
        <StatBand />
      </div>

      {/* No pricing on the homepage — secondary CTA points to the platform, not
          /preise (Preise individuell nach Umfang). `title` is passed explicitly
          (single ink colour) to drop the shared default's two-tone <Accent>
          split on the homepage only — other pages keep their own titles. */}
      <CTASection
        title="Frag deine Zielgruppe — bau auf echten Stimmen."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
