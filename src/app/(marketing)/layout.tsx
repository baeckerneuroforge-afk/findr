import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ogDefaults, twitterDefaults } from "@/lib/marketing/seo";

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
  themeColor: "#faf8f4",
};

/**
 * Marketing route-group shell. NESTED under the root layout — it does NOT render
 * <html>/<body> (those come from app/layout.tsx; a second pair would be a bug,
 * §8). It only reclaims the light surface: the global <body> is `bg-obsidian
 * text-white` with Inter; this wrapper paints `bg-canvas text-neutral-900` (the
 * warm off-white marketing base — Farbsystem), sets the Hanken body face
 * (`font-body`), and fills the viewport so the dark dashboard background never
 * shows through. Header + <main> + Footer wrap every
 * marketing page. Server component (no interactivity at this level).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas font-body text-neutral-900 antialiased">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
