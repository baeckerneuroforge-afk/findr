import type { Metadata } from "next";
import {
  Inter,
  Hanken_Grotesk,
  JetBrains_Mono,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { MESSAGES } from "@/i18n/messages";
import { SITE_URL } from "@/lib/marketing/seo";
import "../globals.css";

/**
 * Teilnehmer-Root-Layout (Multi-Root, Geschwister von (app) und (marketing)).
 *
 * Die login-freien, token-basierten Teilnehmer-Seiten (/interview/[token],
 * /interview/open/[token]) lagen bisher im (app)-Tree und erbten dort
 * ClerkProvider + ~15 i18n-Namespaces — beides brauchen sie NICHT: sie nutzen
 * kein Clerk (Token IST die Berechtigung) und stellen ihren EIGENEN
 * NextIntlClientProvider mit der Session-Sprache (Token) + dem `interview`-
 * Namespace auf. Dieses schlanke Root-Layout entfernt genau diesen Ballast vom
 * kritischsten Teilnehmer-First-Load (Clerk-Client-JS ~45 KB + 14 ungenutzte
 * Namespaces im RSC-Payload).
 *
 * BYTE-IDENTISCHES RENDERING zum bisherigen (app)-Erbe ist Absicht: gleiche
 * Fonts, gleiche <html>/<body>-Klassen, gleiches globals.css, gleicher
 * Metadata-Ansatz (PLAIN title, KEIN Template — kein "— Klymeo"-Suffix auf
 * White-Label-Seiten). Einzige Unterschiede: kein ClerkProvider, und der
 * Provider trägt nur noch den `interview`-Namespace (den die Seiten ohnehin
 * selbst mit der Token-Sprache überschreiben — hier als Baseline für etwaige
 * Rand-UI wie not-found).
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-spacemono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Klymeo — Conversation-Intelligence-Plattform für B2B-SaaS",
  description:
    "Ein KI-Gehirn, vier Produkte: Sales Intelligence, Customer Success Health, Product Discovery und Market Research. Klymeo liest jedes Kundengespräch und macht es über alle Produkte hinweg nutzbar — DSGVO-nativ, in Frankfurt gehostet.",
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

export default async function ParticipantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Wie im (app)-Layout: UI-Locale aus dem Cookie (für <html lang> + die
  // Baseline-Messages). Teilnehmer haben i. d. R. keinen Cookie → DEFAULT_LOCALE;
  // den echten Inhalt rendern die Seiten mit der Token-Sprache in ihrem eigenen
  // Provider.
  const resolved = await getLocale();
  const locale: Locale = isLocale(resolved) ? resolved : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${GeistSans.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${spaceMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-obsidian text-white">
        <NextIntlClientProvider
          locale={locale}
          messages={{ interview: MESSAGES[locale].interview }}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
