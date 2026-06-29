import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Inter,
  IBM_Plex_Serif,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import { SITE_URL, ogDefaults, jsonLdHtml } from "@/lib/marketing/seo";
import "./site.css";

/**
 * Public Klymeo marketing site — its OWN root layout (Next multi-root pattern;
 * there is no shared src/app/layout.tsx). It imports ONLY site.css, so the
 * dashboard/interview/auth trees (their own root layouts + globals.css) are
 * never affected. Fonts are self-hosted via next/font and exposed as
 * --font-site-* variables that site.css maps onto --font-display/-italic/-sans/
 * -mono — exactly the IBM Plex Serif / Instrument Serif / Inter / JetBrains Mono
 * faces the template used, but with no external Google Fonts request.
 */
const inter = Inter({ variable: "--font-site-sans", subsets: ["latin"] });
const serif = IBM_Plex_Serif({
  variable: "--font-site-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
const italic = Instrument_Serif({
  variable: "--font-site-italic",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});
const mono = JetBrains_Mono({ variable: "--font-site-mono", subsets: ["latin"] });

const DEFAULT_TITLE = "Klymeo — KI-Marktforschung, orchestriert von Konsoul";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { template: "%s — Klymeo", default: DEFAULT_TITLE },
  description:
    "Qualitative & quantitative Studien in Tagen: konzipieren, rekrutieren, interviewen, auswerten — orchestriert von Konsoul. EU-gehostet in Frankfurt.",
  openGraph: { ...ogDefaults },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfbf8",
  colorScheme: "light",
};

/** Organization + WebSite JSON-LD — site-wide, mirrors the template's __root. */
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Klymeo",
      url: SITE_URL,
      description:
        "Klymeo ist eine KI-Marktforschungsplattform, die qualitative und quantitative Studien konzipiert, durchführt und auswertet — orchestriert vom Agenten Konsoul.",
      email: "support@klymeo.com",
    },
    { "@type": "WebSite", name: "Klymeo", url: SITE_URL },
  ],
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${serif.variable} ${italic.variable} ${mono.variable}`}
    >
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(ORG_JSONLD) }}
        />
      </body>
    </html>
  );
}
