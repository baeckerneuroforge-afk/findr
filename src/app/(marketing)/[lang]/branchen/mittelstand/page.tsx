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

const PATH = "/branchen/mittelstand";
const META = {
  title: {
    de: "Market Research für den Mittelstand",
    en: "Market Research for the Mid-Market",
  },
  ogTitle: {
    de: "Market Research für den Mittelstand — Klymeo",
    en: "Market Research for the Mid-Market — Klymeo",
  },
  description: {
    de: "Qualitative Marktforschung ohne Institutsbudget: KI-Interviews mit deinen Kunden und Zielgruppen auf Deutsch — auf Wunsch per Voice-Agent. Belegte Antworten statt Bauchgefühl, exportiert als PDF oder PowerPoint, DSGVO-nativ in Frankfurt.",
    en: "Qualitative market research without an agency-scale budget: AI interviews with your customers and target audiences in German and English — optionally via Voice Agent. Evidenced answers instead of gut feeling, exported as PDF or PowerPoint, GDPR-native in Frankfurt.",
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
      de: "Klymeo Market Research — Mittelstand",
      en: "Klymeo Market Research — Mid-Market",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: IndustryContent = {
  slug: "mittelstand",
  eyebrow: "Branche · Mittelstand",
  heroTitle: <>Frag deinen Markt — ohne ein Institut zu beauftragen.</>,
  heroSubhead:
    "Im Mittelstand fallen Produkt-, Preis- und Markenentscheidungen oft aus Erfahrung, weil klassische Marktforschung Wochen dauert und schnell fünfstellig kostet. Klymeo führt die Tiefeninterviews selbst — KI-geführt, auf Deutsch, auf Wunsch hörbar per Voice-Agent — und macht aus „das sagt der Vertrieb“ eine Antwort, die je Studie am Gespräch belegt ist.",
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
    body: "Setz für jede Frage eine eigene Studie auf — Preiswahrnehmung, neues Angebot, Markenbild. Lade deine eigenen Kunden per Link ein oder rekrutiere über Panel-Anbindung und Screening genau die Zielgruppe, die du brauchst. Klymeo interviewt auf Deutsch, auf Wunsch per Voice-Agent, und verdichtet alles zu Themen, Lagern und Originalzitaten — exportierbar als PDF-Report oder PowerPoint-Deck für die nächste Geschäftsführungsrunde.",
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
    lead: "Buch eine Demo und sieh, wie Klymeo eine Mittelstands-Frage über mehrere Studien beantwortet — belegt, exportierbar, ohne Institut.",
  },
};

const CONTENT_EN: IndustryContent = {
  slug: "mittelstand",
  eyebrow: "Industry · Mid-Market",
  heroTitle: <>Ask your market — without commissioning an agency.</>,
  heroSubhead:
    "In the mid-market, product, pricing, and brand decisions are often made from experience, because classic market research takes weeks and quickly runs into five figures. Klymeo runs the in-depth interviews itself — AI-led, in German and English, optionally audible via Voice Agent — and turns “that's what sales says” into an answer that's evidenced in the conversation, study by study.",
  audience:
    "Leadership, marketing, and product owners in the mid-market — from manufacturers to retailers to service providers.",
  pain: {
    eyebrow: "Mid-Market · The blind spot",
    title: <>“The customer wants it this way” — says who, exactly?</>,
    problem:
      "What the market really thinks usually arrives filtered in the mid-market: through sales, through a few loud customers, through the last conversation at a trade show. Commissioning an agency for every question is unrealistic — so experience fills the gap. It's valuable, but it isn't evidenced, and with new audiences or new offers it doesn't hold.",
    stakes: {
      strong: "What stays open as long as no one asks systematically.",
      body: "Whether the price is the problem or findability, whether the new offer is understood, where prospects drop off — that stays a guess until someone asks it in conversation. A gap, not a drama: it's just not filled yet.",
    },
    blindCard: {
      badge: "Without verbatim · just hearsay",
      rows: [
        {
          label: "What's on the table",
          value: "“Sales says we're too expensive.”",
        },
        {
          label: "What stays open",
          value:
            "Whether it really is the price — or the value proposition, comparability with the competition, or simply that the offer isn't understood.",
        },
      ],
    },
  },
  howLead:
    "Four connected steps — from a defined study to the number that backs every statement, per study, with a quote. No agency, no moderator, no weeks of lead time — at a fraction of the cost.",
  solution: {
    eyebrow: "Mid-Market · The evidenced answer",
    title: <>From sales-floor hearsay to an evidenced voice of the market.</>,
    body: "Set up a separate study for each question — price perception, a new offer, brand image. Invite your own customers by link or recruit exactly the audience you need through panel integration and screening. Klymeo interviews in German and English, optionally via Voice Agent, and distills everything into themes, camps, and verbatim quotes — exportable as a PDF report or a PowerPoint deck for the next leadership meeting.",
    payoff: {
      strong: "A number you can defend in front of leadership.",
      body: "If someone asks “how do we know that?”, you show the number — with the verbatim quote from the relevant study beside it. Nothing extrapolated, nothing assumed.",
    },
    answerCard: {
      badge: "Market Lens · evidenced per study",
      rows: [
        {
          label: "Question",
          value: "Why do prospects decide against our offer?",
        },
        {
          label: "Answer",
          value:
            "In 3 of 5 studies the obstacle wasn't price but comparability — prospects couldn't name the difference from the cheaper competitor. Every number backed by a quote.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“More expensive would have been fine — I just never understood, right to the end, what I'd get more of for it.”",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "Mid-Market · Before you invest",
    title: <>Test the market before you invest.</>,
    body: "The same study works the other way around too: don't only dig in once something's stuck — ask beforehand whether the idea holds. A new product, a new market, a rebrand — set up a concept study, show the draft as a stimulus right inside the interview, and let your audience respond before budget and capacity are committed.",
    payoff: {
      strong: "An evidenced basis for the go or no-go — before you invest.",
      body: "Instead of learning from revenue after the launch, you walk into the decision with a number that shows how many the idea really convinces — and what makes the others hesitate.",
    },
    card: {
      badge: "Concept Test · before the decision",
      rows: [
        {
          label: "Question",
          value: "Does the new service offer land with existing customers?",
        },
        {
          label: "Answer",
          value:
            "In 4 of 6 concept studies, clear interest — the most frequently named hurdle: the contract commitment. Every number backed by a quote from the relevant study.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“The package sounds reasonable — but I won't sign a two-year commitment, I haven't known you long enough for that.”",
        },
      ],
    },
  },
  proofLead:
    "Every capability works on real interviews with real people — built so that market research works even without an insights department.",
  cta: {
    title: <>Listen to your market — starting this week.</>,
    lead: "Book a demo and see how Klymeo answers a mid-market question across several studies — evidenced, exportable, no agency.",
  },
};

export default async function MittelstandPage({
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
