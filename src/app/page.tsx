import type { Metadata } from "next";
import { loadMarketingPage } from "@/lib/marketing/page-source";
import { MarketingScripts } from "@/components/marketing/MarketingScripts";

export const metadata: Metadata = {
  title: "findr. — Conversation Intelligence for B2B Sales",
  description:
    "Your CRM shows what happened. findr. shows why — reading every sales conversation, scoring deal risk in real time, and surfacing the signals your CRM misses. EU-hosted, GDPR + EU AI Act compliant.",
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
