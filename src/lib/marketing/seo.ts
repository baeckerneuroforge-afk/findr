import type { Metadata } from "next";

/**
 * Single source of SEO truth for the public marketing site.
 *
 * D1 (open decision): the production domain isn't final yet. `SITE_URL` is the
 * ONE place the placeholder `https://findr.de` lives — root layout's
 * `metadataBase` reads it and every per-page canonical/OG url is relative, so
 * swapping the domain later is a one-line change.
 */
export const SITE_URL = "https://findr.de";
export const SITE_NAME = "findr.";

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
      alt: "findr. — Qualitative Marktforschung mit KI",
    },
  ],
};

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
