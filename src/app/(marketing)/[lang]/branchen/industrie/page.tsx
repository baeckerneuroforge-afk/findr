import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  localizedContent,
  localizePath,
  resolveLocale,
  toBcp47,
  type Locale,
} from "@/i18n/marketing-locale";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";

const PATH = "/branchen/industrie";
const META = {
  title: {
    de: "Market Research für die Industrie",
    en: "Market Research for Manufacturing",
  },
  ogTitle: {
    de: "Market Research für die Industrie — Klymeo",
    en: "Market Research for Manufacturing — Klymeo",
  },
  description: {
    de: "Anwender- und Kundenforschung für Industrieunternehmen: KI-Interviews auf Deutsch mit Anwendern, Einkäufern und Partnern — per Link, auf Wunsch per Voice-Agent. Belegte Antworten zu Produkt, Service und neuen Angeboten, bevor investiert wird. DSGVO-nativ.",
    en: "User and customer research for manufacturers: AI interviews in German and English with users, buyers, and partners — by link, optionally voice-led with a Voice Agent. Evidenced answers on product, service, and new offerings before you invest. GDPR-native.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  return {
    title: localizedContent(locale, META.title),
    description: localizedContent(locale, META.description),
    alternates: buildAlternates(locale, PATH),
    openGraph: {
      ...ogDefaultsFor(locale),
      title: localizedContent(locale, META.ogTitle),
      url: localizePath(locale, PATH),
    },
  };
}

function buildJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: localizedContent(locale, {
      de: "Klymeo Market Research — Industrie",
      en: "Klymeo Market Research — Manufacturing",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: IndustryContent = {
  slug: "industrie",
  eyebrow: "Branche · Industrie",
  heroTitle: <>Hör den Anwendern zu, bevor die Linie umgebaut wird.</>,
  heroSubhead:
    "Maschinen, Komponenten, Services: Industrieentscheidungen binden Kapital für Jahre — und das Wissen darüber, was Anwender wirklich brauchen, steckt in Messegesprächen und Service-Tickets. Klymeo führt strukturierte Tiefeninterviews mit Anwendern, Einkäufern und Partnern auf Deutsch, auf Wunsch hörbar per Voice-Agent — und macht daraus belegte Entscheidungsgrundlagen.",
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
    body: "Setz für jede Frage eine eigene Studie auf — Anwenderzufriedenheit, Servicequalität, Bedarf für die nächste Produktgeneration. Lade Kunden, Anwender und Partner per Link ein; das Screening-Gate sorgt dafür, dass die richtige Rolle antwortet — Bediener:in, Instandhaltung oder Einkauf. Klymeo interviewt auf Deutsch, auf Wunsch per Voice-Agent für alle, die lieber reden als tippen, und verdichtet die Gespräche zu Themen, Lagern und Originalzitaten — exportierbar als PDF oder PowerPoint für den Investitionsausschuss.",
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
    lead: "Buch eine Demo und sieh, wie Klymeo eine Industrie-Frage über mehrere Studien beantwortet — vom Anwender-O-Ton bis zum PowerPoint-Export.",
  },
};

const CONTENT_EN: IndustryContent = {
  slug: "industrie",
  eyebrow: "Industry · Manufacturing",
  heroTitle: <>Listen to your users before you retool the line.</>,
  heroSubhead:
    "Machines, components, services: manufacturing decisions tie up capital for years — and the knowledge of what users really need sits buried in trade-show chats and service tickets. Klymeo runs structured in-depth interviews with users, buyers, and partners in German and English, optionally voice-led with a Voice Agent — and turns them into an evidenced basis for decisions.",
  audience:
    "Product management, sales operations, and strategy at manufacturers — machinery, components, suppliers, industrial services.",
  pain: {
    eyebrow: "Manufacturing · The blind spot",
    title: <>The spec sheet says what was required. Not what gets in the way on the job.</>,
    problem:
      "There's a long road between what the spec sheet says and what users actually experience at the machine: feedback comes filtered through service, anecdotally from a trade show, or not at all. Asking systematically fails on effort — plant visits and interview rounds take weeks, and the product manager doesn't have them.",
    stakes: {
      strong: "What stays open as long as only the service report speaks.",
      body: "Which function gets bypassed in daily use, what really decides a repeat purchase, what customers would pay for — that stays a guess until someone asks it in a conversation. A gap, not a drama: it's just not filled yet.",
    },
    blindCard: {
      badge: "Without verbatim · just ticket data",
      rows: [
        {
          label: "What the report shows",
          value: "Few complaints, steady maintenance rate — the product seems to fit.",
        },
        {
          label: "What the report leaves open",
          value:
            "That users have long since worked around a clumsy function — and at the next investment cycle they'll trial the competitor who solved exactly that.",
        },
      ],
    },
  },
  howLead:
    "Four connected steps — from a defined user study to the number that backs every statement, per study, with a quote. By link to your customers and partners, with no plant visit and no weeks of lead time.",
  solution: {
    eyebrow: "Manufacturing · The evidenced answer",
    title: <>From trade-show hearsay to a structured voice of the user.</>,
    body: "Set up a separate study for each question — user satisfaction, service quality, the need for the next product generation. Invite customers, users, and partners by link; the screening gate makes sure the right role answers — operator, maintenance, or procurement. Klymeo interviews in German and English, optionally voice-led with a Voice Agent for everyone who'd rather talk than type, and distills the conversations into themes, camps, and verbatim quotes — exportable as PDF or PowerPoint for the investment committee.",
    payoff: {
      strong: "A number you can defend in the investment committee.",
      body: "When someone asks “how do we know that?”, you show the number — with the user's verbatim quote right beside it. Nothing extrapolated, nothing secondhand.",
    },
    answerCard: {
      badge: "Market Lens · evidenced per study",
      rows: [
        {
          label: "Question",
          value: "What decides repeat purchases among existing customers?",
        },
        {
          label: "Answer",
          value:
            "In 4 of 6 studies, price wasn't the deciding factor — spare-parts availability and service response time were, every number backed by a quote.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“The machine is top-notch — but when the line is down and the spare part takes three weeks, the best price does nothing for me.”",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Manufacturing · Before the investment",
    title: <>Validate the next product generation before it&apos;s engineered.</>,
    body: "The same study works the other way around too: before a new product line, a digital service offering, or a spare-parts subscription gets developed, you ask the users first. Show the concept as a stimulus right inside the interview — draft data sheet, control interface, service model — and let exactly the people who'll later work with it or buy it react.",
    payoff: {
      strong: "An evidenced foundation before engineering and tooling start.",
      body: "Instead of learning from complaints after the production ramp-up, you walk into the decision with a number that shows what users really need — and what they'd pay for.",
    },
    card: {
      badge: "Concept Test · before engineering",
      rows: [
        {
          label: "Question",
          value: "Will the planned service subscription land with existing customers?",
        },
        {
          label: "Answer",
          value:
            "In 3 of 5 studies, clear interest — the most common condition: response times have to be contractually guaranteed. Every number backed by a quote.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“For a guaranteed 24 hours I'll happily pay — for a better-than-nothing promise, not a cent.”",
        },
      ],
    },
  },
  proofLead:
    "Every capability works on real interviews with real users and buyers — structured, not anecdotal.",
  cta: {
    title: <>Listen to your users.</>,
    lead: "Book a demo and see how Klymeo answers a manufacturing question across several studies — from the user's verbatim to the PowerPoint export.",
  },
};

export default async function IndustriePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  return (
    <>
      <JsonLd data={buildJsonLd(locale)} />
      <IndustryPage
        content={localizedContent(lang, { de: CONTENT, en: CONTENT_EN })}
        locale={locale}
      />
    </>
  );
}
