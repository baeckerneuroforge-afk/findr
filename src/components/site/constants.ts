/** Shared constants for the public Klymeo site. */

/** External demo-booking link (cal.eu) — opens in a new tab from CTAs. */
export const DEMO_URL = "https://www.cal.eu/klymeoai/demo?overlayCalendar=true";

/** Support inbox shown on the contact page + footer. */
export const SUPPORT_EMAIL = "support@klymeo.com";

/** Primary site navigation (header + mobile menu). */
export const NAV_LINKS = [
  { to: "/konsoul", label: "Konsoul" },
  { to: "/plattform", label: "Plattform" },
  { to: "/loesungen", label: "Lösungen" },
  { to: "/branchen", label: "Branchen" },
  { to: "/methoden", label: "Methoden" },
  { to: "/preise", label: "Preise" },
] as const;
