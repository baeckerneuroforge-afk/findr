import type { HealthAxisKey, HealthLevel } from "@/lib/schemas/health";

/**
 * Test groups for per-category reporting. Not the same as expected.healthLevel
 * — QUIET cases live in their own group but still expect "lukewarm" at the
 * aggregator (thin transcripts land at NEUTRAL_BASELINE = 50).
 */
export type HealthCategory =
  | "thriving"
  | "healthy"
  | "lukewarm"
  | "at_risk"
  | "critical"
  | "quiet";

export interface HealthEvalAccount {
  companyName: string;
  sponsorName: string | null;
  productName: string | null;
  orgName: string | null;
}

export interface HealthEvalCase {
  id: string;
  description: string;
  category: HealthCategory;
  language: "de" | "en" | "mixed";
  account: HealthEvalAccount;
  call: {
    title: string;
    recordedAt: string;
    /** Plain text, "speaker: line\nspeaker: line" form. Fed to the classifier
     *  as-is AND used as the verbatim source for the evidence check. */
    transcript: string;
  };
  expected: {
    healthLevel: HealthLevel;
    scoreRangeMin: number;
    scoreRangeMax: number;
    /** Acute-signal types that MUST appear (e.g. CHAMPION_LOSS). */
    requiredAcuteSignals?: string[];
    /** Acute-signal types that must NOT appear. */
    forbiddenAcuteSignals?: string[];
    /** Axes the classifier MUST rate at confidence < 0.3 (honest-thin posture). */
    lowConfidenceAxes?: HealthAxisKey[];
  };
}

/** Per-axis verdict captured in the result for inspection + the evidence check. */
export interface AxisReport {
  score: number;
  confidence: number;
  evidenceCount: number;
  /** Evidence entries on this axis that did NOT appear verbatim in the transcript. */
  evidenceOrphans: number;
}

export interface HealthEvalResult {
  caseId: string;
  passed: boolean;
  /** True when the LLM call itself failed (analysis did not run) — distinct
   *  from "ran but scored wrong" so a broken model can't hide behind metrics. */
  errored: boolean;
  actual: {
    /** Score from aggregateHealth (deterministic from axes + signals). */
    healthScore: number;
    healthLevel: HealthLevel | "unknown";
    /** The classifier's own self-rating, kept for comparison. */
    rawHealthScore: number;
    rawHealthLevel: string;
    axes: Record<HealthAxisKey, AxisReport>;
    acuteSignals: string[];
    signalEvidenceOrphans: number;
  };
  expected: HealthEvalCase["expected"];
  errors: string[];
  durationMs: number;
}

export interface HealthEvalReport {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  erroredCases: number;
  accuracyPct: number;
  levelAccuracy: number;
  scoreInBandRate: number;
  /** Across ALL evidence entries (axes + signals), share that appears verbatim
   *  in the transcript. Anti-hallucination metric. */
  evidenceVerbatimRate: number;
  /** Across cases that specified lowConfidenceAxes, share of those axis-expectations
   *  the classifier honored (confidence < 0.3 where required). */
  lowConfidenceHonestyRate: number;
  totalDurationMs: number;
  estimatedCostUsd: number;
  perCategoryAccuracy: Record<string, { passed: number; total: number }>;
  failures: HealthEvalResult[];
}
