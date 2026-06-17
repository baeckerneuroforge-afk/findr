import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";
import { getInsightSlugs } from "@/lib/insights/articles";
import { SITEMAP_ROUTES } from "@/components/marketing/nav-data";
import {
  localizePath,
  MARKETING_DEFAULT_LOCALE,
} from "@/i18n/marketing-locale";

/**
 * Sitemap — the indexable marketing routes (homepage, /produkt + four modules,
 * /loesungen + roles, /branchen, /preise, /insights, /demo) come from the single
 * nav registry (nav-data.ts: SITEMAP_ROUTES), so the menu, the footer and this
 * file can't drift apart. Article slugs are appended from the SAME source as
 * generateStaticParams (getAllInsightSlugs) so prebuilt routes and sitemap stay
 * in lockstep too.
 *
 * Legal pages: /impressum carries the binding text and IS listed (via
 * SITEMAP_ROUTES, low priority). /datenschutz + /agb are indexable but stay out
 * of the sitemap while they still hold placeholders — add them to SITEMAP_ROUTES
 * once the real legal text from André/Legal lands.
 *
 * DE/EN: the routes are emitted under the German /de prefix only — DE is the
 * indexed locale today. /en is an EN=DE mirror and is noindex (layout robots),
 * so it stays OUT of the sitemap until real English texts land; then EN URLs +
 * per-entry hreflang alternates get added here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    ...SITEMAP_ROUTES,
    ...getInsightSlugs(MARKETING_DEFAULT_LOCALE).map((slug) => ({
      path: `/insights/${slug}`,
      priority: 0.6,
    })),
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${localizePath(MARKETING_DEFAULT_LOCALE, r.path)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
