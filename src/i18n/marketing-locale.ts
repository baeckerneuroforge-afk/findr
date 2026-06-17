import { isLocale, LOCALES, toBcp47, type Locale } from "./locale";

/**
 * Marketing-locale primitives — the public-site counterpart to the dashboard's
 * cookie-based i18n.
 *
 * The marketing tree is a separate, deliberately-static root layout (no Clerk,
 * no NextIntlClientProvider, no cookie read — see src/app/(marketing)/layout.tsx).
 * To stay statically pre-rendered AND give crawlers a distinct hreflang-able URL
 * per language, marketing resolves its locale from the URL PATH, not the
 * `klymeo.locale` cookie the dashboard uses. German lives at the existing bare
 * paths (the x-default); English is served under a `/en` prefix.
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

/** Default/unprefixed marketing locale. German is the x-default for this
 *  DACH-first product, so DE keeps the bare paths and only EN is prefixed.
 *  Intentionally NOT the global DEFAULT_LOCALE ("en"), which serves the
 *  dashboard chrome. */
export const MARKETING_DEFAULT_LOCALE: Locale = "de";

const EN_PREFIX = "/en";

/**
 * Map a canonical German marketing path to its localized URL.
 *   localizePath("de", "/produkt")        -> "/produkt"        (x-default, bare)
 *   localizePath("en", "/produkt")        -> "/en/produkt"
 *   localizePath("en", "/")               -> "/en"             (not "/en/")
 *   localizePath("en", "/produkt#voice")  -> "/en/produkt#voice"
 *
 * Pass ONLY internal marketing paths. External / cross-root links
 * (/sign-in, /sign-up, mailto:, https://…, bare "#anchor") must NOT be
 * localized — callers exclude them exactly like CtaLink already does.
 */
export function localizePath(locale: Locale, path: string): string {
  if (locale === MARKETING_DEFAULT_LOCALE) return path;
  if (path === "/") return EN_PREFIX;
  return `${EN_PREFIX}${path}`;
}

/**
 * Strip a leading `/en` to recover the canonical German path — the inverse of
 * localizePath for the prefixed locale.
 *   "/en"          -> "/"
 *   "/en/produkt"  -> "/produkt"
 *   "/produkt"     -> "/produkt"   (already canonical)
 * The `"/en/"` guard avoids a false positive on unrelated paths like
 * "/ensemble" (which is left untouched).
 */
export function deCanonicalPath(pathname: string): string {
  if (pathname === EN_PREFIX) return "/";
  if (pathname.startsWith(`${EN_PREFIX}/`)) return pathname.slice(EN_PREFIX.length);
  return pathname;
}

/** Which locale a marketing pathname is rendered in (path-derived, no cookie). */
export function localeOfPath(pathname: string): Locale {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`)
    ? "en"
    : MARKETING_DEFAULT_LOCALE;
}

export { isLocale, toBcp47, type Locale };
