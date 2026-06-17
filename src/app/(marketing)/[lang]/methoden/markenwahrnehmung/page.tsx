import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  MethodPage,
  type MethodContent,
} from "@/components/marketing/methode-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/methoden/markenwahrnehmung";
const OG_TITLE = "Markenwahrnehmung — Klymeo";
const DESCRIPTION =
  "Wie deine Marke wirklich wahrgenommen wird: Klymeo erfragt Assoziationen, Bilder und Gefühle in den eigenen Worten deiner Zielgruppe — bewusst breit. KI-Interviews auf Deutsch, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Markenwahrnehmung",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klymeo — Markenwahrnehmung",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: MethodContent = {
  slug: "markenwahrnehmung",
  status: "Live",
  eyebrow: "Methode · Markenwahrnehmung",
  heroTitle: <>Wie deine Marke wirklich im Kopf sitzt.</>,
  heroSubhead:
    "Markenwahrnehmung lässt sich nicht ankreuzen. Klymeo fragt nach Assoziationen, Bildern und Gefühlen — in den eigenen Worten deiner Zielgruppe, bewusst breit, bevor eine Skala die spontane Reaktion überformt.",
  audience:
    "Marken-, Marketing- und Strategie-Teams, die das echte Bild ihrer Marke hören wollen — nicht das gewünschte.",
  statusNote:
    "Diese Methode läuft heute — du kannst sie direkt in einer Market-Research-Studie einsetzen.",
  pain: {
    eyebrow: "Markenwahrnehmung · Der blinde Fleck",
    title: <>Das Brand-Tracking zeigt einen Wert. Nicht das Bild dahinter.</>,
    problem:
      "Gestützte Abfragen liefern Prozentpunkte auf vorgegebenen Attributen — aber die Marke lebt in spontanen Assoziationen, Bildern und Gefühlen, die in keiner Skala vorkommen. Was Menschen ungefragt mit dir verbinden, verrät mehr als jede Zustimmung zu „modern: ja/nein“.",
    stakes: {
      strong: "Vorgegebene Attribute messen deine Hypothese, nicht ihre Wahrnehmung.",
      body: "Wer nur abfragt, was er ohnehin vermutet, hört nie das Wort, das die Zielgruppe selbst wählt — und genau das prägt die Marke.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur gestützte Skala",
      rows: [
        {
          label: "Was das Tracking zeigt",
          value: "Zustimmungswerte zu vorgegebenen Marken-Attributen.",
        },
        {
          label: "Was das Tracking offenlässt",
          value:
            "Welches Bild, welches Gefühl, welche spontane Assoziation die Marke wirklich auslöst — in den Worten der Zielgruppe, nicht in deinen.",
        },
      ],
    },
  },
  how: {
    title: <>So hält Klymeo die Wahrnehmung offen.</>,
    lead:
      "Bewusst breit statt tief: Klymeo fragt nach dem ersten Einfall, bevor es konkretisiert — damit die spontane Wahrnehmung nicht durch die Frage geformt wird.",
    steps: [
      {
        phase: "Spontan",
        title: "Erst der erste Einfall",
        body: "„Was kommt Ihnen als Erstes in den Sinn bei [Marke]?“ — die ungestützte Assoziation zuerst, bevor irgendein Attribut sie lenkt.",
        tag: "Live",
      },
      {
        phase: "Bild & Gefühl",
        title: "Assoziationen, Bilder, Gefühle",
        body: "Klymeo fragt nach Bildern und Gefühlen statt nach Skalenwerten — und bleibt bei den eigenen Worten der Person.",
        tag: "Live",
      },
      {
        phase: "Breit halten",
        title: "Nicht überformen",
        body: "Statt früh zu vertiefen, hält Klymeo die Frage offen — damit die Wahrnehmung nicht in eine vorgegebene Richtung gedrängt wird.",
        tag: "Live",
      },
      {
        phase: "Kern",
        title: "Wofür die Marke steht — und wofür nicht",
        body: "Erst am Ende verdichtet Klymeo zum Markenkern: „Wofür steht [Marke] — und wofür nicht?“ Belegt am Zitat.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Markenwahrnehmung · Was rauskommt",
    title: <>Das Markenbild in echten Worten.</>,
    body: "Klymeo verdichtet die Interviews zu den wiederkehrenden Assoziationen, Bildern und Gefühlen — und zeigt, welche davon die Marke tragen und welche sie bremsen. Über mehrere Studien hinweg deterministisch gezählt, je Studie mit Zitat belegt.",
    payoff: {
      strong: "Ein Markenbild, das du zitieren kannst.",
      body: "Nicht „Attribut X liegt bei Y Prozent“, sondern das Wort, das die Zielgruppe selbst gewählt hat — belegt am Interview.",
    },
    card: {
      badge: "Beispiel-Fragen · Markenwahrnehmung",
      rows: [
        {
          label: "So fragt Klymeo",
          value:
            "„Was kommt Ihnen als Erstes in den Sinn bei [Marke]?“ · „Beschreiben Sie [Marke] in einem Satz.“",
        },
        {
          label: "Was Klymeo heraushört",
          value:
            "Spontane Assoziationen, das Gefühl dahinter und den Markenkern — in den eigenen Worten, nicht in vorgegebenen Attributen.",
        },
      ],
    },
  },
  proofLead:
    "Was aus den Gesprächen wird, übernimmt dieselbe Synthese wie bei jeder Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Hör, wie deine Marke wirklich klingt.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo spontane Assoziationen zu einem belegten Markenbild verdichtet.",
  },
};

export default function MarkenwahrnehmungPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <MethodPage content={CONTENT} />
    </>
  );
}
