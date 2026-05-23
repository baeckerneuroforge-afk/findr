import type { Metadata } from "next";
import { loadMarketingPage } from "@/lib/marketing/page-source";
import { MarketingScripts } from "@/components/marketing/MarketingScripts";

export const metadata: Metadata = {
  title: "Pricing — findr.",
  description:
    "One platform, honest pricing. Starter, Growth, and Scale tiers plus Enterprise — 14-day free trial, no credit card. EU-hosted, GDPR compliant.",
};

export default function PricingPage() {
  const { css, html, js } = loadMarketingPage("pricing.html", [
    ["index.html#", "/#"],
    ["index.html", "/"],
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <MarketingScripts js={js} />
    </>
  );
}
