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
import { ogDefaults, twitterDefaults } from "@/lib/marketing/seo";
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
 * Marketing-scoped metadata defaults. Living on THIS nested layout (not the
 * root) confines them to the (marketing) subtree:
 *   • title.template "%s — findr." → every marketing page sets just a short
 *     title; non-marketing routes are untouched (no double "— findr." on
 *     /pricing, no brand suffix on white-label interview pages).
 *   • openGraph defaults (siteName/locale/type/og-image) — pages still spread
 *     `{ ...ogDefaults, title, url }` per page (Befund 1: per-key REPLACE).
 *   • twitter card + light themeColor.
 */
export const metadata: Metadata = {
  title: { template: "%s — findr.", default: DEFAULT_TITLE },
  openGraph: ogDefaults,
  twitter: twitterDefaults,
};

export const viewport: Viewport = {
  themeColor: "#f4eee0",
};

/**
 * Marketing route-group shell — die „Studio-Session“-Bühne. NESTED under the
 * root layout (kein <html>/<body>, §8). Der .studio-Wrapper:
 *   • remappt die Marketing-Design-Tokens (studio.css) — warmes Papier,
 *     Tinten-Neutrals, REC-Rot als Akzent — ohne globals.css anzufassen,
 *   • trägt die next/font-Variablen der vier Studio-Schriften,
 *   • legt das Filmkorn (st-grain) und die Cursor-FX über alle Seiten.
 *
 * Die Reveal-Choreografie (Rv) armiert ihren versteckten Ausgangszustand
 * selbst erst nach dem Mount — no-JS/Bots sehen alles sofort, und es gibt
 * keinen Hydration-Mismatch durch fremde className-Mutationen.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`studio ${bricolage.variable} ${instrumentSerif.variable} ${archivo.variable} ${splineSansMono.variable} flex min-h-dvh flex-col bg-canvas font-body text-neutral-900 antialiased`}
    >
      <div className="st-grain" aria-hidden />
      <StudioFx />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
