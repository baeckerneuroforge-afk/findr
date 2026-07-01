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

/** Narrow the raw [lang] route param (typed `string`) to a Locale, falling back
 *  to the marketing default. dynamicParams=false already 404s anything but
 *  de/en, so this is mainly for the string→Locale type narrowing. */
export function resolveLocale(lang: string): Locale {
  return isLocale(lang) ? lang : MARKETING_DEFAULT_LOCALE;
}

/**
 * Pick the locale variant of a content object. English falls back to German
 * until the EN copy is authored — pass only `{ de }` today, and add `en` later:
 *   localizedContent(lang, { de: CONTENT })            // always DE (EN pending)
 *   localizedContent(lang, { de: CONTENT, en: CONTENT_EN })  // real EN once it exists
 */
export function localizedContent<T>(
  lang: string,
  variants: { de: T; en?: T },
): T {
  return resolveLocale(lang) === "en" && variants.en !== undefined
    ? variants.en
    : variants.de;
}

/** App-tree / Clerk roots that live OUTSIDE the localized marketing subtree and
 *  must never get a /de|/en prefix (navigating to them is a full-page load to
 *  the other root layout). */
const CROSS_ROOT_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/dashboard",
  "/onboarding",
  "/interview",
  "/shared",
  "/api",
];

/**
 * Localize an href for use in a link — the safe wrapper around localizePath for
 * arbitrary hrefs. Leaves untouched anything that must NOT be locale-prefixed:
 *   • external / protocol links (https:, mailto:, tel:) and bare "#anchor"s,
 *   • cross-root app/Clerk routes (/sign-in, /dashboard, …).
 * Everything else is an internal marketing path and gets the [lang] prefix:
 *   localizeHref("en", "/produkt#voice") -> "/en/produkt#voice"
 *   localizeHref("en", "/sign-in")       -> "/sign-in"   (cross-root, untouched)
 *   localizeHref("en", "https://…")      -> "https://…"  (external, untouched)
 */
export function localizeHref(locale: Locale, href: string): string {
  if (/^(?:[a-z]+:|#)/i.test(href)) return href; // https:, mailto:, tel:, #anchor
  const isCrossRoot = CROSS_ROOT_PREFIXES.some(
    (p) =>
      href === p ||
      href.startsWith(`${p}/`) ||
      href.startsWith(`${p}?`) ||
      href.startsWith(`${p}#`),
  );
  return isCrossRoot ? href : localizePath(locale, href);
}

/**
 * ── Asymmetric site-locale helpers (src/app/(site) + src/app/en) ──
 *
 * The functions above (`localizePath`/`stripLocalePrefix`/`localeOfPath`)
 * implement a SYMMETRIC scheme — both `de` and `en` prefixed — built for the
 * now-deleted `(marketing)/[lang]` tree. `src/components/marketing/*` still
 * uses them (kept alive only for the (app)/(participant) not-found pages), so
 * they are left untouched rather than repurposed.
 *
 * The LIVE public site is asymmetric instead: German kept its existing flat,
 * unprefixed URLs (already indexed since the Lovable relaunch — re-prefixing
 * them now would be a pure regression), and only English sits under `/en`.
 * German pages and English pages are genuinely separate files/routes (e.g.
 * `src/app/(site)/preise/page.tsx` vs `src/app/en/preise/page.tsx`), each with
 * its own hand-translated content — these helpers exist only for the small
 * amount of locale-aware CHROME (the language switcher, shared nav/footer)
 * that both trees import.
 */

/** German is always unprefixed (canonical, unchanged); English sits under
 *  `/en`. `path` must be a canonical (German) site path, e.g. "/preise" or
 *  "/" — never already locale-prefixed.
 *    siteLocalizePath("de", "/preise") -> "/preise"
 *    siteLocalizePath("en", "/preise") -> "/en/preise"
 *    siteLocalizePath("en", "/")       -> "/en" */
export function siteLocalizePath(locale: Locale, path: string): string {
  if (locale === "de") return path;
  return path === "/" ? "/en" : `/en${path}`;
}

/** Strip a leading `/en` segment to recover the canonical (German) path —
 *  the inverse of `siteLocalizePath`. A path with no `/en` prefix is already
 *  canonical (defensive — also handles German's own unprefixed paths).
 *    stripSiteLocalePrefix("/en/preise") -> "/preise"
 *    stripSiteLocalePrefix("/en")        -> "/"
 *    stripSiteLocalePrefix("/preise")    -> "/preise" */
export function stripSiteLocalePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}

/** Which locale a site pathname is rendered in (path-derived, no cookie) —
 *  `/en` or any `/en/...` path is English, everything else is German. */
export function siteLocaleOfPath(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "de";
}

export { isLocale, toBcp47, type Locale };
