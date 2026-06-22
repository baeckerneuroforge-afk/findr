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
  UseCasePage,
  type UseCaseContent,
} from "@/components/marketing/use-case-template";
import {
  MicIcon,
  RadarIcon,
  ImageIcon,
  CheckIcon,
  LayersIcon,
  ShieldCheckIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";

const PATH = "/loesungen/user-research";
const META = {
  title: {
    de: "User Research mit KI — Discovery-Interviews, DSGVO-nativ",
    en: "User Research with AI — discovery interviews, GDPR-native",
  },
  ogTitle: {
    de: "User Research mit KI — Klymeo",
    en: "User Research with AI — Klymeo",
  },
  description: {
    de: "User Research auf derselben KI-Engine: Klymeo führt qualitative Discovery-Interviews, bohrt pro Thema in mehreren Schichten nach und verdichtet die Gespräche zu Bedürfnissen, Jobs-to-be-Done und echten Workarounds — jede Aussage am Originalzitat belegt. Auf Deutsch und Englisch, DSGVO-nativ in Frankfurt.",
    en: "User research on the same AI engine: Klymeo runs qualitative discovery interviews, probes in several layers per theme, and distills the conversations into needs, jobs-to-be-done and real workarounds — every statement backed by a verbatim quote. In German and English, GDPR-native in Frankfurt.",
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
      de: "Klymeo — User Research mit KI",
      en: "Klymeo — User Research with AI",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: UseCaseContent = {
  slug: "user-research",
  eyebrow: "Anwendungsfall · User Research",
  heroTitle: <>Versteh deine Nutzer:innen, bevor du baust.</>,
  heroSubhead:
    "User Research läuft auf derselben Engine wie unsere Marktforschung: Klymeo führt qualitative Discovery-Interviews, bohrt pro Thema in mehreren Schichten nach wie ein erfahrener Researcher und verdichtet die Gespräche zu Bedürfnissen, Jobs-to-be-Done und echten Workarounds — jede Aussage am Originalzitat belegt.",
  audience:
    "Produkt-, Discovery- und Insights-Teams, die wissen wollen, warum Menschen handeln, wie sie handeln — bevor eine Lösung gebaut wird.",
  how: {
    eyebrow: "So funktioniert User Research",
    title: <>Vom Gespräch zur belegten Erkenntnis.</>,
    lead: "Vier verbundene Schritte — von der Forschungsfrage bis zur Aussage, die jedes Muster mit einem Zitat belegt. Rekrutiert über Link, eigenen Pool oder Panel, ohne Moderator.",
    steps: [
      {
        phase: "Aufsetzen",
        title: "Forschungsfrage, Screening & Quoten definieren",
        body: "Leg pro Frage eine eigene Interview-Studie an, setz ein Screening-Gate und Quoten davor — nur die passenden Nutzer:innen kommen ins Interview, der Rest wird sauber und DSGVO-konform abgewiesen.",
        tag: "Live",
      },
      {
        phase: "Einsammeln",
        title: "Offener Link, eigener Pool oder Panel",
        body: "Teil einen offenen Studien-Link, lade deinen eigenen Teilnehmer-Pool ein oder rekrutiere über die Panel-Anbindung. Das KI-Interview läuft auf Deutsch und Englisch, auf Wunsch hörbar vom Voice-Agent geführt.",
        tag: "Live",
      },
      {
        phase: "Verstehen",
        title: "Bedürfnisse, Jobs-to-be-Done & Workarounds",
        body: "Aus jedem Gespräch werden Themen und Lager verdichtet — was Menschen wirklich brauchen, wie sie sich heute behelfen und woran sie hängenbleiben. Jede Aussage ist am Originalzitat im Transkript verankert.",
        tag: "Live",
      },
      {
        phase: "Vergleichen",
        title: "Über Studien hinweg, exakt gezählt",
        body: "Frag über alle Studien hinweg. Klymeo zählt deterministisch und belegt jede Aussage mit einem Zitat aus der jeweiligen Studie — keine erfundenen Muster.",
        tag: "Live",
      },
    ],
  },
  proof: {
    eyebrow: "Belegt, nicht geraten",
    title: <>Was User Research konkret liefert.</>,
    lead: "Jede Fähigkeit arbeitet an echten Gesprächen mit echten Menschen — vom Voice-Interview bis zum teilbaren Ergebnis.",
    points: [
      {
        title: "KI-Tiefeninterviews — auch per Voice",
        body: "Strukturierte Discovery-Interviews in echter Gesprächssprache. Auf Wunsch führt der Voice-Agent das Gespräch hörbar — Teilnehmer:innen sprechen einfach, das Transkript bleibt die Quelle.",
        Icon: MicIcon,
        tag: "Live",
      },
      {
        title: "Nachbohren in mehreren Schichten",
        body: "Die KI fragt nach wie ein erfahrener Researcher — bis hinter die erste Antwort. Wie tief sie pro Thema bohrt, stellst du selbst ein.",
        Icon: RadarIcon,
        tag: "Live",
      },
      {
        title: "Stimulus: Entwürfe live zeigen",
        body: "Zeig Konzepte, Screens oder Entwürfe direkt im Interview — Teilnehmer:innen nehmen Bezug auf genau das Material, das du verstehen willst.",
        Icon: ImageIcon,
        tag: "Live",
      },
      {
        title: "Screening-Gate & Quoten",
        body: "Qualifizier Teilnehmer:innen vor dem Interview und steuer die Stichprobe — die richtige Zielgruppe kommt rein, der Rest wird sauber und DSGVO-konform abgewiesen.",
        Icon: CheckIcon,
        tag: "Live",
      },
      {
        title: "Belegte Synthese — Themen, Lager, Zitate",
        body: "Aus jedem Interview werden Themen, Lager und Originalzitate; über mehrere Studien hinweg wird deterministisch gezählt und je Studie belegt. Export als PDF & PowerPoint, plus teilbare Ergebnis-Links.",
        Icon: LayersIcon,
        tag: "Live",
      },
      {
        title: "DSGVO-nativ, in Frankfurt gehostet",
        body: "Auf Deutsch und Englisch, in der EU gehostet, keine US-Cloud — die Stimmen deiner Nutzer:innen verlassen die EU nicht.",
        Icon: ShieldCheckIcon,
        tag: "Live",
      },
    ],
  },
  cta: {
    title: <>Versteh deine Nutzer:innen — am O-Ton belegt.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo aus echten Gesprächen Bedürfnisse und Jobs-to-be-Done herausarbeitet — jede Aussage am Zitat belegt.",
  },
};

const CONTENT_EN: UseCaseContent = {
  slug: "user-research",
  eyebrow: "Use case · User Research",
  heroTitle: <>Understand your users before you build.</>,
  heroSubhead:
    "User research runs on the same engine as our market research: Klymeo conducts qualitative discovery interviews, probes in several layers per theme like an experienced researcher, and distills the conversations into needs, jobs-to-be-done and real workarounds — every statement backed by a verbatim quote.",
  audience:
    "Product, discovery and insights teams who want to know why people behave the way they do — before a solution is built.",
  how: {
    eyebrow: "How User Research works",
    title: <>From conversation to evidenced finding.</>,
    lead: "Four connected steps — from the research question to the statement that backs every pattern with a quote. Recruited by link, your own pool or a panel, with no moderator.",
    steps: [
      {
        phase: "Set up",
        title: "Define the research question, screening & quotas",
        body: "Set up a separate interview study per question, with a screening gate and quotas in front — only the right users enter the interview, the rest is turned away cleanly and GDPR-compliantly.",
        tag: "Live",
      },
      {
        phase: "Collect",
        title: "Open link, your own pool or panel",
        body: "Share an open study link, invite your own participant pool or recruit through the panel integration. The AI interview runs in German and English, optionally led audibly by the Voice Agent.",
        tag: "Live",
      },
      {
        phase: "Understand",
        title: "Needs, jobs-to-be-done & workarounds",
        body: "Every conversation is distilled into themes and camps — what people actually need, how they cope today and where they get stuck. Every statement is anchored to a verbatim quote in the transcript.",
        tag: "Live",
      },
      {
        phase: "Compare",
        title: "Across studies, exactly counted",
        body: "Ask across all studies. Klymeo counts deterministically and backs every statement with a quote from the respective study — no invented patterns.",
        tag: "Live",
      },
    ],
  },
  proof: {
    eyebrow: "Evidenced, not guessed",
    title: <>What User Research delivers, concretely.</>,
    lead: "Every capability works on real conversations with real people — from the voice interview to the shareable result.",
    points: [
      {
        title: "AI in-depth interviews — also by voice",
        body: "Structured discovery interviews in natural spoken language. On request the Voice Agent leads the conversation audibly — participants simply speak, the transcript stays the source.",
        Icon: MicIcon,
        tag: "Live",
      },
      {
        title: "Probing in several layers",
        body: "The AI follows up like an experienced researcher — past the first answer. How deep it probes per theme is yours to set.",
        Icon: RadarIcon,
        tag: "Live",
      },
      {
        title: "Stimulus: show drafts live",
        body: "Show concepts, screens or drafts right inside the interview — participants respond to exactly the material you want to understand.",
        Icon: ImageIcon,
        tag: "Live",
      },
      {
        title: "Screening gate & quotas",
        body: "Qualify participants before the interview and steer the sample — the right audience gets in, the rest is turned away cleanly and GDPR-compliantly.",
        Icon: CheckIcon,
        tag: "Live",
      },
      {
        title: "Evidenced synthesis — themes, camps, quotes",
        body: "Every interview becomes themes, camps and verbatim quotes; across studies it is counted deterministically and evidenced per study. Export as PDF & PowerPoint, plus shareable result links.",
        Icon: LayersIcon,
        tag: "Live",
      },
      {
        title: "GDPR-native, hosted in Frankfurt",
        body: "In German and English, hosted in the EU, no US cloud — your users' voices never leave the EU.",
        Icon: ShieldCheckIcon,
        tag: "Live",
      },
    ],
  },
  cta: {
    title: <>Understand your users — backed by their own words.</>,
    lead: "Book a demo and see how Klymeo surfaces needs and jobs-to-be-done from real conversations — every statement backed by a quote.",
  },
};

export default async function UserResearchPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  return (
    <>
      <JsonLd data={buildJsonLd(locale)} />
      <UseCasePage
        content={localizedContent(lang, { de: CONTENT, en: CONTENT_EN })}
        locale={locale}
      />
    </>
  );
}
