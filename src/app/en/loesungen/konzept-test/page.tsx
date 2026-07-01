import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Concept & Creative Testing with AI · Klymeo" },
  description:
    "Packaging, claims, ads, landing pages — embedded in real conversations. Konsoul asks at exactly the right moment.",
  alternates: buildAlternates("en", "/loesungen/konzept-test"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Concept & Creative Testing with AI · Klymeo",
    description: "Test packaging, a claim, an ad, or a landing page embedded in a live conversation.",
    url: "/loesungen/konzept-test",
  },
};

export default function ConceptTestPage() {
  return (
    <SolutionPage
      lang="en"
      data={{
        eyebrow: "Concept & Creative Test",
        title: "Concepts that",
        italic: "really land.",
        lead: "Which variant wins — and why? Klymeo tests packaging, a claim, a landing page, or an ad embedded in a live conversation, instead of showing it upfront in isolation.",
        mood: "wow",
        whatItIs:
          "Stimulus material is shown right in the middle of the interview. Konsoul observes the reaction, asks structured follow-ups (what stands out, what sticks, what would you tell a friend) and compares A/B/C — on wording and implicit reaction.",
        questions: [
          "Which packaging variant communicates “premium” most strongly?",
          "Does the audience understand my claim correctly?",
          "Which ad triggers the right emotion — and which cut?",
          "Where does my landing page lose conversion attention?",
        ],
        process: [
          { n: "01", t: "Stimuli upload", b: "Images, videos, URLs, PDFs — Konsoul understands every format." },
          { n: "02", t: "Test design", b: "Monadic, sequential, or A/B/C — Konsoul recommends the right setup." },
          { n: "03", t: "Live testing", b: "Played in conversation, capturing reaction before rationalization." },
          { n: "04", t: "Verdict", b: "Comparison per stimulus with quotes, themes, recommendation." },
        ],
        deliverables: [
          "Side-by-side comparison of all variants with score & evidence",
          "Top driver & top detractor per variant",
          "Recommendation per audience segment (Konsoul segments automatically)",
          "Highlight reel: the strongest 90 seconds per concept",
          "Iteration suggestions based on the open-ends",
        ],
        exampleQuote: {
          q: "“We knew immediately that variant B would win — and could show the CMO the exact quotes for why.”",
          a: "Brand Lead · Consumer goods, 3 packaging variants",
        },
        related: [
          { label: "User Research", href: "/en/loesungen/user-research" },
          { label: "Brand Perception", href: "/en/loesungen/markenwahrnehmung" },
          { label: "Platform", href: "/en/plattform" },
        ],
      }}
    />
  );
}
