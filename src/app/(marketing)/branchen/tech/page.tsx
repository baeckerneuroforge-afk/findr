import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/tech";
const OG_TITLE = "Market Research für Tech & Consumer Apps — findr.";
const DESCRIPTION =
  "KI-Interviews mit echten Nutzer:innen auf Deutsch — warum Nutzer abspringen oder bleiben, welches Feature wirklich fehlt, wo das Onboarding frustriert. Im Gespräch ergründet, nicht aus Analytics geraten. Je Studie belegt, deterministisch gezählt.";

export const metadata: Metadata = {
  title: "Market Research für Tech & Consumer Apps",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Market Research — Tech & Consumer Apps",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "tech",
  eyebrow: "Branche · Tech & Consumer Apps",
  heroTitle: <>Die Retention-Kurve zeigt den Absprung. Das Interview zeigt warum.</>,
  heroSubhead:
    "Warum Nutzer:innen nach dem Onboarding abspringen, welches Feature wirklich fehlt, was sie zum Bleiben bringt — deine Funnels sehen das Was, nie das Warum. findr. führt KI-Interviews mit echten Nutzer:innen auf Deutsch und macht aus der Drop-off-Kurve einen belegten Grund: je Studie verankert, deterministisch gezählt.",
  audience:
    "Product-, Growth- und Research-Teams hinter Consumer-Apps und digitalen Diensten.",
  pain: {
    eyebrow: "Tech · Der blinde Fleck",
    title: <>Ein Drop-off bei Schritt 3 ist ein Event. Keine Erklärung.</>,
    problem:
      "Dein Funnel weiß auf den Klick genau, wo Nutzer:innen abspringen — und schweigt zum Grund. War das Onboarding verwirrend, fehlte der eine Aha-Moment, war ein Pflichtfeld zu viel, oder hat eine andere App den Job schon erledigt? Session-Replays zeigen das Verhalten, nie die Absicht dahinter.",
    stakes: {
      strong: "Was die Analytics offenlassen.",
      body: "Tickets sind die lauteste Stimme, nicht die häufigste — was die Mehrheit wirklich vermisst, steht in keinem Ticket-Volumen. Eine Lücke, die erst ein Gespräch füllt.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Analytics",
      rows: [
        {
          label: "Was die Kurve zeigt",
          value: "Ein großer Teil bricht das Onboarding bei Schritt 3 ab.",
        },
        {
          label: "Was die Kurve offenlässt",
          value:
            "Ob der Schritt überfordert, das Pflichtfeld nervt — oder die Nutzer:innen schlicht nicht verstehen, was die App ihnen an dieser Stelle bringt.",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Nutzerstudie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Kein Recruiting-Dienstleister, kein Moderator, kein Wochen-Vorlauf.",
  solution: {
    eyebrow: "Tech · Die belegte Antwort",
    title: <>Vom anonymen Drop-off zur belegten Nutzerstimme.</>,
    body: "Setz eine Studie je Frage auf — Onboarding-Frust, Feature-Wunsch, Abwanderungsgrund, Wechsel zur Alternative. Über einen offenen Studien-Link starten echte Nutzer:innen selbst ein KI-Interview auf Deutsch; das Screening-Gate trennt aktive von abgesprungenen Nutzer:innen, damit du die richtige Frage der richtigen Gruppe stellst. Die Markt-Linse extrahiert Kaufabsicht, Segment und Wettbewerb — und über mehrere Studien wird deterministisch gezählt, je Studie mit Zitat belegt.",
    payoff: {
      strong: "Eine Roadmap-Entscheidung, die nicht die lauteste Stimme gewinnt.",
      body: "Fragt das Team „wollen das wirklich genug Leute?“, zeigst du die Zahl über alle Studien — und das Zitat je Studie.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Warum springen neue Nutzer:innen nach dem Onboarding ab?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 7 Studien war nicht ein fehlendes Feature der Grund, sondern ein unklarer erster Nutzen — jede mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Ich hab mich durch fünf Screens geklickt und dann nicht mehr gewusst, was die App jetzt eigentlich für mich tut — also wieder gelöscht.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Tech · Vor dem Build",
    title: <>Klär die Nachfrage, bevor das Team monatelang baut.</>,
    body: "Dieselbe Studie greift schon vor der ersten Zeile Code: bevor ein Feature auf die Roadmap wandert, fragst du, ob es wirklich gewünscht ist und was stattdessen fehlt. Echte Nutzer:innen starten über einen offenen Link selbst ein KI-Interview auf Deutsch; das Screening trennt die Zielgruppe vom Rest. Die Markt-Linse liest Kaufabsicht, Zahlungsbereitschaft und Segment heraus — über mehrere Studien deterministisch gezählt, sodass die Priorität aus der Häufigkeit kommt, nicht aus der lautesten Stimme im Backlog.",
    payoff: {
      strong: "Belegte Priorität, bevor du Wochen in den Build steckst.",
      body: "Statt erst an der Retention-Kurve zu sehen, dass ein Feature kaum jemand wollte, weißt du vorher, wie viele es wirklich brauchen — und welches Problem es lösen soll.",
    },
    card: {
      badge: "Feature-Test · vor dem Build",
      rows: [
        {
          label: "Frage",
          value: "Lohnt sich das geplante Feature — oder fehlt etwas anderes mehr?",
        },
        {
          label: "Antwort",
          value:
            "In 2 von 5 Studien war das geplante Feature zweitrangig — zuerst gefragt war ein einfacherer Einstieg, jede mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Ehrlich, das neue Feature bräuchte ich selten — was mich wirklich nervt, ist dass ich beim Start jedes Mal von vorn anfange.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Nutzer:innen — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Die Kurve zeigt den Absprung. findr. den Grund.</>,
    lead: "Buch eine Demo und sieh, wie findr. eine Nutzerfrage über mehrere Studien beantwortet — deterministisch gezählt, je Studie belegt.",
  },
};

export default function TechPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={CONTENT} />
    </>
  );
}
