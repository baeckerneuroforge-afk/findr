import {
  HEALTH_AXIS_KEYS,
  type AcuteSignal,
  type AcuteSignalSeverity,
  type HealthAnalysisResult,
  type HealthAxisKey,
  type HealthLevel,
} from "@/lib/schemas/health";

/**
 * Deterministic aggregator that turns the classifier's per-axis ratings + acute
 * signals into a final { healthScore, healthLevel }. Reproducible, eval-able,
 * and adjustable in ONE place via the named constants below.
 *
 * The classifier's own healthScore / healthLevel are kept on the result for
 * inspection; production callers typically overwrite them with the aggregated
 * values so the score is reproducible from the structured output alone.
 */

// ── Axis weights — sum to 1.0 ───────────────────────────────────────────────
// Value realization and relationship dominate because they're the strongest
// leading indicators of renewal; product and engagement support but rarely flip
// the verdict on their own.
export const AXIS_WEIGHTS: Record<HealthAxisKey, number> = {
  valueRealization: 0.3,
  relationship: 0.3,
  product: 0.2,
  engagement: 0.2,
};

// Axes with confidence BELOW this threshold are dropped from the baseline; the
// remaining axes' weights are renormalized to sum to 1. Mirrors the prompt's
// "if the transcript barely touches an axis, set confidence < 0.3" rule.
export const MIN_CONFIDENCE_FOR_AXIS = 0.3;

// ── Acute-signal overrides ──────────────────────────────────────────────────
// Two effects per signal:
//   • a PENALTY subtracted from the baseline (multiple signals stack);
//   • a CAP that hard-limits the final score (the most-restrictive cap wins
//     across all signals).
// Tuned so:
//   - one medium = noticeable but recoverable (≤70 ceiling);
//   - one critical = the customer cannot land above "at_risk" (≤30);
//   - several criticals push the score into "critical" band via penalties.
export const SIGNAL_PENALTIES: Record<AcuteSignalSeverity, number> = {
  low: 5,
  medium: 12,
  high: 20,
  critical: 30,
};

export const SIGNAL_CAPS: Record<AcuteSignalSeverity, number> = {
  low: 100, // no hard cap
  medium: 70,
  high: 50,
  critical: 30,
};

// ── Score → level bands (descending, covers 0-100) ──────────────────────────
// Edit these to retune levels without touching the classifier or the prompt.
export const LEVEL_BANDS: ReadonlyArray<{ min: number; level: HealthLevel }> = [
  { min: 80, level: "thriving" },
  { min: 65, level: "healthy" },
  { min: 45, level: "lukewarm" },
  { min: 25, level: "at_risk" },
  { min: 0, level: "critical" },
] as const;

// Fallback when no axis has sufficient confidence — neutral, not optimistic.
export const NEUTRAL_BASELINE = 50;

// ── Aggregation ─────────────────────────────────────────────────────────────

export interface AggregatedHealth {
  healthScore: number;
  healthLevel: HealthLevel;
  /** Score from axes alone, before signal penalties + caps. */
  baseline: number;
  /** Maximum allowed score after applying the strictest signal cap. */
  capApplied: number;
  /** Total penalty subtracted from baseline before clamping. */
  penaltyTotal: number;
  /** Axis keys that contributed (confidence ≥ MIN_CONFIDENCE_FOR_AXIS). */
  axesUsed: HealthAxisKey[];
}

/**
 * Compute the canonical health score + level from axes + acute signals.
 * Deterministic — call as many times as you like, same inputs → same outputs.
 */
export function aggregateHealth(
  axes: HealthAnalysisResult["satisfactionAxes"],
  signals: ReadonlyArray<AcuteSignal>,
): AggregatedHealth {
  // 1) Baseline from axes — drop low-confidence axes, renormalize remaining
  //    weights so they sum to 1 again.
  const eligible = HEALTH_AXIS_KEYS.map((key) => ({
    key,
    axis: axes[key],
    weight: AXIS_WEIGHTS[key],
  })).filter(({ axis }) => axis.confidence >= MIN_CONFIDENCE_FOR_AXIS);

  const totalWeight = eligible.reduce((sum, { weight }) => sum + weight, 0);
  const baselineRaw =
    totalWeight === 0
      ? NEUTRAL_BASELINE
      : eligible.reduce(
          (acc, { axis, weight }) => acc + axis.score * (weight / totalWeight),
          0,
        );

  // 2) Acute signals — penalties stack, strictest cap wins.
  const penaltyTotal = signals.reduce(
    (sum, s) => sum + SIGNAL_PENALTIES[s.severity],
    0,
  );
  const capApplied =
    signals.length === 0
      ? 100
      : Math.min(...signals.map((s) => SIGNAL_CAPS[s.severity]));

  // 3) Final: clamp (baseline − penalties) into [0, cap].
  const afterPenalty = Math.max(0, baselineRaw - penaltyTotal);
  const healthScore = Math.round(Math.min(afterPenalty, capApplied));

  // 4) Level from fixed bands (descending; the first match wins).
  const band = LEVEL_BANDS.find((b) => healthScore >= b.min);
  const healthLevel: HealthLevel = band?.level ?? "critical";

  return {
    healthScore,
    healthLevel,
    baseline: Math.round(baselineRaw),
    capApplied,
    penaltyTotal,
    axesUsed: eligible.map(({ key }) => key),
  };
}

/**
 * Convenience: take a raw classifier result and return a copy with the
 * aggregator's deterministic healthScore + healthLevel applied. The original
 * model-supplied values are dropped (use the raw result if you want both).
 */
export function withAggregatedScores(
  result: HealthAnalysisResult,
): HealthAnalysisResult {
  const { healthScore, healthLevel } = aggregateHealth(
    result.satisfactionAxes,
    result.acuteSignals,
  );
  return { ...result, healthScore, healthLevel };
}
