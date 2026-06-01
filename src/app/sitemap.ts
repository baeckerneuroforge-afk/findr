import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";

/**
 * Sitemap — homepage, the platform overview and all four module pages (Etappe
 * A + B). Later etappen add /loesungen, /preise, /demo, legal, and the
 * /insights article slugs (loaded from the same source as generateStaticParams).
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
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
