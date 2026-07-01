import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Brand Perception — Brand research with AI · Klymeo" },
  description: "What does your brand really stand for? Implicit associations from open conversations, evidenced in the wording.",
  alternates: buildAlternates("en", "/loesungen/markenwahrnehmung"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Brand Perception — Brand research with AI · Klymeo",
    description: "Implicit brand associations from open conversations — evidenced in the wording.",
    url: "/loesungen/markenwahrnehmung",
  },
};

export default function BrandPerceptionPage() {
  return (
    <SolutionPage
      lang="en"
      data={{
        eyebrow: "Brand Perception",
        title: "What your brand",
        italic: "really triggers.",
        lead: "Brand research beyond the Likert scale: Konsoul lets people talk openly — and distills what your brand stands for in your audience's mind.",
        mood: "think",
        whatItIs:
          "Instead of predefined image attributes, Konsoul asks openly about associations, stories and experiences. The synthesis clusters these into implicit brand values — including the uncomfortable ones that stay invisible on closed scales.",
        questions: [
          "What three words come to people's minds spontaneously for my brand?",
          "How does perception differ between customers and non-customers?",
          "Which competitor gets confused with us — and why?",
          "Which brand values are actually experienced, and which are only claimed?",
        ],
        process: [
          { n: "01", t: "Sample", b: "Customers, lapsed customers, aware non-buyers, unaware — all in parallel." },
          { n: "02", t: "Open storytelling", b: "Konsoul asks for stories, not ratings." },
          { n: "03", t: "Clustering", b: "Implicit themes, tone, brand personality." },
          { n: "04", t: "Comparison", b: "You vs. competitors, segment vs. segment." },
        ],
        deliverables: [
          "Brand image map with implicit themes & weight",
          "Segment comparison (customers vs. non-customers)",
          "Competitive positioning from your audience's point of view",
          "Verbatim collection: the sentences that describe your brand",
          "Strategy slides for marketing & leadership",
        ],
        exampleQuote: {
          q: "“We thought we stood for ‘innovative.’ Klymeo showed us: our audience hears ‘reliable.’ That completely changed our campaign.”",
          a: "Head of Brand · B2B SaaS",
        },
        related: [
          { label: "Concept Test", href: "/en/loesungen/konzept-test" },
          { label: "Needs & Behavior", href: "/en/loesungen/bedarf-verhalten" },
          { label: "Industries", href: "/en/branchen" },
        ],
      }}
    />
  );
}
