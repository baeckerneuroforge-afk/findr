import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "User Research — UX research with AI · Klymeo" },
  description:
    "UX and product research with voice interviews: understand how people use your product — in context, with real follow-up questions from Konsoul.",
  alternates: buildAlternates("en", "/loesungen/user-research"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "User Research — UX research with AI · Klymeo",
    description: "Deep user interviews — in parallel, in context, with real follow-ups from Konsoul.",
    url: "/loesungen/user-research",
  },
};

export default function UserResearchPage() {
  return (
    <SolutionPage
      lang="en"
      data={{
        eyebrow: "User Research",
        title: "UX research",
        italic: "that listens.",
        lead: "Deep user interviews — in parallel, in context, with real follow-ups. Konsoul moderates, you understand what's really blocking your users.",
        mood: "listen",
        whatItIs:
          "Voice or text interviews with real users during or right after they use your product. Konsoul probes further whenever something gets interesting — like an experienced UX researcher, but around the clock and in parallel across hundreds of conversations.",
        questions: [
          "Where do users drop off in onboarding — and why?",
          "Which feature is underrated, which is overrated?",
          "What's the real job our product gets hired for?",
          "What workarounds do power users build?",
        ],
        process: [
          { n: "01", t: "Brief", b: "You describe the product & open questions — Konsoul builds the guide + screener." },
          { n: "02", t: "Recruit", b: "Your own list, customer pool, or panel. GDPR-compliant, anonymous." },
          { n: "03", t: "Interview", b: "Voice or text, in context. Konsoul probes three why-layers deep." },
          { n: "04", t: "Synthesis", b: "Themes, friction map, JTBD — all evidenced in the wording." },
        ],
        deliverables: [
          "Friction report with top pains, sorted by frequency & intensity",
          "Jobs-to-be-done clusters with real quotes",
          "Persona update from the interviews (see Personas module)",
          "Clickable quotes — straight to the audio moment",
          "Roadmap hypotheses, prioritized with Konsoul",
        ],
        exampleQuote: {
          q: "“I knew I was losing users during setup — but not why. Klymeo showed us in 4 days: it's step 3, and it's the wording.”",
          a: "VP Product · SaaS tool, 80 user interviews",
        },
        related: [
          { label: "Concept Test", href: "/en/loesungen/konzept-test" },
          { label: "Personas", href: "/en/personas" },
          { label: "Methods", href: "/en/methoden" },
        ],
      }}
    />
  );
}
