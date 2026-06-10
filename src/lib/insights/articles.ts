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
    slug: "umfrage-sagt-nicht-warum",
    title: "Die Umfrage sagt 7 von 10. Sie sagt nicht, warum.",
    excerpt:
      "Skalen und Scores zeigen, WAS deine Zielgruppe denkt — aber nie, warum. Warum das Warum in Tiefeninterviews wohnt, und wie KI sie endlich skalierbar macht.",
    category: "Qualitative Forschung",
    date: "2026-05-20",
    readingMinutes: 6,
    body: [
      {
        kind: "p",
        text: "Die Zustimmung liegt bei 7 von 10, der Score ist seit dem letzten Quartal stabil, das Dashboard ist grün. Und trotzdem weiß nach dem Meeting niemand, was jetzt zu tun ist. Das liegt nicht an der Umfrage — sie tut genau, was sie kann. Es liegt daran, was sie prinzipiell nicht kann.",
      },
      { kind: "h2", text: "Was die Skala verschweigt" },
      {
        kind: "p",
        text: "Eine Skala verdichtet eine Entscheidung auf eine Zahl — und wirft dabei genau die Information weg, die du für die nächste Entscheidung brauchst:",
      },
      {
        kind: "ul",
        items: [
          "„Preis ist okay“ — aber nicht, ob das Verzicht, Gewohnheit oder echte Zahlungsbereitschaft ist.",
          "„Würde ich empfehlen“ — aber nicht, in welcher Situation und mit welchen Worten.",
          "Ein Absprung im Funnel — aber nicht, ob Verwirrung, Misstrauen oder schlicht ein besseres Angebot dahintersteckt.",
        ],
      },
      {
        kind: "p",
        text: "Dazu kommt ein leiser Messfehler: Skalen werden sozial beantwortet. Eine 5 fühlt sich unhöflich an, also wird es eine 7 — und der Unterschied zwischen echter Begeisterung und höflicher Gleichgültigkeit verschwindet in derselben Zahl.",
      },
      { kind: "h2", text: "Das Warum wohnt im Gespräch" },
      {
        kind: "p",
        text: "Im Tiefeninterview passiert, was keine Skala leisten kann: Jemand erzählt eine konkrete Situation, und auf die erste Antwort folgt eine Nachfrage. Erst hinter der ersten Antwort liegt der Grund.",
      },
      {
        kind: "quote",
        text: "Ich hab 7 angekreuzt, weil 5 irgendwie gemein wirkt. Ehrlich gesagt benutze ich es seit Wochen nicht mehr.",
        cite: "Aus einem KI-geführten Tiefeninterview",
      },
      {
        kind: "p",
        text: "Genau deshalb waren Tiefeninterviews immer das Werkzeug für die wichtigen Entscheidungen — und genau deshalb wurden sie so selten gemacht: Rekrutierung, Moderation, Transkription, Auswertung. Wochen an Aufwand für eine Handvoll Gespräche.",
      },
      { kind: "h2", text: "KI macht das Warum skalierbar" },
      {
        kind: "p",
        text: "KI-geführte Interviews ändern die Rechnung. Was sich für DACH-Teams dabei bewährt:",
      },
      {
        kind: "ul",
        items: [
          "Hunderte Interviews parallel statt acht pro Woche — per Link, eigenem Pool oder Panel.",
          "Auf Deutsch, mit echtem Nachbohren — auf Wunsch hörbar, per Voice-Agent.",
          "Beleg-Pflicht: Jede Aussage der Auswertung bleibt am Originalzitat verankert.",
        ],
      },
      {
        kind: "p",
        text: "Die Skala behält ihren Platz: Sie zeigt, WO du hinschauen musst. Aber die Entscheidung selbst verdient das Warum — und das steht in den Gesprächen, nicht in der Verteilung.",
      },
    ],
  },
  {
    slug: "voice-interviews-mehr-tiefe",
    title: "Voice-Interviews: Warum sprechende Teilnehmer mehr erzählen",
    excerpt:
      "Tippen ist eine Hürde — besonders mobil. Wenn ein Voice-Agent das Interview hörbar führt, werden Antworten länger und spontaner. Worauf es dabei wirklich ankommt.",
    category: "KI-Interviews",
    date: "2026-06-03",
    readingMinutes: 5,
    body: [
      {
        kind: "p",
        text: "Ein Tiefeninterview lebt von dem, was Menschen von sich aus erzählen. Genau da hat das getippte Interview eine eingebaute Bremse: Schreiben ist Arbeit. Wer auf dem Handy antwortet, kürzt ab — und der spannendste Halbsatz fällt der Tipperei zum Opfer.",
      },
      { kind: "h2", text: "Die Tipp-Hürde" },
      {
        kind: "ul",
        items: [
          "Getippte Antworten sind kurz — Nebengedanken werden weggelassen, bevor sie ausgesprochen sind.",
          "Mobil steigt die Abbruchgefahr mit jeder Frage, die eine lange Antwort verlangt.",
          "Schreiben ist redigiert: Was unhöflich oder ungeordnet wirkt, wird vor dem Absenden geglättet.",
        ],
      },
      { kind: "h2", text: "Was sich ändert, wenn gesprochen wird" },
      {
        kind: "p",
        text: "Im Voice-Interview stellt der Agent die Frage hörbar, und die Person antwortet, wie sie reden würde — mit Anläufen, Korrekturen und genau den Nebensätzen, in denen die eigentlichen Gründe stecken. Gesprochene Sprache ist weniger redigiert, und das ist forschungsrelevant: Der erste Gedanke kommt mit.",
      },
      {
        kind: "quote",
        text: "Ach, und noch was — das fällt mir jetzt erst ein: Eigentlich war der Hauptgrund ein ganz anderer …",
        cite: "Aus einem Voice-Interview, live transkribiert",
      },
      {
        kind: "p",
        text: "Solche Sätze tippt niemand. Gesagt werden sie ständig.",
      },
      { kind: "h2", text: "Worauf es technisch ankommt" },
      {
        kind: "ul",
        items: [
          "Das Transkript bleibt die Quelle der Wahrheit — jede Auswertung verweist auf die exakte Stelle, Voice ändert nichts an der Beleg-Pflicht.",
          "Unterbrechen muss erlaubt sein: Wer dem Agenten ins Wort fällt, ist engagiert — das System sollte zuhören, nicht weiterreden.",
          "Tippen bleibt jederzeit möglich — nicht jede Umgebung verträgt Sprechen, der Wechsel darf nichts kosten.",
          "Audio ist besonders persönlich: EU-Hosting und klare Löschfristen sind bei Voice keine Kür, sondern Voraussetzung.",
        ],
      },
      {
        kind: "p",
        text: "Voice ersetzt das getippte Interview nicht — es senkt die Hürde für alle, denen Reden leichter fällt als Schreiben. Und das sind, außerhalb unserer Bubble, die meisten.",
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
        text: "Ich will mich nicht durch ein Verkaufsgespräch quälen — lass mich es einfach selbst ausprobieren.",
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
