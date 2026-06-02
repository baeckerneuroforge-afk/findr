import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";
import { getAllInsightSlugs } from "@/lib/insights/articles";
import { SITEMAP_ROUTES } from "@/components/marketing/nav-data";

/**
 * Sitemap — the indexable marketing routes (homepage, /produkt + four modules,
 * /loesungen + roles, /branchen, /preise, /insights, /demo) come from the single
 * nav registry (nav-data.ts: SITEMAP_ROUTES), so the menu, the footer and this
 * file can't drift apart. Article slugs are appended from the SAME source as
 * generateStaticParams (getAllInsightSlugs) so prebuilt routes and sitemap stay
 * in lockstep too.
 *
 * The legal pages (/impressum, /datenschutz, /agb) are intentionally NOT listed:
 * they ship as noindex placeholders (texts come from André/Legal, D8) and are
 * therefore omitted from SITEMAP_ROUTES. Add /impressum + /datenschutz there
 * once they carry the real, indexable text; /agb stays noindex by choice (§4.9).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    ...SITEMAP_ROUTES,
    ...getAllInsightSlugs().map((slug) => ({
      path: `/insights/${slug}`,
      priority: 0.6,
    })),
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
