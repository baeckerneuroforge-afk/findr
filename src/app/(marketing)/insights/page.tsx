import type { Metadata } from "next";
import {
  Container,
  Section,
  SectionHeading,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import { InsightTeaser } from "@/components/marketing/InsightTeaser";
import { CTASection } from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";
import { INSIGHTS_BY_DATE } from "@/lib/insights/articles";

const PATH = "/insights";
const OG_TITLE = "Insights — Klymeo";
const DESCRIPTION =
  "Ressourcen zu qualitativer Marktforschung, KI- und Voice-Interviews und DSGVO-nativer KI — belegt statt geraten, ohne Hype, von Klymeo.";

export const metadata: Metadata = {
  title: "Insights",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

// Blog JSON-LD: lists the published articles so search engines can surface them
// as a collection. Each entry mirrors the per-article BlogPosting on [slug].
const BLOG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Klymeo Insights",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  inLanguage: "de-DE",
  blogPost: INSIGHTS_BY_DATE.map((a) => ({
    "@type": "BlogPosting",
    headline: a.title,
    description: a.excerpt,
    datePublished: a.date,
    url: `${SITE_URL}/insights/${a.slug}`,
  })),
};

export default function InsightsPage() {
  return (
    <>
      <JsonLd data={BLOG_JSONLD} />

      <Section className="pt-14 sm:pt-20">
        <Container>
          <Reveal>
            <SectionHeading
              as="h1"
              align="left"
              eyebrow="Insights"
              title={
                <>
                  Was wir übers Zuhören gelernt haben.
                </>
              }
              lead="Ressourcen zu qualitativer Marktforschung, KI- und Voice-Interviews und DSGVO-nativer KI. Belegt, nicht geraten — und ohne Hype."
            />
          </Reveal>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INSIGHTS_BY_DATE.map((article, i) => (
              <Reveal key={article.slug} delay={i * 0.05} className="h-full">
                <InsightTeaser article={article} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <CTASection
        eyebrow="Bereit?"
        title={
          <>
            Lieber selbst sehen als nachlesen?
          </>
        }
        lead="Buch eine Demo und sieh, was Klymeo in echten Tiefeninterviews findet — über alle vier Methoden hinweg, vom Voice-Interview bis zum exportierten Deck."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
