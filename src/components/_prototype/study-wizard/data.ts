/**
 * Dummy-Daten + „Fake-KI" für den Studio-Klick-Prototyp.
 *
 * Hier passiert KEIN echter KI-Call und KEIN Fetch. `generateProposal` gibt nach
 * einer simulierten Denkpause einen fest verdrahteten Vorschlag zurück, damit der
 * Flow „Briefing → KI füllt vor → bestätigen" erlebbar wird, ohne Backend/DB.
 *
 * Bewusst NICHT gelöst: der produktive „heimliche Draft"-Mechanismus (zweistufiger
 * Submit, der beim Generieren still einen draft-Plan anlegt). Das ist ein separates
 * Backend-Thema — dieser Prototyp legt zu keinem Zeitpunkt etwas an.
 */

export type UseCase =
  | "general_survey"
  | "brand_research"
  | "creative_test"
  | "concept_test"
  | "usability_test";

export type AudienceType = "b2c" | "b2b";
export type InterviewMode = "text" | "voice";
export type Depth = "flach" | "mittel" | "tief";

export interface Topic {
  id: string;
  label: string;
  mainQuestion: string;
  probes: string[];
}

export interface Proposal {
  title: string;
  useCase: UseCase;
  persona: string;
  sampleTarget: number;
  audienceType: AudienceType;
  topics: Topic[];
}

export interface AnalyticsToggles {
  visualCapture: boolean;
  eventTracking: boolean;
  turnSignals: boolean;
  tts: boolean;
}

export interface StudyState {
  briefing: string;
  proposal: Proposal | null;
  mode: InterviewMode;
  depth: Depth;
  language: "de" | "en";
  /** Erweitert (eingeklappt) */
  maxRounds: number | null;
  durationMin: number | null;
  /** Optionale Analyse (eingeklappt im Interview-Schritt) */
  analytics: AnalyticsToggles;
}

export const INITIAL_STATE: StudyState = {
  briefing: "",
  proposal: null,
  mode: "text",
  depth: "mittel",
  language: "de",
  maxRounds: null,
  durationMin: null,
  analytics: {
    visualCapture: false,
    eventTracking: false,
    turnSignals: false,
    tts: false,
  },
};

/** Beispiel-Briefings — füllen das Eingabefeld per Klick (Demo-Anker). */
export const EXAMPLE_BRIEFINGS: string[] = [
  "Würden berufstätige Eltern eine App für gesunde Familienrezepte nutzen – und was hält sie ab?",
  "Wie treffen kleine Cafés ihre Entscheidung für einen neuen Kaffee-Lieferanten?",
  "Was erwarten Erstkäufer:innen von unserer neuen Verpackung im Regal?",
];

export const USE_CASES: {
  id: UseCase;
  label: string;
  hint: string;
  needsStimulus: boolean;
  needsTask: boolean;
}[] = [
  {
    id: "general_survey",
    label: "Offene Befragung",
    hint: "Breit explorieren, Motive & Hürden verstehen",
    needsStimulus: false,
    needsTask: false,
  },
  {
    id: "brand_research",
    label: "Markenwahrnehmung",
    hint: "Wie wird die Marke erlebt und eingeordnet",
    needsStimulus: false,
    needsTask: false,
  },
  {
    id: "concept_test",
    label: "Konzepttest",
    hint: "Reaktion auf eine Idee oder ein Mockup",
    needsStimulus: true,
    needsTask: false,
  },
  {
    id: "creative_test",
    label: "Creative-Test",
    hint: "Anzeige, Spot oder Visual bewerten",
    needsStimulus: true,
    needsTask: false,
  },
  {
    id: "usability_test",
    label: "Usability-Test",
    hint: "Aufgabe an einem Prototyp lösen lassen",
    needsStimulus: false,
    needsTask: true,
  },
];

export function useCaseMeta(id: UseCase) {
  return USE_CASES.find((u) => u.id === id) ?? USE_CASES[0];
}

export const DEPTHS: {
  id: Depth;
  label: string;
  layers: string;
  approxQuestions: string;
  approxMinutes: string;
}[] = [
  {
    id: "flach",
    label: "Flach",
    layers: "1 Nachfrage-Schicht",
    approxQuestions: "≈ 4–5 Fragen",
    approxMinutes: "≈ 5 Min",
  },
  {
    id: "mittel",
    label: "Mittel",
    layers: "2 Nachfrage-Schichten",
    approxQuestions: "≈ 8–10 Fragen",
    approxMinutes: "≈ 8–12 Min",
  },
  {
    id: "tief",
    label: "Tief",
    layers: "4 Nachfrage-Schichten",
    approxQuestions: "≈ 14–18 Fragen",
    approxMinutes: "≈ 18–25 Min",
  },
];

/** Simulierte KI-Denkpause (ms). */
export const FAKE_THINKING_MS = 1500;

let topicSeq = 0;
function topic(label: string, mainQuestion: string, probes: string[]): Topic {
  topicSeq += 1;
  return { id: `t${topicSeq}`, label, mainQuestion, probes };
}

/**
 * Drei kanned Vorschläge, je einer pro Beispiel-Briefing. Ein simpler
 * Stichwort-Router wählt anhand des Briefings — so wirkt jeder der drei
 * Beispiel-Klicks kohärent. Es ist KEINE echte Inferenz, nur ein glaubwürdiger
 * Prototyp-Effekt. Fallback ist der Familienrezepte-Vorschlag.
 */
function recipesProposal(): Proposal {
  return {
    title: "Konzepttest: App für gesunde Familienrezepte",
    useCase: "general_survey",
    persona:
      "Berufstätige Eltern mit Kindern im Haushalt (25–45 Jahre), die unter Zeitdruck kochen und trotzdem Wert auf gesunde Ernährung legen.",
    sampleTarget: 15,
    audienceType: "b2c",
    topics: [
      topic(
        "Heutige Koch-Routine",
        "Wie entscheidest du unter der Woche, was auf den Tisch kommt?",
        ["Was ist dabei die größte Hürde?", "Wie viel Zeit bleibt dir realistisch?"],
      ),
      topic(
        "Anspruch vs. Alltag",
        "Wo klafft für dich die Lücke zwischen „gesund kochen wollen“ und dem, was tatsächlich passiert?",
        ["Was hast du zuletzt aufgegeben?", "Was würde es dir leichter machen?"],
      ),
      topic(
        "Reaktion auf die Idee",
        "Eine App schlägt dir Familienrezepte nach Zeit und Vorräten vor — was geht dir zuerst durch den Kopf?",
        ["Was würde dich abhalten, sie zu nutzen?", "Wofür würdest du dafür zahlen?"],
      ),
      topic("Heutige Lösungswege", "Was nutzt du heute, um diese Aufgabe zu lösen?", [
        "Was fehlt diesen Lösungen?",
      ]),
    ],
  };
}

function coffeeProposal(): Proposal {
  return {
    title: "Lieferanten-Entscheidung: Kaffee für kleine Cafés",
    useCase: "general_survey",
    persona:
      "Inhaber:innen und Betriebsleiter:innen kleiner, unabhängiger Cafés, die ihren Kaffee-Lieferanten selbst auswählen.",
    sampleTarget: 12,
    audienceType: "b2b",
    topics: [
      topic(
        "Auslöser für den Wechsel",
        "Wann haben Sie zuletzt über einen neuen Kaffee-Lieferanten nachgedacht — und warum?",
        ["Was war der konkrete Anlass?", "Wie dringend war es?"],
      ),
      topic(
        "Entscheidungs-Kriterien",
        "Woran machen Sie fest, ob ein Lieferant zu Ihrem Café passt?",
        ["Was ist ein Ausschlusskriterium?", "Wo schließen Sie Kompromisse?"],
      ),
      topic(
        "Heutiger Beschaffungs-Weg",
        "Wie läuft die Bestellung und Nachlieferung heute konkret ab?",
        ["Was nervt daran am meisten?"],
      ),
    ],
  };
}

function packagingProposal(): Proposal {
  return {
    title: "Verpackungstest: Erstkäufer:innen im Regal",
    useCase: "concept_test",
    persona:
      "Personen, die das Produkt noch nie gekauft haben und im Supermarkt-Regal zum ersten Mal darauf treffen.",
    sampleTarget: 15,
    audienceType: "b2c",
    topics: [
      topic(
        "Erster Eindruck",
        "Was nehmen Sie als Erstes wahr, wenn Sie diese Verpackung im Regal sehen?",
        ["Was fällt zuerst auf?", "Was bleibt unklar?"],
      ),
      topic(
        "Erwartete Eigenschaften",
        "Was vermuten Sie über das Produkt allein anhand der Verpackung?",
        ["Wofür halten Sie es?", "Für wen scheint es gemacht?"],
      ),
      topic(
        "Kauf-Hürde",
        "Was würde Sie davon abhalten, es das erste Mal mitzunehmen?",
        ["Was müsste die Verpackung anders zeigen?"],
      ),
    ],
  };
}

export function generateProposal(briefing: string): Proposal {
  const b = briefing.toLowerCase();
  if (/kaffee|café|cafe|lieferant/.test(b)) return coffeeProposal();
  if (/verpackung|regal|supermarkt/.test(b)) return packagingProposal();
  return recipesProposal();
}

export function audienceLabel(a: AudienceType): string {
  return a === "b2c" ? "Endkund:innen (du)" : "Geschäftlich (Sie)";
}
