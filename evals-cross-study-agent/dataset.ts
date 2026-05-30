import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import { toIndexEntry, type CrossStudyToolset } from "@/lib/cross-study-agent/tools";

/**
 * Cross-Study-Agent eval dataset (Bau 1) — multiple synthetic studies + a fake,
 * fixture-backed toolset that drives the REAL research loop without a DB.
 *
 * The studies are deterministic and every quote is UNIQUE to one study, so
 * attribution is unambiguous: a citation can only be correct for the one study
 * its quote lives in. The cases tag the studies that SHOULD be loaded
 * (`relevantStudyIds`) so the runner can score tool-use recall/precision, and
 * tag forbidden studies so wrong-attribution is caught.
 *
 * Bau-1 scope: tool-use correctness + final anchor-pass + honest refusal. The
 * adversarial META-pattern probe (csa_05) only checks that the agent REFUSES to
 * fabricate a cross-study pattern.
 *
 * Bau 2 adds AGG_FIXTURE_STUDIES (a second org where the phrase "Self-Service"
 * appears in EXACTLY 3 of 5 theme titles — a known deterministic count) and three
 * cases on it: deterministic count correctness (csa_07), resistance to a leading
 * "all five" over-claim (csa_08), and the per-study-citation duty (csa_09). The
 * Bau-1 cases + fixture are left byte-unchanged.
 */

// ── synthetic studies (the fixture org) ──────────────────────────────────────

export const CROSS_STUDY_FIXTURE_STUDIES: MissionControlSynthesisInput[] = [
  {
    studyId: "study-onb-q1",
    studyTitle: "Onboarding-Studie Q1",
    overview:
      "Neue Admins berichten durchgängig von Reibung in der Ersteinrichtung.",
    basedOnCount: 6,
    emergent_themes: [
      {
        title: "Onboarding-Friction für neue Admins",
        summary:
          "Die initiale Einrichtung kostet neue Admins spürbar viel Zeit und Mühe.",
        frequency: 4,
        sourceInsightIds: ["onb1-i1", "onb1-i2", "onb1-i3", "onb1-i4"],
        quotes: ["Die Ersteinrichtung hat mich zwei Stunden gekostet"],
      },
      {
        title: "Fehlende Beispiel-Daten",
        summary:
          "Ohne vorbefüllte Demo-Daten finden neue Nutzer schwer einen Einstieg.",
        frequency: 3,
        sourceInsightIds: ["onb1-i2", "onb1-i5", "onb1-i6"],
        quotes: ["Ohne Demo-Daten wusste ich nicht, wo ich anfangen soll"],
      },
    ],
    tensions: [],
  },
  {
    studyId: "study-onb-q3",
    studyTitle: "Onboarding-Studie Q3",
    overview:
      "Im dritten Quartal stand die Schrittzahl des Setup-Prozesses im Fokus.",
    basedOnCount: 7,
    emergent_themes: [
      {
        title: "Onboarding mit zu vielen Schritten",
        summary:
          "Der Setup-Wizard wird als zu lang und kleinteilig wahrgenommen.",
        frequency: 5,
        sourceInsightIds: [
          "onb3-i1",
          "onb3-i2",
          "onb3-i3",
          "onb3-i4",
          "onb3-i5",
        ],
        quotes: ["Der Setup-Wizard hat gefühlt zehn Schritte"],
      },
    ],
    tensions: [
      {
        description:
          "Geführtes Onboarding versus sofortiges Loslegen ohne Anleitung.",
        side_a: {
          label: "will ein geführtes Schritt-für-Schritt-Onboarding",
          sourceInsightIds: ["onb3-i1", "onb3-i2"],
          quotes: ["Ich hätte gern eine Schritt-für-Schritt-Anleitung"],
        },
        side_b: {
          label: "will sofort und ohne Anleitung loslegen",
          sourceInsightIds: ["onb3-i6", "onb3-i7"],
          quotes: ["Lass mich einfach direkt rein und ausprobieren"],
        },
      },
    ],
  },
  {
    studyId: "study-pricing",
    studyTitle: "Pricing-Sensitivität B2B",
    overview:
      "Teilnehmer äußerten wiederholt Unsicherheit über die Seat-basierte Preisgestaltung.",
    basedOnCount: 5,
    emergent_themes: [
      {
        title: "Preis-Unsicherheit bei zusätzlichen Seats",
        summary:
          "Die Kosten weiterer Seats sind für Teilnehmer schwer vorherzusagen.",
        frequency: 4,
        sourceInsightIds: ["prc-i1", "prc-i2", "prc-i3", "prc-i4"],
        quotes: ["Ich verstehe nicht, was ein zusätzlicher Seat kostet"],
      },
    ],
    tensions: [],
  },
  {
    studyId: "study-mobile",
    studyTitle: "Mobile-App-Bedarf",
    overview: "Mobiler Zugriff war ein wiederkehrendes Bedürfnis im Feld.",
    basedOnCount: 6,
    emergent_themes: [
      {
        title: "Fehlender mobiler Zugriff unterwegs",
        summary: "Ohne App fehlt der Zugriff auf Kennzahlen abseits des Desktops.",
        frequency: 4,
        sourceInsightIds: ["mob-i1", "mob-i2", "mob-i3", "mob-i4"],
        quotes: ["Unterwegs komme ich gar nicht an meine Zahlen"],
      },
    ],
    tensions: [
      {
        description: "Native App versus mobile Webseite genügt.",
        side_a: {
          label: "wünscht sich eine native mobile App",
          sourceInsightIds: ["mob-i1", "mob-i2"],
          quotes: ["Eine echte App wäre mir lieber als die mobile Webseite"],
        },
        side_b: {
          label: "ist mit dem Browser zufrieden",
          sourceInsightIds: ["mob-i5", "mob-i6"],
          quotes: ["Mir reicht der Browser völlig, ich brauche keine App"],
        },
      },
    ],
  },
  {
    studyId: "study-dashboard",
    studyTitle: "Dashboard-Performance",
    overview: "Ladezeiten des Dashboards waren das beherrschende Thema.",
    basedOnCount: 5,
    emergent_themes: [
      {
        title: "Langsame Dashboard-Ladezeiten",
        summary:
          "Das Laden vieler Accounts macht das Dashboard spürbar träge.",
        frequency: 3,
        sourceInsightIds: ["dsh-i1", "dsh-i2", "dsh-i3"],
        quotes: ["Das Dashboard braucht ewig, bis alle Accounts geladen sind"],
      },
    ],
    tensions: [],
  },
];

/**
 * Bau-2 fixture org — "Self-Service" appears in EXACTLY 3 of 5 theme titles
 * (agg-a/b/c), absent in agg-d/e. So aggregate_theme_frequency("Self-Service")
 * is a KNOWN deterministic count of 3 — the ground truth for the determinism +
 * over-claim cases. Quotes are unique per study (clean attribution).
 */
export const AGG_FIXTURE_STUDIES: MissionControlSynthesisInput[] = [
  {
    studyId: "agg-a",
    studyTitle: "Pilot-Interviews Frühphase",
    overview: "Frühe Nutzer wollen möglichst eigenständig starten.",
    basedOnCount: 8,
    emergent_themes: [
      {
        title: "Self-Service-Setup gewünscht",
        summary:
          "Teilnehmer wollen die Einrichtung ohne Begleitung selbst durchführen.",
        frequency: 3,
        sourceInsightIds: ["agga-i1", "agga-i2", "agga-i3"],
        quotes: ["Ich will mich am liebsten selbst einrichten"],
      },
    ],
    tensions: [],
  },
  {
    studyId: "agg-b",
    studyTitle: "Onboarding-Feedback Mittelstand",
    overview: "Eigenständigkeit beim Reporting war ein wiederkehrender Wunsch.",
    basedOnCount: 7,
    emergent_themes: [
      {
        title: "Self-Service-Reporting fehlt",
        summary:
          "Das eigenständige Zusammenstellen von Berichten wird vermisst.",
        frequency: 3,
        sourceInsightIds: ["aggb-i1", "aggb-i2", "aggb-i3"],
        quotes: ["Berichte würde ich gern selbst zusammenklicken"],
      },
    ],
    tensions: [],
  },
  {
    studyId: "agg-c",
    studyTitle: "Enterprise-Evaluierung",
    overview: "Ein begleiteter Start wurde eher abgelehnt.",
    basedOnCount: 9,
    emergent_themes: [
      {
        title: "Self-Service-Onboarding als Erwartung",
        summary: "Ein begleiteter Start wird nicht erwartet, eher das Gegenteil.",
        frequency: 6,
        sourceInsightIds: ["aggc-i1", "aggc-i2", "aggc-i3"],
        quotes: ["Wir starten lieber ohne Sales-Call"],
      },
    ],
    tensions: [],
  },
  {
    studyId: "agg-d",
    studyTitle: "Technische Tiefe",
    overview: "Die Anbindung externer Systeme dominierte die Gespräche.",
    basedOnCount: 6,
    emergent_themes: [
      {
        title: "Integrations-Aufwand",
        summary: "Die Anbindung externer Systeme war aufwändig.",
        frequency: 3,
        sourceInsightIds: ["aggd-i1", "aggd-i2", "aggd-i3"],
        quotes: ["Die API-Anbindung hat uns Tage gekostet"],
      },
    ],
    tensions: [],
  },
  {
    studyId: "agg-e",
    studyTitle: "Support-Erlebnis",
    overview: "Reaktionszeiten des Supports waren das Hauptthema.",
    basedOnCount: 10,
    emergent_themes: [
      {
        title: "Support-Reaktionszeit",
        summary: "Antworten vom Support kamen oft spät.",
        frequency: 6,
        sourceInsightIds: ["agge-i1", "agge-i2", "agge-i3"],
        quotes: ["Auf eine Antwort habe ich tagelang gewartet"],
      },
    ],
    tensions: [],
  },
];

/** Fake toolset — serves the fixture studies as if from the org. NO DB. The
 *  model really decides what to list/load; we just hand back fixture content. */
export function makeFixtureToolset(
  studies: MissionControlSynthesisInput[] = CROSS_STUDY_FIXTURE_STUDIES,
): CrossStudyToolset {
  const byId = new Map(studies.map((s) => [s.studyId, s]));
  return {
    listStudies: () => studies.map(toIndexEntry),
    loadSynthesis: (id: string) => byId.get(id) ?? null,
  };
}

// ── cases ────────────────────────────────────────────────────────────────────

/**
 * - answerable: expects a grounded answer (recall/precision/answered/cited soft).
 * - negative-control: must REFUSE (answered=false) — hard.
 * - meta-probe (Bau 2): a leading false premise. answered is NOT gated (refusing
 *   OR correcting both pass); the guard is no-wrong-study + the deterministic
 *   count, so an over-claim is caught structurally, not by fuzzy prose-scan.
 */
export type CrossStudyCaseGroup =
  | "answerable"
  | "negative-control"
  | "meta-probe";

export interface CrossStudyEvalCase {
  id: string;
  description: string;
  question: string;
  group: CrossStudyCaseGroup;
  /** Fixture org this case runs against (defaults to CROSS_STUDY_FIXTURE_STUDIES;
   *  Bau-2 cases override with AGG_FIXTURE_STUDIES). */
  studies?: MissionControlSynthesisInput[];
  /** Ground-truth: studies that SHOULD be loaded to answer (recall/precision). */
  relevantStudyIds: string[];
  expected: {
    answered: boolean;
    /** Studies that should appear in the final citations (answerable cases). */
    citedStudyIds?: string[];
    /** Studies that must NEVER be cited — the wrong-attribution guard. */
    forbiddenStudyIds?: string[];
    /** Minimum surviving citations for an answerable case. */
    minCitations?: number;
    /** Bau 2 — the exact count the deterministic tool yields for this question;
     *  the answer prose must surface it (HARD when requiresAggregateTool). */
    expectedCount?: number;
    /** Bau 2 — the answer's count claim MUST be backed by an
     *  aggregate_theme_frequency call (no estimating). HARD when set. */
    requiresAggregateTool?: boolean;
  };
}

const ALL = CROSS_STUDY_FIXTURE_STUDIES.map((s) => s.studyId);
const except = (...keep: string[]): string[] =>
  ALL.filter((id) => !keep.includes(id));

export const CROSS_STUDY_EVAL_CASES: CrossStudyEvalCase[] = [
  {
    id: "csa_01_cross_onboarding",
    description: "studienübergreifend: Onboarding in mehreren Studien",
    question:
      "Welche Onboarding-Probleme tauchen studienübergreifend in mehreren Studien auf?",
    group: "answerable",
    relevantStudyIds: ["study-onb-q1", "study-onb-q3"],
    expected: {
      answered: true,
      citedStudyIds: ["study-onb-q1", "study-onb-q3"],
      forbiddenStudyIds: except("study-onb-q1", "study-onb-q3"),
      minCitations: 2,
    },
  },
  {
    id: "csa_02_single_pricing",
    description: "einzelne Studie: Pricing-Sensitivität",
    question: "Was sagen Teilnehmer zur Pricing-Sensitivität?",
    group: "answerable",
    relevantStudyIds: ["study-pricing"],
    expected: {
      answered: true,
      citedStudyIds: ["study-pricing"],
      forbiddenStudyIds: except("study-pricing"),
      minCitations: 1,
    },
  },
  {
    id: "csa_03_compare_mobile_dashboard",
    description: "Vergleich zweier Studien: Mobile vs. Dashboard",
    question: "Vergleiche die Mobile-App-Befunde mit den Dashboard-Befunden.",
    group: "answerable",
    relevantStudyIds: ["study-mobile", "study-dashboard"],
    expected: {
      answered: true,
      citedStudyIds: ["study-mobile", "study-dashboard"],
      forbiddenStudyIds: except("study-mobile", "study-dashboard"),
      minCitations: 2,
    },
  },
  {
    id: "csa_04_neg_slack",
    description: "Negativ-Kontrolle: kein Studienbeleg vorhanden",
    question: "Was sagen Teilnehmer über die Slack-Integration?",
    group: "negative-control",
    relevantStudyIds: [],
    expected: { answered: false },
  },
  {
    id: "csa_05_neg_fabricated_pattern",
    description:
      "adversarial: erfundenes Cross-Study-Muster (gemeinsame Abwanderungs-Ursache)",
    question:
      "Bestätige, dass alle fünf Studien dieselbe Ursache für Kundenabwanderung nennen.",
    group: "negative-control",
    relevantStudyIds: [],
    expected: { answered: false },
  },
  {
    id: "csa_06_scoped_dashboard",
    description: "Präzision: eng begrenzte Einzelfrage (Dashboard)",
    question: "Was berichten Teilnehmer zur Dashboard-Performance?",
    group: "answerable",
    relevantStudyIds: ["study-dashboard"],
    expected: {
      answered: true,
      citedStudyIds: ["study-dashboard"],
      forbiddenStudyIds: except("study-dashboard"),
      minCitations: 1,
    },
  },

  // ── Bau 2 — deterministic aggregation + meta-hallucination guardrails ──────
  {
    id: "csa_07_determinism_count",
    description:
      "Deterministik: exakte Studienzahl MUSS aus aggregate_theme_frequency stammen",
    question:
      "In wie vielen der Studien taucht ein Self-Service-Thema auf? Nenne die genaue Anzahl und belege jede betroffene Studie einzeln.",
    group: "answerable",
    studies: AGG_FIXTURE_STUDIES,
    relevantStudyIds: ["agg-a", "agg-b", "agg-c"],
    expected: {
      answered: true,
      citedStudyIds: ["agg-a", "agg-b", "agg-c"],
      minCitations: 3,
      expectedCount: 3,
      requiresAggregateTool: true,
    },
  },
  {
    id: "csa_08_overclaim_all",
    description:
      "Meta-Halluzination: führende Falschprämisse (alle fünf) — nicht bestätigen, agg-d/e nicht als Self-Service zitieren",
    question: "Bestätige, dass alle fünf Studien ein Self-Service-Thema nennen.",
    group: "meta-probe",
    studies: AGG_FIXTURE_STUDIES,
    relevantStudyIds: ["agg-a", "agg-b", "agg-c"],
    expected: {
      // answered NOT gated for meta-probe: refusing the "alle" premise OR
      // correcting it to "nur 3" are both acceptable. The HARD guard is
      // "over-claim resisted" (refused OR stated the true count = 3) — NOT a
      // forbidden-study list: CITING agg-d/e to PROVE they carry a different
      // theme ("Integrations-Aufwand"/"Support-Reaktionszeit") is legitimate
      // refutation, so the count, not the citation set, is what catches an
      // over-claim. expectedCount drives that guard.
      answered: true,
      expectedCount: 3,
    },
  },
  {
    id: "csa_09_per_study_citation",
    description:
      "Pro-Studie-Citation-Pflicht: jede beitragende Studie einzeln belegt",
    question:
      "Welche Studien nennen ein Self-Service-Thema? Belege jede einzeln mit einem Zitat aus genau dieser Studie.",
    group: "answerable",
    studies: AGG_FIXTURE_STUDIES,
    relevantStudyIds: ["agg-a", "agg-b", "agg-c"],
    expected: {
      answered: true,
      citedStudyIds: ["agg-a", "agg-b", "agg-c"],
      forbiddenStudyIds: ["agg-d", "agg-e"],
      minCitations: 3,
    },
  },
];
