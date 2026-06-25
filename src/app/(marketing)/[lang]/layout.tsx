import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Inter,
  Hanken_Grotesk,
  Instrument_Serif,
  IBM_Plex_Serif,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { notFound } from "next/navigation";
import { StudioFx } from "@/components/marketing/studio/StudioFx";
import {
  ogDefaultsFor,
  twitterDefaults,
  SITE_URL,
} from "@/lib/marketing/seo";
import {
  isLocale,
  MARKETING_LOCALES,
  resolveLocale,
} from "@/i18n/marketing-locale";
import "../../globals.css";
import "@/components/marketing/studio/studio.css";

// ── Twilight-Konsole-Schriftstimmen ──────────────────────────────────────────
// Self-hosted via next/font (Build-Time-Download, ausgeliefert vom eigenen
// Origin — kein Google-Request zur Laufzeit, keine DSGVO-Regression). Bewusst
// HIER geladen statt im Root-Layout: die Variablen hängen am .studio-Wrapper
// unten, damit Dashboard/Interview/Auth keine zusätzlichen Fonts preloaden.
// Die Stimmen der Twilight-Konsole:
//   Space Grotesk    → Display/Headlines (--font-display, via --font-marketing)
//   Hanken Grotesk   → Fließtext (--font-body)
//   Space Mono       → Konsolen-Etiketten, Timecodes, Kapitelmarken (--font-mono)
//   Instrument Serif → kursiver Serif-Akzent in Headlines + Originalzitate
// Eigene Var-Namen (-mkt) statt der Root-Layout-Namen, damit klar bleibt,
// dass dieser Tree seine Fonts selbst lädt (Multi-Root: kein Sharing).
// Inter → strenge, neutrale Marketing-Stimme (Conveo-Richtung): trägt jetzt
// Display + Body (--font-marketing/--font-body). Die alten Stimmen bleiben
// geladen, falls einzelne Twilight-Unterseiten sie noch referenzieren.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken-mkt",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

// IBM Plex Serif → GENAU die Headline-Serif von conveo.ai (deren Site lädt
// exakt diese Familie). Diskrete Schnitte (kein Variable-Font): 400/500/600
// geladen, damit die Display-Dicke fein abstimmbar ist; studio.css remappt
// --font-marketing auf diese Stimme. Body bleibt Inter.
const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

// Space Mono → Konsolen-Etiketten / Eyebrows / Hex-Codes (--font-mono).
const spaceMono = Space_Mono({
  variable: "--font-spacemono-mkt",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DEFAULT_TITLE =
  "Klymeo — Qualitative Marktforschung mit KI, DSGVO-nativ & auf Deutsch";

/**
 * Marketing-scoped metadata defaults. Living on THIS root layout confines
 * them to the (marketing) tree — the (app) tree has its own root layout, so
 * nothing leaks onto dashboard/interview/white-label routes:
 *   • title.template "%s — Klymeo" → every marketing page sets just a short
 *     title; non-marketing routes are untouched (no double "— Klymeo",
 *     no brand suffix on white-label interview pages).
 *   • openGraph defaults (siteName/locale/type/og-image) — pages still spread
 *     `{ ...ogDefaults, title, url }` per page (Befund 1: per-key REPLACE).
 *   • twitter card + light themeColor.
 *   • metadataBase + icons: previously inherited from the removed shared
 *     root layout — a root layout owns them itself (metadataBase is mandatory
 *     for relative canonical/OG urls to resolve).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: { template: "%s — Klymeo", default: DEFAULT_TITLE },
    openGraph: ogDefaultsFor(locale),
    twitter: twitterDefaults,
    // EN ist jetzt echt englisch getextet, mit reziprokem hreflang + per-Locale
    // og:locale/canonical/JSON-LD-inLanguage (P1–P4) → BEIDE Sprachen werden
    // indexiert. VORAUSSETZUNG für saubere Indexierung: NEXT_PUBLIC_SITE_URL
    // zeigt auf die echte Produktiv-Domain — sonst vergiftet der findr.de-
    // Fallback jeden Canonical/jede hreflang-/Sitemap-URL.
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    },
  };
}

export const viewport: Viewport = {
  // Browser-Chrome folgt dem System wie die Seite selbst (studio.css trägt
  // den prefers-color-scheme-Block): Lab-Canvas am Tag, Nacht-Canvas nachts.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d1a" },
  ],
  colorScheme: "light dark",
};

/**
 * Pre-render one static tree per locale. The locale lives in the URL [lang]
 * segment (/de, /en) — NOT in a cookie — so reading it never forces dynamic
 * rendering, and each language gets its own crawlable, hreflang-able URL.
 * `dynamicParams = false` closes the set: any [lang] other than de/en 404s (the
 * same closed-set technique /insights/[slug] already uses), so the tree stays
 * fully SSG.
 */
export function generateStaticParams() {
  return MARKETING_LOCALES.map((lang) => ({ lang }));
}

export const dynamicParams = false;

/**
 * Marketing ROOT layout — die „Twilight-Konsole“-Bühne (Perf-Etappe C, Fund 0):
 * eigenes Root-Layout im Multi-Root-Pattern statt nested unter dem App-Shell.
 * Bewusst NICHT drin: ClerkProvider (Marketing nutzt 0× Clerk → ~45 KB gz JS
 * weniger pro Public-Page), NextIntlClientProvider (0 Namespaces genutzt →
 * kein Katalog im RSC-Payload) und vor allem KEIN getLocale()-Cookie-Read.
 * Die UI-Sprache kommt jetzt aus dem [lang]-URL-Segment (/de, /en) statt aus
 * dem Cookie — kein Cookie-Read heißt: der Tree bleibt vollständig statisch
 * (jede Sprache ist eine eigene SSG-URL inkl. /insights/[slug]), und beide
 * Sprachen sind crawlbar/hreflang-fähig. <html lang> ist jetzt pro Locale.
 *
 * Der .studio-Wrapper (Klassenname bleibt als stabiles Scope-Präfix der
 * st-*-Komponentenklassen, die Haut darunter ist jetzt Twilight):
 *   • remappt die Marketing-Design-Tokens (studio.css) — heller Lab-Canvas,
 *     Zinc-Neutrals, Twilight-Indigo #4A51A8 als das EINE Signal — ohne
 *     globals.css anzufassen,
 *   • trägt die next/font-Variablen der drei Stimmen (die App-Fonts des
 *     (app)-Trees existieren hier nicht; studio.css remappt --font-body/
 *     --font-marketing/--font-mono vollständig im .studio-Scope),
 *   • legt Punktraster (st-grid), Filmkorn (st-grain) und die Cursor-FX
 *     über alle Seiten.
 *
 * Die Reveal-Choreografie (Rv) armiert ihren versteckten Ausgangszustand
 * selbst erst nach dem Mount — no-JS/Bots sehen alles sofort, und es gibt
 * keinen Hydration-Mismatch durch fremde className-Mutationen.
 *
 * Navigation Marketing ↔ App ist seit dem Split ein Full-Page-Load (Next-
 * Verhalten zwischen Root-Layouts) — gewollt, die Welten teilen kein JS.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // dynamicParams=false 404t Nicht-de/en bereits; isLocale verengt lang
  // zusätzlich vom string auf die Locale-Union für <html lang>.
  if (!isLocale(lang)) notFound();

  return (
    // data-scroll-behavior: Next-16-Opt-in — Routenwechsel springen sofort
    // statt smooth hochzuscrollen; Anker-Sprünge bleiben smooth.
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className="h-full scroll-smooth antialiased"
    >
      <body className="min-h-full">
        <div
          className={`studio ${inter.variable} ${hanken.variable} ${instrumentSerif.variable} ${ibmPlexSerif.variable} ${spaceGrotesk.variable} ${spaceMono.variable} flex min-h-dvh flex-col bg-canvas font-body text-neutral-900 antialiased`}
        >
          <div className="st-grid" aria-hidden />
          <div className="st-grain" aria-hidden />
          <StudioFx />
          <MarketingHeader lang={lang} />
          <main className="flex-1">{children}</main>
          <MarketingFooter lang={lang} />
        </div>
      </body>
    </html>
  );
}
