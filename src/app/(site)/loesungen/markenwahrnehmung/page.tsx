import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Markenwahrnehmung — Brand Research mit KI · Klymeo" },
  description: "Wofür steht deine Marke wirklich? Implizite Assoziationen aus offenen Gesprächen, belegt am Wortlaut.",
  alternates: buildAlternates("de", "/loesungen/markenwahrnehmung"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Markenwahrnehmung — Brand Research mit KI · Klymeo",
    description: "Implizite Marken-Assoziationen aus offenen Gesprächen — belegt am Wortlaut.",
    url: "/loesungen/markenwahrnehmung",
  },
};

export default function MarkenwahrnehmungPage() {
  return (
    <SolutionPage
      data={{
        eyebrow: "Markenwahrnehmung",
        title: "Was deine Marke",
        italic: "wirklich auslöst.",
        lead: "Markenforschung jenseits der Likert-Skala: Konsoul lässt Menschen offen erzählen — und destilliert daraus, wofür deine Marke im Kopf der Zielgruppe steht.",
        mood: "think",
        whatItIs:
          "Statt vorgegebener Image-Attribute fragt Konsoul offen nach Assoziationen, Geschichten und Erlebnissen. Die Synthese clustert daraus implizite Brand-Werte — auch die unangenehmen, die in geschlossenen Skalen unsichtbar bleiben.",
        questions: [
          "Welche drei Wörter fallen Menschen spontan zu meiner Marke ein?",
          "Wie unterscheidet sich die Wahrnehmung zwischen Kund:innen und Nicht-Kund:innen?",
          "Welche Konkurrenz wird mit uns verwechselt — und warum?",
          "Welche Markenwerte sind erlebt, welche nur behauptet?",
        ],
        process: [
          { n: "01", t: "Sample", b: "Kund:innen, Lapsed, Aware-Nicht-Käufer:innen, Unaware — alles parallel." },
          { n: "02", t: "Offen erzählen", b: "Konsoul fragt Geschichten ab, keine Bewertungen." },
          { n: "03", t: "Clustering", b: "Implizite Themen, Tonalität, Brand-Persönlichkeit." },
          { n: "04", t: "Vergleich", b: "Eigene vs. Wettbewerb, Segment vs. Segment." },
        ],
        deliverables: [
          "Brand-Image-Map mit impliziten Themen & Gewicht",
          "Segment-Vergleich (Kund:innen vs. Nicht-Kund:innen)",
          "Wettbewerbs-Positionierung aus Sicht der Zielgruppe",
          "Verbatim-Sammlung: die Sätze, die deine Marke beschreiben",
          "Strategie-Slides für Marketing & Geschäftsleitung",
        ],
        exampleQuote: {
          q: "„Wir dachten, wir stehen für 'innovativ'. Klymeo hat gezeigt: die Zielgruppe hört 'verlässlich'. Das hat unsere Kampagne komplett gedreht.“",
          a: "Head of Brand · B2B-SaaS",
        },
        related: [
          { label: "Konzept-Test", href: "/loesungen/konzept-test" },
          { label: "Bedarf & Verhalten", href: "/loesungen/bedarf-verhalten" },
          { label: "Branchen", href: "/branchen" },
        ],
      }}
    />
  );
}
