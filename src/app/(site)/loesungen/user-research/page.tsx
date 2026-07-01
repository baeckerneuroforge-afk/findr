import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "User Research — UX-Forschung mit KI · Klymeo" },
  description:
    "UX- & Produktforschung mit Voice-Interviews: verstehe, wie Menschen dein Produkt nutzen — im Kontext, mit echtem Nachhaken durch Konsoul.",
  alternates: buildAlternates("de", "/loesungen/user-research"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "User Research — UX-Forschung mit KI · Klymeo",
    description: "Tiefe Nutzer-Interviews — parallel, im Kontext, mit echten Follow-ups durch Konsoul.",
    url: "/loesungen/user-research",
  },
};

export default function UserResearchPage() {
  return (
    <SolutionPage
      data={{
        eyebrow: "User Research",
        title: "UX-Forschung,",
        italic: "die zuhört.",
        lead: "Tiefe Nutzer-Interviews — parallel, im Kontext und mit echten Follow-ups. Konsoul moderiert, du verstehst, was deine Nutzer:innen wirklich blockiert.",
        mood: "listen",
        whatItIs:
          "Voice- oder Text-Interviews mit echten Nutzer:innen während oder direkt nach der Produktnutzung. Konsoul bohrt nach, wenn etwas spannend wird — wie ein erfahrener UX-Researcher, aber rund um die Uhr und parallel über hunderte Gespräche.",
        questions: [
          "Wo brechen Nutzer:innen im Onboarding ab — und warum?",
          "Welches Feature wird unterschätzt, welches überschätzt?",
          "Was ist der eigentliche Job, für den unser Produkt gehired wird?",
          "Welche Workarounds bauen Power-User:innen?",
        ],
        process: [
          { n: "01", t: "Brief", b: "Du beschreibst Produkt & offene Fragen — Konsoul baut Leitfaden + Screener." },
          { n: "02", t: "Recruit", b: "Eigene Liste, Kunden-Pool oder Panel. DSGVO-konform, anonym." },
          { n: "03", t: "Interview", b: "Voice oder Text, im Kontext. Konsoul fragt 3-Why-Layer tief nach." },
          { n: "04", t: "Synthese", b: "Themen, Friction-Map, JTBD — alles am Wortlaut belegt." },
        ],
        deliverables: [
          "Friction-Report mit Top-Pains, sortiert nach Häufigkeit & Intensität",
          "Jobs-to-be-Done-Cluster mit echten Zitaten",
          "Persona-Update aus den Interviews (siehe Personas-Modul)",
          "Klickbare Quotes — direkt zur Audiostelle",
          "Roadmap-Hypothesen, priorisiert mit Konsoul",
        ],
        exampleQuote: {
          q: "„Ich wusste, dass ich beim Setup verloren gehe — aber nicht warum. Klymeo hat in 4 Tagen gezeigt: es ist Schritt 3, und es liegt am Wording.“",
          a: "VP Product · SaaS-Tool, 80 Nutzer-Interviews",
        },
        related: [
          { label: "Konzept-Test", href: "/loesungen/konzept-test" },
          { label: "Personas", href: "/personas" },
          { label: "Methoden", href: "/methoden" },
        ],
      }}
    />
  );
}
