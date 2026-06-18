import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";
import { getInsightSlugs } from "@/lib/insights/articles";
import { SITEMAP_ROUTES } from "@/components/marketing/nav-data";
import {
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  MARKETING_LOCALES,
  toBcp47,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Sitemap — the indexable marketing routes come from the single nav registry
 * (nav-data.ts: SITEMAP_ROUTES), so the menu, the footer and this file can't
 * drift. Article slugs are appended from the SAME source as generateStaticParams
 * (getInsightSlugs) so prebuilt routes and the sitemap stay in lockstep.
 *
 * DE/EN: every route is emitted ONCE PER LOCALE (/de/… and /en/…), and each
 * entry carries reciprocal hreflang `alternates.languages` (de-DE, en-US,
 * x-default → German) so crawlers see both language variants of every page.
 * Insight slugs are taken PER LOCALE — a slug is only advertised for the
 * locales that actually have an article for it (today DE + EN share all three;
 * written generically so an asymmetric set never advertises a 404).
 *
 * Legal pages: /impressum (binding) plus /datenschutz + /agb are all listed in
 * SITEMAP_ROUTES (low priority). The latter two are still detailed drafts
 * (ENTWURF) but are advertised on André's decision so the legal pages are
 * findable; revisit once the final text lands.
 */

/** Absolute reciprocal-hreflang map for a canonical (locale-less) path, listing
 *  only the locales that actually have the path + x-default → German. */
function languagesFor(
  path: string,
  locales: readonly Locale[],
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of locales) {
    languages[toBcp47(loc)] = `${SITE_URL}${localizePath(loc, path)}`;
  }
  languages["x-default"] = `${SITE_URL}${localizePath(
    MARKETING_DEFAULT_LOCALE,
    path,
  )}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Static marketing routes exist in every locale.
  for (const r of SITEMAP_ROUTES) {
    const languages = languagesFor(r.path, MARKETING_LOCALES);
    for (const loc of MARKETING_LOCALES) {
      entries.push({
        url: `${SITE_URL}${localizePath(loc, r.path)}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: r.priority,
        alternates: { languages },
      });
    }
  }

  // Insight articles: only the locales that actually have a given slug get an
  // entry + only those locales appear in its hreflang map (no 404 advertised).
  const slugLocales = new Map<string, Locale[]>();
  for (const loc of MARKETING_LOCALES) {
    for (const slug of getInsightSlugs(loc)) {
      slugLocales.set(slug, [...(slugLocales.get(slug) ?? []), loc]);
    }
  }
  for (const [slug, locales] of slugLocales) {
    const path = `/insights/${slug}`;
    const languages = languagesFor(path, locales);
    for (const loc of locales) {
      entries.push({
        url: `${SITE_URL}${localizePath(loc, path)}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages },
      });
    }
  }

  return entries;
}
