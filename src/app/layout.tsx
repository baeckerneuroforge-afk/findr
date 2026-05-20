import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        lang="en"
        className={`${inter.variable} ${GeistSans.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-obsidian text-white">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
