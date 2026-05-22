import type { Metadata } from "next";
import { Navbar } from "@/components/landing-comic/Navbar";
import { Footer } from "@/components/landing-comic/Footer";
import { PricingHeader } from "@/components/landing-comic/PricingHeader";
import { PricingTiers } from "@/components/landing-comic/PricingTiers";
import { EnterpriseBand } from "@/components/landing-comic/EnterpriseBand";

export const metadata: Metadata = {
  title: "Findr — Pricing",
  description:
    "Land with Sales Intelligence. Add CS Health, Discovery, and Research as your team grows. One platform, one contract — linear cost, compounding value.",
};

export default function PricingPage() {
  return (
    <main className="font-grotesk bg-paper text-ink min-h-screen relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] comic-dots" />
      <div className="relative z-10">
        <Navbar />
        <PricingHeader />
        <section>
          <div className="max-w-[1180px] mx-auto px-7">
            <PricingTiers />
            <EnterpriseBand />
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}
