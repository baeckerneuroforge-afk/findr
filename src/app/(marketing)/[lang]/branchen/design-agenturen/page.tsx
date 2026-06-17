import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { localizedContent } from "@/i18n/marketing-locale";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/design-agenturen";
const OG_TITLE = "Market Research für Design & Agenturen — Klymeo";
const DESCRIPTION =
  "Konzept- und Creative-Tests mit echten Zielgruppen: Entwürfe, Key-Visuals und Kampagnen als Stimulus direkt im KI-Interview zeigen — Feedback in Tagen statt Wochen, mit Originalzitaten fürs Kunden-Deck und Export als PDF oder PowerPoint im eigenen Branding.";

export const metadata: Metadata = {
  title: "Market Research für Design & Agenturen",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klymeo Market Research — Design & Agenturen",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "design-agenturen",
  eyebrow: "Branche · Design & Agenturen",
  heroTitle: <>Zeig den Entwurf der Zielgruppe — bevor ihn der Kunde sieht.</>,
  heroSubhead:
    "Key-Visual, Claim, Packaging, Landingpage: Irgendwann fragt der Kunde, woher ihr wisst, dass es funktioniert. Klymeo zeigt deine Entwürfe als Stimulus direkt im KI-Interview — echte Menschen aus der Zielgruppe reagieren, vergleichen und sagen in eigenen Worten, was hängen bleibt. Feedback in Tagen, mit Zitaten, die du ins Deck nimmst.",
  audience:
    "Design-Studios, Marken- und Werbeagenturen, Inhouse-Kreation — alle, die Entwürfe verkaufen müssen, nicht nur gestalten.",
  pain: {
    eyebrow: "Design & Agenturen · Der blinde Fleck",
    title: <>Im Review gewinnt der Geschmack der ranghöchsten Person. Nicht der Markt.</>,
    problem:
      "Kreativentscheidungen fallen in Reviews, in denen niemand aus der Zielgruppe sitzt. Das Bauchgefühl ist trainiert, aber es ist nicht belegt — und wenn der Kunde fragt „funktioniert das auch bei unseren Käufern?“, steht Aussage gegen Aussage. Klassische Pretests sind teuer, dauern Wochen und kommen für die meisten Etats schlicht nicht infrage.",
    stakes: {
      strong: "Was offen bleibt, solange nur intern reviewt wird.",
      body: "Ob die Botschaft in drei Sekunden ankommt, ob das Visual die Marke trägt, ob der Claim verstanden oder nur gemocht wird — das bleibt Geschmacksurteil, bis es die Zielgruppe selbst gesehen hat. Eine Lücke, kein Drama: sie ist nur noch nicht gefüllt.",
    },
    blindCard: {
      badge: "Ohne Test · nur Geschmack",
      rows: [
        {
          label: "Was im Review steht",
          value: "„Variante B wirkt frischer — nehmen wir die.“",
        },
        {
          label: "Was offen bleibt",
          value:
            "Ob die Zielgruppe in Variante B die Botschaft erkennt — oder nur eine hübsche Fläche sieht und die Marke dahinter nicht zuordnen kann.",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — vom hochgeladenen Entwurf bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Schnell genug für laufende Projekte: aufsetzen heute, Ergebnisse diese Woche.",
  solution: {
    eyebrow: "Design & Agenturen · Die belegte Antwort",
    title: <>Vom Geschmacksurteil zum belegten Creative-Feedback.</>,
    body: "Lade den Entwurf als Stimulus in die Studie — Key-Visual, Packaging, Anzeige oder Landingpage — und lass echte Menschen aus der Zielgruppe im KI-Interview darauf reagieren: Ersteindruck, Verständnis, Markenpassung, Kaufimpuls. Der Creative-Test fragt nach drei Sekunden Sichtkontakt, was hängen geblieben ist; der Konzept-Test prüft, ob die Idee in eigenen Worten erklärt werden kann. Am Ende: Themen, Lager und Originalzitate — exportiert als PDF oder PowerPoint im eigenen Branding, fertig fürs Kunden-Meeting.",
    payoff: {
      strong: "Ein Deck, das den Entwurf verteidigt — mit der Stimme der Zielgruppe.",
      body: "Statt „uns gefällt B besser“ zeigst du, wie viele die Botschaft in B verstanden haben — und das Zitat daneben. Aus Meinung wird Empfehlung.",
    },
    answerCard: {
      badge: "Creative-Test · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Welche der zwei Kampagnen-Routen trägt die Botschaft?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 4 Studien wurde Route A nach drei Sekunden korrekt wiedergegeben — Route B wurde als „schön, aber austauschbar“ gelesen. Jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Bei der ersten wusste ich sofort, worum’s geht — die zweite könnte auch Werbung für irgendwas anderes sein.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Design & Agenturen · Vor dem Pitch",
    title: <>Geh mit getesteten Routen in den Pitch.</>,
    body: "Dieselbe Studie funktioniert auch vor dem Kundentermin: Test zwei, drei Routen gegeneinander, bevor du präsentierst. Die Zielgruppe sieht jeden Entwurf als Stimulus im Interview, der Voice-Agent führt das Gespräch hörbar — und du gehst mit einer Empfehlung in den Raum, die nicht auf Agentur-Bauchgefühl steht, sondern auf Gesprächen mit genau den Menschen, die der Kunde erreichen will.",
    payoff: {
      strong: "Ein Pitch-Argument, das kein Mitbewerber hat.",
      body: "„Wir haben beide Routen mit Ihrer Zielgruppe getestet — Route A wurde verstanden, Route B nicht. Hier sind die Stimmen.“ Das gewinnt Termine.",
    },
    card: {
      badge: "Stimulus-Test · vor dem Termin",
      rows: [
        {
          label: "Frage",
          value: "Welche Claim-Variante bleibt nach drei Sekunden hängen?",
        },
        {
          label: "Antwort",
          value:
            "In 2 von 3 Studien wurde Claim-Variante „kurz“ wortnah erinnert — die lange Variante wurde sinngemäß, aber ohne Markenbezug wiedergegeben. Jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Den kurzen Satz kann ich dir jetzt noch sagen — beim langen weiß ich nur noch, dass es um Nachhaltigkeit ging.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Menschen — gebaut für Teams, die Kreation verkaufen müssen.",
  cta: {
    title: <>Test den Entwurf, bevor ihn der Kunde testet.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo zwei Kreativ-Routen gegeneinander testet — mit Stimulus im Interview und Zitaten fürs Deck.",
  },
};

export default async function DesignAgenturenPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage content={localizedContent(lang, { de: CONTENT })} />
    </>
  );
}
