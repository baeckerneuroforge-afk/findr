import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { MESSAGES } from "@/i18n/messages";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Comic landing (/v2) display + body fonts.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Findr — Revenue Intelligence OS",
  description:
    "Stop losing deals you should win. Predictive loss-risk detection for B2B SaaS sales teams.",
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
      <html
        lang={locale}
        className={`${inter.variable} ${GeistSans.variable} ${bricolage.variable} ${spaceGrotesk.variable} h-full scroll-smooth antialiased`}
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
              sales: MESSAGES[locale].sales,
              health: MESSAGES[locale].health,
              research: MESSAGES[locale].research,
              branding: MESSAGES[locale].branding,
              sharedSynthesis: MESSAGES[locale].sharedSynthesis,
              researchAgent: MESSAGES[locale].researchAgent,
              missionControl: MESSAGES[locale].missionControl,
            }}
          >
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
