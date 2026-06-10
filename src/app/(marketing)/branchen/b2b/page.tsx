import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/b2b";
const OG_TITLE = "Market Research für B2B — findr.";
const DESCRIPTION =
  "Qualitative B2B-Marktforschung mit KI-Interviews auf Deutsch: Entscheider, Anwender und Einkäufer im O-Ton — per Link in deine eigenen Kontakte, auf Wunsch per Voice-Agent. Belegte Antworten zu Bedarf, Positionierung und Angebot, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Market Research für B2B",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research — B2B",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "b2b",
  eyebrow: "Branche · B2B",
  heroTitle: <>Hör dem ganzen Buying-Center zu — nicht nur der lautesten Stimme.</>,
  heroSubhead:
    "Im B2B entscheidet selten eine Person: Fachbereich, Einkauf, Geschäftsführung — jede Rolle hat eigene Gründe, und die wenigsten landen ungefiltert bei dir. findr. führt strukturierte Tiefeninterviews mit deinen Zielgruppen auf Deutsch, per Link direkt in deine Kontakte, auf Wunsch hörbar per Voice-Agent — und verdichtet die Gespräche zu belegten Antworten.",
  audience:
    "Marketing-, Produkt- und Strategieverantwortliche in B2B-Unternehmen — Software, Dienstleistung, Fertigung, Großhandel.",
  pain: {
    eyebrow: "B2B · Der blinde Fleck",
    title: <>Wenige Abschlüsse, lange Zyklen — und jede Erklärung ist eine Anekdote.</>,
    problem:
      "B2B-Märkte liefern wenige Datenpunkte: eine Handvoll Abschlüsse pro Quartal, lange Entscheidungszyklen, und das Feedback kommt als Einzelmeinung — vom letzten Termin, vom lautesten Kunden, aus dritter Hand. Klassische Umfragen erreichen Fachentscheider kaum, und wenn doch, kreuzen sie Skalen an, statt zu erklären, wie ihre Entscheidung wirklich gefallen ist.",
    stakes: {
      strong: "Was offen bleibt, solange niemand strukturiert nachfragt.",
      body: "Welche Rolle im Buying-Center wirklich bremst, wie Anbieter verglichen werden, was ein Angebot verständlich macht — das bleibt Vermutung, bis es jemand im Tiefeninterview erfragt. Eine Lücke, kein Drama: sie ist nur noch nicht gefüllt.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Einzelmeinung",
      rows: [
        {
          label: "Was im Raum steht",
          value: "„Die Fachabteilung wollte uns, der Einkauf hat es gekippt.“",
        },
        {
          label: "Was offen bleibt",
          value:
            "Ob es wirklich der Einkauf war — oder ein Vergleichsangebot, ein fehlender Referenzfall oder eine Anforderung, die im Angebot schlicht nicht beantwortet wurde.",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Zielgruppen-Studie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Per Link in deine eigenen Kontakte, mit Screening für die richtige Rolle im Buying-Center.",
  solution: {
    eyebrow: "B2B · Die belegte Antwort",
    title: <>Vom anekdotischen Feedback zur strukturierten Marktstimme.</>,
    body: "Setz für jede Frage eine eigene Studie auf — Bedarfsanalyse, Positionierungs-Check, Angebotsverständnis. Lade Kunden, Beinahe-Kunden und Zielkontakte per Link ein; das Screening-Gate stellt sicher, dass die richtige Rolle antwortet — Anwender:in, Fachentscheider:in oder Einkauf. findr. führt das Tiefeninterview auf Deutsch, auf Wunsch per Voice-Agent für Gesprächspartner, die lieber reden als tippen, und verdichtet alles zu Themen, Lagern und Originalzitaten.",
    payoff: {
      strong: "Eine Zahl, die du im Strategie-Meeting verteidigst.",
      body: "Fragt jemand „woher wissen wir das?“, zeigst du die Zahl — und das Originalzitat der jeweiligen Rolle daneben. Nichts hochgerechnet, nichts aus dritter Hand.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Woran scheitert unser Angebot bei Fachentscheidern?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 5 Studien fehlte nicht der Funktionsumfang, sondern ein Referenzfall aus der eigenen Branche — jede Zahl mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Das Produkt hat überzeugt — aber ohne einen Fall aus unserer Branche bekomme ich das intern nicht durch.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "B2B · Vor dem Markteintritt",
    title: <>Validier Angebot und Positionierung, bevor der Vertrieb losläuft.</>,
    body: "Dieselbe Studie funktioniert auch andersherum: Bevor ein neues Angebot, ein neues Segment oder eine neue Preislogik in den Markt geht, fragst du die Zielrollen vorher. Zeig das Angebots-Konzept oder die neue Nutzenargumentation als Stimulus direkt im Interview — Fachentscheider nehmen Bezug auf genau das Material, mit dem dein Vertrieb später arbeiten soll.",
    payoff: {
      strong: "Eine belegte Grundlage, bevor Vertriebszeit gebunden wird.",
      body: "Statt die Positionierung im Markt zu testen, gehst du mit einer Zahl in die Entscheidung, die zeigt, welche Argumente tragen — und welche Einwände dein Vertrieb hören wird, bevor er sie hört.",
    },
    card: {
      badge: "Konzept-Test · vor dem Rollout",
      rows: [
        {
          label: "Frage",
          value: "Versteht die Zielgruppe das neue Leistungspaket?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 6 Studien wurde der Mehrwert verstanden — die häufigste Rückfrage galt der Abgrenzung der Pakete. Jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Den Nutzen kapiere ich sofort — mir ist nur nicht klar, warum ich das mittlere Paket nehmen sollte, wenn das kleine fast dasselbe kann.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Entscheidern und Anwendern — strukturiert statt anekdotisch.",
  cta: {
    title: <>Hör deinem Buying-Center zu.</>,
    lead: "Buch eine Demo und sieh, wie findr. eine B2B-Frage über mehrere Studien beantwortet — Rolle für Rolle, je Studie belegt.",
  },
};

export default function B2bPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={CONTENT} />
    </>
  );
}
