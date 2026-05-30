import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";

/**
 * Mission-Control / Cross-Study-Chat eval dataset (Etappe 1).
 *
 * Hand-crafted org of THREE study syntheses + cross-study questions. The point
 * is the cross-study anchor guarantee: every surfaced statement must trace to
 * ONE real synthesis, attributed to the RIGHT study, with no mixing of findings
 * across studies that no single synthesis makes.
 *
 * Deliberate trap: "Verlässlichkeit" appears in BOTH the onboarding study (as
 * praised platform STABILITY) and the mobile study (as broken SYNC) — opposite
 * senses in different studies. A correct answer attributes each sense to its
 * own study; a hallucinating model merges them into one false claim. All quotes
 * are verbatim so a faithful model's citations fold-match the synthesis text.
 */

// ── The org's three study syntheses (the cross-study haystack) ───────────────

const STUDY_ONBOARDING: MissionControlSynthesisInput = {
  studyId: "study_onboarding",
  studyTitle: "Onboarding-Studie Q1",
  overview:
    "Neue Admin-Nutzer kämpfen mit einer steilen Lernkurve, und die Dokumentation gilt als veraltet. Die Stabilität der Plattform selbst wird durchweg gelobt.",
  emergent_themes: [
    {
      title: "Steile Lernkurve im Onboarding",
      summary:
        "Mehrere Admins berichten, dass der Einstieg ohne Begleitung schwerfällt.",
      frequency: 4,
      sourceInsightIds: ["call_a1", "call_a2", "call_a3", "call_a4"],
      quotes: ["Ich war in der ersten Woche komplett verloren ohne Hilfe."],
    },
    {
      title: "Veraltete Dokumentation",
      summary: "Die Hilfe-Artikel zeigen alte Screenshots, die nicht mehr stimmen.",
      frequency: 3,
      sourceInsightIds: ["call_a2", "call_a3", "call_a5"],
      quotes: [
        "Die Screenshots in der Anleitung stimmen nicht mehr mit der App überein.",
      ],
    },
    {
      title: "Verlässliche Plattform-Stabilität",
      summary:
        "Trotz Onboarding-Friktion loben die Nutzer die Stabilität der Plattform.",
      frequency: 3,
      sourceInsightIds: ["call_a1", "call_a4", "call_a6"],
      quotes: [
        "Die Plattform ist extrem stabil, in sechs Monaten kein einziger Ausfall.",
      ],
    },
  ],
  tensions: [
    {
      description: "Selbstständiges Onboarding versus begleitetes Onboarding.",
      side_a: {
        label: "will sich selbst einrichten",
        sourceInsightIds: ["call_a1", "call_a6"],
        quotes: ["Ich will das selbst einrichten, ohne einen Termin zu buchen."],
      },
      side_b: {
        label: "will ein geführtes Setup",
        sourceInsightIds: ["call_a2", "call_a3"],
        quotes: ["Ohne ein Guided-Setup-Gespräch komme ich nicht klar."],
      },
    },
  ],
  basedOnCount: 6,
};

const STUDY_PRICING: MissionControlSynthesisInput = {
  studyId: "study_pricing",
  studyTitle: "Pricing-Wahrnehmung",
  overview:
    "Das Per-Seat-Pricing wird als Wachstumsbremse empfunden, während der Jahresrabatt geschätzt wird.",
  emergent_themes: [
    {
      title: "Per-Seat-Pricing als Reibungspunkt",
      summary: "Teams zögern, weitere Sitze zu kaufen, weil jeder Sitz extra kostet.",
      frequency: 5,
      sourceInsightIds: ["call_b1", "call_b2", "call_b3", "call_b4", "call_b5"],
      quotes: ["Jeder neue Sitz kostet extra, also laden wir Leute gar nicht erst ein."],
    },
    {
      title: "Jahresrabatt wird geschätzt",
      summary: "Der Rabatt auf die Jahreszahlung kommt bei den Käufern gut an.",
      frequency: 4,
      sourceInsightIds: ["call_b3", "call_b6", "call_b7"],
      quotes: ["Der Jahresrabatt hat uns die Entscheidung leicht gemacht."],
    },
  ],
  tensions: [
    {
      description: "Preis-Transparenz versus Verhandlungs-Flexibilität.",
      side_a: {
        label: "will feste, transparente Preise",
        sourceInsightIds: ["call_b1", "call_b4"],
        quotes: ["Ich will einen klaren Listenpreis, ohne verhandeln zu müssen."],
      },
      side_b: {
        label: "will individuelle Konditionen",
        sourceInsightIds: ["call_b2", "call_b5"],
        quotes: ["Wir brauchen individuelle Konditionen für unser Volumen."],
      },
    },
  ],
  basedOnCount: 7,
};

const STUDY_MOBILE: MissionControlSynthesisInput = {
  studyId: "study_mobile",
  studyTitle: "Mobile-App-Feedback",
  overview:
    "Nutzer wünschen sich einen Offline-Modus, und die Verlässlichkeit der Synchronisation ist ein wiederkehrendes Problem.",
  emergent_themes: [
    {
      title: "Wunsch nach Offline-Modus",
      summary: "Außendienst-Nutzer wollen auch ohne Verbindung arbeiten können.",
      frequency: 4,
      sourceInsightIds: ["call_c1", "call_c2", "call_c4"],
      quotes: ["Im Zug ohne Empfang kann ich gar nichts machen."],
    },
    {
      title: "Mangelhafte Sync-Verlässlichkeit",
      summary: "Daten synchronisieren sich verspätet oder gar nicht.",
      frequency: 3,
      sourceInsightIds: ["call_c3", "call_c5"],
      quotes: ["Meine Änderungen tauchen erst Stunden später auf dem Desktop auf."],
    },
  ],
  tensions: [],
  basedOnCount: 5,
};

const ORG_SYNTHESES: MissionControlSynthesisInput[] = [
  STUDY_ONBOARDING,
  STUDY_PRICING,
  STUDY_MOBILE,
];

// ── Case shape ───────────────────────────────────────────────────────────────

export interface MissionControlEvalCase {
  id: string;
  description: string;
  rationale: string;
  /** The org's syntheses for this case (the full union, or [] for empty-org). */
  buildSyntheses: () => MissionControlSynthesisInput[];
  question: string;
  expected: {
    /** Soft on answerable cases (model judgment), HARD on negative controls. */
    answered: boolean;
    /** true → refusal-clean is a HARD gate (no supporting evidence exists). */
    negativeControl?: boolean;
    /** HARD on answerable cases: every surviving citation's studyId MUST be in
     *  this set — a citation outside it is a wrong-study attribution. */
    allowedStudyIds?: string[];
    /** Soft coverage signal: studies a complete answer should draw from. */
    expectStudyIds?: string[];
  };
}

// ── Cases ────────────────────────────────────────────────────────────────────

export const MISSION_CONTROL_EVAL_CASES: MissionControlEvalCase[] = [
  // ── Cross-study, answerable — attribution-critical ────────────────────────
  {
    id: "mc_01_reliability_split",
    description: "Verlässlichkeit across studies (gegensätzliche Bedeutungen)",
    rationale:
      "DER Kern-Test: 'Verlässlichkeit' steht in der Onboarding-Studie als gelobte Plattform-STABILITÄT und in der Mobile-Studie als kaputte SYNC. Ein guter Agent trennt beide und ordnet jede Aussage ihrer Studie zu; ein halluzinierender vermischt sie zu einer falschen Gesamtaussage.",
    buildSyntheses: () => ORG_SYNTHESES,
    question:
      "Was sagen die Studien über Verlässlichkeit und Stabilität? Bitte pro Studie.",
    expected: {
      answered: true,
      allowedStudyIds: ["study_onboarding", "study_mobile"],
      expectStudyIds: ["study_onboarding", "study_mobile"],
    },
  },
  {
    id: "mc_02_compare_onboarding_pricing",
    description: "Vergleich Onboarding- vs. Pricing-Studie",
    rationale:
      "Klassischer Vergleichs-Auftrag. Jede Seite muss aus IHRER Studie zitiert werden; kein Übertragen eines Befundes auf die andere Studie.",
    buildSyntheses: () => ORG_SYNTHESES,
    question:
      "Vergleiche die zentralen Befunde aus der Onboarding-Studie und der Pricing-Studie.",
    expected: {
      answered: true,
      allowedStudyIds: ["study_onboarding", "study_pricing"],
      expectStudyIds: ["study_onboarding", "study_pricing"],
    },
  },
  {
    id: "mc_03_pricing_only",
    description: "Single-study-Zuordnung: Preisgestaltung",
    rationale:
      "Preis-Themen existieren NUR in der Pricing-Studie. Der Agent muss ausschließlich study_pricing zitieren — keine Zuordnung zu Onboarding/Mobile (Wrong-Source-Falle).",
    buildSyntheses: () => ORG_SYNTHESES,
    question: "Was wurde zum Thema Preisgestaltung berichtet?",
    expected: {
      answered: true,
      allowedStudyIds: ["study_pricing"],
      expectStudyIds: ["study_pricing"],
    },
  },
  {
    id: "mc_04_mobile_wishes",
    description: "Single-study-Zuordnung: mobile Wünsche",
    rationale:
      "Offline-Modus steht nur in der Mobile-Studie. Erwartet study_mobile, nichts anderes.",
    buildSyntheses: () => ORG_SYNTHESES,
    question: "Welche Wünsche gibt es rund um die mobile Nutzung?",
    expected: {
      answered: true,
      allowedStudyIds: ["study_mobile"],
      expectStudyIds: ["study_mobile"],
    },
  },
  {
    id: "mc_05_recurring_themes",
    description: "Welche Themen tauchen in mehr als einer Studie auf?",
    rationale:
      "Soft/Urteil: Verlässlichkeit wird in zwei Studien berührt (Stabilität vs. Sync). Ein vorsichtiger Agent darf das studienübergreifend benennen (mit Zitat je Studie) ODER ehrlich sagen, dass kein identisches Thema doppelt vorkommt. Beides ok — solange jede Zitat-Zuordnung korrekt ankert.",
    buildSyntheses: () => ORG_SYNTHESES,
    question: "Welche Themen tauchen in mehr als einer Studie auf?",
    expected: {
      answered: true,
      allowedStudyIds: ["study_onboarding", "study_pricing", "study_mobile"],
    },
  },
  // ── Negative controls — no supporting evidence anywhere ───────────────────
  {
    id: "mc_06_neg_temporal",
    description: "Zeitlicher Trend (keine Zeitdaten in irgendeiner Studie)",
    rationale:
      "Keine Synthese hat eine zeitliche Dimension. Ein Trend ist nicht ableitbar — ehrliche Absage statt Extrapolation.",
    buildSyntheses: () => ORG_SYNTHESES,
    question:
      "Wie hat sich die Zufriedenheit der Nutzer über die letzten zwölf Monate entwickelt?",
    expected: { answered: false, negativeControl: true },
  },
  {
    id: "mc_07_neg_salary",
    description: "Gehaltszufriedenheit (falsche Domäne)",
    rationale:
      "Keine Studie behandelt Mitarbeiter-/Gehaltszufriedenheit. Der Agent darf nichts erfinden.",
    buildSyntheses: () => ORG_SYNTHESES,
    question:
      "Was sagen die Studien über die Gehaltszufriedenheit der Mitarbeiter?",
    expected: { answered: false, negativeControl: true },
  },
  {
    id: "mc_08_mixing_trap",
    description: "Erfundene studienübergreifende Kausalität (Mixing-Falle)",
    rationale:
      "Verknüpft einen Mobile-Befund (Offline-Modus) mit einem Pricing-Befund zu einer Kausalität, die in KEINER Synthese steht. Die ehrliche Antwort verneint die Prämisse. Selbst wenn der Agent nuanciert antwortet, darf KEIN erfundenes (zusammengemischtes) Zitat überleben, und Zuordnungen müssen korrekt sein.",
    buildSyntheses: () => ORG_SYNTHESES,
    question:
      "Stimmt es, dass Nutzer wegen des fehlenden Offline-Modus zum günstigeren Pricing-Modell wechseln wollten?",
    expected: {
      answered: false,
      allowedStudyIds: ["study_pricing", "study_mobile"],
    },
  },
  {
    id: "mc_09_empty_org",
    description: "Org ohne Synthesen",
    rationale:
      "Keine Studien vorhanden — der Agent muss ohne Modell-Aufruf ehrlich absagen (No-Studies-Pfad).",
    buildSyntheses: () => [],
    question: "Welche Themen tauchen studienübergreifend auf?",
    expected: { answered: false, negativeControl: true },
  },
];
