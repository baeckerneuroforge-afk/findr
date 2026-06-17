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

const PATH = "/methoden/bedarf-verhalten";
const META = {
  title: { de: "Bedarf & Verhalten", en: "Needs & Behavior" },
  ogTitle: {
    de: "Bedarf & Verhalten — Klymeo",
    en: "Needs & Behavior — Klymeo",
  },
  description: {
    de: "Klymeo fragt nach konkreten Situationen und Workarounds statt nach Hypothesen — und bohrt nach, bis echter Bedarf belegt ist. KI-Interviews auf Deutsch, DSGVO-nativ.",
    en: "Klymeo asks about concrete situations and workarounds instead of hypotheses — and keeps digging until real need is evidenced. AI interviews in German and English, GDPR-native.",
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
      de: "Klymeo — Bedarf & Verhalten",
      en: "Klymeo — Needs & Behavior",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: MethodContent = {
  slug: "bedarf-verhalten",
  status: "Live",
  eyebrow: "Methode · Bedarf & Verhalten",
  heroTitle: <>Frag nach dem Verhalten, nicht nach der Meinung.</>,
  heroSubhead:
    "Was Menschen sagen, dass sie tun, und was sie wirklich tun, ist selten dasselbe. Klymeo fragt nach konkreten Situationen und echten Workarounds aus der Vergangenheit — und bohrt nach, bis aus einer Hypothese ein belegter Bedarf wird.",
  audience:
    "Produkt-, Innovations- und Insights-Teams, die echten Bedarf von Wunschdenken trennen wollen.",
  statusNote:
    "Diese Methode läuft heute — du kannst sie direkt in einer Market-Research-Studie einsetzen.",
  pain: {
    eyebrow: "Bedarf & Verhalten · Der blinde Fleck",
    title: <>„Würden Sie das nutzen?“ — und alle sagen ja.</>,
    problem:
      "Direkt gefragt, ob ein Bedarf besteht, bekommst du Höflichkeit, Hypothesen und gut gemeinte Selbsteinschätzung. Ob jemand ein Problem wirklich hat, zeigt sich nicht in der Absichtserklärung, sondern im Verhalten der letzten Woche — und genau danach fragt eine Umfrage nie.",
    stakes: {
      strong: "Was ungefragt bleibt, baust du auf Verdacht.",
      body: "Ohne den konkreten Anlass, den letzten Workaround und den Moment der Reibung bleibt jede Roadmap eine Wette. Eine Lücke, kein Drama — sie ist nur noch nicht mit echtem Verhalten gefüllt.",
    },
    blindCard: {
      badge: "Ohne Nachbohren · nur Selbstauskunft",
      rows: [
        {
          label: "Was die Umfrage zeigt",
          value:
            "Zustimmung zu einer Idee — abgefragt als Absicht, nicht als Verhalten.",
        },
        {
          label: "Was die Umfrage offenlässt",
          value:
            "Ob das Problem im Alltag überhaupt auftaucht, wie oft, und was die Person bisher dagegen tut. Genau das entscheidet, ob sich der Bau lohnt.",
        },
      ],
    },
  },
  how: {
    title: <>So bohrt Klymeo nach.</>,
    lead:
      "Kein Skript, das bei der ersten Antwort stehenbleibt. Klymeo arbeitet sich vom konkreten Fall zum belegten Bedarf — wie ein erfahrener Researcher, nur skalierbar.",
    steps: [
      {
        phase: "Situation",
        title: "Nach dem letzten Mal fragen, nicht nach der Regel",
        body: "Statt „Nutzen Sie das?“ fragt Klymeo: „Erzähl von letzter Woche — wie bist du da vorgegangen?“ Konkrete Episoden statt verallgemeinerter Selbsteinschätzung.",
        tag: "Live",
      },
      {
        phase: "Workaround",
        title: "Den Behelf aufdecken",
        body: "Wo es hakt, hat sich jede Person längst irgendwie beholfen. Klymeo fragt nach dem Workaround — er zeigt den ungedeckten Bedarf deutlicher als jede Wunschliste.",
        tag: "Live",
      },
      {
        phase: "Nachbohren",
        title: "Komplimente zählen nicht als Signal",
        body: "„Coole Idee“ ist kein Beleg. Klymeo hakt nach, bis ein konkretes Beispiel auf dem Tisch liegt — und erkennt, wenn Höflichkeit als Begeisterung getarnt ist.",
        tag: "Live",
      },
      {
        phase: "Beleg",
        title: "Vom Zitat zum verankerten Bedarf",
        body: "Jede Erkenntnis bleibt an die Stelle im Transkript geknüpft, an der sie fiel — nachlesbar, nicht interpretiert.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Bedarf & Verhalten · Was rauskommt",
    title: <>Belegter Bedarf statt bestätigter Annahme.</>,
    body: "Aus jedem Interview verdichtet Klymeo die wiederkehrenden Situationen, Workarounds und Reibungspunkte zu belegter Evidenz — verankert im Transkript. Über mehrere Interviews hinweg wird deterministisch gezählt, welche Muster wirklich tragen.",
    payoff: {
      strong: "Eine Priorisierung, die du verteidigen kannst.",
      body: "Statt „das Team glaubt, dass …“ zeigst du, in wie vielen Gesprächen ein Bedarf konkret auftauchte — und das Zitat dazu.",
    },
    card: {
      badge: "Beispiel-Fragen · Bedarf & Verhalten",
      rows: [
        {
          label: "So fragt Klymeo",
          value:
            "„Wie sieht ein typischer Arbeitstag bei Ihnen aus?“ · „Welche Aufgaben kosten am meisten Zeit?“",
        },
        {
          label: "Was Klymeo heraushört",
          value:
            "Wiederkehrende Situationen, den bisherigen Workaround und den Moment, an dem es hakt — als belegte Erkenntnis, nicht als Skalenwert.",
        },
      ],
    },
  },
  proofLead:
    "Was aus den Gesprächen wird, übernimmt dieselbe Synthese wie bei jeder Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Frag nach dem Verhalten — und hör genau hin.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo in einem Tiefeninterview vom ersten „klingt gut“ zum belegten Bedarf nachbohrt.",
  },
};

const CONTENT_EN: MethodContent = {
  slug: "bedarf-verhalten",
  status: "Live",
  eyebrow: "Method · Needs & Behavior",
  heroTitle: <>Ask about behavior, not opinion.</>,
  heroSubhead:
    "What people say they do and what they actually do are rarely the same. Klymeo asks about concrete past situations and real workarounds — and keeps digging until a hypothesis becomes an evidenced need.",
  audience:
    "Product, innovation, and insights teams that want to separate real demand from wishful thinking.",
  statusNote:
    "This method runs today — you can put it to work in a Market Research study right now.",
  pain: {
    eyebrow: "Needs & Behavior · The blind spot",
    title: <>“Would you use this?” — and everyone says yes.</>,
    problem:
      "Ask directly whether a need exists and you get politeness, hypotheses, and well-meant self-assessment. Whether someone actually has a problem shows up not in a statement of intent but in last week's behavior — and that's exactly what a survey never asks about.",
    stakes: {
      strong: "Whatever goes unasked, you build on a hunch.",
      body: "Without the specific trigger, the last workaround, and the moment of friction, every roadmap is a bet. It's a gap, not a drama — it just hasn't been filled with real behavior yet.",
    },
    blindCard: {
      badge: "Without follow-up · self-report only",
      rows: [
        {
          label: "What the survey shows",
          value:
            "Agreement with an idea — captured as intent, not as behavior.",
        },
        {
          label: "What the survey leaves open",
          value:
            "Whether the problem even comes up in daily life, how often, and what the person does about it today. That's exactly what decides whether building is worth it.",
        },
      ],
    },
  },
  how: {
    title: <>How Klymeo digs in.</>,
    lead:
      "No script that stops at the first answer. Klymeo works from the concrete case to the evidenced need — like an experienced researcher, only scalable.",
    steps: [
      {
        phase: "Situation",
        title: "Ask about the last time, not the rule",
        body: "Instead of “Do you use this?” Klymeo asks: “Tell me about last week — how did you go about it?” Concrete episodes rather than generalized self-assessment.",
        tag: "Live",
      },
      {
        phase: "Workaround",
        title: "Surface the makeshift fix",
        body: "Wherever something snags, people have long since cobbled together some fix. Klymeo asks about the workaround — it reveals the unmet need more clearly than any wish list.",
        tag: "Live",
      },
      {
        phase: "Follow-up",
        title: "Compliments don't count as signal",
        body: "“Cool idea” is no evidence. Klymeo follows up until a concrete example is on the table — and recognizes when politeness is disguised as enthusiasm.",
        tag: "Live",
      },
      {
        phase: "Evidence",
        title: "From the quote to the anchored need",
        body: "Every finding stays tied to the spot in the transcript where it came up — readable, not interpreted.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Needs & Behavior · What comes out",
    title: <>Evidenced need instead of confirmed assumption.</>,
    body: "From every interview, Klymeo distills the recurring situations, workarounds, and friction points into evidenced findings — anchored in the transcript. Across multiple interviews, which patterns truly hold is deterministically counted.",
    payoff: {
      strong: "A prioritization you can defend.",
      body: "Instead of “the team believes that …” you show in how many conversations a need concretely came up — and the quote to back it.",
    },
    card: {
      badge: "Example questions · Needs & Behavior",
      rows: [
        {
          label: "How Klymeo asks",
          value:
            "“What does a typical workday look like for you?” · “Which tasks cost you the most time?”",
        },
        {
          label: "What Klymeo hears out",
          value:
            "Recurring situations, the workaround so far, and the moment it snags — as an evidenced finding, not a scale value.",
        },
      ],
    },
  },
  proofLead:
    "What becomes of those conversations runs through the same synthesis as every method — Live for what's Live; Soon for what's coming.",
  cta: {
    title: <>Ask about behavior — and listen closely.</>,
    lead: "Book a demo and see how Klymeo digs from the first “sounds good” to an evidenced need in an in-depth interview.",
  },
};

export default async function BedarfVerhaltenPage({
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
