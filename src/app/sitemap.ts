import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";
import { getAllInsightSlugs } from "@/lib/insights/articles";

/**
 * Sitemap — homepage, platform overview + four module pages (Etappe A + B), plus
 * Etappe C: /loesungen, /insights (and every article slug, loaded from the SAME
 * source as generateStaticParams so prebuilt routes and sitemap can't drift) and
 * /preise. Later etappen add /demo and the legal pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: "/", priority: 1.0 },
    { path: "/produkt", priority: 0.8 },
    { path: "/produkt/sales-intelligence", priority: 0.8 },
    { path: "/produkt/customer-health", priority: 0.8 },
    { path: "/produkt/product-discovery", priority: 0.8 },
    { path: "/produkt/market-research", priority: 0.8 },
    { path: "/preise", priority: 0.8 },
    { path: "/loesungen", priority: 0.7 },
    { path: "/insights", priority: 0.6 },
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
