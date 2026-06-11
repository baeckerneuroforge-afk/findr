import type { Metadata } from "next";
import { Inter, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { MESSAGES } from "@/i18n/messages";
import { SITE_URL } from "@/lib/marketing/seo";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Platform shell (dashboard/onboarding) faces. Self-hosted by next/font: the
// font files are fetched at BUILD time and served from our own origin, so there
// is no runtime request to Google — no @import, no DSGVO regression. Both are
// variable fonts, so the weight comes from the variable axis (no `weight`).
//   Hanken Grotesk → body / UI AND display / headlines (--font-heading is now
//                    Hanken: KPI numbers + page titles render sans-serif)
//   JetBrains Mono → numbers / code (the `font-mono` utility)
// (PERF CLEANUP — Fraunces, Bricolage Grotesque and Space Grotesk were
// REMOVED: all three were loaded + preloaded on every page but consumed by no
// CSS rule — Bricolage/Space Grotesk belonged to the deleted /v2 comic
// landing, Fraunces to the retired serif-headline look. To restore one,
// re-add its next/font import + <html> variable and point the relevant
// globals.css token (--font-heading / --font-display) at it.)
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// App-tree metadata defaults (Perf-Etappe C: this is now the ROOT layout of
// the (app) tree only — (marketing) has its own root layout with its own
// metadata, so nothing can leak between the two anymore).
//   • metadataBase is mandatory for relative canonical/OG urls to resolve
//     (otherwise next build errors); it reads the single SITE_URL placeholder.
//   • `title` is a PLAIN default (the de-staled fallback) — NOT a template,
//     so there is no "— findr." suffix / findr OG on the protected interview,
//     dashboard and shared-synthesis routes (important for white-label
//     participant pages).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "findr. — Conversation-Intelligence-Plattform für B2B-SaaS",
  description:
    "Ein KI-Gehirn, vier Produkte: Sales Intelligence, Customer Success Health, Product Discovery und Market Research. findr. liest jedes Kundengespräch und macht es über alle Produkte hinweg nutzbar — DSGVO-nativ, in Frankfurt gehostet.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // i18n without routing: the app-wide UI locale comes from the cookie
  // (resolved in src/i18n/request.ts). The interview subtree overrides this
  // with the session locale via its own provider.
  const resolved = await getLocale();
  const locale: Locale = isLocale(resolved) ? resolved : DEFAULT_LOCALE;

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding/create-org"
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          colorBackground: "#ffffff",
          colorText: "#18181b",
          colorTextSecondary: "#71717a",
          colorInputBackground: "#ffffff",
          colorInputText: "#18181b",
          colorNeutral: "#71717a",
          fontFamily: "var(--font-geist-sans), system-ui",
        },
        elements: {
          organizationSwitcherTrigger:
            "px-2 py-1.5 hover:bg-neutral-50 rounded-md transition-colors text-neutral-900",
        },
      }}
    >
      {/* data-scroll-behavior: Next 16 überschreibt scroll-behavior bei
          Navigationen nur noch mit diesem Opt-in — ohne es animiert das
          scroll-smooth der Klasse JEDEN Routenwechsel (träges Hochscrollen).
          Mit Attribut: Routenwechsel springen sofort, Anker-Sprünge (z. B.
          E6-Startkarten) bleiben smooth. Siehe upgrading/version-16.md. */}
      <html
        lang={locale}
        data-scroll-behavior="smooth"
        className={`${inter.variable} ${GeistSans.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full scroll-smooth antialiased`}
      >
        <body className="min-h-full flex flex-col bg-obsidian text-white">
          <NextIntlClientProvider
            locale={locale}
            messages={{
              interview: MESSAGES[locale].interview,
              nav: MESSAGES[locale].nav,
              command: MESSAGES[locale].command,
              settings: MESSAGES[locale].settings,
              common: MESSAGES[locale].common,
              // "heute" wird von der Client-Begrüßung (HeuteGreeting) gelesen —
              // fehlt der Namespace hier, rendert next-intl den rohen Keypfad
              // ("heute.greetingMorning"), während die server-gerenderten Teile
              // derselben Seite weiter funktionieren. Prod-Befund 2026-06-11.
              heute: MESSAGES[locale].heute,
              sales: MESSAGES[locale].sales,
              health: MESSAGES[locale].health,
              research: MESSAGES[locale].research,
              branding: MESSAGES[locale].branding,
              sharedSynthesis: MESSAGES[locale].sharedSynthesis,
              researchAgent: MESSAGES[locale].researchAgent,
              missionControl: MESSAGES[locale].missionControl,
              crossStudyAgent: MESSAGES[locale].crossStudyAgent,
              syntheticTest: MESSAGES[locale].syntheticTest,
            }}
          >
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
