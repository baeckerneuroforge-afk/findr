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

const PATH = "/methoden/creative-test";
const META = {
  title: { de: "Creative-Test", en: "Creative Test" },
  ogTitle: { de: "Creative-Test — Klymeo", en: "Creative Test — Klymeo" },
  description: {
    de: "Die Wirkung einer Kreation prüfen, bevor das Budget fließt: Klymeo erfasst ersten Eindruck und emotionale Wirkung. KI-Interviews auf Deutsch, DSGVO-nativ.",
    en: "Test how a creative lands before the budget flows: Klymeo captures first impression and emotional impact. AI interviews in German and English, GDPR-native.",
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
      de: "Klymeo — Creative-Test",
      en: "Klymeo — Creative Test",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: MethodContent = {
  slug: "creative-test",
  status: "Live",
  eyebrow: "Methode · Creative-Test",
  heroTitle: <>Wirkt die Kreation — bevor das Budget fließt?</>,
  heroSubhead:
    "Werbung wirkt in den ersten Sekunden oder gar nicht. Klymeo erfasst den ersten Eindruck und die emotionale Wirkung einer Kreation — was zuerst auffällt und hängenbleibt, bevor du Media-Budget dahinter legst.",
  audience:
    "Marketing-, Brand- und Kreativ-Teams, die eine Kreation prüfen wollen, bevor sie ausgespielt wird.",
  statusNote:
    "Diese Methode läuft heute — du zeigst deine Kreation (Anzeige, Mockup oder Clip) im Interview und setzt sie direkt in einer Market-Research-Studie ein.",
  pain: {
    eyebrow: "Creative-Test · Der blinde Fleck",
    title: <>Performance-Zahlen kommen, wenn das Budget schon läuft.</>,
    problem:
      "Klickraten und Conversions sagen dir, dass eine Kreation nicht zieht — erst nachdem du dafür bezahlt hast. Was im ersten Eindruck auffällt, welche Botschaft ankommt und was emotional hängenbleibt, steht in keinem Performance-Dashboard.",
    stakes: {
      strong: "Eine schwache Kreation lernst du sonst aus der Media-Rechnung.",
      body: "Ohne den ersten Eindruck vorher zu kennen, ist jeder Spend ein Test mit echtem Geld statt mit echten Menschen.",
    },
    blindCard: {
      badge: "Ohne Vorab-Reaktion · nur Performance",
      rows: [
        {
          label: "Was die Kampagne zeigt",
          value:
            "Klick- und Conversion-Zahlen — nachdem das Budget ausgespielt wurde.",
        },
        {
          label: "Was die Kampagne offenlässt",
          value:
            "Was im ersten Eindruck auffällt, welche Botschaft ankommt und was emotional hängenbleibt — bevor bezahlt wird.",
        },
      ],
    },
  },
  how: {
    title: <>Erster Eindruck zuerst.</>,
    lead:
      "Klymeo zeigt die Kreation als Asset und erfasst die spontane Reaktion — was zuerst auffällt und hängenbleibt, ohne zu überanalysieren.",
    steps: [
      {
        phase: "Stimulus",
        title: "Die Kreation zeigen",
        body: "Klymeo spielt die Kreation als echtes Asset im Interview aus — Anzeige, Mockup oder Clip — statt sie zu beschreiben.",
        tag: "Live",
      },
      {
        phase: "Erster Eindruck",
        title: "Die spontane Reaktion einfangen",
        body: "„Was ist Ihr erster spontaner Eindruck?“ Die erste Sekunde zählt — Klymeo fragt danach, bevor Nachdenken sie glättet.",
        tag: "Live",
      },
      {
        phase: "Botschaft",
        title: "Was ankommt",
        body: "„Welche Botschaft nehmen Sie mit?“ Klymeo prüft, ob die gemeinte Botschaft auch die wahrgenommene ist.",
        tag: "Live",
      },
      {
        phase: "Erinnerung",
        title: "Was hängenbleibt",
        body: "Klymeo fragt, was am stärksten im Gedächtnis bleibt — die emotionale Wirkung, die später die Erinnerung trägt.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Creative-Test · Was rauskommt",
    title: <>Die Wirkung, bevor das Budget fließt.</>,
    body: "Klymeo verdichtet ersten Eindruck, wahrgenommene Botschaft und emotionale Erinnerung zu belegter Evidenz — verankert im Transkript. Über mehrere Kreationen hinweg deterministisch gezählt. Dieselbe Synthese wie bei jeder anderen Methode.",
    payoff: {
      strong: "Eine Vorab-Entscheidung mit echten Reaktionen statt mit Media-Geld.",
      body: "Du siehst, welche Kreation zieht und woran — bevor der erste Euro Spend fließt.",
    },
    card: {
      badge: "Beispiel-Fragen · Creative-Test",
      rows: [
        {
          label: "So fragt Klymeo",
          value:
            "„Was ist Ihr erster spontaner Eindruck?“ · „Welche Botschaft nehmen Sie mit?“",
        },
        {
          label: "Was Klymeo heraushört",
          value:
            "Ersten Eindruck, wahrgenommene Botschaft und was emotional hängenbleibt — bevor ausgespielt wird.",
        },
      ],
    },
  },
  proofLead:
    "Was aus den Gesprächen wird, übernimmt dieselbe Synthese wie bei jeder Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Kreationen prüfen, bevor das Budget fließt.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo eine Kreation als Asset zeigt und ersten Eindruck, Botschaft und emotionale Wirkung einfängt — bevor das Budget fließt.",
  },
};

const CONTENT_EN: MethodContent = {
  slug: "creative-test",
  status: "Live",
  eyebrow: "Method · Creative Test",
  heroTitle: <>Does the creative land — before the budget flows?</>,
  heroSubhead:
    "Advertising works in the first few seconds or not at all. Klymeo captures the first impression and the emotional impact of a creative — what stands out and sticks first, before you put media budget behind it.",
  audience:
    "Marketing, brand and creative teams who want to test a creative before it goes live.",
  statusNote:
    "This method runs today — you show your creative (an ad, mockup or clip) in the interview and put it straight to work in a Market Research study.",
  pain: {
    eyebrow: "Creative Test · The blind spot",
    title: <>Performance numbers arrive once the budget is already running.</>,
    problem:
      "Click-through rates and conversions tell you a creative isn't landing — only after you've paid for it. What stands out in the first impression, which message gets through and what sticks emotionally shows up in no performance dashboard.",
    stakes: {
      strong: "Otherwise you learn a weak creative from the media invoice.",
      body: "Without knowing the first impression up front, every spend is a test with real money instead of with real people.",
    },
    blindCard: {
      badge: "Without an up-front reaction · performance only",
      rows: [
        {
          label: "What the campaign shows",
          value:
            "Click and conversion numbers — after the budget has been spent.",
        },
        {
          label: "What the campaign leaves open",
          value:
            "What stands out in the first impression, which message gets through and what sticks emotionally — before you pay.",
        },
      ],
    },
  },
  how: {
    title: <>First impression first.</>,
    lead:
      "Klymeo shows the creative as an asset and captures the spontaneous reaction — what stands out and sticks first, without over-analyzing.",
    steps: [
      {
        phase: "Stimulus",
        title: "Show the creative",
        body: "Klymeo plays the creative as a real asset in the interview — an ad, mockup or clip — instead of describing it.",
        tag: "Live",
      },
      {
        phase: "First impression",
        title: "Capture the spontaneous reaction",
        body: "“What's your first spontaneous impression?” The first second counts — Klymeo asks before reflection smooths it over.",
        tag: "Live",
      },
      {
        phase: "Message",
        title: "What gets through",
        body: "“What message do you take away?” Klymeo checks whether the intended message is also the perceived one.",
        tag: "Live",
      },
      {
        phase: "Recall",
        title: "What sticks",
        body: "Klymeo asks what stays in memory most strongly — the emotional impact that later carries the recall.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Creative Test · What comes out",
    title: <>The impact, before the budget flows.</>,
    body: "Klymeo distills first impression, perceived message and emotional recall into evidenced findings — anchored in the transcript. Deterministically counted across multiple creatives. The same synthesis as in every other method.",
    payoff: {
      strong: "An up-front decision with real reactions instead of media money.",
      body: "You see which creative lands and on what — before the first euro of spend flows.",
    },
    card: {
      badge: "Example questions · Creative Test",
      rows: [
        {
          label: "How Klymeo asks",
          value:
            "“What's your first spontaneous impression?” · “What message do you take away?”",
        },
        {
          label: "What Klymeo hears out",
          value:
            "First impression, perceived message and what sticks emotionally — before it goes live.",
        },
      ],
    },
  },
  proofLead:
    "What comes out of the conversations runs through the same synthesis as in every method — Live where it's Live; Soon where it's coming.",
  cta: {
    title: <>Test creatives before the budget flows.</>,
    lead: "Book a demo and see how Klymeo shows a creative as an asset and captures first impression, message and emotional impact — before the budget flows.",
  },
};

export default async function CreativeTestPage({
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
