import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/industrie";
const OG_TITLE = "Market Research für die Industrie — findr.";
const DESCRIPTION =
  "Anwender- und Kundenforschung für Industrieunternehmen: KI-Interviews auf Deutsch mit Anwendern, Einkäufern und Partnern — per Link, auf Wunsch per Voice-Agent. Belegte Antworten zu Produkt, Service und neuen Angeboten, bevor investiert wird. DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Market Research für die Industrie",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research — Industrie",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "industrie",
  eyebrow: "Branche · Industrie",
  heroTitle: <>Hör den Anwendern zu, bevor die Linie umgebaut wird.</>,
  heroSubhead:
    "Maschinen, Komponenten, Services: Industrieentscheidungen binden Kapital für Jahre — und das Wissen darüber, was Anwender wirklich brauchen, steckt in Messegesprächen und Service-Tickets. findr. führt strukturierte Tiefeninterviews mit Anwendern, Einkäufern und Partnern auf Deutsch, auf Wunsch hörbar per Voice-Agent — und macht daraus belegte Entscheidungsgrundlagen.",
  audience:
    "Produktmanagement, Vertriebssteuerung und Strategie in Industrieunternehmen — Maschinenbau, Komponenten, Zulieferer, Industrieservices.",
  pain: {
    eyebrow: "Industrie · Der blinde Fleck",
    title: <>Das Lastenheft sagt, was gefordert wurde. Nicht, was im Alltag stört.</>,
    problem:
      "Zwischen dem, was im Lastenheft steht, und dem, was Anwender an der Maschine wirklich erleben, liegt ein weiter Weg: Rückmeldungen kommen gefiltert über den Service, anekdotisch von der Messe oder gar nicht. Systematisch nachzufragen scheitert am Aufwand — Werksbesuche und Interviewreihen kosten Wochen, und der Produktmanager hat sie nicht.",
    stakes: {
      strong: "Was offen bleibt, solange nur der Service-Bericht spricht.",
      body: "Welche Funktion im Alltag umgangen wird, was einen Folgekauf wirklich entscheidet, wofür Kunden zahlen würden — das bleibt Vermutung, bis es jemand im Gespräch erfragt. Eine Lücke, kein Drama: sie ist nur noch nicht gefüllt.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Ticket-Daten",
      rows: [
        {
          label: "Was der Bericht zeigt",
          value: "Wenige Reklamationen, stabile Wartungsquote — Produkt scheint zu passen.",
        },
        {
          label: "Was der Bericht offenlässt",
          value:
            "Dass Anwender eine umständliche Funktion längst per Workaround umgehen — und beim nächsten Investitionszyklus den Wettbewerber testen, der genau das gelöst hat.",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Anwender-Studie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Per Link zu deinen Kunden und Partnern, ohne Werksbesuch, ohne Wochen Vorlauf.",
  solution: {
    eyebrow: "Industrie · Die belegte Antwort",
    title: <>Vom Messe-Hörensagen zur strukturierten Anwenderstimme.</>,
    body: "Setz für jede Frage eine eigene Studie auf — Anwenderzufriedenheit, Servicequalität, Bedarf für die nächste Produktgeneration. Lade Kunden, Anwender und Partner per Link ein; das Screening-Gate sorgt dafür, dass die richtige Rolle antwortet — Bediener:in, Instandhaltung oder Einkauf. findr. interviewt auf Deutsch, auf Wunsch per Voice-Agent für alle, die lieber reden als tippen, und verdichtet die Gespräche zu Themen, Lagern und Originalzitaten — exportierbar als PDF oder PowerPoint für den Investitionsausschuss.",
    payoff: {
      strong: "Eine Zahl, die du im Investitionsausschuss verteidigst.",
      body: "Fragt jemand „woher wissen wir das?“, zeigst du die Zahl — und das Originalzitat des Anwenders daneben. Nichts hochgerechnet, nichts aus dritter Hand.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Was entscheidet bei Bestandskunden über den Folgekauf?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 6 Studien war nicht der Preis ausschlaggebend, sondern Ersatzteilverfügbarkeit und Reaktionszeit im Service — jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Die Maschine ist top — aber wenn die Linie steht und das Ersatzteil drei Wochen braucht, nützt mir der beste Preis nichts.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Industrie · Vor der Investition",
    title: <>Validier die nächste Produktgeneration, bevor konstruiert wird.</>,
    body: "Dieselbe Studie funktioniert auch andersherum: Bevor eine neue Baureihe, ein digitales Serviceangebot oder ein Ersatzteil-Abo entwickelt wird, fragst du die Anwender vorher. Zeig das Konzept als Stimulus direkt im Interview — Datenblatt-Entwurf, Bedienoberfläche, Servicemodell — und lass genau die Menschen reagieren, die später damit arbeiten oder es einkaufen.",
    payoff: {
      strong: "Eine belegte Grundlage, bevor Konstruktion und Werkzeugbau anlaufen.",
      body: "Statt nach dem Serienanlauf aus Reklamationen zu lernen, gehst du mit einer Zahl in die Entscheidung, die zeigt, was Anwender wirklich brauchen — und wofür sie zahlen würden.",
    },
    card: {
      badge: "Konzept-Test · vor der Konstruktion",
      rows: [
        {
          label: "Frage",
          value: "Trägt das geplante Service-Abo bei Bestandskunden?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 5 Studien klares Interesse — die häufigste Bedingung: Reaktionszeiten müssen vertraglich zugesichert sein. Jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Für garantierte 24 Stunden zahle ich gern — für ein Besser-als-nichts-Versprechen keinen Cent.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Anwendern und Einkäufern — strukturiert statt anekdotisch.",
  cta: {
    title: <>Hör deinen Anwendern zu.</>,
    lead: "Buch eine Demo und sieh, wie findr. eine Industrie-Frage über mehrere Studien beantwortet — vom Anwender-O-Ton bis zum PowerPoint-Export.",
  },
};

export default function IndustriePage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={CONTENT} />
    </>
  );
}
