/**
 * Insights content source (Etappe C — the SEO-Motor).
 *
 * ONE source of truth for the /insights index, the /insights/[slug] article
 * pages (generateStaticParams + generateMetadata), and sitemap.ts — so the
 * prebuilt routes and the sitemap can never drift apart (§5/§8). Today this is a
 * small typed TS array with 1–2 seed articles; a real CMS/MDX pipeline can
 * replace the data layer later without touching the pages, as long as it keeps
 * exporting the same shape + helpers.
 *
 * Copy status: SEED / placeholder editorial — honest, evidence-anchored, du-Form,
 * anti-hype, no fabricated metrics or UWG-risky superlatives. André/Redaktion
 * sharpens and adds real articles later.
 */

/** A single rendered block of an article body. Kept deliberately small. */
export type InsightBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "quote"; text: string; cite?: string };

export interface InsightArticle {
  /** URL segment — lowercase, kebab, stable (changing it breaks links). */
  slug: string;
  /** Article headline → page <title> via the "%s — findr." template. */
  title: string;
  /** Teaser + meta description (one honest sentence or two). */
  excerpt: string;
  /** Topic label shown as the card/article eyebrow. */
  category: string;
  /** ISO date (YYYY-MM-DD) — sortable as a string, no Date object needed. */
  date: string;
  /** Rough reading time in minutes (shown in the article header). */
  readingMinutes: number;
  /** Ordered body blocks. */
  body: InsightBlock[];
}

export const INSIGHTS: InsightArticle[] = [
  {
    slug: "crm-forecast-luegt",
    title: "Warum dein CRM-Forecast lügt — und was die Gespräche verraten",
    excerpt:
      "CRM-Stages bilden ab, was Reps eintragen — nicht, was im Deal wirklich passiert. Warum eine risiko-adjustierte Prognose aus echten Gesprächen ehrlicher ist als jede Pipeline-Spalte.",
    category: "Conversation Intelligence",
    date: "2026-05-20",
    readingMinutes: 6,
    body: [
      {
        kind: "p",
        text: "Jeden Montag dieselbe Übung: Die Pipeline wird durchgesprochen, die Stages werden geschoben, und am Ende steht eine Zahl, an die niemand so richtig glaubt. Das liegt selten an den Reps. Es liegt daran, woraus der Forecast gebaut ist.",
      },
      { kind: "h2", text: "Das Problem mit dem Stage-basierten Forecast" },
      {
        kind: "p",
        text: "Ein klassischer CRM-Forecast multipliziert Deal-Wert mit einer Wahrscheinlichkeit, die an der Stage hängt. Die Stage wiederum pflegt der Rep — von Hand, nach bestem Wissen und mit einem verständlichen Hang zum Optimismus. Was dabei systematisch verloren geht:",
      },
      {
        kind: "ul",
        items: [
          "Der Champion ist intern abgesprungen, aber die Stage steht noch auf „Verhandlung“.",
          "Ein Wettbewerber ist im Spiel — erwähnt im Call, nirgends im CRM-Feld.",
          "Budget-Signale aus dem letzten Gespräch, die niemand dokumentiert hat.",
        ],
      },
      {
        kind: "p",
        text: "Der Forecast ist also nur so ehrlich wie die Felder, die ihn speisen. Und die Felder kennen die Hälfte der Geschichte nicht.",
      },
      { kind: "h2", text: "Was Gespräche verraten, was Felder nicht können" },
      {
        kind: "p",
        text: "Die entscheidenden Signale fallen im Gespräch — und bleiben dort liegen. Ein einziger Satz kann ein „wahrscheinlich“ in ein „gefährdet“ drehen:",
      },
      {
        kind: "quote",
        text: "Sarah war eigentlich die treibende Kraft auf unserer Seite — seit sie letzte Woche gegangen ist, liegt das Thema etwas auf Eis.",
        cite: "Aus einem echten Discovery-Call",
      },
      {
        kind: "p",
        text: "Kein Pflichtfeld der Welt fängt diesen Moment ein. Eine Conversation-Intelligence-Engine, die jeden Call mitliest, schon — und kann ihn an der exakten Transkript-Stelle belegen, statt ihn zu interpretieren.",
      },
      { kind: "h2", text: "Risiko-adjustiert statt optimistisch" },
      {
        kind: "p",
        text: "Die ehrlichere Prognose dreht die Logik um: Statt einer optimistischen Stage-Wahrscheinlichkeit bekommt jeder Deal einen Risiko-Score aus dem, was tatsächlich gesagt wurde — und der Forecast zeigt eine Spanne statt einer Wunschzahl.",
      },
      {
        kind: "ul",
        items: [
          "Best Case, wahrscheinlich, Worst Case — als Spanne, nicht als Punkt.",
          "Jedes Risiko-Signal mit dem Zitat belegt, das es ausgelöst hat.",
          "Aktualisiert nach jedem Call, nicht erst beim Quartals-Review.",
        ],
      },
      {
        kind: "p",
        text: "Der Forecast lügt nicht mehr, weil er nicht mehr rät. Er rechnet mit dem, was im Gespräch steht — belegt, nicht geraten.",
      },
    ],
  },
  {
    slug: "dsgvo-native-ki-interviews",
    title:
      "DSGVO-native KI-Interviews: Worauf DACH-Teams bei Voice of Customer achten müssen",
    excerpt:
      "KI-geführte Interviews skalieren Research enorm — aber nur, wenn Datenschutz, Hosting und Beleg-Pflicht von Anfang an stimmen. Eine ehrliche Checkliste für Teams in der DACH-Region.",
    category: "DSGVO & KI",
    date: "2026-05-06",
    readingMinutes: 7,
    body: [
      {
        kind: "p",
        text: "KI-Interviews machen etwas möglich, das in der Research lange unbezahlbar war: mit vielen echten Nutzer:innen strukturiert sprechen, ohne dass ein Mensch jeden Termin moderiert. Für DACH-Teams hängt der Nutzen aber an Fragen, die rein englischsprachige Tools selten zuerst beantworten.",
      },
      { kind: "h2", text: "Wo werden die Daten verarbeitet?" },
      {
        kind: "p",
        text: "Ein Interview ist personenbezogen, sobald jemand spricht. Entscheidend ist deshalb nicht nur, ob ein Tool „DSGVO-konform“ auf der Website stehen hat, sondern wo Transkripte und Aufnahmen tatsächlich verarbeitet und gespeichert werden. EU-Hosting ist hier kein Bonus, sondern die Grundlage.",
      },
      {
        kind: "ul",
        items: [
          "Verarbeitung und Speicherung innerhalb der EU — idealerweise nachweisbar in Deutschland.",
          "Ein Auftragsverarbeitungsvertrag (AVV), der die KI-Verarbeitung explizit abdeckt.",
          "Klare Aufbewahrungs- und Löschfristen statt „unbegrenzt“.",
        ],
      },
      { kind: "h2", text: "Spricht das Tool die Sprache deiner Nutzer:innen?" },
      {
        kind: "p",
        text: "Ein KI-Interview steht und fällt mit der Nachfrage im richtigen Moment. Auf Deutsch — mit Dialekt, Füllwörtern und Zwischentönen — ist das deutlich anspruchsvoller als auf Englisch. Wer DACH-Nutzer:innen befragt, sollte testen, ob die KI wirklich nachhakt statt nur abzuhaken.",
      },
      { kind: "h2", text: "Kannst du jede Aussage belegen?" },
      {
        kind: "p",
        text: "Der größte Risikofaktor bei KI-Synthese ist nicht der Datenschutz, sondern die erfundene Mehrheit: ein Trend, den das Modell plausibel formuliert, aber niemand so gesagt hat. Die Gegenmaßnahme ist Beleg-Pflicht.",
      },
      {
        kind: "quote",
        text: "Ich will mich nicht durch ein Sales-Gespräch quälen — lass mich es einfach selbst ausprobieren.",
        cite: "Aus einem KI-geführten Nutzer-Interview",
      },
      {
        kind: "p",
        text: "Jede Aussage in der Synthese sollte auf das exakte Zitat zurück-klickbar sein, und „in 3 von 7 Studien“ sollte deterministisch gezählt sein — nicht geschätzt. Was nicht belegt ist, gehört nicht in die Auswertung.",
      },
      {
        kind: "p",
        text: "Kurz: KI-Interviews sind ein enormer Hebel für Voice of Customer in der DACH-Region — wenn Hosting, Sprache und Beleg-Pflicht von Tag eins stimmen.",
      },
    ],
  },
];

/** All slugs — for generateStaticParams and sitemap.ts (same source). */
export function getAllInsightSlugs(): string[] {
  return INSIGHTS.map((a) => a.slug);
}

/** Look up one article by slug (undefined → 404 in the page). */
export function getInsight(slug: string): InsightArticle | undefined {
  return INSIGHTS.find((a) => a.slug === slug);
}

/** Articles newest-first. ISO date strings sort correctly as plain strings. */
export const INSIGHTS_BY_DATE: InsightArticle[] = [...INSIGHTS].sort((a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
);

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Format an ISO date (YYYY-MM-DD) as a German long date, e.g. "20. Mai 2026".
 * Done by hand (no Date/Intl) so it's deterministic across build environments
 * and free of ICU/timezone surprises in SSR.
 */
export function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS_DE[(m ?? 1) - 1] ?? "";
  return `${d}. ${month} ${y}`;
}
