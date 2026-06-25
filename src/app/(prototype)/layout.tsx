import type { Metadata } from "next";
import {
  Inter,
  Hanken_Grotesk,
  JetBrains_Mono,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "../globals.css";

/**
 * (prototype) — ISOLIERTE Vorschau-Route-Group. NICHT produktiv.
 *
 * Klymeo nutzt Multi-Root-Layouts (es gibt kein gemeinsames src/app/layout.tsx;
 * jede Top-Level-Group — (app)/(marketing)/(participant) — ist ihr eigenes
 * Root). Diese Group ist deshalb komplett abgekoppelt: KEIN SessionProvider,
 * KEINE Org/Auth-Pflicht, KEIN NextIntlClientProvider. Sie spiegelt nur die
 * Schrift-Variablen + globals.css, damit die Design-Tokens (text-display,
 * bg-card, primary-*, st-rise …) nativ im Klymeo-Look rendern.
 *
 * Zweck: ein reiner Klick-Prototyp des neuen, gefuehrten Studien-Flows mit
 * Dummy-Daten. Er fasst weder Backend noch DB an und ist bewusst NICHT aus der
 * Navigation/Sitemap verlinkt. robots=noindex hält ihn aus Suchmaschinen raus.
 */

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
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
  title: "Studio-Prototyp (intern) — Klymeo",
  description: "Vorläufiger, isolierter Klick-Prototyp. Nicht produktiv.",
  robots: { index: false, follow: false },
};

export default function PrototypeRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${GeistSans.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-surface font-body text-neutral-900">
        {children}
      </body>
    </html>
  );
}
