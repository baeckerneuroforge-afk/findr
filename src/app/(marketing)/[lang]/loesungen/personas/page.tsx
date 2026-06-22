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
  UsersIcon,
  FileCheckIcon,
  NetworkIcon,
  CpuIcon,
  CheckIcon,
  ShieldCheckIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";

const PATH = "/loesungen/personas";
const META = {
  title: {
    de: "Personas mit KI — belegt aus echten Interviews, DSGVO-nativ",
    en: "Personas with AI — evidenced from real interviews, GDPR-native",
  },
  ogTitle: {
    de: "Personas mit KI — Klymeo",
    en: "Personas with AI — Klymeo",
  },
  description: {
    de: "Klymeo verdichtet die belegte Synthese deiner Marktforschungs-Interviews zu drei bis fünf Zielgruppen-Segmenten — keine erfundenen Steckbriefe. Jedes Feld einer Persona (Ziele, Pains, Verhalten, Motivation) ist am Originalzitat verankert und bis zur Interview-Session klickbar; die Anteile sind server-berechnet aus den zugeordneten Gesprächen, nicht geschätzt. Erzeugbar ab genügend Interviews, jederzeit neu. Auf Deutsch und Englisch, DSGVO-nativ in Frankfurt.",
    en: "Klymeo distills the evidenced synthesis of your market-research interviews into three to five audience segments — no invented profiles. Every field of a persona (goals, pains, behavior, motivation) is anchored to a verbatim quote and clickable through to the interview session; the shares are server-computed from the assigned conversations, not estimated. Generatable once you have enough interviews, re-runnable anytime. In German and English, GDPR-native in Frankfurt.",
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
      de: "Klymeo — Personas mit KI",
      en: "Klymeo — Personas with AI",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: UseCaseContent = {
  slug: "personas",
  eyebrow: "Anwendungsfall · Personas",
  heroTitle: <>Personas, die aus echten Gesprächen stammen.</>,
  heroSubhead:
    "Personas entstehen bei Klymeo nicht am Reißbrett: Wir verdichten die belegte Synthese deiner Interviews zu drei bis fünf Zielgruppen-Segmenten — jedes Feld am Originalzitat verankert, jede Größe server-berechnet aus den tatsächlich zugeordneten Gesprächen.",
  audience:
    "Produkt-, Marketing- und Insights-Teams, die mit Zielgruppen-Segmenten arbeiten wollen, die am O-Ton belegt sind statt geraten.",
  how: {
    eyebrow: "So entstehen Personas",
    title: <>Vom ausgewerteten Interview zur belegten Persona.</>,
    lead: "Vier Schritte — von den ausgewerteten Interviews deiner Studie bis zur Persona, deren jedes Feld ein Zitat trägt. Kein Steckbrief wird erfunden, keine Größe geschätzt.",
    steps: [
      {
        phase: "Voraussetzung",
        title: "Genug ausgewertete Interviews",
        body: "Personas bauen auf der Synthese deiner Studie auf. Erst ab einer Mindestzahl ausgewerteter Interviews schaltet Klymeo die Erzeugung frei — darunter bleibt sie bewusst gesperrt, damit keine Persona aus zu wenigen Stimmen entsteht.",
        tag: "Live",
      },
      {
        phase: "Erzeugen",
        title: "Auf Knopfdruck verdichten",
        body: "Ein eigener Knopf verdichtet die Befragten zu drei bis fünf disjunkten Segmenten — jede:r Befragte gehört zu genau einer Persona. Kommen neue Interviews dazu, erzeugst du die Personas jederzeit unabhängig neu.",
        tag: "Live",
      },
      {
        phase: "Belegen",
        title: "Jedes Feld am Originalzitat",
        body: "Ziele, Pains, Verhalten und Motivation jeder Persona sind an wörtlichen Zitaten aus echten Interviews verankert. Ein Feld ohne Beleg fällt weg — lieber eine Lücke als eine erfundene Eigenschaft.",
        tag: "Live",
      },
      {
        phase: "Nachvollziehen",
        title: "Klickbar bis zur Interview-Session",
        body: "Hinter jedem Zitat steht ein Link zur Quell-Interview-Session. Und die Anteile der Segmente sind server-berechnet aus den tatsächlich zugeordneten Interviews — nie vom Modell geschätzt.",
        tag: "Live",
      },
    ],
  },
  proof: {
    eyebrow: "Belegt, nicht erfunden",
    title: <>Was Personas konkret liefern.</>,
    lead: "Jede Persona steht auf echten Gesprächen mit echten Menschen — nichts ist geraten, nichts frei gestaltet.",
    points: [
      {
        title: "Drei bis fünf belegte Segmente",
        body: "Klymeo clustert die Befragten zu drei bis fünf Zielgruppen-Segmenten als strikte Partition — jede:r Befragte zählt zu genau einer Persona, keine Doppelzählung.",
        Icon: UsersIcon,
        tag: "Live",
      },
      {
        title: "Jedes Feld am Zitat verankert",
        body: "Ziele, Pains, Verhalten und Motivation tragen je ein wörtliches Zitat aus einem echten Interview. Felder ohne Beleg werden unterdrückt.",
        Icon: FileCheckIcon,
        tag: "Live",
      },
      {
        title: "Klickbare Belegkette",
        body: "Jedes Zitat verlinkt direkt auf die Interview-Session, aus der es stammt — der Beleg ist einen Klick entfernt, nicht bloß behauptet.",
        Icon: NetworkIcon,
        tag: "Live",
      },
      {
        title: "Server-berechnete Anteile",
        body: "Wie groß ein Segment ist — Anteil und Anzahl — zählt der Server aus den zugeordneten Interviews. Diese Zahl kommt nie vom Sprachmodell.",
        Icon: CpuIcon,
        tag: "Live",
      },
      {
        title: "Min-Gate & jederzeit neu",
        body: "Personas entstehen erst ab einer Mindestzahl ausgewerteter Interviews und lassen sich per Knopf unabhängig neu erzeugen, wenn neue Gespräche dazukommen.",
        Icon: CheckIcon,
        tag: "Live",
      },
      {
        title: "DSGVO-nativ, in Frankfurt gehostet",
        body: "Auf Deutsch und Englisch, in der EU gehostet, keine US-Cloud — die Stimmen hinter deinen Personas verlassen die EU nicht.",
        Icon: ShieldCheckIcon,
        tag: "Live",
      },
    ],
  },
  cta: {
    title: <>Sieh deine Zielgruppe — belegt, nicht erfunden.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo aus echten Interviews drei bis fünf Personas verdichtet — jedes Feld am Zitat belegt, jede Größe server-berechnet.",
  },
};

const CONTENT_EN: UseCaseContent = {
  slug: "personas",
  eyebrow: "Use case · Personas",
  heroTitle: <>Personas that come from real conversations.</>,
  heroSubhead:
    "At Klymeo personas aren't drawn up at a desk: we distill the evidenced synthesis of your interviews into three to five audience segments — every field anchored to a verbatim quote, every size server-computed from the conversations actually assigned to it.",
  audience:
    "Product, marketing and insights teams who want audience segments backed by people's own words rather than guessed.",
  how: {
    eyebrow: "How personas are built",
    title: <>From analyzed interview to evidenced persona.</>,
    lead: "Four steps — from your study's analyzed interviews to a persona whose every field carries a quote. No profile is invented, no size estimated.",
    steps: [
      {
        phase: "Prerequisite",
        title: "Enough analyzed interviews",
        body: "Personas build on your study's synthesis. Only once you have a minimum number of analyzed interviews does Klymeo unlock generation — below that it stays deliberately locked, so no persona is built from too few voices.",
        tag: "Live",
      },
      {
        phase: "Generate",
        title: "Distill at the push of a button",
        body: "A dedicated button distills the respondents into three to five disjoint segments — each respondent belongs to exactly one persona. When new interviews come in, you regenerate the personas independently anytime.",
        tag: "Live",
      },
      {
        phase: "Evidence",
        title: "Every field on a verbatim quote",
        body: "Each persona's goals, pains, behavior and motivation are anchored to verbatim quotes from real interviews. A field without evidence is dropped — a gap beats an invented trait.",
        tag: "Live",
      },
      {
        phase: "Trace",
        title: "Clickable through to the interview session",
        body: "Behind every quote sits a link to its source interview session. And the segment shares are server-computed from the interviews actually assigned — never estimated by the model.",
        tag: "Live",
      },
    ],
  },
  proof: {
    eyebrow: "Evidenced, not invented",
    title: <>What personas deliver, concretely.</>,
    lead: "Every persona stands on real conversations with real people — nothing guessed, nothing freely designed.",
    points: [
      {
        title: "Three to five evidenced segments",
        body: "Klymeo clusters the respondents into three to five audience segments as a strict partition — each respondent counts toward exactly one persona, no double-counting.",
        Icon: UsersIcon,
        tag: "Live",
      },
      {
        title: "Every field anchored to a quote",
        body: "Goals, pains, behavior and motivation each carry a verbatim quote from a real interview. Fields without evidence are suppressed.",
        Icon: FileCheckIcon,
        tag: "Live",
      },
      {
        title: "Clickable evidence chain",
        body: "Every quote links straight to the interview session it came from — the evidence is one click away, not merely asserted.",
        Icon: NetworkIcon,
        tag: "Live",
      },
      {
        title: "Server-computed shares",
        body: "How big a segment is — share and count — is tallied by the server from the assigned interviews. That number never comes from the language model.",
        Icon: CpuIcon,
        tag: "Live",
      },
      {
        title: "Min-gate & re-run anytime",
        body: "Personas appear only above a minimum number of analyzed interviews and can be regenerated independently at the push of a button when new conversations arrive.",
        Icon: CheckIcon,
        tag: "Live",
      },
      {
        title: "GDPR-native, hosted in Frankfurt",
        body: "In German and English, hosted in the EU, no US cloud — the voices behind your personas never leave the EU.",
        Icon: ShieldCheckIcon,
        tag: "Live",
      },
    ],
  },
  cta: {
    title: <>See your audience — evidenced, not invented.</>,
    lead: "Book a demo and see how Klymeo distills three to five personas from real interviews — every field backed by a quote, every size server-computed.",
  },
};

export default async function PersonasPage({
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
