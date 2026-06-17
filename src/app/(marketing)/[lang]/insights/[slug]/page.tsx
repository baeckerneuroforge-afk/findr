import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Container,
  Section,
  Eyebrow,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import { CTASection } from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  SITE_URL,
  SITE_NAME,
  ogDefaultsFor,
  buildAlternates,
} from "@/lib/marketing/seo";
import {
  getInsight,
  getInsightSlugs,
  formatDate,
  type InsightBlock,
} from "@/lib/insights/articles";
import {
  MARKETING_LOCALES,
  localizePath,
  resolveLocale,
  toBcp47,
} from "@/i18n/marketing-locale";

// params now carries the parent [lang] segment too (/de|/en × /insights/[slug]).
type Params = { lang: string; slug: string };

// Build one static HTML per article from the same source as the sitemap (§8).
// This segment only generates its OWN param ([slug]); Next runs it once per
// parent [lang] and forms the lang×slug cross-product. `dynamicParams = false`
// closes the set: an unknown slug 404s instead of being rendered on demand.
// Safe here because next.config has NO `cacheComponents` — with it on,
// dynamicParams would be unavailable and an empty array a build error (§8
// caveat); we have ≥1 article either way.
export function generateStaticParams(): { lang: string; slug: string }[] {
  // "Bottom-up": this leaf generates the FULL (lang, slug) combos itself, only
  // for locales that actually HAVE articles. Insights are authored, not
  // machine-translated → German-only today, so only /de/insights/<slug> exists;
  // /en/insights/[slug] 404s (dynamicParams=false) until EN articles are
  // authored, at which point they appear here automatically.
  return MARKETING_LOCALES.flatMap((locale) =>
    getInsightSlugs(locale).map((slug) => ({ lang: locale, slug })),
  );
}

export const dynamicParams = false;

// params is a Promise in Next 16 — awaiting ONLY params (no searchParams/
// cookies/headers) keeps the route statically rendered (§8).
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const locale = resolveLocale(lang);
  const article = getInsight(slug, locale);
  if (!article) return {};

  const path = `/insights/${article.slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: buildAlternates(locale, path),
    // Full openGraph object (Befund 1: per-key REPLACE) + article type.
    openGraph: {
      ...ogDefaultsFor(locale),
      title: `${article.title} — ${SITE_NAME}`,
      description: article.excerpt,
      url: localizePath(locale, path),
      type: "article",
      publishedTime: article.date,
    },
  };
}

function ArticleBlock({ block }: { block: InsightBlock }) {
  switch (block.kind) {
    case "h2":
      return (
        <h2 className="mt-12 font-marketing text-[clamp(22px,3vw,30px)] font-semibold leading-snug tracking-[-0.01em] text-neutral-900">
          {block.text}
        </h2>
      );
    case "ul":
      return (
        <ul className="mt-5 flex flex-col gap-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-neutral-700">
              <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary-500" />
              <span className="text-[17px] leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="mt-7 rounded border-l-2 border-primary-300 bg-neutral-0 py-4 pl-5 pr-4">
          <p className="text-[17px] italic leading-relaxed text-neutral-700">
            „{block.text}“
          </p>
          {block.cite ? (
            <cite className="mt-2 block text-[13px] not-italic text-neutral-400">
              — {block.cite}
            </cite>
          ) : null}
        </blockquote>
      );
    default:
      return (
        <p className="mt-5 text-[17px] leading-relaxed text-neutral-700">
          {block.text}
        </p>
      );
  }
}

export default async function InsightArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, lang } = await params;
  const locale = resolveLocale(lang);
  const article = getInsight(slug, locale);
  if (!article) notFound();

  const path = `/insights/${article.slug}`;
  const BLOG_POSTING_JSONLD = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: toBcp47(locale),
    url: `${SITE_URL}${path}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${path}` },
    image: `${SITE_URL}/og-image.png`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/og-image.png` },
    },
  };

  return (
    <>
      <JsonLd data={BLOG_POSTING_JSONLD} />

      <Section className="pt-14 sm:pt-20">
        <Container>
          <Reveal>
            <article className="mx-auto max-w-2xl">
              <header className="flex flex-col gap-4">
                <Eyebrow>{article.category}</Eyebrow>
                <h1 className="font-marketing text-[clamp(30px,5vw,52px)] font-semibold leading-[1.06] tracking-[-0.03em] text-neutral-900">
                  {article.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-400">
                  <time dateTime={article.date}>{formatDate(article.date, locale)}</time>
                  <span aria-hidden>·</span>
                  <span>{article.readingMinutes} Min. Lesezeit</span>
                </div>
                <p className="mt-2 border-l-2 border-primary-300 pl-4 text-[19px] leading-relaxed text-neutral-500">
                  {article.excerpt}
                </p>
              </header>

              <div className="mt-4">
                {article.body.map((block, i) => (
                  <ArticleBlock key={i} block={block} />
                ))}
              </div>

              <footer className="mt-14 border-t border-neutral-200 pt-6">
                <Link
                  href="/insights"
                  className="inline-flex items-center gap-2 rounded text-sm font-medium text-primary-700 transition-colors hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
                >
                  <span aria-hidden>←</span> Alle Insights
                </Link>
              </footer>
            </article>
          </Reveal>
        </Container>
      </Section>

      <CTASection
        title={
          <>
            Von der Theorie zum eigenen Gespräch.
          </>
        }
        lead="Buch eine Demo und sieh, was Klymeo in deinen eigenen Calls findet — belegt, nicht geraten."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
