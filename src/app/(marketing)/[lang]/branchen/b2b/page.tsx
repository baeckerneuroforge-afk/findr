import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { localizedContent, resolveLocale } from "@/i18n/marketing-locale";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/b2b";
const OG_TITLE = "Market Research für B2B — Klymeo";
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
  name: "Klymeo Market Research — B2B",
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
    "Im B2B entscheidet selten eine Person: Fachbereich, Einkauf, Geschäftsführung — jede Rolle hat eigene Gründe, und die wenigsten landen ungefiltert bei dir. Klymeo führt strukturierte Tiefeninterviews mit deinen Zielgruppen auf Deutsch, per Link direkt in deine Kontakte, auf Wunsch hörbar per Voice-Agent — und verdichtet die Gespräche zu belegten Antworten.",
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
    body: "Setz für jede Frage eine eigene Studie auf — Bedarfsanalyse, Positionierungs-Check, Angebotsverständnis. Lade Kunden, Beinahe-Kunden und Zielkontakte per Link ein; das Screening-Gate stellt sicher, dass die richtige Rolle antwortet — Anwender:in, Fachentscheider:in oder Einkauf. Klymeo führt das Tiefeninterview auf Deutsch, auf Wunsch per Voice-Agent für Gesprächspartner, die lieber reden als tippen, und verdichtet alles zu Themen, Lagern und Originalzitaten.",
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
    lead: "Buch eine Demo und sieh, wie Klymeo eine B2B-Frage über mehrere Studien beantwortet — Rolle für Rolle, je Studie belegt.",
  },
};

const CONTENT_EN: IndustryContent = {
  slug: "b2b",
  eyebrow: "Industry · B2B",
  heroTitle: <>Listen to the whole buying center — not just the loudest voice.</>,
  heroSubhead:
    "In B2B, one person rarely decides: the business unit, procurement, leadership — every role has its own reasons, and few of them reach you unfiltered. Klymeo runs structured in-depth interviews with your target audiences in German and English, by link straight into your contacts, optionally voice-led with a Voice Agent — and distills the conversations into evidenced answers.",
  audience:
    "Marketing, product, and strategy leads at B2B companies — software, services, manufacturing, wholesale.",
  pain: {
    eyebrow: "B2B · The blind spot",
    title: <>Few deals, long cycles — and every explanation is an anecdote.</>,
    problem:
      "B2B markets yield few data points: a handful of deals per quarter, long decision cycles, and feedback that arrives as a single opinion — from the last meeting, the loudest customer, secondhand. Traditional surveys barely reach business decision-makers, and when they do, respondents tick scales instead of explaining how their decision really came about.",
    stakes: {
      strong: "What stays open until someone asks in a structured way.",
      body: "Which role in the buying center is really holding things back, how vendors get compared, what makes an offer easy to understand — that stays guesswork until someone asks it in an in-depth interview. A gap, not a drama: it's just not filled yet.",
    },
    blindCard: {
      badge: "Without verbatim · just a single opinion",
      rows: [
        {
          label: "What's on the table",
          value: "“The business unit wanted us, but procurement killed it.”",
        },
        {
          label: "What stays open",
          value:
            "Whether it really was procurement — or a competing bid, a missing reference case, or a requirement the proposal simply never answered.",
        },
      ],
    },
  },
  howLead:
    "Four connected steps — from a defined audience study to the number that backs every statement, per study, with a quote. By link into your own contacts, with screening for the right role in the buying center.",
  solution: {
    eyebrow: "B2B · The evidenced answer",
    title: <>From anecdotal feedback to a structured voice of the market.</>,
    body: "Set up a separate study for each question — needs analysis, positioning check, offer comprehension. Invite customers, near-misses, and target contacts by link; the screening gate makes sure the right role answers — user, business decision-maker, or procurement. Klymeo runs the in-depth interview in German and English, optionally voice-led with a Voice Agent for people who'd rather talk than type, and distills everything into themes, camps, and verbatim quotes.",
    payoff: {
      strong: "A number you can defend in the strategy meeting.",
      body: "When someone asks “how do we know that?”, you show the number — with the verbatim quote from that role right beside it. Nothing extrapolated, nothing secondhand.",
    },
    answerCard: {
      badge: "Market Lens · evidenced per study",
      rows: [
        {
          label: "Question",
          value: "Where does our offer fall short with business decision-makers?",
        },
        {
          label: "Answer",
          value:
            "In 3 of 5 studies, what was missing wasn't feature scope but a reference case from their own industry — every number backed by a quote from the relevant study.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“The product won us over — but without a case from our industry, I can't get it approved internally.”",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "B2B · Before market entry",
    title: <>Validate your offer and positioning before sales rolls out.</>,
    body: "The same study works the other way around too: before a new offer, a new segment, or new pricing logic hits the market, you ask the target roles first. Show the offer concept or the new value argument as a stimulus right inside the interview — business decision-makers react to exactly the material your sales team will work with later.",
    payoff: {
      strong: "An evidenced foundation before sales time gets committed.",
      body: "Instead of testing the positioning in the market, you walk into the decision with a number that shows which arguments land — and which objections your sales team will hear, before they hear them.",
    },
    card: {
      badge: "Concept Test · before the rollout",
      rows: [
        {
          label: "Question",
          value: "Does the audience understand the new service package?",
        },
        {
          label: "Answer",
          value:
            "In 4 of 6 studies the added value came across — the most common follow-up question was about how the packages differ. Every number backed by a quote.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“I get the value right away — I'm just not sure why I'd take the middle package when the small one does almost the same.”",
        },
      ],
    },
  },
  proofLead:
    "Every capability works on real interviews with real decision-makers and users — structured, not anecdotal.",
  cta: {
    title: <>Listen to your buying center.</>,
    lead: "Book a demo and see how Klymeo answers a B2B question across several studies — role by role, evidenced per study.",
  },
};

export default async function B2bPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage
        content={localizedContent(lang, { de: CONTENT, en: CONTENT_EN })}
        locale={resolveLocale(lang)}
      />
    </>
  );
}
