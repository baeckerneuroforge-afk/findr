import type { Metadata } from "next";

import {
  siteLocalizePath,
  MARKETING_LOCALES,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Single source of SEO truth for the public marketing site.
 *
 * The production domain is a Vercel config value: set NEXT_PUBLIC_SITE_URL and it
 * flows through `metadataBase` + every per-page canonical/OG url (all relative).
 * Falls back to the `https://findr.de` placeholder until the env var is set.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://findr.de";
export const SITE_NAME = "Klymeo";

/** Open Graph BCP-47-ish locale tags (underscore form OG expects). */
const OG_LOCALE: Record<Locale, string> = {
  de: "de_DE",
  en: "en_US",
};

/** og:image alt per locale — one short string tied to the shared OG asset,
 *  kept next to the OG object rather than in the message catalog. */
const OG_IMAGE_ALT: Record<Locale, string> = {
  de: "Klymeo — Qualitative Marktforschung mit KI",
  en: "Klymeo — Qualitative market research powered by AI",
};

/**
 * Default Open Graph object. Spread into every page's `openGraph` as
 * `{ ...ogDefaults, title, url }`.
 *
 * ⚠ Next metadata merge is a per-KEY REPLACE: setting `openGraph` on a page
 * replaces the inherited `openGraph` WHOLESALE (it does NOT deep-merge with the
 * root default). So a page that sets only `openGraph.title` would silently drop
 * siteName/locale/images. Always spread `ogDefaults` to keep them. (Befund 1.)
 */
export const ogDefaults: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName: SITE_NAME,
  locale: "de_DE",
  images: [
    {
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "Klymeo — Qualitative Marktforschung mit KI",
    },
  ],
};

/**
 * Per-locale Open Graph defaults — the bilingual successor to `ogDefaults`.
 * Spread into a page's `openGraph` as `{ ...ogDefaultsFor(locale), title, url }`.
 * Sets `og:locale` for the rendered locale AND `og:locale:alternate` for the
 * other(s), so crawlers see both language variants. Same per-KEY-REPLACE caveat
 * as `ogDefaults`: always SPREAD this, never set `openGraph` partially.
 *
 * (Phase 5 migrates the pages onto this; `ogDefaults` stays as the DE-only
 * back-compat default until then so existing output is byte-identical.)
 */
export function ogDefaultsFor(
  locale: Locale,
): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: OG_LOCALE[locale],
    alternateLocale: MARKETING_LOCALES.filter((l) => l !== locale).map(
      (l) => OG_LOCALE[l],
    ),
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT[locale],
      },
    ],
  };
}

/**
 * canonical + reciprocal hreflang alternates for one marketing page.
 *
 * `dePath` is the page's canonical GERMAN path (the existing route, e.g.
 * "/produkt" or "/"). Returns RELATIVE urls — Next resolves them against the
 * layout's `metadataBase` into absolutes, exactly like today's per-page
 * canonical. Uses the asymmetric `siteLocalizePath` (German unprefixed,
 * English under /en — see src/i18n/marketing-locale.ts), NOT the symmetric
 * `localizePath` built for the dead (marketing)/[lang] tree. The `languages`
 * map is IDENTICAL on both locale variants (reciprocal hreflang) and always
 * carries `x-default` → the German path.
 *
 *   buildAlternates("de", "/produkt")  // canonical "/produkt"
 *   buildAlternates("en", "/produkt")  // canonical "/en/produkt"
 *   // both -> languages { de-DE:"/produkt", en-US:"/en/produkt", x-default:"/produkt" }
 */
export function buildAlternates(
  locale: Locale,
  dePath: string,
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: siteLocalizePath(locale, dePath),
    languages: {
      "de-DE": siteLocalizePath("de", dePath),
      "en-US": siteLocalizePath("en", dePath),
      "x-default": siteLocalizePath("de", dePath),
    },
  };
}

export const twitterDefaults: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
};

/**
 * Serialize a JSON-LD object for inline injection. `JSON.stringify` does NOT
 * sanitize `<`, so we escape it to `<` to prevent a `</script>` break-out
 * (XSS). Pair with a native `<script type="application/ld+json">` in a Server
 * Component — see `JsonLd` below. (Befund 3 / §8.)
 */
export function jsonLdHtml(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
