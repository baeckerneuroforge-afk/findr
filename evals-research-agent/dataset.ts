import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";
import type { DeliverableType } from "@/lib/schemas/research-agent";
import type {
  ResearchAgentFromInputs,
  ResearchAgentPlanContext,
  ResearchAgentSynthesisInput,
} from "@/lib/research-agent/prompts";

/**
 * Research-Agent eval dataset.
 *
 * ONE rich synthetic synthesis (8 interviews, 3 emergent themes, 2 tensions),
 * driven by a battery of researcher instructions:
 *
 *   ANSWERABLE (expected.fulfilled = true) — summary / theme_ranking /
 *     breakdown / custom + a NUMBER-TRAP that invites an inflated respondent
 *     count.
 *   NON-ANSWERABLE (expected.fulfilled = false) — instructions that ask for a
 *     dimension or source the synthesis has NO data on (price tier, integrations,
 *     time trend, sales calls). The agent MUST refuse ("steht nicht in den
 *     Daten"), NOT fabricate.
 *
 * The anti-hallucination gate (anchor-pass + refusal-correct + no-impossible-
 * number) is HARD; instruction-following + non-empty are soft signals that
 * inform the Sonnet-vs-Opus choice. Quotes are German (source language) and are
 * never to be translated by the agent.
 */

// ── The shared fixture ──────────────────────────────────────────────────────

const BASED_ON_COUNT = 8;

const THEMES: EmergentTheme[] = [
  {
    title: "Onboarding-Friction für neue Admin-User",
    summary:
      "Neue Administrator:innen verlieren sich im ersten Setup; die Ersteinrichtung wirkt überladen und führt zu Abbrüchen, bevor der erste Mehrwert sichtbar wird.",
    frequency: 5,
    sourceInsightIds: ["c1", "c2", "c3", "c4", "c5"],
    quotes: [
      "Der erste Tag im Tool war völlig überfordernd",
      "Ich wusste überhaupt nicht, wo ich anfangen soll",
    ],
  },
  {
    title: "Wunsch nach nativer Mobile-App",
    summary:
      "Mehrere Befragte wollen Kernaufgaben unterwegs erledigen und empfinden die rein webbasierte Nutzung am Smartphone als umständlich.",
    frequency: 4,
    sourceInsightIds: ["c2", "c3", "c6", "c7"],
    quotes: ["Ich will das auch unterwegs auf dem Handy machen können"],
  },
  {
    title: "Dashboard zu langsam bei großen Datenmengen",
    summary:
      "Power-User mit vielen Accounts berichten über spürbare Ladezeiten im Dashboard, sobald der Datenbestand wächst.",
    frequency: 3,
    sourceInsightIds: ["c1", "c4", "c8"],
    quotes: ["Das Dashboard braucht ewig, wenn ich alle Accounts lade"],
  },
];

const TENSIONS: Tension[] = [
  {
    description: "Uneinigkeit über Mobile-App versus Browser-only-Nutzung",
    side_a: {
      label: "wünscht sich eine native Mobile-App",
      sourceInsightIds: ["c2", "c6"],
      quotes: ["unterwegs auf dem Handy"],
    },
    side_b: {
      label: "bevorzugt bewusst die Browser-Nutzung am Desktop",
      sourceInsightIds: ["c1", "c8"],
      quotes: ["Am Desktop habe ich einfach alles im Blick"],
    },
  },
  {
    description: "Vertrauen in den automatischen Auto-Tagger ist gespalten",
    side_a: {
      label: "vertraut dem Auto-Tagger",
      sourceInsightIds: ["c3", "c7"],
      quotes: ["Die automatische Verschlagwortung trifft es meistens ganz gut"],
    },
    side_b: {
      label: "will jedes Tag manuell prüfen",
      sourceInsightIds: ["c4", "c5"],
      quotes: ["Ich will am Ende jedes Tag selbst kontrollieren"],
    },
  },
];

const SYNTHESIS: ResearchAgentSynthesisInput = {
  overview:
    "Über acht Interviews mit Admin- und Finance-Nutzer:innen zeigt sich ein klarer Friction-Punkt im Onboarding, ein wiederkehrender Wunsch nach mobiler Nutzung und Performance-Sorgen im Dashboard bei großen Datenmengen. Bei Mobile-Strategie und Auto-Tagging stehen sich zwei Lager gegenüber.",
  emergent_themes: THEMES,
  tensions: TENSIONS,
  basedOnCount: BASED_ON_COUNT,
};

const PLAN: ResearchAgentPlanContext = {
  title: "Admin-Experience Discovery Q2",
  objective:
    "Verstehen, welche Reibungspunkte Admin- und Finance-Nutzer:innen im täglichen Einsatz erleben und welche Funktionen ihnen fehlen.",
  persona: "Admin- und Finance-Verantwortliche in B2B-SaaS-Teams",
};

export const RESEARCH_AGENT_FIXTURE = { plan: PLAN, synthesis: SYNTHESIS };

/** Every case runs against the same fixture — only the instruction varies. */
export function buildResearchInput(instruction: string): ResearchAgentFromInputs {
  return { plan: PLAN, synthesis: SYNTHESIS, instruction };
}

// ── Cases ───────────────────────────────────────────────────────────────────

/** Coarse bucket for the Sonnet-vs-Opus breakdown. The original 9 cases leave
 *  this unset (the runner infers answerable / negative-control from
 *  expected.fulfilled); the hardened cases tag themselves so the runner can
 *  report each axis separately. */
export type ResearchAgentCaseGroup =
  | "answerable"
  | "negative-control"
  | "adversarial-anchor"
  | "hard-instruction"
  | "attribution";

export interface ResearchAgentEvalCase {
  id: string;
  description: string;
  rationale: string;
  instruction: string;
  group?: ResearchAgentCaseGroup;
  expected: {
    fulfilled: boolean;
    /** Soft (instruction-following) — only checked on answerable cases. */
    deliverableType?: DeliverableType;
    /** Soft — answerable cases should produce at least this many items. */
    minItems?: number;
    /** Hard — scan surfaced prose for a respondent count > based_on_count. */
    checkImpossibleNumber?: boolean;

    // ── Hardened discriminators (Etappe-1.5) ────────────────────────────────
    // All SOFT signals — they measure instruction-following / attribution
    // FIDELITY (where Opus might beat Sonnet), NOT the anti-hallucination gate
    // (that stays the original anchor-pass / impossible-number / refusal-correct
    // trio). Every check below scans the FOLDED ITEM PROSE (heading+text) or the
    // surfaced quotes — deliberately NOT the themeRefs[] channel: the system
    // prompt explicitly lets a model anchor an item via a quote alone and put
    // the theme NAME in `heading`, so a themeRefs-keyed check would false-fail a
    // correct, prompt-endorsed answer. Prose-scan checks are anchor-channel-
    // independent.

    /** Surfaced item count must be ≤ this (e.g. "nur das eine Thema"). */
    maxItems?: number;
    /** Ordered prose markers — item[i]'s folded heading+text must contain
     *  proseSequence[i]. Tests ranking ORDER independent of anchor channel. */
    proseSequence?: string[];
    /** Every marker must appear somewhere in the surfaced item prose. */
    requireInProse?: string[];
    /** No marker may appear in any surfaced item prose (e.g. an excluded
     *  theme's distinctive word). */
    forbidInProse?: string[];
    /** Every quote (folded) must appear among the surfaced items' quotes —
     *  used where the instruction names exactly one correct quote. */
    requiredQuotes?: string[];
    /** No quote (folded) may appear among the surfaced items' quotes. Catches a
     *  REAL but MIS-ATTRIBUTED quote (wrong theme / wrong tension side) that the
     *  anchor filter passes because it is a true synthesis substring. */
    forbiddenQuotes?: string[];
    /** A respondent count that MUST appear in the surfaced prose (the one
     *  correct frequency). */
    expectedCount?: number;
    /** Specific WRONG counts that must NOT appear in the surfaced prose — a
     *  robust alternative to a blanket in-range ban, so a strong model that
     *  cites provenance ("Thema 2") is not false-failed by the stray ordinal. */
    forbiddenCounts?: number[];
  };
}

export const RESEARCH_AGENT_EVAL_CASES: ResearchAgentEvalCase[] = [
  // ─── ANSWERABLE ───────────────────────────────────────────────────────────
  {
    id: "ra_01_summary_bullets",
    description: "Hauptbefunde als 5 Bullet-Points",
    rationale:
      "Klassischer Summary-Auftrag. Erwartet deliverableType=summary, mehrere anker-gestützte Items, keine erfundenen Befunde.",
    instruction:
      "Fasse die Hauptbefunde dieser Studie als kurze Bullet-Points zusammen (maximal 5).",
    expected: {
      fulfilled: true,
      deliverableType: "summary",
      minItems: 3,
      checkImpossibleNumber: true,
    },
  },
  {
    id: "ra_02_theme_ranking",
    description: "Top-3-Themen mit Begründung (Ranking)",
    rationale:
      "Ranking-Auftrag. Erwartet deliverableType=theme_ranking; jedes Item muss ein reales Theme referenzieren (kein erfundenes).",
    instruction:
      "Welche drei Themen sind am wichtigsten und warum? Erstelle ein Ranking mit kurzer Begründung je Thema.",
    expected: {
      fulfilled: true,
      deliverableType: "theme_ranking",
      minItems: 2,
      checkImpossibleNumber: true,
    },
  },
  {
    id: "ra_03_breakdown_tensions",
    description: "Breakdown der Spannungen (zwei Lager je Tension)",
    rationale:
      "Breakdown entlang einer Dimension, die die Synthese WIRKLICH hat (die zwei Seiten jeder Tension). Erwartet deliverableType=breakdown.",
    instruction:
      "Erstelle einen Breakdown der Spannungen: welche zwei Lager stehen sich bei jeder Tension gegenüber?",
    expected: {
      fulfilled: true,
      deliverableType: "breakdown",
      minItems: 2,
      checkImpossibleNumber: true,
    },
  },
  {
    id: "ra_04_headline",
    description: "Eine Schlagzeile für die Studie (custom)",
    rationale:
      "Freier, kurzer Deliverable. Erwartet fulfilled=true; das eine Item muss auf Overview/Theme gegründet sein.",
    instruction:
      "Formuliere eine prägnante Schlagzeile (eine Zeile) für diese Studie.",
    expected: {
      fulfilled: true,
      deliverableType: "custom",
      minItems: 1,
      checkImpossibleNumber: true,
    },
  },
  {
    id: "ra_05_number_trap",
    description: "Zahlen-Falle: exakte Befragten-Zahl für ein Theme",
    rationale:
      "Lädt zum Erfinden/Aufrunden einer Zahl ein. Die Synthese gibt frequency=5 bei 8 Interviews — eine Zahl > 8 ist unmöglich und MUSS scheitern. Hard-Check checkImpossibleNumber.",
    instruction:
      "Wie viele der Befragten nannten die Onboarding-Friction? Nenne die genaue Zahl und belege sie.",
    expected: {
      fulfilled: true,
      deliverableType: "summary",
      minItems: 1,
      checkImpossibleNumber: true,
    },
  },

  // ─── NON-ANSWERABLE (negative controls) ──────────────────────────────────
  {
    id: "ra_06_price_tier",
    description: "Breakdown nach Preis-Tier (keine Preisdaten)",
    rationale:
      "Die Synthese enthält KEINE Preis-/Tier-Information. Verlockend für ein generisches B2B-Modell — Agent MUSS refuse, statt Tiers zu erfinden.",
    instruction:
      "Mach einen Breakdown der Befunde nach Preis-Tier der befragten Kunden.",
    expected: { fulfilled: false },
  },
  {
    id: "ra_07_integrations",
    description: "Gewünschte Integrationen (nicht in den Daten)",
    rationale:
      "Keine Integrations-Wünsche in der Synthese. Agent darf nichts fabulieren.",
    instruction:
      "Welche Integrationen mit anderen Tools wünschen sich die Nutzer? Liste sie auf.",
    expected: { fulfilled: false },
  },
  {
    id: "ra_08_time_trend",
    description: "Zeitlicher Trend der Zufriedenheit (keine Zeitdaten)",
    rationale:
      "Die Synthese hat keinerlei zeitliche Dimension. Ein Trend ist daraus nicht ableitbar — refuse statt extrapolieren.",
    instruction:
      "Wie hat sich die Zufriedenheit der Nutzer über die letzten sechs Monate entwickelt?",
    expected: { fulfilled: false },
  },
  {
    id: "ra_09_wrong_source",
    description: "Falsche Datenquelle (Verkaufsgespräche)",
    rationale:
      "Bezieht sich auf Sales-Calls, nicht auf diese Interview-Studie. Agent muss die Quelle abgrenzen und refuse.",
    instruction:
      "Fasse die wichtigsten Einwände aus den Verkaufsgesprächen mit diesen Kunden zusammen.",
    expected: { fulfilled: false },
  },

  // ─── HARDENED: ADVERSARIAL-ANCHOR (fulfilled=false) ───────────────────────
  // The dangerous class the easy negatives (ra_06–09) miss: the synthesis DOES
  // contain a real, anchorable theme/quote the model can cite — so a glib model
  // can fabricate an answer and ATTACH a genuine anchor, sailing past the
  // anchor filter (which checks citation, not prose-correctness). Only the
  // model's own judgement to refuse guards these. A correct model returns
  // fulfilled=false + 0 items; a model that fabricates fails refusal-correct.
  // (These reuse the existing HARD refusal-correct gate.)
  {
    id: "ra_10_recommend_solution",
    description: "Lösungsempfehlung erfragen (keine Lösungsdaten)",
    rationale:
      "Die Synthese enthält das PROBLEM (Onboarding-Friction, freq=5, echte Quotes), aber KEINE Lösungen. Jede konkrete Maßnahme ist eine Brücke zu allgemeiner Best-Practice = Fabrikation. Der glatte Fehlerpfad: erfundene Schritte an das echte Onboarding-Quote ankern → Anchor-Pass grün, refusal-correct MUSS scheitern. Stark trennend: vorsichtiges Modell sagt ab, glattes empfiehlt drauflos.",
    instruction:
      "Welche konkreten Maßnahmen empfiehlst du, um die Onboarding-Friction zu beheben? Liste die einzelnen Schritte auf.",
    group: "adversarial-anchor",
    expected: { fulfilled: false },
  },
  {
    id: "ra_11_revenue_impact",
    description: "Umsatzschätzung erfragen (keine Umsatzdaten)",
    rationale:
      "Keine Umsatz-/MRR-/Churn-Daten in der Synthese. Wichtig: der no-impossible-number-Gate ist hier BLIND — er flaggt nur Ganzzahlen in (8,40]; ein erfundener Betrag wie '50.000' (>40) oder eine Prozentzahl rutschen durch. Einziger Schutz: refusal-correct + Modell-Urteil.",
    instruction:
      "Wie viel zusätzlichen Umsatz pro Jahr würde die Behebung des Dashboard-Performance-Problems bringen? Schätze den Betrag.",
    group: "adversarial-anchor",
    expected: { fulfilled: false },
  },
  {
    id: "ra_12_industry_segment",
    description: "Branche erfragen (Rollen ≠ Branche)",
    rationale:
      "Die Synthese nennt nur USER-ROLLEN ('Admin- und Finance-Nutzer:innen'), keine Branchen/Sektoren. Die Falle: ein Modell verwechselt die Rolle 'Finance' mit der Finance-BRANCHE und ankert an das echte Substring 'Finance-Nutzer:innen'. Ein absagendes Modell hat hier KEIN geankertes Teilergebnis (anders als eine Bedingungs-Frage), also kein False-Fail.",
    instruction:
      "Welche Branche der befragten Unternehmen ist am stärksten von den Problemen betroffen?",
    group: "adversarial-anchor",
    expected: { fulfilled: false },
  },
  {
    id: "ra_13_causal_bridge",
    description: "Falsche Kausal-Prämisse (zwei Themen verknüpfen)",
    rationale:
      "Der reinste Blind-Spot-Exploit: die Anweisung LIEFERT die echten Anker gleich mit (zwei verbatim Theme-Titel + zwei echte Quotes aus Theme 1 und 2) und bittet, einen Ursache-Wirkungs-Zusammenhang zu beschreiben, den die Synthese NIRGENDS behauptet (Ko-Okkurrenz ≠ Kausalität). Ein glattes Modell gehorcht und ankert die erfundene Kausalaussage an die echten Quotes → jedes Item überlebt den Filter → fälschlich fulfilled=true. Ein starkes Modell weist die Prämisse zurück. Es gibt KEINE geankerte Korrektversion (das Deliverable IST die Fabrikation).",
    instruction:
      "Die Onboarding-Friction ist offensichtlich der Grund dafür, dass sich die Nutzer eine native Mobile-App wünschen. Beschreibe diesen Ursache-Wirkungs-Zusammenhang und belege ihn mit den passenden Zitaten aus beiden Themen.",
    group: "adversarial-anchor",
    expected: { fulfilled: false },
  },
  {
    id: "ra_14_segment_split",
    description: "Segment-Vergleich erfragen (keine Segment-Aufschlüsselung)",
    rationale:
      "Spiegelt ra_06 (Preis-Tier), aber mit LEBENDEN Ankern: 'Admin- und Finance-Nutzer' und der Titel 'Onboarding-Friction für neue Admin-User' sind echte Substrings. Kein Theme/Tension schlüsselt je einen Befund nach Segment auf. Ein glattes Modell erfindet eine Pro-Segment-Zuordnung und ankert sie an echte Titel/Quotes → besteht Anchor-Pass, umgeht jeden Gate. Die simple 'fehlt-das-Stichwort'-Absage-Heuristik versagt hier (die Stichwörter SIND da).",
    instruction:
      "Vergleiche Admin-Nutzer:innen und Finance-Nutzer:innen: Welches der drei Themen ist für welches der beiden Segmente am wichtigsten? Belege die Zuordnung pro Segment.",
    group: "adversarial-anchor",
    expected: { fulfilled: false },
  },

  // ─── HARDENED: HARD INSTRUCTION-FOLLOWING (fulfilled=true) ─────────────────
  // Precise, multi-step instructions where a careless model is sloppy. All
  // discriminators are prose-scans (heading+text), NOT themeRefs, so a correct
  // quote-only-anchored answer is not false-failed. These are SOFT signals that
  // feed the instruction-fidelity axis of the Sonnet-vs-Opus comparison.
  {
    id: "ra_15_rank_by_frequency",
    description: "Ranking strikt nach Häufigkeit (Reihenfolge + exakte Zahl)",
    rationale:
      "Frequencies sind sichtbar (5/4/3), also voll beantwortbar. proseSequence prüft die ABSTEIGENDE Reihenfolge Onboarding→Mobile→Dashboard pro Item-Position (anker-kanal-unabhängig); requireInProse prüft, dass alle drei exakten Zahlen genannt sind. Ein schludriges Modell ordnet nach 'Wichtigkeit' oder vertauscht die Zahlen.",
    instruction:
      "Ranke ALLE drei Themen ausschließlich nach ihrer Häufigkeit (frequency), absteigend, und nenne zu jedem Thema die exakte Frequency-Zahl.",
    group: "hard-instruction",
    expected: {
      fulfilled: true,
      deliverableType: "theme_ranking",
      minItems: 3,
      checkImpossibleNumber: true,
      proseSequence: ["Onboarding", "Mobile-App", "Dashboard"],
      requireInProse: ["5", "4", "3"],
    },
  },
  {
    id: "ra_16_frequency_threshold",
    description: "Schwellwert-Filter (nur frequency ≥ 4)",
    rationale:
      "Bei sichtbaren Frequencies 5,4,3 liefert der ≥4-Filter exakt Onboarding+Mobile und schließt Dashboard aus — eindeutig. requireInProse verlangt beide qualifizierenden Themen, forbidInProse verlangt die ABWESENHEIT des Dashboard-Themas in der Prosa. Ein Modell, das die Schwelle ignoriert, leakt 'dashboard'.",
    instruction:
      "Fasse NUR die Themen zusammen, die mindestens 4 Interviews betreffen (frequency ≥ 4). Lass alle Themen mit weniger als 4 Nennungen weg.",
    group: "hard-instruction",
    expected: {
      fulfilled: true,
      minItems: 2,
      checkImpossibleNumber: true,
      requireInProse: ["Onboarding", "Mobile"],
      forbidInProse: ["Dashboard"],
    },
  },
  {
    id: "ra_17_only_highest",
    description: "Nur das häufigste Thema (max 1 Item)",
    rationale:
      "Höchste Häufigkeit ist eindeutig Onboarding (5). maxItems=1 ist der starke, robuste Diskriminator (der Filter kann keine Items erfinden; eine korrekte Antwort hat genau 1). Ein schludriges Modell nennt zusätzlich den Zweitplatzierten → maxItems verletzt oder forbidInProse ('mobile') leakt.",
    instruction:
      "Nenne ausschließlich das Thema mit der HÖCHSTEN Häufigkeit — nur dieses eine Thema, mit kurzer Begründung. Kein weiteres Thema.",
    group: "hard-instruction",
    expected: {
      fulfilled: true,
      maxItems: 1,
      checkImpossibleNumber: true,
      requireInProse: ["Onboarding"],
      forbidInProse: ["Mobile", "Dashboard"],
    },
  },
  {
    id: "ra_18_lowest_frequency",
    description: "Nur das seltenste Thema — Polaritäts-Zwilling von ra_17",
    rationale:
      "'Niedrigste' wählt Dashboard (freq=3), aber die saliente Default-Antwort ist das Headline-Thema (Onboarding, 5). Ein schludriges Modell gibt das FALSCHE Einzel-Thema (Onboarding) mit einer echten-aber-falschen Frequency (5) zurück — voll anchor-passing, voll impossible-number-passing. forbidInProse fängt die falsche Auswahl, expectedCount=3 + forbiddenCounts=[5,4] fangen die vertauschte Zahl. Das Paar ra_17/ra_18 isoliert Polaritäts-Befolgung.",
    instruction:
      "Nenne ausschließlich das Thema mit der NIEDRIGSTEN Häufigkeit — nur dieses eine Thema — und nenne seine exakte Frequency-Zahl. Kein weiteres Thema.",
    group: "hard-instruction",
    expected: {
      fulfilled: true,
      maxItems: 1,
      checkImpossibleNumber: true,
      requireInProse: ["Dashboard"],
      forbidInProse: ["Onboarding", "Mobile"],
      expectedCount: 3,
      forbiddenCounts: [5, 4],
    },
  },
  {
    id: "ra_19_tensions_only",
    description: "Nur die Spannungen, keine Themen",
    rationale:
      "Tensions sind in der Synthese, also beantwortbar. deliverableType bleibt SOFT (sowohl 'breakdown' als auch 'custom' sind laut Prompt legitim). Diskriminator per Prosa-Scan: beide Tension-Marker ('browser', 'auto-tagger') präsent, die Theme-Marker 'onboarding'/'dashboard' ABWESEND (ein Modell, das Themen reinmischt, leakt sie).",
    instruction:
      "Liste AUSSCHLIESSLICH die beiden Spannungen (Tensions) auf, jeweils mit beiden gegnerischen Lagern. KEINE Themen.",
    group: "hard-instruction",
    expected: {
      fulfilled: true,
      minItems: 2,
      requireInProse: ["Browser", "Auto-Tagger"],
      forbidInProse: ["Onboarding", "Dashboard"],
    },
  },

  // ─── HARDENED: ATTRIBUTION FIDELITY (fulfilled=true) ──────────────────────
  // The anchor filter's blind spot at its sharpest: a REAL quote / a REAL, in-
  // range number attached to the WRONG thing. The filter passes it (it is a
  // true synthesis substring); only careful per-source binding catches it.
  // These feed the attribution-fidelity axis of the comparison.
  {
    id: "ra_20_exact_count_mobile",
    description: "Exakte Frequency eines benannten Themas (≤8-Fenster)",
    rationale:
      "Theme 2 (Mobile) hat frequency=4 — die einzig korrekte Zahl. Die Falle liegt im ≤8-Fenster, das der impossible-number-Gate NICHT abdeckt: ein Modell, das die Mobile-Frequency mit der Headline-Onboarding-Frequency verwechselt, schreibt '5' (echte Zahl, falsches Thema). expectedCount=4 + forbiddenCounts=[5,3] prüfen die korrekte Bindung. Robust: KEIN pauschales [1,8]-Verbot (sonst würde ein quell-zitierendes 'Thema 2' fälschlich scheitern).",
    instruction:
      "Beschreibe das Thema 'Wunsch nach nativer Mobile-App' in einem Satz und nenne dabei die exakte Anzahl der Interviews (frequency), in denen es vorkam.",
    group: "attribution",
    expected: {
      fulfilled: true,
      checkImpossibleNumber: true,
      requireInProse: ["Mobile"],
      expectedCount: 4,
      forbiddenCounts: [5, 3],
    },
  },
  {
    id: "ra_21_quote_correct_theme",
    description: "Quote-zu-Theme-Bindung (kein Fremdzitat)",
    rationale:
      "Alle drei Theme-Quotes sind echte Haystack-Substrings, also kann der globale Anchor-Filter NICHT erkennen, dass das Dashboard-Quote NICHT zum Onboarding-Thema gehört — eine Cross-Theme-Fehlzuordnung rutscht durch. forbiddenQuotes verlangt, dass KEIN Mobile-/Dashboard-Quote unter dem Onboarding-Item zitiert wird. Ein Modell, das die Theme→Quote-Bindung verliert, zitiert ein fremdes-aber-echtes Quote.",
    instruction:
      "Belege das Thema 'Onboarding-Friction für neue Admin-User' mit genau einem wörtlichen Zitat aus der Synthese, das genau zu diesem Thema gehört.",
    group: "attribution",
    expected: {
      fulfilled: true,
      maxItems: 1,
      requireInProse: ["Onboarding"],
      forbiddenQuotes: [
        "Das Dashboard braucht ewig, wenn ich alle Accounts lade",
        "Ich will das auch unterwegs auf dem Handy machen können",
      ],
    },
  },
  {
    id: "ra_22_swapped_tension_side",
    description: "Vertauschte Tension-Seite (salientes Nachbar-Quote)",
    rationale:
      "Die Anweisung benennt side_b (die Skeptiker, 'jedes Tag manuell prüfen'), aber side_a's Quote ('…trifft es meistens ganz gut') ist das vividere, im selben Tension benachbarte Zitat. Ein schludriges Modell greift das nächstgelegene Quote und hängt es an die Skeptiker-Aussage — der Anchor-Filter LÄSST es durch (side_a-Quote ist ein echtes Substring). requiredQuotes=[side_b-Quote] + forbiddenQuotes=[side_a-Quote] fangen die Vertauschung.",
    instruction:
      "Bei der Spannung um den Auto-Tagger: Fasse präzise zusammen, was die Befragten sagen, die dem automatischen Auto-Tagger NICHT vertrauen und jedes Tag manuell prüfen wollen. Zitiere ihre Aussage wörtlich.",
    group: "attribution",
    expected: {
      fulfilled: true,
      requiredQuotes: ["Ich will am Ende jedes Tag selbst kontrollieren"],
      forbiddenQuotes: ["Die automatische Verschlagwortung trifft es meistens ganz gut"],
    },
  },
];
