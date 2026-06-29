import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";

/**
 * Sitemap for the public Klymeo marketing site — the flat, single-locale (German)
 * (site) route group (replaced the old (marketing)/[lang] DE/EN tree). One entry
 * per indexable page, absolute URLs from SITE_URL. Set NEXT_PUBLIC_SITE_URL to the
 * production domain before go-live; the findr.de fallback would otherwise poison
 * every absolute URL.
 */
const ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1.0 },
  { path: "/konsoul", priority: 0.9 },
  { path: "/plattform", priority: 0.9 },
  { path: "/methoden", priority: 0.8 },
  { path: "/preise", priority: 0.8 },
  { path: "/loesungen", priority: 0.8 },
  { path: "/loesungen/user-research", priority: 0.7 },
  { path: "/loesungen/konzept-test", priority: 0.7 },
  { path: "/loesungen/markenwahrnehmung", priority: 0.7 },
  { path: "/loesungen/bedarf-verhalten", priority: 0.7 },
  { path: "/personas", priority: 0.7 },
  { path: "/branchen", priority: 0.7 },
  { path: "/kontakt", priority: 0.6 },
  { path: "/blog/system-usability-scale-guide", priority: 0.6 },
  { path: "/blog/ai-market-research-tools-comparison", priority: 0.6 },
  { path: "/blog/ki-marktforschung-einsatz", priority: 0.6 },
  { path: "/impressum", priority: 0.3 },
  { path: "/datenschutz", priority: 0.3 },
  { path: "/agb", priority: 0.3 },
  { path: "/cookies", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: r.path === "/" ? SITE_URL : `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
