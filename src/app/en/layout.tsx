import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Inter,
  IBM_Plex_Serif,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import { SITE_URL, ogDefaultsFor, jsonLdHtml } from "@/lib/marketing/seo";
import "../(site)/site.css";

/**
 * English marketing root — its OWN root layout (Next multi-root pattern,
 * sibling to (app)/(participant)/(prototype)/(site)), NOT nested under
 * (site)/en/. A nested layout can't override the parent's <html lang>, and
 * (site)/layout.tsx hardcodes lang="de" — so English needs its own root to
 * correctly render <html lang="en">. Imports the SAME site.css as (site) so
 * both trees share design tokens; fonts are re-declared here (next/font calls
 * must live in the file that uses them) rather than touching the working
 * German layout.
 */
const inter = Inter({ variable: "--font-site-sans", subsets: ["latin"] });
// Only 400 (site.css sets all headings to font-weight:400) and 500 (blog h3
// `font-medium`) are actually used; 600 + italics were never referenced with
// the serif family — italics on the site render in Instrument Serif below.
const serif = IBM_Plex_Serif({
  variable: "--font-site-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal"],
});
const italic = Instrument_Serif({
  variable: "--font-site-italic",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});
const mono = JetBrains_Mono({ variable: "--font-site-mono", subsets: ["latin"] });

const DEFAULT_TITLE = "Klymeo — AI-powered market research, orchestrated by Konsoul";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { template: "%s — Klymeo", default: DEFAULT_TITLE },
  description:
    "Qualitative & quantitative studies in days: design, recruit, interview, analyze — orchestrated by Konsoul. Hosted in the EU, Frankfurt.",
  openGraph: { ...ogDefaultsFor("en") },
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

/** Organization + WebSite JSON-LD — English counterpart of (site)/layout.tsx.
 *  `inLanguage` matches the rendered locale (crawlers should never see a
 *  language mismatch between visible content and structured data). */
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Klymeo",
      url: SITE_URL,
      description:
        "Klymeo is an AI-powered market research platform that designs, runs, and analyzes qualitative and quantitative studies — orchestrated by the Konsoul agent.",
      email: "support@klymeo.com",
      inLanguage: "en",
    },
    { "@type": "WebSite", name: "Klymeo", url: SITE_URL, inLanguage: "en" },
  ],
};

export default function EnglishSiteLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
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
