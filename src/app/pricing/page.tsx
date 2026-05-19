import { Header } from "@/components/landing/Header";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingTable } from "@/components/pricing/PricingTable";
import { PlatformRoadmap } from "@/components/pricing/PlatformRoadmap";
import { OutcomePricing } from "@/components/pricing/OutcomePricing";
import { FoundingCustomer } from "@/components/pricing/FoundingCustomer";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { PricingFinalCTA } from "@/components/pricing/PricingFinalCTA";

export const metadata = {
  title: "Pricing — Findr",
  description:
    "Transparent pricing for European B2B SaaS. Start with Sales Intelligence, expand to a full conversation intelligence platform.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-obsidian text-white overflow-x-hidden">
      <Header />
      <PricingHero />
      <PricingTable />
      <FoundingCustomer />
      <PlatformRoadmap />
      <OutcomePricing />
      <PricingFAQ />
      <PricingFinalCTA />
      <LandingFooter />
    </main>
  );
}
