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
import { insightsByDate } from "@/lib/insights/articles";
import { resolveLocale, toBcp47 } from "@/i18n/marketing-locale";

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

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = resolveLocale((await params).lang);
  const articles = insightsByDate(locale);

  // Blog JSON-LD lists THIS locale's published articles. EN has none yet → omit
  // the block entirely rather than emit an empty Blog.
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Klymeo Insights",
    url: `${SITE_URL}${PATH}`,
    description: DESCRIPTION,
    inLanguage: toBcp47(locale),
    blogPost: articles.map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.excerpt,
      datePublished: a.date,
      url: `${SITE_URL}/insights/${a.slug}`,
    })),
  };

  return (
    <>
      {articles.length > 0 ? <JsonLd data={blogJsonLd} /> : null}

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
          {articles.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article, i) => (
                <Reveal key={article.slug} delay={i * 0.05} className="h-full">
                  <InsightTeaser article={article} />
                </Reveal>
              ))}
            </div>
          ) : (
            // EN has no articles yet — editorial is authored, not machine-translated.
            <Reveal>
              <p className="mx-auto max-w-xl text-center text-[15px] leading-relaxed text-neutral-500">
                {locale === "en"
                  ? "English insights are coming soon. In the meantime, explore the platform — the German articles are available under DE."
                  : "Bald erscheinen hier die ersten Insights."}
              </p>
            </Reveal>
          )}
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
