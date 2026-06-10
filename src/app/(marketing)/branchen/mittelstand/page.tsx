import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/mittelstand";
const OG_TITLE = "Market Research für den Mittelstand — findr.";
const DESCRIPTION =
  "Qualitative Marktforschung ohne Institutsbudget: KI-Interviews mit deinen Kunden und Zielgruppen auf Deutsch — auf Wunsch per Voice-Agent. Belegte Antworten statt Bauchgefühl, exportiert als PDF oder PowerPoint, DSGVO-nativ in Frankfurt.";

export const metadata: Metadata = {
  title: "Market Research für den Mittelstand",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research — Mittelstand",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "mittelstand",
  eyebrow: "Branche · Mittelstand",
  heroTitle: <>Frag deinen Markt — ohne ein Institut zu beauftragen.</>,
  heroSubhead:
    "Im Mittelstand fallen Produkt-, Preis- und Markenentscheidungen oft aus Erfahrung, weil klassische Marktforschung Wochen dauert und schnell fünfstellig kostet. findr. führt die Tiefeninterviews selbst — KI-geführt, auf Deutsch, auf Wunsch hörbar per Voice-Agent — und macht aus „das sagt der Vertrieb“ eine Antwort, die je Studie am Gespräch belegt ist.",
  audience:
    "Geschäftsführung, Marketing- und Produktverantwortliche im Mittelstand — vom Hersteller über den Händler bis zum Dienstleister.",
  pain: {
    eyebrow: "Mittelstand · Der blinde Fleck",
    title: <>„Der Kunde will das so“ — sagt wer eigentlich?</>,
    problem:
      "Was der Markt wirklich denkt, kommt im Mittelstand meist gefiltert an: über den Vertrieb, über einzelne laute Kunden, über das letzte Messegespräch. Ein Institut für jede Frage zu beauftragen ist unrealistisch — also bleibt die Erfahrung. Die ist wertvoll, aber sie ist nicht belegt, und bei neuen Zielgruppen oder neuen Angeboten trägt sie nicht.",
    stakes: {
      strong: "Was offen bleibt, solange niemand systematisch fragt.",
      body: "Ob der Preis das Problem ist oder die Auffindbarkeit, ob das neue Angebot verstanden wird, woran Interessenten abspringen — das bleibt Vermutung, bis es jemand im Gespräch erfragt. Eine Lücke, kein Drama: sie ist nur noch nicht gefüllt.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Hörensagen",
      rows: [
        {
          label: "Was im Raum steht",
          value: "„Der Vertrieb sagt, wir sind zu teuer.“",
        },
        {
          label: "Was offen bleibt",
          value:
            "Ob es wirklich der Preis ist — oder das Leistungsversprechen, die Vergleichbarkeit mit dem Wettbewerb oder schlicht, dass das Angebot nicht verstanden wird.",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Studie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Ohne Institut, ohne Moderator, ohne Wochen Vorlauf — zum Bruchteil der Kosten.",
  solution: {
    eyebrow: "Mittelstand · Die belegte Antwort",
    title: <>Vom Vertriebs-Hörensagen zur belegten Marktstimme.</>,
    body: "Setz für jede Frage eine eigene Studie auf — Preiswahrnehmung, neues Angebot, Markenbild. Lade deine eigenen Kunden per Link ein oder rekrutiere über Panel-Anbindung und Screening genau die Zielgruppe, die du brauchst. findr. interviewt auf Deutsch, auf Wunsch per Voice-Agent, und verdichtet alles zu Themen, Lagern und Originalzitaten — exportierbar als PDF-Report oder PowerPoint-Deck für die nächste Geschäftsführungsrunde.",
    payoff: {
      strong: "Eine Zahl, die du in der Geschäftsführung verteidigst.",
      body: "Fragt jemand „woher wissen wir das?“, zeigst du die Zahl — und das Originalzitat aus der jeweiligen Studie daneben. Nichts hochgerechnet, nichts angenommen.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Warum entscheiden sich Interessenten gegen unser Angebot?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 5 Studien war nicht der Preis das Hindernis, sondern die Vergleichbarkeit — Interessenten konnten den Unterschied zum günstigeren Wettbewerber nicht benennen. Jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Teurer wäre okay gewesen — ich habe nur bis zum Schluss nicht verstanden, was ich dafür mehr bekomme.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Mittelstand · Vor der Investition",
    title: <>Prüf den Markt, bevor du investierst.</>,
    body: "Dieselbe Studie funktioniert auch andersherum: nicht erst nachforschen, wenn etwas hakt, sondern vorher fragen, ob die Idee trägt. Ein neues Produkt, ein neuer Markt, ein Rebranding — leg eine Konzept-Studie an, zeig den Entwurf als Stimulus direkt im Interview und lass deine Zielgruppe antworten, bevor Budget und Kapazität gebunden sind.",
    payoff: {
      strong: "Eine belegte Grundlage fürs Go oder No-Go — vor dem Invest.",
      body: "Statt nach dem Launch aus dem Umsatz zu lernen, gehst du mit einer Zahl in die Entscheidung, die zeigt, wie viele die Idee wirklich überzeugt — und woran die anderen zögern.",
    },
    card: {
      badge: "Konzept-Test · vor der Entscheidung",
      rows: [
        {
          label: "Frage",
          value: "Trägt das neue Serviceangebot bei Bestandskunden?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 6 Konzept-Studien klares Interesse — am häufigsten genannte Hürde: die Laufzeitbindung. Jede Zahl mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Das Paket klingt vernünftig — aber zwei Jahre Bindung unterschreibe ich nicht, dafür kenne ich euch noch zu kurz.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Menschen — gebaut, damit Marktforschung auch ohne Insights-Abteilung funktioniert.",
  cta: {
    title: <>Hör deinem Markt zu — ab dieser Woche.</>,
    lead: "Buch eine Demo und sieh, wie findr. eine Mittelstands-Frage über mehrere Studien beantwortet — belegt, exportierbar, ohne Institut.",
  },
};

export default function MittelstandPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={CONTENT} />
    </>
  );
}
