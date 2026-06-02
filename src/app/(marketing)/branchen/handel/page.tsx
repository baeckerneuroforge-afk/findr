import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/handel";
const OG_TITLE = "Market Research für Handel & E-Commerce — findr.";
const DESCRIPTION =
  "KI-Interviews mit echten Kund:innen auf Deutsch — Warenkorbabbruch, Sortiments- und Preiswahrnehmung aus echten Gesprächen statt nur aus Klickdaten. Je Studie verankert, deterministisch gezählt, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Market Research für Handel & E-Commerce",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research — Handel & E-Commerce",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "handel",
  eyebrow: "Branche · Handel & E-Commerce",
  heroTitle: <>Klickdaten zeigen den Absprung. Nicht den Grund.</>,
  heroSubhead:
    "Warenkorb verlassen, Filiale ohne Kauf verlassen, zur Konkurrenz gewechselt — deine Analytics sehen das Was, nie das Warum. findr. führt KI-Interviews mit echten Kund:innen auf Deutsch und macht aus dem Absprung einen belegten Grund: je Studie verankert, deterministisch gezählt.",
  audience:
    "Category-, CRM- und E-Commerce-Teams im Handel — stationär wie online.",
  pain: {
    eyebrow: "Handel · Der blinde Fleck",
    title: <>Eine hohe Abbruchrate ist eine Zahl. Kein Grund.</>,
    problem:
      "Heatmaps, Funnels und Abbruchraten erzählen dir präzise, wo Kund:innen abspringen — aber nie, warum. War der Versand zu teuer, fehlte eine Größe, wirkte das Sortiment beliebig, oder lag dasselbe Produkt nebenan zwei Euro günstiger? Die Klickspur endet genau dort, wo die Antwort anfängt.",
    stakes: {
      strong: "Was der Funnel offenlässt.",
      body: "Ein A/B-Test zeigt dir, welche Variante gewinnt — nicht, welches Bedürfnis dahintersteht. Das ist keine Schwäche der Daten, nur ihre Grenze: das Warum steht woanders.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Funnel",
      rows: [
        {
          label: "Was der Funnel zeigt",
          value: "Ein Großteil bricht auf der Versandkostenseite ab.",
        },
        {
          label: "Was der Funnel offenlässt",
          value:
            "Ob es die Höhe der Versandkosten ist, die fehlende Lieferzeit-Angabe oder das Gefühl, dasselbe Produkt anderswo schon günstiger gesehen zu haben.",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Kundenstudie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Kein Panel, kein Moderator, keine Wartezeit.",
  solution: {
    eyebrow: "Handel · Die belegte Antwort",
    title: <>Vom anonymen Abbruch zur belegten Kaufentscheidung.</>,
    body: "Leg eine Studie pro Frage an — Warenkorbabbruch, Sortimentswahrnehmung, Preisgefühl, Wechsel zum Wettbewerb. Über einen offenen Studien-Link starten echte Kund:innen selbst ein KI-Interview auf Deutsch; das Screening-Gate sorgt dafür, dass du mit Käufer:innen deiner Kategorie sprichst, nicht mit zufälligen Besucher:innen. Die Markt-Linse trennt Preis-Signal, Kaufabsicht, Segment und Wettbewerb — und über mehrere Studien wird deterministisch gezählt, je Studie mit Zitat belegt.",
    payoff: {
      strong: "Eine Sortiments- oder Preisentscheidung, die du belegst.",
      body: "Statt „die Kunden finden uns zu teuer“ zeigst du, in wie vielen Studien das aufkam — und das Zitat dazu.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Warum landet der Warenkorb nicht im Kauf?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 5 Studien war nicht der Preis das Problem, sondern die unklare Lieferzeit — jede mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Der Preis war okay. Aber nirgends stand, ob das vor dem Wochenende da ist — da hab ich’s woanders bestellt, wo’s klar dranstand.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Handel · Vor dem Roll-out",
    title: <>Test das Konzept, bevor das Sortiment in die Fläche geht.</>,
    body: "Die gleiche Studie lässt sich vorziehen: bevor ein neues Sortiment, eine Eigenmarke oder ein Shop-Konzept ausgerollt wird, fragst du die Käufer:innen, ob es trifft. Über einen offenen Studien-Link starten echte Kund:innen selbst ein KI-Interview auf Deutsch; das Screening sorgt dafür, dass du mit deiner Zielgruppe sprichst, nicht mit zufälligen Besucher:innen. Die Markt-Linse trennt, was wirklich zieht, von dem, was nur nett klingt — Preisgefühl, Kaufabsicht und Erwartung ans Sortiment, über mehrere Studien deterministisch gezählt.",
    payoff: {
      strong: "Belegt, bevor du in Sortiment oder Eigenmarke investierst.",
      body: "Statt einen Roll-out im Nachhinein an Warenkorbabbrüchen zu deuten, weißt du vorher, welche Eigenmarke oder welches Konzept die Käufer:innen tatsächlich wollen.",
    },
    card: {
      badge: "Konzept-Test · vor dem Roll-out",
      rows: [
        {
          label: "Frage",
          value: "Trifft die geplante Eigenmarke den Bedarf der Zielgruppe?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 6 Studien klare Kaufabsicht — der meistgenannte Wunsch war eine größere Gebindeauswahl, jede mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Die Eigenmarke würde ich nehmen — aber nur, wenn’s die auch in der Familienpackung gibt, sonst lohnt sich der Wechsel für mich nicht.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Kund:innen — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Der Absprung hat einen Grund. Frag ihn ab.</>,
    lead: "Buch eine Demo und sieh, wie findr. eine Kundenfrage über mehrere Studien beantwortet — deterministisch gezählt, je Studie belegt.",
  },
};

export default function HandelPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={CONTENT} />
    </>
  );
}
