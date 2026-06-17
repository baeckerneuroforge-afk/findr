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
  MethodPage,
  type MethodContent,
} from "@/components/marketing/methode-template";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";

const PATH = "/methoden/konzept-test";
const META = {
  title: { de: "Konzept-Test", en: "Concept Test" },
  ogTitle: { de: "Konzept-Test — Klymeo", en: "Concept Test — Klymeo" },
  description: {
    de: "Konzepte belegt prüfen, bevor sie gebaut werden: Klymeo testet erst das Verständnis, dann die Relevanz — zurückhaltend bei der Kaufabsicht. KI-Interviews auf Deutsch, DSGVO-nativ.",
    en: "Test concepts with evidence before they get built: Klymeo tests understanding first, then relevance — restrained on purchase intent. AI interviews in German and English, GDPR-native.",
  },
  jsonLdName: {
    de: "Klymeo — Konzept-Test",
    en: "Klymeo — Concept Test",
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
    name: localizedContent(locale, META.jsonLdName),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: MethodContent = {
  slug: "konzept-test",
  status: "Live",
  eyebrow: "Methode · Konzept-Test",
  heroTitle: <>Trägt das Konzept — und woran?</>,
  heroSubhead:
    "Bevor du ein Konzept baust, willst du wissen, ob es verstanden wird und ob es relevant ist. Klymeo prüft erst das Verständnis, dann die Relevanz — zurückhaltend bei „würden Sie kaufen“ — und zeigt das Konzept als echtes Asset im Interview.",
  audience:
    "Produkt-, Innovations- und Konzept-Teams, die eine Idee belegt prüfen wollen, bevor sie gebaut wird.",
  statusNote:
    "Diese Methode läuft heute — du zeigst deinen Stimulus (Text, Bild oder Mockup) im Interview und setzt sie direkt in einer Market-Research-Studie ein.",
  pain: {
    eyebrow: "Konzept-Test · Der blinde Fleck",
    title: <>„Würden Sie das kaufen?“ misst Höflichkeit, nicht Relevanz.</>,
    problem:
      "Die Kaufabsichtsfrage zu früh gestellt, liefert eine Zahl, die selten hält — denn zuerst zählt, ob das Konzept überhaupt richtig verstanden wurde. Wird es missverstanden, testest du nicht die Idee, sondern das Missverständnis.",
    stakes: {
      strong: "Ein missverstandenes Konzept liefert eine schöne, falsche Zahl.",
      body: "Ohne zu prüfen, was bei der Person ankommt, weißt du nicht, ob ein „Nein“ der Idee gilt oder ihrer Erklärung.",
    },
    blindCard: {
      badge: "Ohne Verständnis-Check · nur Kaufabsicht",
      rows: [
        {
          label: "Was die Abfrage zeigt",
          value:
            "Eine Kaufabsichts-Zahl auf ein Konzept, das in einem Satz beschrieben wurde.",
        },
        {
          label: "Was die Abfrage offenlässt",
          value:
            "Ob das Konzept so verstanden wurde, wie es gemeint war — und woran genau es trägt oder scheitert.",
        },
      ],
    },
  },
  how: {
    title: <>Erst verstehen, dann bewerten.</>,
    lead:
      "Klymeo zeigt das Konzept als Asset und arbeitet sich vom Verständnis zur Relevanz — bewusst zurückhaltend bei der Kaufabsicht.",
    steps: [
      {
        phase: "Stimulus",
        title: "Das Konzept zeigen",
        body: "Klymeo präsentiert das Konzept als echtes Asset im Interview — Text, Bild oder Mockup — statt es nur zu beschreiben.",
        tag: "Live",
      },
      {
        phase: "Verständnis",
        title: "In eigenen Worten zurückgeben lassen",
        body: "„Beschreiben Sie das Konzept in eigenen Worten.“ Erst wenn klar ist, was ankommt, ergibt jede Bewertung Sinn.",
        tag: "Live",
      },
      {
        phase: "Relevanz",
        title: "Was gefällt — und was nicht",
        body: "Klymeo fragt nach dem, was zieht, und dem, was bremst — und bleibt zurückhaltend bei „würden Sie kaufen“: Relevanz statt erzwungener Kaufabsicht.",
        tag: "Live",
      },
      {
        phase: "Variante",
        title: "Welche Richtung trägt",
        body: "Stehen mehrere Varianten zur Wahl, fragt Klymeo nach Präferenz und Grund — woran genau eine Idee trägt oder scheitert.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Konzept-Test · Was rauskommt",
    title: <>Belegt, ob die Idee trägt — und woran.</>,
    body: "Klymeo verdichtet, ob das Konzept verstanden wurde, was Relevanz stiftet und wo es hakt — verankert im Transkript. Über mehrere Konzept-Studien hinweg deterministisch gezählt. Dieselbe Synthese wie bei jeder anderen Methode.",
    payoff: {
      strong: "Ein Go/No-Go, das auf Verständnis fußt — nicht auf einer voreiligen Zahl.",
      body: "Du siehst nicht nur, ob die Idee ankommt, sondern woran genau — der Hebel für die nächste Version.",
    },
    card: {
      badge: "Beispiel-Fragen · Konzept-Test",
      rows: [
        {
          label: "So fragt Klymeo",
          value:
            "„Beschreiben Sie das Konzept in eigenen Worten.“ · „Was gefällt Ihnen, was weniger?“",
        },
        {
          label: "Was Klymeo heraushört",
          value:
            "Ob das Konzept verstanden wurde, was Relevanz stiftet und welche Variante trägt — bevor gebaut wird.",
        },
      ],
    },
  },
  proofLead:
    "Was aus den Gesprächen wird, übernimmt dieselbe Synthese wie bei jeder Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Konzepte prüfen, bevor sie gebaut werden.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo ein Konzept als Asset zeigt und sich vom Verständnis zur Relevanz vorarbeitet — bevor gebaut wird.",
  },
};

const CONTENT_EN: MethodContent = {
  slug: "konzept-test",
  status: "Live",
  eyebrow: "Method · Concept Test",
  heroTitle: <>Does the concept hold up — and on what?</>,
  heroSubhead:
    "Before you build a concept, you want to know whether it's understood and whether it's relevant. Klymeo tests understanding first, then relevance — staying restrained on “would you buy this” — and shows the concept as a real asset inside the interview.",
  audience:
    "Product, innovation and concept teams who want to test an idea with evidence before it gets built.",
  statusNote:
    "This method runs today — you show your stimulus (text, image or mockup) in the interview and put it to work directly in a Market Research study.",
  pain: {
    eyebrow: "Concept Test · The blind spot",
    title: <>“Would you buy this?” measures politeness, not relevance.</>,
    problem:
      "Asked too early, the purchase-intent question hands you a number that rarely holds — because what matters first is whether the concept was even understood correctly. If it's misunderstood, you're not testing the idea, you're testing the misunderstanding.",
    stakes: {
      strong: "A misunderstood concept hands you a pretty, wrong number.",
      body: "Without checking what actually lands with the person, you can't tell whether a “no” is aimed at the idea or at the way it was explained.",
    },
    blindCard: {
      badge: "Without an understanding check · purchase intent only",
      rows: [
        {
          label: "What the question shows",
          value:
            "A purchase-intent number on a concept that was described in a single sentence.",
        },
        {
          label: "What the question leaves open",
          value:
            "Whether the concept was understood the way it was meant — and exactly what it holds up on or fails at.",
        },
      ],
    },
  },
  how: {
    title: <>Understand first, then evaluate.</>,
    lead:
      "Klymeo shows the concept as an asset and works from understanding to relevance — deliberately restrained on purchase intent.",
    steps: [
      {
        phase: "Stimulus",
        title: "Show the concept",
        body: "Klymeo presents the concept as a real asset in the interview — text, image or mockup — instead of merely describing it.",
        tag: "Live",
      },
      {
        phase: "Understanding",
        title: "Have it played back in their own words",
        body: "“Describe the concept in your own words.” Only once it's clear what lands does any evaluation make sense.",
        tag: "Live",
      },
      {
        phase: "Relevance",
        title: "What appeals — and what doesn't",
        body: "Klymeo asks what pulls people in and what holds them back — and stays restrained on “would you buy this”: relevance instead of forced purchase intent.",
        tag: "Live",
      },
      {
        phase: "Variant",
        title: "Which direction holds up",
        body: "When several variants are on the table, Klymeo asks for preference and reason — exactly what makes an idea hold up or fall short.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Concept Test · What you get",
    title: <>Evidence of whether the idea holds up — and on what.</>,
    body: "Klymeo distills whether the concept was understood, what drives relevance and where it snags — anchored in the transcript. Counted deterministically across multiple concept studies. The same synthesis as every other method.",
    payoff: {
      strong: "A go/no-go grounded in understanding — not in a premature number.",
      body: "You see not just whether the idea lands, but exactly on what — the lever for the next version.",
    },
    card: {
      badge: "Example questions · Concept Test",
      rows: [
        {
          label: "How Klymeo asks",
          value:
            "“Describe the concept in your own words.” · “What appeals to you, and what less so?”",
        },
        {
          label: "What Klymeo picks up",
          value:
            "Whether the concept was understood, what drives relevance and which variant holds up — before anything gets built.",
        },
      ],
    },
  },
  proofLead:
    "What comes out of the conversations runs through the same synthesis as every method — Live for what's live; Soon for what's coming.",
  cta: {
    title: <>Test concepts before they get built.</>,
    lead: "Book a demo and see how Klymeo shows a concept as an asset and works from understanding to relevance — before anything gets built.",
  },
};

export default async function KonzeptTestPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  return (
    <>
      <JsonLd data={buildJsonLd(locale)} />
      <MethodPage
        content={localizedContent(lang, { de: CONTENT, en: CONTENT_EN })}
        locale={locale}
      />
    </>
  );
}
