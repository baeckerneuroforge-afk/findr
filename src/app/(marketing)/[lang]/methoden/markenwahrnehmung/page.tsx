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
import {
  SITE_URL,
  ogDefaultsFor,
  buildAlternates,
} from "@/lib/marketing/seo";

const PATH = "/methoden/markenwahrnehmung";
const META = {
  title: { de: "Markenwahrnehmung", en: "Brand Perception" },
  ogTitle: {
    de: "Markenwahrnehmung — Klymeo",
    en: "Brand Perception — Klymeo",
  },
  description: {
    de: "Wie deine Marke wirklich wahrgenommen wird: Klymeo erfragt Assoziationen, Bilder und Gefühle in den eigenen Worten deiner Zielgruppe — bewusst breit. KI-Interviews auf Deutsch, DSGVO-nativ.",
    en: "How your brand is really perceived: Klymeo asks for associations, images, and feelings in your audience's own words — deliberately broad. AI interviews in German and English, GDPR-native.",
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
      de: "Klymeo — Markenwahrnehmung",
      en: "Klymeo — Brand Perception",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: MethodContent = {
  slug: "markenwahrnehmung",
  status: "Live",
  eyebrow: "Methode · Markenwahrnehmung",
  heroTitle: <>Wie deine Marke wirklich im Kopf sitzt.</>,
  heroSubhead:
    "Markenwahrnehmung lässt sich nicht ankreuzen. Klymeo fragt nach Assoziationen, Bildern und Gefühlen — in den eigenen Worten deiner Zielgruppe, bewusst breit, bevor eine Skala die spontane Reaktion überformt.",
  audience:
    "Marken-, Marketing- und Strategie-Teams, die das echte Bild ihrer Marke hören wollen — nicht das gewünschte.",
  statusNote:
    "Diese Methode läuft heute — du kannst sie direkt in einer Market-Research-Studie einsetzen.",
  pain: {
    eyebrow: "Markenwahrnehmung · Der blinde Fleck",
    title: <>Das Brand-Tracking zeigt einen Wert. Nicht das Bild dahinter.</>,
    problem:
      "Gestützte Abfragen liefern Prozentpunkte auf vorgegebenen Attributen — aber die Marke lebt in spontanen Assoziationen, Bildern und Gefühlen, die in keiner Skala vorkommen. Was Menschen ungefragt mit dir verbinden, verrät mehr als jede Zustimmung zu „modern: ja/nein“.",
    stakes: {
      strong: "Vorgegebene Attribute messen deine Hypothese, nicht ihre Wahrnehmung.",
      body: "Wer nur abfragt, was er ohnehin vermutet, hört nie das Wort, das die Zielgruppe selbst wählt — und genau das prägt die Marke.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur gestützte Skala",
      rows: [
        {
          label: "Was das Tracking zeigt",
          value: "Zustimmungswerte zu vorgegebenen Marken-Attributen.",
        },
        {
          label: "Was das Tracking offenlässt",
          value:
            "Welches Bild, welches Gefühl, welche spontane Assoziation die Marke wirklich auslöst — in den Worten der Zielgruppe, nicht in deinen.",
        },
      ],
    },
  },
  how: {
    title: <>So hält Klymeo die Wahrnehmung offen.</>,
    lead:
      "Bewusst breit statt tief: Klymeo fragt nach dem ersten Einfall, bevor es konkretisiert — damit die spontane Wahrnehmung nicht durch die Frage geformt wird.",
    steps: [
      {
        phase: "Spontan",
        title: "Erst der erste Einfall",
        body: "„Was kommt Ihnen als Erstes in den Sinn bei [Marke]?“ — die ungestützte Assoziation zuerst, bevor irgendein Attribut sie lenkt.",
        tag: "Live",
      },
      {
        phase: "Bild & Gefühl",
        title: "Assoziationen, Bilder, Gefühle",
        body: "Klymeo fragt nach Bildern und Gefühlen statt nach Skalenwerten — und bleibt bei den eigenen Worten der Person.",
        tag: "Live",
      },
      {
        phase: "Breit halten",
        title: "Nicht überformen",
        body: "Statt früh zu vertiefen, hält Klymeo die Frage offen — damit die Wahrnehmung nicht in eine vorgegebene Richtung gedrängt wird.",
        tag: "Live",
      },
      {
        phase: "Kern",
        title: "Wofür die Marke steht — und wofür nicht",
        body: "Erst am Ende verdichtet Klymeo zum Markenkern: „Wofür steht [Marke] — und wofür nicht?“ Belegt am Zitat.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Markenwahrnehmung · Was rauskommt",
    title: <>Das Markenbild in echten Worten.</>,
    body: "Klymeo verdichtet die Interviews zu den wiederkehrenden Assoziationen, Bildern und Gefühlen — und zeigt, welche davon die Marke tragen und welche sie bremsen. Über mehrere Studien hinweg deterministisch gezählt, je Studie mit Zitat belegt.",
    payoff: {
      strong: "Ein Markenbild, das du zitieren kannst.",
      body: "Nicht „Attribut X liegt bei Y Prozent“, sondern das Wort, das die Zielgruppe selbst gewählt hat — belegt am Interview.",
    },
    card: {
      badge: "Beispiel-Fragen · Markenwahrnehmung",
      rows: [
        {
          label: "So fragt Klymeo",
          value:
            "„Was kommt Ihnen als Erstes in den Sinn bei [Marke]?“ · „Beschreiben Sie [Marke] in einem Satz.“",
        },
        {
          label: "Was Klymeo heraushört",
          value:
            "Spontane Assoziationen, das Gefühl dahinter und den Markenkern — in den eigenen Worten, nicht in vorgegebenen Attributen.",
        },
      ],
    },
  },
  proofLead:
    "Was aus den Gesprächen wird, übernimmt dieselbe Synthese wie bei jeder Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Hör, wie deine Marke wirklich klingt.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo spontane Assoziationen zu einem belegten Markenbild verdichtet.",
  },
};

const CONTENT_EN: MethodContent = {
  slug: "markenwahrnehmung",
  status: "Live",
  eyebrow: "Method · Brand Perception",
  heroTitle: <>How your brand really sits in people&apos;s minds.</>,
  heroSubhead:
    "Brand perception can't be ticked off a list. Klymeo asks about associations, images, and feelings — in your audience's own words, deliberately broad, before a scale reshapes the spontaneous reaction.",
  audience:
    "Brand, marketing, and strategy teams who want to hear the real picture of their brand — not the one they wish for.",
  statusNote:
    "This method runs today — you can put it to work in a Market Research study right now.",
  pain: {
    eyebrow: "Brand Perception · The blind spot",
    title: <>Brand tracking shows a number. Not the picture behind it.</>,
    problem:
      "Prompted questions deliver percentage points on predefined attributes — but a brand lives in the spontaneous associations, images, and feelings that no scale captures. What people connect with you unprompted says more than any agreement with “modern: yes/no”.",
    stakes: {
      strong: "Predefined attributes measure your hypothesis, not their perception.",
      body: "Ask only what you already suspect and you never hear the word the audience chooses itself — and that's exactly what shapes the brand.",
    },
    blindCard: {
      badge: "Without verbatim · prompted scale only",
      rows: [
        {
          label: "What the tracking shows",
          value: "Agreement scores on predefined brand attributes.",
        },
        {
          label: "What the tracking leaves open",
          value:
            "Which image, which feeling, which spontaneous association the brand really triggers — in the audience's words, not yours.",
        },
      ],
    },
  },
  how: {
    title: <>How Klymeo keeps perception open.</>,
    lead:
      "Deliberately broad rather than deep: Klymeo asks for the first thing that comes to mind before getting specific — so spontaneous perception isn't shaped by the question.",
    steps: [
      {
        phase: "Spontaneous",
        title: "The first thing that comes to mind",
        body: "“What's the first thing that comes to mind with [brand]?” — the unprompted association first, before any attribute steers it.",
        tag: "Live",
      },
      {
        phase: "Image & feeling",
        title: "Associations, images, feelings",
        body: "Klymeo asks for images and feelings rather than scale values — and stays with the person's own words.",
        tag: "Live",
      },
      {
        phase: "Keep it broad",
        title: "Don't overshape",
        body: "Instead of drilling down early, Klymeo keeps the question open — so perception isn't nudged in a predefined direction.",
        tag: "Live",
      },
      {
        phase: "Core",
        title: "What the brand stands for — and what it doesn't",
        body: "Only at the end does Klymeo distill the brand core: “What does [brand] stand for — and what doesn't it?” Backed by the quote.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Brand Perception · What comes out",
    title: <>The brand image in real words.</>,
    body: "Klymeo distills the interviews into the recurring associations, images, and feelings — and shows which of them carry the brand and which hold it back. Deterministically counted across multiple studies, evidenced with a quote per study.",
    payoff: {
      strong: "A brand image you can quote.",
      body: "Not “attribute X sits at Y percent,” but the word the audience chose itself — backed by the interview.",
    },
    card: {
      badge: "Example questions · Brand Perception",
      rows: [
        {
          label: "How Klymeo asks",
          value:
            "“What's the first thing that comes to mind with [brand]?” · “Describe [brand] in one sentence.”",
        },
        {
          label: "What Klymeo hears out",
          value:
            "Spontaneous associations, the feeling behind them, and the brand core — in their own words, not in predefined attributes.",
        },
      ],
    },
  },
  proofLead:
    "What becomes of those conversations runs through the same synthesis as every method — Live for what's Live; Soon for what's coming.",
  cta: {
    title: <>Hear how your brand really sounds.</>,
    lead: "Book a demo and see how Klymeo distills spontaneous associations into an evidenced brand image.",
  },
};

export default async function MarkenwahrnehmungPage({
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
