import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Needs & Behavior — AI-powered market research · Klymeo" },
  description: "What jobs, triggers and barriers drive purchase decisions? Jobs-to-be-done, first-hand.",
  alternates: buildAlternates("en", "/loesungen/bedarf-verhalten"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Needs & Behavior — AI-powered market research · Klymeo",
    description: "Triggers, barriers and substitutes for your audience — at JTBD depth, with real substance.",
    url: "/loesungen/bedarf-verhalten",
  },
};

export default function NeedsBehaviorPage() {
  return (
    <SolutionPage
      lang="en"
      data={{
        eyebrow: "Needs & Behavior",
        title: "Why people",
        italic: "really buy.",
        lead: "Understand your audience's triggers, barriers and substitutes — at JTBD depth, with real substance instead of 5-point scales.",
        mood: "scan",
        whatItIs:
          "Konsoul conducts a combination of critical-incident technique and jobs-to-be-done interviews. You learn not just what gets bought, but what people did right before and after — and where they nearly walked away.",
        questions: [
          "What trigger really puts people into buying mode?",
          "Which alternatives are considered — and why are they rejected?",
          "At which point in the customer journey do we lose the most people?",
          "Which job gets “hired” — and which is just the vehicle?",
        ],
        process: [
          { n: "01", t: "Trigger", b: "Recency sample: people who bought recently." },
          { n: "02", t: "Story mining", b: "Konsoul has the purchase story told chronologically." },
          { n: "03", t: "Switch triggers", b: "What was the one moment that tipped the decision?" },
          { n: "04", t: "Segment & synthesize", b: "Clusters per JTBD, barrier map, trigger map." },
        ],
        deliverables: [
          "Jobs-to-be-done map with frequency & intensity",
          "Switch-trigger timeline (push, pull, anxieties, habits)",
          "Substitute analysis: who are you really losing to?",
          "Persona update + needs clusters (see Personas)",
          "Recommendations for messaging & funnel optimization",
        ],
        exampleQuote: {
          q: "“We spent years pitching against the wrong competitor. Klymeo showed us in one study: our real competition is ‘doing nothing at all.’”",
          a: "Growth Lead · D2C brand",
        },
        related: [
          { label: "User Research", href: "/en/loesungen/user-research" },
          { label: "Personas", href: "/en/personas" },
          { label: "Industries", href: "/en/branchen" },
        ],
      }}
    />
  );
}
