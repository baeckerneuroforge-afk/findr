/**
 * Chat-with-data Eval Dataset
 * ---------------------------
 * Hand-crafted fixture for measuring the QUALITY of chatWithDataFromInputs().
 *
 * Shape: ONE small "Onboarding-Studie" study, 4 verdichtete Interviews + a
 * minimal Stage-2 synthesis. Ten questions split into two camps:
 *
 *   ANSWERABLE  (expected.answered = true)  — 6 cases
 *     Each question has a clear, verbatim-quotable answer in the fixture.
 *     The runner expects answered=true, ≥1 citation, every citation
 *     interviewId in the input set, every quote a fold-substring of the
 *     fixture's evidence/summary/synthesis text.
 *
 *   NON-ANSWERABLE  (expected.answered = false)  — 4 cases
 *     The question is plausibly something a researcher might ask but the
 *     fixture has zero evidence on it (pricing, integrations, tenure,
 *     ordering). The runner expects answered=false, EXACTLY zero
 *     citations, and a refusal answer (rejection signal — any of the
 *     phrases "Evidenz", "nicht thematisiert", "keine Aussage", etc.).
 *
 * Anti-hallu philosophy mirrors evals-synthesis/dataset.ts: items are
 * judged on PROPERTIES (anchored citations? correct refusal? id valid?)
 * plus a human read of the answer. The engine's anchored-filter is what
 * keeps the model honest — the eval verifies that the filter actually
 * holds under a real Anthropic call, not just synthetic input.
 */

import type {
  ChatFromInputs,
  ChatInsightInput,
  ChatSynthesisInput,
} from "@/lib/research/chat-with-data";

export interface ChatEvalCase {
  id: string;
  description: string;
  /** Rationale visible in the runner output — explains what property of
   *  the engine the case probes. */
  rationale: string;
  /** Plan + insights + synthesis are SHARED across cases (one fixture
   *  study, many questions). Stored as a getter so the dataset module
   *  doesn't blow up at import time if a typo lands. */
  buildInput: () => Omit<ChatFromInputs, "question" | "history">;
  question: string;
  expected: {
    answered: boolean;
    /** Optional: substring expected to appear in `answer`. Used as a soft
     *  signal — failure prints WARN, not FAIL. Helps catch "the model
     *  said yes but the answer is gibberish" cases. */
    answerContains?: string;
    /** Lower bound on citations when answered=true. Default 1. Ignored
     *  when answered=false (refusals always expect 0). */
    minCitations?: number;
  };
}

// ── Shared fixture: one Onboarding-Studie ──────────────────────────────────

const PLAN = {
  title: "Onboarding-Studie Q3",
  objective:
    "Verstehen, wo neue Admin-User aufgeben oder hängen bleiben im Onboarding.",
  persona: "Admin-User bei SMB SaaS",
};

const INSIGHTS: ChatInsightInput[] = [
  {
    id: "insight_call_alice",
    respondentRole: "Admin",
    respondentSegment: "SMB",
    sentiment: "negative",
    summary:
      "Alice berichtet, dass die Anleitung beim Onboarding nicht zum aktuellen Stand passte.",
    featureRequests: [],
    painPoints: [
      {
        category: "ONBOARDING",
        title: "Anleitung war veraltet",
        description:
          "Die schriftliche Anleitung passte nicht zum aktuellen Stand der App.",
        severity: "high",
        confidence: 0.9,
        evidence: [
          "Die Anleitung war veraltet, drei Screenshots stimmten nicht mehr.",
        ],
      },
    ],
    themes: [],
  },
  {
    id: "insight_call_bob",
    respondentRole: "Admin",
    respondentSegment: "SMB",
    sentiment: "negative",
    summary:
      "Bob hatte kein internes Schulungsmaterial für neue Kollegen.",
    featureRequests: [],
    painPoints: [
      {
        category: "ONBOARDING",
        title: "Kein Schulungsmaterial",
        description:
          "Ohne internes Schulungsmaterial saß der neue Kollege vor dem Tool.",
        severity: "medium",
        confidence: 0.85,
        evidence: [
          "wir hatten kein Schulungsmaterial für die neuen Kollegen",
        ],
      },
    ],
    themes: [],
  },
  {
    id: "insight_call_clara",
    respondentRole: "Admin im Außendienst",
    respondentSegment: "Enterprise",
    sentiment: "neutral",
    summary:
      "Clara braucht das Tool unterwegs und wünscht sich eine Mobile App.",
    featureRequests: [
      {
        category: "MOBILE",
        title: "Mobile App",
        description: "Im Außendienst brauchen wir das auf dem Handy.",
        intensity: "high",
        confidence: 0.9,
        evidence: [
          "wir bräuchten eine richtige App für den Außendienst",
        ],
      },
    ],
    painPoints: [],
    themes: [],
  },
  {
    id: "insight_call_dirk",
    respondentRole: "Admin",
    respondentSegment: "SMB",
    sentiment: "positive",
    summary:
      "Dirk findet die Browser-Version ausreichend und sieht keinen Bedarf für eine App.",
    featureRequests: [],
    painPoints: [
      {
        category: "UX_FRICTION",
        title: "Browser reicht",
        description:
          "Der Browser-View ist für sein Setup vollkommen ausreichend.",
        severity: "low",
        confidence: 0.8,
        evidence: [
          "eine App brauchen wir nicht, der Browser reicht uns vollkommen",
        ],
      },
    ],
    themes: [],
  },
];

const SYNTHESIS: ChatSynthesisInput = {
  overview:
    "Zwei von vier Teilnehmern berichten von Onboarding-Friktion (veraltete Anleitung, fehlendes Schulungsmaterial). Bei der Mobile-App-Frage spaltet sich die Gruppe in zwei Lager.",
  emergent_themes: [
    {
      title: "Onboarding-Friktion durch fehlende Materialien",
      summary:
        "Zwei Admin-User schildern, dass die Einstiegsmaterialien nicht ausreichten — einmal veraltete Anleitung, einmal kein internes Schulungsmaterial.",
      frequency: 2,
      sourceInsightIds: ["insight_call_alice", "insight_call_bob"],
      quotes: [
        "Die Anleitung war veraltet, drei Screenshots stimmten nicht mehr.",
        "wir hatten kein Schulungsmaterial für die neuen Kollegen",
      ],
    },
  ],
  tensions: [
    {
      description:
        "Über die Notwendigkeit einer Mobile App sind sich die Teilnehmer uneinig.",
      side_a: {
        label: "möchte eine Mobile App für den Außendienst",
        sourceInsightIds: ["insight_call_clara"],
        quotes: ["wir bräuchten eine richtige App für den Außendienst"],
      },
      side_b: {
        label: "Browser-Version reicht aus",
        sourceInsightIds: ["insight_call_dirk"],
        quotes: ["eine App brauchen wir nicht, der Browser reicht uns vollkommen"],
      },
    },
  ],
};

function buildInput(): Omit<ChatFromInputs, "question" | "history"> {
  return {
    plan: PLAN,
    insights: INSIGHTS,
    synthesis: SYNTHESIS,
  };
}

// ── Cases ──────────────────────────────────────────────────────────────────

export const CHAT_EVAL_CASES: ChatEvalCase[] = [
  // ─── ANSWERABLE (6) ─────────────────────────────────────────────────────
  {
    id: "chat_01_alice_veraltet",
    description: "Wer berichtet von veralteter Anleitung?",
    rationale:
      "Direkt-aus-Insight: eine einzige Quelle (Alice), klare Evidenz. Engine muss interviewId 'insight_call_alice' und das Verbatim-Zitat liefern.",
    buildInput,
    question:
      "Wer hat berichtet, dass die Anleitung im Onboarding veraltet war?",
    expected: {
      answered: true,
      answerContains: "Alice",
      minCitations: 1,
    },
  },
  {
    id: "chat_02_mobile_tension",
    description: "Gibt es eine Spannung beim Thema Mobile App?",
    rationale:
      "Cross-call-Frage: muss aus der Synthese-Tension antworten. Mindestens 2 Citations erwartet (oder eine pro Seite).",
    buildInput,
    question:
      "Gibt es in dieser Studie eine Meinungsverschiedenheit zum Thema Mobile App?",
    expected: {
      answered: true,
      answerContains: "App",
      minCitations: 1,
    },
  },
  {
    id: "chat_03_who_wants_app",
    description: "Wer wünschte sich eine Mobile App für den Außendienst?",
    rationale:
      "Spezifisches Single-source-feature_request. Muss Clara als interviewId nennen.",
    buildInput,
    question: "Wer wünschte sich explizit eine Mobile App für den Außendienst?",
    expected: {
      answered: true,
      answerContains: "Clara",
      minCitations: 1,
    },
  },
  {
    id: "chat_04_onboarding_themes",
    description: "Welche Onboarding-Probleme tauchen auf?",
    rationale:
      "Mehrfach-Quellen-Frage. Muss Theme aus Synthese ODER die zwei Insights direkt zitieren (≥1 Citation).",
    buildInput,
    question:
      "Welche konkreten Onboarding-Probleme nennen die Teilnehmer?",
    expected: {
      answered: true,
      answerContains: "Anleitung",
      minCitations: 1,
    },
  },
  {
    id: "chat_05_what_dirk_says",
    description: "Was sagt Dirk zur App-Frage?",
    rationale:
      "Single-source, klar zitierbar. Muss Dirks Browser-reicht-Aussage liefern.",
    buildInput,
    question: "Was sagt Dirk zur Frage, ob eine Mobile App nötig ist?",
    expected: {
      answered: true,
      answerContains: "Browser",
      minCitations: 1,
    },
  },
  {
    id: "chat_06_schulungsmaterial",
    description: "Wer hatte kein Schulungsmaterial?",
    rationale:
      "Single-source Pain Point. Muss interviewId 'insight_call_bob' nennen.",
    buildInput,
    question: "Wer berichtet, dass internes Schulungsmaterial fehlte?",
    expected: {
      answered: true,
      answerContains: "Bob",
      minCitations: 1,
    },
  },

  // ─── NON-ANSWERABLE (4) — outside the supplied data ─────────────────────
  {
    id: "chat_07_pricing",
    description: "Preisfrage (nicht in den Daten)",
    rationale:
      "Klassischer Out-of-scope-Test: kein Teilnehmer hat Preise erwähnt. Engine muss answered=false + leere Citations zurückgeben — KEINE Spekulation über Plan-Tiers.",
    buildInput,
    question: "Was kostet das Tool monatlich laut den Teilnehmern?",
    expected: { answered: false },
  },
  {
    id: "chat_08_integrations",
    description: "Integrations-Frage (nicht in den Daten)",
    rationale:
      "Keine Teilnehmerin hat Integrationen gefragt. Verlockend für ein generisches B2B-Modell zu fabulieren — Engine muss refuse.",
    buildInput,
    question: "Welche Integrationen mit anderen Tools wurden gewünscht?",
    expected: { answered: false },
  },
  {
    id: "chat_09_tenure",
    description: "Erfahrungsdauer (keine Zeitangaben in den Daten)",
    rationale:
      "Die Insights enthalten keine Tenure/Zeit-Information. Engine muss honest refuse, NICHT raten.",
    buildInput,
    question: "Wer der Teilnehmer hat die längste Erfahrung mit dem Produkt?",
    expected: { answered: false },
  },
  {
    id: "chat_10_order_process",
    description: "Bestellprozess (nicht thematisiert)",
    rationale:
      "Bestellprozesse wurden in keinem Interview erwähnt. Auch hier muss refuse, NICHT zu Mobile App / Onboarding rüberbridgen.",
    buildInput,
    question: "Welche Probleme im Bestellprozess wurden genannt?",
    expected: { answered: false },
  },
];
