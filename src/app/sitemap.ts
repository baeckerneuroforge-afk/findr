import type { MetadataRoute } from "next";
import { siteLocalizePath } from "@/i18n/marketing-locale";
import { SITE_URL } from "@/lib/marketing/seo";

/**
 * Sitemap for the public Klymeo marketing site. German is the flat,
 * unprefixed, canonical tree (unchanged since the Lovable relaunch); routes
 * marked `en: true` also have a real hand-translated page under
 * `src/app/en/**` and get a second sitemap entry with reciprocal
 * `alternates.languages` (mirrors what `buildAlternates` emits in each page's
 * `<head>`). Routes without `en` are DE-only for now — no hreflang alternate
 * is emitted for them, since pointing hreflang at a non-existent English page
 * would be actively wrong. Set NEXT_PUBLIC_SITE_URL to the production domain
 * before go-live; the findr.de fallback would otherwise poison every absolute
 * URL in both languages.
 */
const ROUTES: { path: string; priority: number; en?: boolean }[] = [
  { path: "/", priority: 1.0, en: true },
  { path: "/konsoul", priority: 0.9, en: true },
  { path: "/plattform", priority: 0.9, en: true },
  { path: "/methoden", priority: 0.8, en: true },
  { path: "/preise", priority: 0.8, en: true },
  { path: "/loesungen", priority: 0.8, en: true },
  { path: "/loesungen/user-research", priority: 0.7, en: true },
  { path: "/loesungen/konzept-test", priority: 0.7, en: true },
  { path: "/loesungen/markenwahrnehmung", priority: 0.7, en: true },
  { path: "/loesungen/bedarf-verhalten", priority: 0.7, en: true },
  { path: "/personas", priority: 0.7, en: true },
  { path: "/branchen", priority: 0.7, en: true },
  { path: "/kontakt", priority: 0.6, en: true },
  { path: "/blog/system-usability-scale-guide", priority: 0.6, en: true },
  { path: "/blog/ai-market-research-tools-comparison", priority: 0.6, en: true },
  { path: "/blog/ki-marktforschung-einsatz", priority: 0.6, en: true },
  { path: "/impressum", priority: 0.3, en: true },
  { path: "/datenschutz", priority: 0.3, en: true },
  { path: "/agb", priority: 0.3, en: true },
  { path: "/cookies", priority: 0.3, en: true },
];

function absolute(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const r of ROUTES) {
    if (!r.en) {
      entries.push({
        url: absolute(r.path),
        lastModified: now,
        changeFrequency: "monthly",
        priority: r.priority,
      });
      continue;
    }

    const enPath = siteLocalizePath("en", r.path);
    const languages = { de: absolute(r.path), en: absolute(enPath) };
    entries.push({
      url: absolute(r.path),
      lastModified: now,
      changeFrequency: "monthly",
      priority: r.priority,
      alternates: { languages },
    });
    entries.push({
      url: absolute(enPath),
      lastModified: now,
      changeFrequency: "monthly",
      priority: r.priority,
      alternates: { languages },
    });
  }

  return entries;
}
