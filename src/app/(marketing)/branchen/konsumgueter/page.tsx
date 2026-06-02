import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/konsumgueter";
const OG_TITLE = "Market Research für Konsumgüter — findr.";
const DESCRIPTION =
  "KI-Interviews mit echten Verbraucher:innen auf Deutsch — Rezeptur, Verpackung und Markenwahrnehmung belegt prüfen, bevor die Produktion läuft. Je Studie verankert, deterministisch gezählt, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Market Research für Konsumgüter",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research — Konsumgüter",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "konsumgueter",
  eyebrow: "Branche · Konsumgüter",
  heroTitle: <>Frag die Käufer, bevor das Regal antwortet.</>,
  heroSubhead:
    "Rezeptur, Verpackung, Markenversprechen — die teuren Entscheidungen fallen lange vor dem Abverkauf. findr. führt KI-Interviews mit echten Verbraucher:innen auf Deutsch und macht aus „den meisten schmeckt’s“ eine belegte Zahl: je Studie verankert, deterministisch gezählt, nichts hochgerechnet.",
  audience:
    "Marken-, Insights- und Innovationsteams in der Konsumgüterindustrie — Lebensmittel, Getränke, Markenartikel.",
  pain: {
    eyebrow: "Konsumgüter · Der blinde Fleck",
    title: <>Abverkaufszahlen sagen dir, dass etwas floppt. Nicht warum.</>,
    problem:
      "Panels sind langsam und teuer, Fokusgruppen verzerren durch die lauteste Stimme im Raum, und Abverkaufsdaten melden den Misserfolg erst, wenn die Charge längst produziert ist. Warum eine neue Rezeptur im Regal liegen bleibt — zu süß, falsche Portionsgröße, eine Verpackung, die billiger wirkt als das Versprechen — steht in keinem Dashboard.",
    stakes: {
      strong: "Was ein Fehlstart kostet.",
      body: "Verlorene Listung, abgeschriebene Produktion, beschädigtes Vertrauen beim Handel. Ein belegtes Nein vor dem Launch ist günstiger als ein stiller Misserfolg danach.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Abverkauf",
      rows: [
        {
          label: "Was die Zahl zeigt",
          value: "Neue Rezeptur: Wiederkaufrate liegt deutlich unter der alten Variante.",
        },
        {
          label: "Was die Zahl verschweigt",
          value:
            "Warum. Liegt es am Geschmack, am Preis, an der neuen Verpackung — oder daran, dass Stammkäufer:innen das gewohnte Produkt im Regal nicht mehr finden?",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Verbraucher-Studie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Kein Panel-Dienstleister, kein Moderator, keine Wochen Vorlauf.",
  solution: {
    eyebrow: "Konsumgüter · Die belegte Antwort",
    title: <>Vom Bauchgefühl im Tasting-Raum zur belegten Verbraucherstimme.</>,
    body: "Setz für jede Frage eine eigene Studie auf — Rezeptur-Test, Packaging-Vergleich, Markenwahrnehmung. Das Screening-Gate stellt sicher, dass nur die richtige Zielgruppe ins Interview kommt: Käufer:innen der Kategorie, nicht zufällige Klicks. findr. interviewt auf Deutsch und trennt mit der Markt-Linse Preis-Signal, Kaufabsicht, Segment und Wettbewerb — und über mehrere Studien hinweg wird deterministisch gezählt, je Studie mit Zitat belegt.",
    payoff: {
      strong: "Eine Zahl, die du im Innovationsboard verteidigst.",
      body: "Fragt jemand „wie viele sagen das wirklich?“, zeigst du die Zahl — und das Zitat aus der jeweiligen Studie daneben. Nichts hochgerechnet.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Was hält Stammkäufer:innen von der neuen Rezeptur ab?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 6 Verbraucher-Studien nannten Teilnehmer:innen die süßere Note als Grund zum Wechsel — jede mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Das war früher mein Feierabend-Riegel — die neue Version ist mir ehrlich zu süß, ich greif jetzt zum No-Name daneben.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Verbraucher:innen — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Frag die Käufer, bevor die Charge läuft.</>,
    lead: "Buch eine Demo und sieh, wie findr. eine Verbraucherfrage über mehrere Studien beantwortet — deterministisch gezählt, je Studie belegt.",
  },
};

export default function KonsumgueterPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={CONTENT} />
    </>
  );
}
