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
  getMrSteps,
  getMrProofs,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";

const PATH = "/loesungen/marktforschung";
const META = {
  title: {
    de: "Marktforschung mit KI — qualitativ, auf Deutsch, DSGVO-nativ",
    en: "Market Research with AI — qualitative, GDPR-native",
  },
  ogTitle: {
    de: "Marktforschung mit KI — Klymeo",
    en: "Market Research with AI — Klymeo",
  },
  description: {
    de: "Qualitative Marktforschung auf einer KI-Engine: Klymeo führt Tiefeninterviews mit deiner Zielgruppe — auf Deutsch, auf Wunsch per Voice-Agent — zeigt Entwürfe als Stimulus und verdichtet jede Antwort zu belegten Erkenntnissen. Vier Methoden für Bedarf, Marke, Konzept und Creative. DSGVO-nativ in Frankfurt.",
    en: "Qualitative market research on one AI engine: Klymeo runs in-depth interviews with your audience — in German and English, optionally by Voice Agent — shows drafts as a Stimulus and distills every answer into evidenced findings. Four methods for needs, brand, concept and creative. GDPR-native in Frankfurt.",
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
      de: "Klymeo — Marktforschung mit KI",
      en: "Klymeo — Market Research with AI",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: UseCaseContent = {
  slug: "marktforschung",
  eyebrow: "Anwendungsfall · Marktforschung",
  heroTitle: <>Frag deinen Markt, bevor du investierst.</>,
  heroSubhead:
    "Klymeo führt qualitative Tiefeninterviews mit deiner Zielgruppe — auf Deutsch, auf Wunsch hörbar per Voice-Agent — zeigt deine Entwürfe als Stimulus direkt im Gespräch und verdichtet jede Antwort zu belegten Erkenntnissen. Vier Methoden für Bedarf, Marke, Konzept und Creative, alle auf einer Engine.",
  audience:
    "Marken-, Insights-, Produkt- und Marketingteams, die Entscheidungen am O-Ton belegen wollen — statt am Bauchgefühl.",
  how: {
    eyebrow: "So funktioniert Marktforschung",
    title: <>Von der Studie zur belegten Antwort.</>,
    lead: "Vier verbundene Schritte — von der definierten Studie bis zur Aussage, die jedes Muster je Studie mit einem Zitat belegt. Rekrutiert über Link, eigenen Pool oder Panel, ohne Moderator und ohne Wochen Vorlauf.",
    steps: getMrSteps("de"),
  },
  methods: {},
  proof: {
    eyebrow: "Belegt, nicht geraten",
    title: <>Was Marktforschung konkret liefert.</>,
    lead: "Jede Fähigkeit arbeitet an echten Interviews mit echten Menschen — vom Voice-Interview bis zum PowerPoint-Export.",
    points: getMrProofs("de"),
  },
  cta: {
    title: <>Frag deinen Markt — belegt statt geraten.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo eine Marktfrage über mehrere Studien beantwortet — je Studie mit einem Zitat belegt.",
  },
};

const CONTENT_EN: UseCaseContent = {
  slug: "marktforschung",
  eyebrow: "Use case · Market Research",
  heroTitle: <>Ask your market before you invest.</>,
  heroSubhead:
    "Klymeo runs qualitative in-depth interviews with your audience — in German and English, audibly via Voice Agent if you want — shows your drafts as a Stimulus right inside the conversation, and distills every answer into evidenced findings. Four methods for needs, brand, concept and creative, all on one engine.",
  audience:
    "Brand, insights, product and marketing teams who want to back decisions with verbatim evidence — not a gut feeling.",
  how: {
    eyebrow: "How Market Research works",
    title: <>From study to evidenced answer.</>,
    lead: "Four connected steps — from a defined study to the statement that backs every pattern with a quote per study. Recruited by link, your own pool or a panel, with no moderator and no weeks of lead time.",
    steps: getMrSteps("en"),
  },
  methods: {},
  proof: {
    eyebrow: "Evidenced, not guessed",
    title: <>What Market Research delivers, concretely.</>,
    lead: "Every capability works on real interviews with real people — from the voice interview to the PowerPoint export.",
    points: getMrProofs("en"),
  },
  cta: {
    title: <>Ask your market — evidenced, not guessed.</>,
    lead: "Book a demo and see how Klymeo answers a market question across multiple studies — backed by a quote per study.",
  },
};

export default async function MarktforschungPage({
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
