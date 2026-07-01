/** Shared constants for the public Klymeo site. */

import type { Locale } from "@/i18n/marketing-locale";

/** External demo-booking link (cal.eu) — opens in a new tab from CTAs. */
export const DEMO_URL = "https://www.cal.eu/klymeoai/demo?overlayCalendar=true";

/** Support inbox shown on the contact page + footer. */
export const SUPPORT_EMAIL = "support@klymeo.com";

/** Primary site navigation (header + mobile menu). German pages import this
 *  directly, unchanged — English chrome uses `getNavLinks("en")` instead. */
export const NAV_LINKS = [
  { to: "/konsoul", label: "Konsoul" },
  { to: "/plattform", label: "Plattform" },
  { to: "/loesungen", label: "Lösungen" },
  { to: "/branchen", label: "Branchen" },
  { to: "/methoden", label: "Methoden" },
  { to: "/preise", label: "Preise" },
] as const;

// English nav targets are /en-prefixed so that navigating via the top menu
// keeps the visitor in English (they all have real pages under src/app/en/**,
// all listed in EN_AVAILABLE_PATHS). Labels are English; German NAV_LINKS is
// left byte-identical.
const NAV_LINKS_EN = [
  { to: "/en/konsoul", label: "Konsoul" },
  { to: "/en/plattform", label: "Platform" },
  { to: "/en/loesungen", label: "Solutions" },
  { to: "/en/branchen", label: "Industries" },
  { to: "/en/methoden", label: "Methods" },
  { to: "/en/preise", label: "Pricing" },
] as const;

/** Locale-aware nav selector. German is `NAV_LINKS` verbatim (byte-identical
 *  to before this file gained an English variant). */
export function getNavLinks(lang: Locale) {
  return lang === "en" ? NAV_LINKS_EN : NAV_LINKS;
}

/**
 * Canonical (German) site paths that currently have a real, hand-translated
 * English page under `src/app/en/**`. The language switcher (SiteHeader)
 * checks this before linking to `/en/<path>` — anything not listed here yet
 * falls back to the English homepage instead of a 404. Grows as more pages
 * are translated in later rollout steps.
 */
export const EN_AVAILABLE_PATHS: readonly string[] = [
  "/",
  "/plattform",
  "/preise",
  "/kontakt",
  "/konsoul",
  "/loesungen",
  "/loesungen/user-research",
  "/loesungen/konzept-test",
  "/loesungen/markenwahrnehmung",
  "/loesungen/bedarf-verhalten",
  "/branchen",
  "/methoden",
  "/personas",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/cookies",
  "/blog/system-usability-scale-guide",
  "/blog/ai-market-research-tools-comparison",
  "/blog/ki-marktforschung-einsatz",
];

/** Small chrome-string dictionary for header/footer/CTA boilerplate that
 *  isn't page content — kept in one place so both SiteHeader and SiteShell
 *  read the same source instead of duplicating literals per component. */
export const SITE_CHROME = {
  de: {
    login: "Login",
    bookDemo: "Demo buchen",
    menuLabel: "Menü",
    footerTagline:
      "Qualitative Marktforschung mit KI — orchestriert von Konsoul. EU-gehostet in Frankfurt.",
    footerBadge: "🇪🇺 EU-gehostet · DSGVO · Belegt am Transkript",
    ctaEyebrow: "Lass uns loslegen",
    ctaSecondary: "Mit Sales sprechen",
  },
  en: {
    login: "Log in",
    bookDemo: "Book a demo",
    menuLabel: "Menu",
    footerTagline:
      "AI-powered qualitative market research — orchestrated by Konsoul. Hosted in the EU, Frankfurt.",
    footerBadge: "🇪🇺 EU-hosted · GDPR-native · Evidenced in the transcript",
    ctaEyebrow: "Let's get started",
    ctaSecondary: "Talk to sales",
  },
} as const satisfies Record<Locale, Record<string, string>>;
