import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/landing/Header";
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

      <footer className="mt-24 border-t border-mist/10">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" aria-label="Findr home" className="inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="Findr" className="h-[26px] w-auto" />
              </Link>
              <p className="mt-3 max-w-xs text-sm text-mist">
                Revenue Intelligence OS for B2B SaaS sales teams.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-medium text-white">Product</h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/product"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/customers"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Customers
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-medium text-white">Company</h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="#about"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="#blog"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Blog
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-medium text-white">Legal</h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="#privacy"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#terms"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Terms
                  </Link>
                </li>
                <li>
                  <Link
                    href="#security"
                    className="text-sm text-mist transition-colors hover:text-white"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-between gap-3 border-t border-mist/10 pt-6 text-xs text-mist sm:flex-row">
            <p>&copy; 2026 Findr. All rights reserved.</p>
            <p>Private beta &middot; Built for revenue teams</p>
          </div>
        </div>
      </footer>
    </>
  );
}
