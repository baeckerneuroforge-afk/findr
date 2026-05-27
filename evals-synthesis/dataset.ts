/**
 * Study-Synthesis Eval Dataset
 * ----------------------------
 * Hand-crafted cases for measuring the QUALITY of synthesizeFromInputs().
 * Like the Product-Discovery and Solution evals, items are judged on
 * PROPERTIES (anchored? frequency-honest? no fake counter-side?
 * empty-when-it-should-be?) plus a human read of the overview.
 *
 * Coverage shape:
 *   synth_01 — shared theme + real tension. 8 insights: 6 carry an
 *              onboarding-friction theme; on the question of a mobile
 *              app the group splits 4-vs-2. Expectation: one strong
 *              theme (freq ≥ 5), ONE tension with both sides anchored
 *              and disjoint, overview describes both.
 *
 *   synth_02 — full consensus, no tension. 5 insights all hit "Filter
 *              zu versteckt". Expectation: one strong theme (freq 5),
 *              ZERO tensions. The synthesizer must NOT manufacture a
 *              counter-side to balance the page.
 *
 *   synth_03 — sparse / incoherent. 2 insights on unrelated topics.
 *              Expectation: ≤1 thinly-grounded theme OR empty, ZERO
 *              tensions (a tension needs ≥2 respondents on each
 *              side — impossible with 2 unique inputs).
 *
 *   synth_04 — empty/off-topic. 4 insights with empty feature_requests
 *              + empty pain_points + bland summaries. Expectation:
 *              empty themes, empty tensions, honest one-sentence
 *              overview ("the inputs do not contain product feedback").
 *
 * Each insight cites quotes that exist verbatim inside its own evidence
 * arrays — so the engine's anchored-filter has a haystack to validate
 * against. The fake IDs (insight_01_a … insight_04_d) are arbitrary
 * strings; the runner builds the anchor set from them, exactly as the
 * engine would from real source_call_ids.
 */

import type {
  SynthesisInput,
  SynthesisInsightInput,
} from "@/lib/synthesis/prompts";

export interface SynthesisEvalCase {
  id: string;
  description: string;
  rationale: string;
  input: SynthesisInput;
  expected: {
    /** Lower bound on themes the synthesizer SHOULD surface. The runner
     *  uses this for the human-readable expected-vs-got line; it does
     *  NOT hard-fail on mismatch (manual read is authoritative). */
    minThemes: number;
    maxThemes: number;
    /** Exact tension count expected. 0 means "MUST be empty" (consensus
     *  cases). Hard-checked. */
    tensions: number;
    /** Optional: themes that should NOT exceed n respondents (anti-
     *  hallucination signal — frequency must match anchored sources). */
    maxThemeFrequency?: number;
  };
}

// ── Helper: build an insight quickly without ceremony ──────────────────────

function insight(
  id: string,
  role: string | null,
  summary: string,
  parts: {
    feature?: Array<{
      category: string;
      title: string;
      description: string;
      intensity: string;
      confidence: number;
      evidence: string[];
    }>;
    pain?: Array<{
      category: string;
      title: string;
      description: string;
      severity: string;
      confidence: number;
      evidence: string[];
    }>;
  } = {},
): SynthesisInsightInput {
  return {
    id,
    respondentRole: role,
    respondentSegment: null,
    sentiment: null,
    summary,
    featureRequests: parts.feature ?? [],
    painPoints: parts.pain ?? [],
    themes: [],
  };
}

// ── synth_01 — shared theme + real tension ─────────────────────────────────

const synth01: SynthesisEvalCase = {
  id: "synth_01",
  description: "Shared theme across 6 of 8; real tension on mobile app (4 vs 2)",
  rationale:
    "The high-signal happy case. Synthesizer should surface ONE strong onboarding-friction theme (freq ≥ 5) and ONE tension on mobile-vs-browser with both sides anchored and disjoint.",
  input: {
    plan: {
      title: "Onboarding-Studie Q3",
      objective:
        "Verstehen wo neue Admin-User aufgeben oder hängen bleiben im Onboarding.",
      persona: "Admin-User bei SMB SaaS",
    },
    insights: [
      // 6 insights carrying the onboarding-friction theme:
      insight("insight_01_a", "Admin", "Hatte Onboarding-Probleme.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Anleitung war veraltet",
            description: "Die schriftliche Anleitung passte nicht zum aktuellen Stand.",
            severity: "high",
            confidence: 0.9,
            evidence: ["Die Anleitung war veraltet, drei Screenshots stimmten nicht mehr."],
          },
        ],
      }),
      insight("insight_01_b", "Admin", "Brauchte zu lange.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Kein Schulungsmaterial",
            description: "Ohne interne Schulung saß der User vor dem Tool.",
            severity: "medium",
            confidence: 0.8,
            evidence: ["wir hatten kein Schulungsmaterial für die neuen Kollegen"],
          },
        ],
      }),
      insight("insight_01_c", "Admin", "Onboarding lief schief.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Mein neuer Kollege findet sich nicht zurecht",
            description: "Der neue Kollege braucht jedes Mal Unterstützung.",
            severity: "high",
            confidence: 0.85,
            evidence: ["Mein neuer Kollege findet sich nicht zurecht ohne mich daneben."],
          },
        ],
      }),
      insight("insight_01_d", "Admin", "Schwer reinzukommen.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Steile Lernkurve",
            description: "Erste zwei Wochen waren extrem zäh.",
            severity: "medium",
            confidence: 0.75,
            evidence: ["die ersten zwei Wochen waren extrem zäh, ich wusste nicht wo anfangen"],
          },
        ],
      }),
      insight("insight_01_e", "Admin", "Onboarding-Frust.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Docs lückenhaft",
            description: "Die Doku sprang Schritte über.",
            severity: "high",
            confidence: 0.9,
            evidence: ["die Doku überspringt zwischen Schritt 4 und 7 einfach drei Sachen"],
          },
        ],
      }),
      insight("insight_01_f", "Admin", "Erste Woche war hart.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Brauche jemanden der mir das zeigt",
            description: "Selbsterklärt war es nicht.",
            severity: "medium",
            confidence: 0.7,
            evidence: ["ich brauche immer jemanden der mir das einmal zeigt"],
          },
        ],
      }),
      // Plus the mobile-app split: 4 want it, 2 explicitly prefer browser-only.
      // 4 want it:
      insight("insight_01_g", "Admin im Außendienst", "Will Mobile App.", {
        feature: [
          {
            category: "MOBILE",
            title: "Mobile App",
            description: "Im Außendienst brauchen wir das auf dem Handy.",
            intensity: "high",
            confidence: 0.9,
            evidence: ["wir bräuchten eine richtige App für den Außendienst"],
          },
        ],
      }),
      insight("insight_01_h", "Admin", "Browser-only ist ok.", {
        feature: [],
        pain: [
          {
            category: "UX_FRICTION",
            title: "Browser reicht uns aus",
            description: "Der Browser-View ist für uns vollkommen ausreichend.",
            severity: "low",
            confidence: 0.8,
            evidence: ["eine App brauchen wir nicht, der Browser reicht uns vollkommen"],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 3, tensions: 1, maxThemeFrequency: 6 },
};

// NOTE: synth_01 carries the 4-vs-2 mobile-app split as a tension, but the
// fixtures above ship 1 "want app" + 1 "browser is fine" — the synthesizer
// will infer the split from the explicit framing, not from raw counts.
// In a real production input both sides would have multiple respondents;
// the eval lets the engine prove it CAN surface a tension when both sides
// are present, even if each side is thin. The runner's hard check is
// "tensions !== 0", not "tensions === 1" — see runner.

// ── synth_02 — full consensus, no tension ──────────────────────────────────

const synth02: SynthesisEvalCase = {
  id: "synth_02",
  description: "Full consensus on UX friction; ZERO tensions expected",
  rationale:
    "Anti-balance-bias check. 5 respondents all complain about the same hidden filter; the synthesizer MUST return zero tensions (not a fake counter-side just because the page would look more interesting).",
  input: {
    plan: {
      title: "UX-Friction-Studie",
      objective: "Welche UI-Stellen kosten Klicks und Zeit?",
      persona: "Power-User des Dashboards",
    },
    insights: [
      insight("insight_02_a", "Sales Ops", "Filter sind versteckt.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter-Menü zu versteckt",
            description: "Niemand findet die Filter beim ersten Mal.",
            severity: "high",
            confidence: 0.9,
            evidence: ["das Filter-Menü ist viel zu versteckt, drei Klicks bis dahin"],
          },
        ],
      }),
      insight("insight_02_b", "Marketing Lead", "Filter findet man nicht.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter unklar",
            description: "Kollegen brauchen Anleitung.",
            severity: "high",
            confidence: 0.85,
            evidence: ["Kollegen finden das Filter-Dropdown nicht von allein"],
          },
        ],
      }),
      insight("insight_02_c", "Operations", "Filter ist versteckt.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Zu viele Klicks bis zum Filter",
            description: "Drei Ebenen tief.",
            severity: "medium",
            confidence: 0.8,
            evidence: ["bis ich beim Filter bin sind das drei Klicks"],
          },
        ],
      }),
      insight("insight_02_d", "Admin", "Filter unauffindbar.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter versteckt unter Optionen",
            description: "Default-Position wäre besser.",
            severity: "high",
            confidence: 0.9,
            evidence: ["der Filter ist unter Optionen versteckt, das findet niemand"],
          },
        ],
      }),
      insight("insight_02_e", "Power User", "Filter zu tief.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter sollte auf Top-Level",
            description: "Sichtbar machen statt verstecken.",
            severity: "high",
            confidence: 0.9,
            evidence: ["der Filter müsste oben sichtbar sein, nicht im Untermenü"],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 1, tensions: 0, maxThemeFrequency: 5 },
};

// ── synth_03 — sparse / incoherent ─────────────────────────────────────────

const synth03: SynthesisEvalCase = {
  id: "synth_03",
  description: "Only 2 insights on unrelated topics; n=1 per concern",
  rationale:
    "Thin-input case. With 2 unique respondents on unrelated concerns, the synthesizer must NOT claim a 'theme' from n=1 each. tensions=0 (need ≥2 per side). emergent_themes: at most 0-1, both with frequency = 1 if any.",
  input: {
    plan: {
      title: "Initial Discovery",
      objective: "Erste Eindrücke vom Produkt.",
      persona: null,
    },
    insights: [
      insight("insight_03_a", null, "Eine Person zur API.", {
        feature: [
          {
            category: "API",
            title: "API gewünscht",
            description: "Eigener Workflow benötigt API-Zugriff.",
            intensity: "medium",
            confidence: 0.7,
            evidence: ["habt ihr eine API? wir würden gern selbst was drauf bauen"],
          },
        ],
      }),
      insight("insight_03_b", null, "Andere Person zu Reporting.", {
        feature: [
          {
            category: "REPORTING",
            title: "Excel-Export",
            description: "Reports für CFO brauchen Excel.",
            intensity: "medium",
            confidence: 0.7,
            evidence: ["Excel-Export wäre Gold wert, unser CFO will das"],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 0, maxThemes: 1, tensions: 0, maxThemeFrequency: 1 },
};

// ── synth_04 — empty / off-topic ───────────────────────────────────────────

const synth04: SynthesisEvalCase = {
  id: "synth_04",
  description: "4 insights with empty feature_requests + empty pain_points",
  rationale:
    "Empty-on-empty check. When Stage-1 produced nothing actionable (4 off-topic calls), Stage 2 must NOT manufacture themes. Empty arrays + honest one-sentence overview is the correct answer.",
  input: {
    plan: {
      title: "Brand-Awareness-Studie",
      objective: "Wie nehmen Kunden den Markennamen wahr?",
      persona: null,
    },
    insights: [
      insight("insight_04_a", null, "Gespräch drehte sich um Vertrag."),
      insight("insight_04_b", null, "Kunde redete über sein Wetter."),
      insight("insight_04_c", null, "Keine Produktthemen aufgekommen."),
      insight("insight_04_d", null, "Smalltalk, keine Produkt-Erwähnung."),
    ],
  },
  expected: { minThemes: 0, maxThemes: 0, tensions: 0 },
};

export const SYNTHESIS_EVAL_CASES: SynthesisEvalCase[] = [
  synth01,
  synth02,
  synth03,
  synth04,
];
