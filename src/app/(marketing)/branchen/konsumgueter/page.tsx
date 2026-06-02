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
    title: <>Abverkaufszahlen zeigen, dass eine Variante liegen bleibt. Nicht, warum.</>,
    problem:
      "Panels sind langsam und teuer, Fokusgruppen verzerren durch die lauteste Stimme im Raum, und Abverkaufsdaten zeigen erst, dass eine neue Rezeptur liegen bleibt, wenn die Charge längst produziert ist. Warum sie im Regal stehen bleibt — zu süß, falsche Portionsgröße, eine Verpackung, die billiger wirkt als das Versprechen — steht in keinem Dashboard.",
    stakes: {
      strong: "Was offen bleibt, solange nur der Abverkauf spricht.",
      body: "Ob die Portionsgröße passt, ob die Verpackung das Versprechen trägt, ob der Preis sitzt — das bleibt unbelegt, bis du die Käufer:innen selbst fragst. Eine Lücke, kein Drama: sie ist nur noch nicht gefüllt.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Abverkauf",
      rows: [
        {
          label: "Was die Zahl zeigt",
          value: "Neue Rezeptur: Wiederkaufrate liegt unter der gewohnten Variante.",
        },
        {
          label: "Was die Zahl offenlässt",
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
  proactive: {
    eyebrow: "Konsumgüter · Vor dem Launch",
    title: <>Prüf die Idee, bevor die erste Charge läuft.</>,
    body: "Dieselbe Studie funktioniert auch andersherum: nicht erst deuten, was der Abverkauf meldet, sondern vorher fragen, ob das Konzept trägt. Setz für einen Rezeptur-Entwurf, ein Verpackungsmuster oder ein neues Markenversprechen eine eigene Studie an und lass echte Käufer:innen deiner Kategorie im KI-Interview auf Deutsch antworten — bevor Produktion, Listung und Mediabudget gebunden sind. Die Markt-Linse liest Kaufabsicht, Preisbereitschaft und Segment heraus, über mehrere Konzept-Studien hinweg deterministisch gezählt.",
    payoff: {
      strong: "Eine belegte Grundlage fürs Go oder No-Go — vor dem Produktionslauf.",
      body: "Statt nach dem Launch aus Abverkaufszahlen zu lernen, gehst du mit einer Zahl ins Innovationsboard, die zeigt, wie viele die Idee wirklich kaufen würden — und woran die anderen zögern.",
    },
    card: {
      badge: "Konzept-Test · vor der Produktion",
      rows: [
        {
          label: "Frage",
          value: "Würden Stammkäufer:innen die neue Rezeptur-Idee kaufen?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 4 Konzept-Studien klares Kaufinteresse — zwei nannten die kleinere Packung als Hürde, jede mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Die Richtung gefällt mir total — nur die Packung wirkt mir fürs Geld zu klein, da würde ich beim großen Klassiker bleiben.“",
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
