import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { LandingFooter } from "@/components/landing/LandingFooter";
import PricingTable from "@/components/pricing/PricingTable";
import OutcomePricingCallout from "@/components/pricing/OutcomePricingCallout";
import PricingFAQ from "@/components/pricing/PricingFAQ";

export const metadata: Metadata = {
  title: "Pricing — Findr",
  description:
    "Simple, transparent pricing. Pay only for what you analyze. Outcome-based pricing available on all paid tiers.",
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        <section className="mt-16 px-6">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
              Pricing
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-medium tracking-tight text-white md:text-6xl">
              Simple, transparent pricing.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-mist">
              Pay only for what you analyze. Outcome-based pricing available on
              all paid tiers.
            </p>
          </div>
        </section>

        <PricingTable />
        <OutcomePricingCallout />
        <PricingFAQ />
      </main>

      <LandingFooter />
    </>
  );
}
