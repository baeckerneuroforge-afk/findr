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

      {/* ── HERO + interactive demo (the above-the-fold composition) ───── */}
      <section className="relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24">
        {/* Restrained, reduced-motion-safe atmosphere: a faint violet top wash,
            a low-opacity dot grid, and one slow floating accent. No heavy
            purple-on-white gradient (that's the AI-slop trap). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-primary-50/70 to-transparent" />
          <div
            className="absolute inset-x-0 top-0 h-[520px] opacity-[0.13] [background-image:radial-gradient(var(--color-primary-300)_1px,transparent_1.4px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          />
          <div className="absolute -right-24 -top-16 h-72 w-72 rounded-full bg-primary-200/30 blur-3xl motion-safe:animate-float motion-reduce:animate-none" />
        </div>

        <Container>
          <Reveal>
            <div className="flex max-w-4xl flex-col items-start gap-6 sm:gap-7">
              <Eyebrow>Conversation-Intelligence-Plattform für B2B-SaaS</Eyebrow>
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
                Ein KI-Gehirn, vier Produkte, keine Datensilos. findr. liest
                jedes Kundengespräch — Sales-Calls, Success-Reviews,
                Nutzer-Interviews — und macht es über alle Produkte hinweg
                nutzbar. DSGVO-nativ und in der EU gehostet.
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
      <PlatformModules accent title="Ein KI-Gehirn. Vier Produkte." />

      {/* Section rhythm: the band sits on neutral-50 so it reads as its own
          step between the white module grid and the violet closing CTA. */}
      <div className="bg-neutral-50">
        <StatBand />
      </div>

      {/* No pricing on the homepage — secondary CTA points to the platform, not
          /preise (Preise individuell nach Umfang). `title` is passed explicitly
          (single ink colour) to drop the shared default's two-tone <Accent>
          split on the homepage only — other pages keep their own titles. */}
      <CTASection
        title="Ein Gehirn für jedes Kundengespräch."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
