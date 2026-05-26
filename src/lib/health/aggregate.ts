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
// Revised after eval round 1. The OLD model applied BOTH a cap AND a per-signal
// penalty to the same signal, double-punishing single-signal cases:
//   luk_010 raw 32 → agg  1   (lukewarm collapsed to critical)
//   luk_012 raw 42 → agg 10   (lukewarm collapsed to critical)
//   arc_014 raw 32 → agg  0   (at_risk collapsed to critical)
//   arc_015 raw 32 → agg  0   (at_risk collapsed to critical)
//
// New three-step model:
//   1. CAP is the PRIMARY brake. The strictest signal's cap absorbs the first
//      hit — score is clamped to that cap, full stop. NO penalty for the
//      strictest signal (it is already "spent" by the cap).
//   2. EXTRA PENALTY applies ONLY to signals BEYOND the strictest one. Halved
//      from the legacy values — its job is to differentiate 2+ same-severity
//      signals from a single one, not to double-punish.
//   3. SEVERITY FLOOR — depends on the strictest severity. Set LOW for critical
//      (5) so two stacked criticals CAN reach the critical band, but not so
//      low that one critical falls through into critical.
//
// Tuned so:
//   - 1 critical signal at any baseline → score ~32 → at_risk (25-39) ✓
//   - 2+ critical signals               → score ~17 → critical (0-24) ✓
//   - 1 high signal                     → score ~38 → at_risk top (25-39) ✓
//                                         (was 50 → lukewarm; lifted off the
//                                         lukewarm-floor in eval round 3 so a
//                                         single HIGH event from a strong
//                                         baseline lands at_risk, not lukewarm.
//                                         arc_014 / arc_015 are the canonical
//                                         cases this unlocks.)
//   - low signals                       → no cap; barely move the baseline.

/** Score ceiling imposed by the strictest signal present. */
export const SIGNAL_CAPS: Record<AcuteSignalSeverity, number> = {
  low: 100, // no cap
  medium: 72, // single medium → upper-lukewarm boundary
  high: 38, // single high → at_risk top (was 50; lowered in round 3 so a
  //                       single HIGH event from a strong baseline lands
  //                       at_risk (25-39), not lukewarm. Sits one point
  //                       below the at_risk ceiling so it cleanly lives
  //                       inside the band rather than on the edge.)
  critical: 32, // single critical → solid at_risk
};

/** Penalty applied ONLY to signals BEYOND the strictest one. Halved from the
 *  legacy per-signal penalties (low 5, medium 12, high 20, critical 30) so
 *  multiple same-severity signals nudge the score down without doubling the
 *  cap's punishment of the strictest one. */
export const SIGNAL_PENALTIES_PER_EXTRA: Record<AcuteSignalSeverity, number> = {
  low: 2,
  medium: 6,
  high: 10,
  critical: 15,
};

/** Lower bound the score cannot be pushed below by stacked extra penalties.
 *  Depends on the STRICTEST severity present: critical floor is deep (5) so
 *  multiple criticals can reach the critical band (0-24); higher severities
 *  have shallower floors to prevent the score from collapsing too far. */
export const SEVERITY_FLOORS: Record<AcuteSignalSeverity, number> = {
  low: 50,
  medium: 35,
  high: 18,
  critical: 5,
};

// ── Score → level bands (descending, covers 0-100) ──────────────────────────
// Edit these to retune levels without touching the classifier or the prompt.
export const LEVEL_BANDS: ReadonlyArray<{ min: number; level: HealthLevel }> = [
  { min: 80, level: "thriving" }, // 80-100
  { min: 62, level: "healthy" }, //  62-79 (lower bound shifted 65 → 62 in round 4:
  //                                         Opus scores ~2-3 pts stricter than Sonnet,
  //                                         so borderline-healthy cases like hth_007/008
  //                                         legitimately land in the low 60s)
  { min: 40, level: "lukewarm" }, // 40-61 (upper now bounded by healthy floor at 62;
  //                                         lower shifted from 45 → 40 in round 2)
  { min: 25, level: "at_risk" }, //  25-39
  { min: 0, level: "critical" }, //  0-24
] as const;

// Fallback when no axis has sufficient confidence — neutral, not optimistic.
export const NEUTRAL_BASELINE = 50;

// ── Aggregation ─────────────────────────────────────────────────────────────

export interface AggregatedHealth {
  healthScore: number;
  healthLevel: HealthLevel;
  /** Score from axes alone, before signal penalties + caps. */
  baseline: number;
  /** Strictest signal cap (the primary ceiling). 100 = no cap (no signals,
   *  or only low-severity signals). */
  capApplied: number;
  /** Extra-signal penalty applied AFTER the cap — counted only for signals
   *  beyond the strictest one. 0 when there is ≤1 signal. */
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

  // 2) Acute signals — cap is the PRIMARY brake; an extra-signal penalty
  //    differentiates multiple same-severity signals; a severity-dependent
  //    floor prevents stacked penalties from collapsing the score too far.
  let capApplied = 100;
  let penaltyTotal = 0;
  let scoreAfterSignals = baselineRaw;

  if (signals.length > 0) {
    // The strictest signal = the one whose cap is the tightest (lowest value).
    const strictest = signals.reduce(
      (best, s) =>
        SIGNAL_CAPS[s.severity] < SIGNAL_CAPS[best.severity] ? s : best,
      signals[0],
    );
    capApplied = SIGNAL_CAPS[strictest.severity];
    const floor = SEVERITY_FLOORS[strictest.severity];

    // Step 1: the strictest signal absorbs the cap (no additional penalty).
    const afterCap = Math.min(baselineRaw, capApplied);

    // Step 2: extra penalty for every signal BEYOND the strictest. Skipping the
    // strictest one (by index, in case multiple signals share the strictest
    // severity) is what removes the old double-punishment.
    const strictestIdx = signals.indexOf(strictest);
    penaltyTotal = signals.reduce(
      (sum, s, i) =>
        i === strictestIdx
          ? sum
          : sum + SIGNAL_PENALTIES_PER_EXTRA[s.severity],
      0,
    );

    // Step 3: bound below by the severity-floor.
    scoreAfterSignals = Math.max(floor, afterCap - penaltyTotal);
  }

  const healthScore = Math.round(scoreAfterSignals);

  // 3) Level from fixed bands (descending; the first match wins).
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
