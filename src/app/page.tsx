import type { Metadata } from "next";
import { loadMarketingPage } from "@/lib/marketing/page-source";
import { MarketingScripts } from "@/components/marketing/MarketingScripts";

export const metadata: Metadata = {
  title: "findr. — Conversation-Intelligence-Plattform für B2B-SaaS",
  description:
    "Ein KI-Gehirn, vier Produkte: Sales Intelligence, Customer Success Health, Product Discovery und Market Research. findr. liest jedes Kundengespräch und macht es über alle Produkte hinweg nutzbar — DSGVO-nativ, in Frankfurt gehostet, EU-AI-Act-konform.",
};

export default function HomePage() {
  const { css, html, js } = loadMarketingPage("landing.html", [
    ["pricing.html", "/pricing"],
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <MarketingScripts js={js} />
    </>
  );
}
