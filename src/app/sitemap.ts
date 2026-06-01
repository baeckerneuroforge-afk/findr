import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";

/**
 * Sitemap — the first routes (Etappe A). Later etappen add the remaining module
 * pages, /produkt, /loesungen, /preise, /demo, legal, and the /insights article
 * slugs (loaded from the same source as generateStaticParams).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: "/", priority: 1.0 },
    { path: "/produkt/sales-intelligence", priority: 0.8 },
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
