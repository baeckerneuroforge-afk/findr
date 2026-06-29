import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { ogDefaults } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Konzept- & Kreativ-Test mit KI · Klymeo" },
  description:
    "Verpackung, Claims, Spots, Landing Pages — eingebettet in echte Gespräche. Konsoul fragt zum richtigen Moment nach.",
  alternates: { canonical: "/loesungen/konzept-test" },
  openGraph: {
    ...ogDefaults,
    title: "Konzept- & Kreativ-Test mit KI · Klymeo",
    description: "Verpackung, Claim, Spot oder Landing Page eingebettet im Live-Gespräch testen.",
    url: "/loesungen/konzept-test",
  },
};

export default function KonzeptTestPage() {
  return (
    <SolutionPage
      data={{
        eyebrow: "Konzept- & Kreativ-Test",
        title: "Konzepte, die",
        italic: "wirklich zünden.",
        lead: "Welche Variante gewinnt — und warum? Klymeo testet Verpackung, Claim, Landing Page oder Spot eingebettet im Live-Gespräch, statt vorab ausgestellt.",
        mood: "wow",
        whatItIs:
          "Stimulus-Material wird mitten im Interview gezeigt. Konsoul beobachtet die Reaktion, fragt strukturiert nach (was fällt auf, was bleibt hängen, was würdest du erzählen) und vergleicht A/B/C — auf Wortlaut und implizite Reaktion.",
        questions: [
          "Welche Verpackungs-Variante kommuniziert „Premium“ am stärksten?",
          "Versteht die Zielgruppe meinen Claim richtig?",
          "Welcher Spot löst die richtige Emotion aus — und welcher Cut?",
          "Wo verliert meine Landing Page Conversion-Aufmerksamkeit?",
        ],
        process: [
          { n: "01", t: "Stimuli upload", b: "Bilder, Videos, URLs, PDFs — Konsoul versteht jedes Format." },
          { n: "02", t: "Test-Design", b: "Monadisch, sequentiell oder A/B/C — Konsoul empfiehlt das passende Setup." },
          { n: "03", t: "Live-Tests", b: "Im Gespräch eingespielt, mit Reaktion vor Rationalisierung." },
          { n: "04", t: "Verdikt", b: "Vergleich pro Stimulus mit Quotes, Themen, Empfehlung." },
        ],
        deliverables: [
          "Side-by-side-Vergleich aller Varianten mit Score & Belegen",
          "Top-Driver & Top-Detractor pro Variante",
          "Empfehlung pro Zielgruppe (Konsoul segmentiert automatisch)",
          "Highlight-Reel: die stärksten 90 Sekunden pro Konzept",
          "Iterations-Vorschläge auf Basis der Open-Ends",
        ],
        exampleQuote: {
          q: "„Wir wussten sofort, dass Variante B gewinnt — und konnten dem CMO die exakten Zitate zeigen, warum.“",
          a: "Brand Lead · Konsumgüter, 3 Verpackungs-Varianten",
        },
        related: [
          { label: "User Research", href: "/loesungen/user-research" },
          { label: "Markenwahrnehmung", href: "/loesungen/markenwahrnehmung" },
          { label: "Plattform", href: "/plattform" },
        ],
      }}
    />
  );
}
