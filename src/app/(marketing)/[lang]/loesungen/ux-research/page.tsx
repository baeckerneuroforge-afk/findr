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
  TargetIcon,
  RadarIcon,
  SmartphoneIcon,
  CpuIcon,
  TrendingUpIcon,
  ShieldCheckIcon,
} from "@/components/marketing/icons";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import { UsabilityResultShowcase } from "@/components/marketing/studio/UsabilityResultShowcase";

const PATH = "/loesungen/ux-research";
const META = {
  title: {
    de: "UX Research mit KI — task-basiertes Usability-Testing, DSGVO-nativ",
    en: "UX Research with AI — task-based usability testing, GDPR-native",
  },
  ogTitle: {
    de: "UX Research mit KI — Klymeo",
    en: "UX Research with AI — Klymeo",
  },
  description: {
    de: "Task-basiertes Usability-Testing auf derselben KI-Engine: Teilnehmer:innen bekommen eine konkrete Aufgabe, die KI moderiert und fragt nach dem Warum — währenddessen misst Klymeo das Verhalten (Klicks, Zeit, Reibung) und bewertet automatisch, ob die Aufgabe gegen dein Erfolgskriterium geschafft wurde. Rein verhaltensbasiert, keine Emotions- oder Biometrieanalyse. Auf Deutsch und Englisch, DSGVO-nativ in Frankfurt.",
    en: "Task-based usability testing on the same AI engine: participants get a concrete task, the AI moderates and probes the why — meanwhile Klymeo measures behaviour (clicks, time, friction) and automatically assesses whether the task was completed against your success criterion. Purely behavioural, no emotion or biometric analysis. In German and English, GDPR-native in Frankfurt.",
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
      de: "Klymeo — UX Research mit KI",
      en: "Klymeo — UX Research with AI",
    }),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

const CONTENT: UseCaseContent = {
  slug: "ux-research",
  eyebrow: "Anwendungsfall · UX Research",
  heroTitle: <>Sieh, ob Menschen es wirklich bedienen können.</>,
  heroSubhead:
    "UX Research läuft bei Klymeo task-basiert: Teilnehmer:innen bekommen eine konkrete Aufgabe, die KI moderiert das Interview und fragt nach dem Warum — währenddessen misst Klymeo still das Verhalten (Klicks, Scrollen, Zeit, Reibung) und bewertet, ob die Aufgabe gegen dein Erfolgskriterium geschafft wurde. Rein verhaltensbasiert, ohne Biometrie.",
  audience:
    "Produkt-, UX- und Design-Teams, die vor dem Ausrollen wissen wollen, ob ein Flow, Prototyp oder Konzept wirklich funktioniert — nicht nur, ob er gefällt.",
  visual: <UsabilityResultShowcase locale="de" />,
  how: {
    eyebrow: "So funktioniert UX Research",
    title: <>Von der Aufgabe zum belegten Usability-Ergebnis.</>,
    lead: "Vier verbundene Schritte — von der definierten Aufgabe bis zum server-berechneten Ergebnis. Rekrutiert über Link, eigenen Pool oder Panel, ohne Moderator.",
    steps: [
      {
        phase: "Aufsetzen",
        title: "Aufgabe & Erfolgskriterium definieren",
        body: "Leg in der Studie eine konkrete Aufgabe fest und beschreib, woran Erfolg messbar ist. Das Erfolgskriterium bleibt forscher-seitig — die Teilnehmer:innen sehen nur die Aufgabe selbst.",
        tag: "Live",
      },
      {
        phase: "Durchführen",
        title: "Teilnehmer:in löst die Aufgabe",
        body: "Die Aufgabe erscheint als Karte neben dem KI-Interview. Mit Einwilligung zeichnet Klymeo die Interaktion auf — Klicks, Scrollen, Verweildauer — und die Person markiert am Ende bewusst, ob sie die Aufgabe geschafft hat oder nicht.",
        tag: "Live",
      },
      {
        phase: "Messen",
        title: "Verhalten & Erfolg — server-berechnet",
        body: "Klymeo rechnet serverseitig: Ausgang, Zeit pro Aufgabe, Klick-Anzahl und Reibung aus Rage-Clicks. Ein KI-Urteil schätzt zusätzlich gegen dein Erfolgskriterium — getrennt vom Verhaltens-Signal, nie darüber.",
        tag: "Live",
      },
      {
        phase: "Auswerten",
        title: "Usability-Ergebnis pro Session & Studie",
        body: "Pro Interview eine Ergebnis-Karte; über die Studie hinweg eine Erfolgsquote samt Ø Zeit, Klicks und Reibungsrate — aggregiert erst ab genügend Sessions, nie auf eine Einzelperson rückführbar.",
        tag: "Live",
      },
    ],
  },
  proof: {
    eyebrow: "Belegt, nicht geraten",
    title: <>Was UX Research konkret liefert.</>,
    lead: "Jede Fähigkeit arbeitet an echtem Verhalten echter Menschen — von der Aufgabe bis zum aggregierten Usability-Ergebnis.",
    points: [
      {
        title: "Aufgabe & Erfolgskriterium",
        body: "Definier eine konkrete Aufgabe und ihr Erfolgskriterium. Teilnehmer:innen sehen die Aufgabe als Karte im Interview; das Kriterium bleibt forscher-seitig.",
        Icon: TargetIcon,
        tag: "Live",
      },
      {
        title: "Verhaltens-Signale, server-berechnet",
        body: "Klicks, Scrollen und Zeit pro Aufgabe werden während des Interviews still erfasst und serverseitig zu Kennzahlen verdichtet — nicht vom Modell geschätzt.",
        Icon: RadarIcon,
        tag: "Live",
      },
      {
        title: "Reibung erkennen",
        body: "Rage-Clicks — mehrere schnelle Klicks auf dieselbe Stelle — werden als Reibungspunkte markiert. Ein Verhaltenssignal, kein Affekt.",
        Icon: SmartphoneIcon,
        tag: "Live",
      },
      {
        title: "KI-Erfolgs-Urteil",
        body: "Ein KI-Modell schätzt aus dem Transkript, ob die Aufgabe gegen dein Kriterium geschafft wurde — als zweite Meinung in einem eigenen Feld. Das maßgebliche Erfolgs-Signal bleibt verhaltensbasiert.",
        Icon: CpuIcon,
        tag: "Live",
      },
      {
        title: "Usability-Metriken pro Studie",
        body: "Über alle Sessions: Erfolgsquote, Ø Zeit pro Aufgabe, Ø Klicks und Reibungsrate — aggregiert ab einer Mindestzahl, nie auf eine Einzelperson rückführbar.",
        Icon: TrendingUpIcon,
        tag: "Live",
      },
      {
        title: "AI-Act- & DSGVO-sauber",
        body: "Nur Verhalten — keine Emotionserkennung, keine Biometrie. Einwilligung vor jeder Erfassung, EU-Datenresidenz in Frankfurt.",
        Icon: ShieldCheckIcon,
        tag: "Live",
      },
    ],
  },
  cta: {
    title: <>Teste, ob dein Flow wirklich funktioniert.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo Aufgabenerfolg und Reibung am echten Verhalten misst — belegt, nicht vermutet.",
  },
};

const CONTENT_EN: UseCaseContent = {
  slug: "ux-research",
  eyebrow: "Use case · UX Research",
  heroTitle: <>See whether people can actually use it.</>,
  heroSubhead:
    "UX research at Klymeo is task-based: participants get a concrete task, the AI moderates the interview and probes the why — meanwhile Klymeo quietly measures behaviour (clicks, scrolling, time, friction) and assesses whether the task was completed against your success criterion. Purely behavioural, no biometrics.",
  audience:
    "Product, UX and design teams who want to know — before rolling out — whether a flow, prototype or concept actually works, not just whether people like it.",
  visual: <UsabilityResultShowcase locale="en" />,
  how: {
    eyebrow: "How UX Research works",
    title: <>From the task to an evidenced usability result.</>,
    lead: "Four connected steps — from the defined task to the server-computed result. Recruited by link, your own pool or a panel, with no moderator.",
    steps: [
      {
        phase: "Set up",
        title: "Define the task & success criterion",
        body: "Set a concrete task in the study and describe what makes success measurable. The success criterion stays researcher-side — participants only ever see the task itself.",
        tag: "Live",
      },
      {
        phase: "Run",
        title: "The participant completes the task",
        body: "The task appears as a card beside the AI interview. With consent, Klymeo records the interaction — clicks, scrolling, dwell time — and the person explicitly marks “done” or “couldn't” at the end.",
        tag: "Live",
      },
      {
        phase: "Measure",
        title: "Behaviour & success — computed server-side",
        body: "Klymeo computes server-side: outcome, time on task, click count and friction from rage-clicks. An AI verdict additionally assesses against your success criterion — separate from the behavioural signal, never overriding it.",
        tag: "Live",
      },
      {
        phase: "Analyze",
        title: "Usability result per session & study",
        body: "A result card per interview; across the study a success rate with average time, clicks and friction rate — aggregated only once there are enough sessions, never traceable to a single person.",
        tag: "Live",
      },
    ],
  },
  proof: {
    eyebrow: "Evidenced, not guessed",
    title: <>What UX Research delivers, concretely.</>,
    lead: "Every capability works on real behaviour from real people — from the task to the aggregated usability result.",
    points: [
      {
        title: "Task & success criterion",
        body: "Define a concrete task and its success criterion. Participants see the task as a card in the interview; the criterion stays researcher-side.",
        Icon: TargetIcon,
        tag: "Live",
      },
      {
        title: "Behavioural signals, computed server-side",
        body: "Clicks, scrolling and time on task are captured quietly during the interview and distilled into metrics server-side — not estimated by the model.",
        Icon: RadarIcon,
        tag: "Live",
      },
      {
        title: "Spot friction",
        body: "Rage-clicks — several rapid clicks on the same spot — are flagged as friction points. A behavioural signal, not affect.",
        Icon: SmartphoneIcon,
        tag: "Live",
      },
      {
        title: "AI success verdict",
        body: "An AI model assesses from the transcript whether the task was completed against your criterion — as a second opinion in its own field. The authoritative success signal stays behavioural.",
        Icon: CpuIcon,
        tag: "Live",
      },
      {
        title: "Usability metrics per study",
        body: "Across all sessions: success rate, average time on task, average clicks and friction rate — aggregated above a minimum count, never traceable to a single person.",
        Icon: TrendingUpIcon,
        tag: "Live",
      },
      {
        title: "AI-Act- & GDPR-clean",
        body: "Behaviour only — no emotion recognition, no biometrics. Consent before any capture, EU data residency in Frankfurt.",
        Icon: ShieldCheckIcon,
        tag: "Live",
      },
    ],
  },
  cta: {
    title: <>Test whether your flow actually works.</>,
    lead: "Book a demo and see how Klymeo measures task success and friction from real behaviour — evidenced, not assumed.",
  },
};

export default async function UxResearchPage({
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
