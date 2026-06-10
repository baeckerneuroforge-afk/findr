import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Bricolage_Grotesque,
  Instrument_Serif,
  Archivo,
  Spline_Sans_Mono,
} from "next/font/google";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { StudioFx } from "@/components/marketing/studio/StudioFx";
import { ogDefaults, twitterDefaults, SITE_URL } from "@/lib/marketing/seo";
import "../globals.css";
import "@/components/marketing/studio/studio.css";

// ── Studio-Session-Schriftstimmen ────────────────────────────────────────────
// Self-hosted via next/font (Build-Time-Download, ausgeliefert vom eigenen
// Origin — kein Google-Request zur Laufzeit, keine DSGVO-Regression). Bewusst
// HIER geladen statt im Root-Layout: die Variablen hängen am .studio-Wrapper
// unten, damit Dashboard/Interview/Auth keine zusätzlichen Fonts preloaden
// (deckt sich mit dem Perf-Cleanup, der ungenutzte Fonts aus dem Root entfernte).
//   Bricolage Grotesque → Display/Headlines (--font-marketing via studio.css)
//   Instrument Serif    → kursiver Serif-Akzent in Headlines + Zitate
//   Archivo             → Fließtext (--font-body im .studio-Scope)
//   Spline Sans Mono    → Tape-Labels, Timecodes, Kapitelmarken
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

const DEFAULT_TITLE =
  "findr. — Qualitative Marktforschung mit KI, DSGVO-nativ & auf Deutsch";

/**
 * Marketing-scoped metadata defaults. Living on THIS root layout confines
 * them to the (marketing) tree — the (app) tree has its own root layout, so
 * nothing leaks onto dashboard/interview/white-label routes:
 *   • title.template "%s — findr." → every marketing page sets just a short
 *     title; non-marketing routes are untouched (no double "— findr.",
 *     no brand suffix on white-label interview pages).
 *   • openGraph defaults (siteName/locale/type/og-image) — pages still spread
 *     `{ ...ogDefaults, title, url }` per page (Befund 1: per-key REPLACE).
 *   • twitter card + light themeColor.
 *   • metadataBase + icons: previously inherited from the removed shared
 *     root layout — a root layout owns them itself (metadataBase is mandatory
 *     for relative canonical/OG urls to resolve).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { template: "%s — findr.", default: DEFAULT_TITLE },
  openGraph: ogDefaults,
  twitter: twitterDefaults,
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

export const viewport: Viewport = {
  themeColor: "#f4eee0",
};

/**
 * Marketing ROOT layout — die „Studio-Session“-Bühne (Perf-Etappe C, Fund 0):
 * eigenes Root-Layout im Multi-Root-Pattern statt nested unter dem App-Shell.
 * Bewusst NICHT drin: ClerkProvider (Marketing nutzt 0× Clerk → ~45 KB gz JS
 * weniger pro Public-Page), NextIntlClientProvider (0 Namespaces genutzt →
 * kein Katalog im RSC-Payload) und vor allem KEIN getLocale()-Cookie-Read —
 * der machte den gesamten Marketing-Tree ƒ-dynamisch. <html lang="de"> ist
 * hart: Marketing ist per Entscheidung DE-only. Damit rendert der Tree
 * statisch und /insights/[slug] wird wirklich SSG.
 *
 * Der .studio-Wrapper:
 *   • remappt die Marketing-Design-Tokens (studio.css) — warmes Papier,
 *     Tinten-Neutrals, REC-Rot als Akzent — ohne globals.css anzufassen,
 *   • trägt die next/font-Variablen der vier Studio-Schriften (die App-Fonts
 *     des (app)-Trees existieren hier nicht; studio.css remappt --font-body/
 *     --font-marketing/--font-mono vollständig im .studio-Scope),
 *   • legt das Filmkorn (st-grain) und die Cursor-FX über alle Seiten.
 *
 * Die Reveal-Choreografie (Rv) armiert ihren versteckten Ausgangszustand
 * selbst erst nach dem Mount — no-JS/Bots sehen alles sofort, und es gibt
 * keinen Hydration-Mismatch durch fremde className-Mutationen.
 *
 * Navigation Marketing ↔ App ist seit dem Split ein Full-Page-Load (Next-
 * Verhalten zwischen Root-Layouts) — gewollt, die Welten teilen kein JS.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="h-full scroll-smooth antialiased">
      <body className="min-h-full">
        <div
          className={`studio ${bricolage.variable} ${instrumentSerif.variable} ${archivo.variable} ${splineSansMono.variable} flex min-h-dvh flex-col bg-canvas font-body text-neutral-900 antialiased`}
        >
          <div className="st-grain" aria-hidden />
          <StudioFx />
          <MarketingHeader />
          <main className="flex-1">{children}</main>
          <MarketingFooter />
        </div>
      </body>
    </html>
  );
}
