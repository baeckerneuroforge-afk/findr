import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      appearance={{
        variables: {
          colorPrimary: "#6d28d9",
          colorBackground: "#16101e",
          colorText: "#f6f4f8",
          colorInputBackground: "#1f1731",
          colorInputText: "#f6f4f8",
          colorNeutral: "#c4b5fd",
        },
      }}
    >
      <html
        lang="en"
        className={`${inter.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-obsidian text-white">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
