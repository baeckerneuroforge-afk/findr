import { isLocale, LOCALES, toBcp47, type Locale } from "./locale";

/**
 * Marketing-locale primitives — the public-site counterpart to the dashboard's
 * cookie-based i18n.
 *
 * The marketing tree is a separate, deliberately-static root layout (no Clerk,
 * no NextIntlClientProvider, no cookie read — see
 * src/app/(marketing)/[lang]/layout.tsx). To stay statically pre-rendered AND
 * give crawlers a distinct hreflang-able URL per language, marketing resolves
 * its locale from the URL [lang] PATH segment, not the `klymeo.locale` cookie
 * the dashboard uses. BOTH locales are prefixed: German under `/de`, English
 * under `/en`. German is the default and the hreflang x-default for this
 * DACH-first product.
 *
 * This module owns ONLY the pure, framework-free path<->locale mapping. It
 * reuses the canonical Locale/LOCALES/isLocale/toBcp47 from ./locale so the two
 * surfaces can never drift apart on what "de"/"en" mean — it just gives
 * marketing its OWN default (German) without touching the dashboard's
 * DEFAULT_LOCALE ("en").
 */

/** The locales the public marketing site is served in. Mirrors the platform
 *  LOCALES; declared separately so marketing's surface is self-documenting. */
export const MARKETING_LOCALES: readonly Locale[] = LOCALES;

/** Default marketing locale + the hreflang x-default. German for this
 *  DACH-first product. Intentionally NOT the global DEFAULT_LOCALE ("en"),
 *  which serves the dashboard chrome. */
export const MARKETING_DEFAULT_LOCALE: Locale = "de";

/**
 * Map a canonical (locale-less) marketing path to its localized URL. BOTH
 * locales are prefixed under their [lang] segment:
 *   localizePath("de", "/produkt")   -> "/de/produkt"
 *   localizePath("en", "/produkt")   -> "/en/produkt"
 *   localizePath("de", "/")          -> "/de"   (homepage, no trailing slash)
 *   localizePath("en", "/x#voice")   -> "/en/x#voice"
 *
 * Pass ONLY internal marketing paths. External / cross-root links
 * (/sign-in, /sign-up, mailto:, https://…, bare "#anchor") must NOT be
 * localized — callers exclude them exactly like CtaLink already does.
 */
export function localizePath(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Strip the leading `/de` or `/en` to recover the canonical, locale-less path —
 * the inverse of localizePath. Used by the language switcher to map the current
 * URL onto the other locale.
 *   "/de"          -> "/"
 *   "/en/produkt"  -> "/produkt"
 *   "/produkt"     -> "/produkt"   (already locale-less; defensive)
 */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of MARKETING_LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname;
}

/** Which locale a marketing pathname is rendered in (path-derived, no cookie).
 *  Falls back to the default locale for an unprefixed path. */
export function localeOfPath(pathname: string): Locale {
  for (const locale of MARKETING_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return MARKETING_DEFAULT_LOCALE;
}

export { isLocale, toBcp47, type Locale };
