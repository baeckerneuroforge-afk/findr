import type { LossReasonType } from "./extractor";

/**
 * Maps each loss-reason to the risk-signal types that are predictive of that
 * loss. Signal types here match the Sprint 4 orchestrator detector type
 * strings (snake_case lowercase): champion_loss, competitor_pressure,
 * stalling, budget_friction, late_decision_maker, stakeholder_churn,
 * engagement_drop, multi_threading_failure.
 *
 * Legacy LLM-classifier signals (SCREAMING_SNAKE_CASE like CHAMPION_LOSS) are
 * normalized to lowercase by `normalizeSignalType` in early-warning-service.
 */
export const LOSS_TO_SIGNAL_MAP: Record<LossReasonType, string[]> = {
  pricing: ["budget_friction"],
  budget: ["budget_friction"],
  compliance: ["late_decision_maker", "stalling"],
  competitor: ["competitor_pressure"],
  timing: ["stalling"],
  champion_lost: ["champion_loss", "stakeholder_churn"],
  feature_gap: ["competitor_pressure"],
  no_decision: ["stalling", "late_decision_maker"],
  internal_priority: ["stalling", "engagement_drop"],
  other: [],
};

export interface LossPattern {
  reason: LossReasonType;
  loss_count: number;
  loss_percentage: number;
  total_lost_value: number;
  predictive_signals: string[];
}

/**
 * Aggregate a list of historical loss-records into ranked LossPatterns.
 * Returns patterns sorted by loss_count descending.
 */
export function computeLossPatterns(
  lossReasons: Array<{ primary_reason: LossReasonType; deal_amount: number }>,
): LossPattern[] {
  if (lossReasons.length === 0) return [];

  const total = lossReasons.length;
  const byReason = new Map<
    LossReasonType,
    { count: number; value: number }
  >();

  for (const loss of lossReasons) {
    const existing =
      byReason.get(loss.primary_reason) ?? { count: 0, value: 0 };
    existing.count += 1;
    existing.value += loss.deal_amount;
    byReason.set(loss.primary_reason, existing);
  }

  return Array.from(byReason.entries())
    .map(([reason, data]) => ({
      reason,
      loss_count: data.count,
      loss_percentage: Math.round((data.count / total) * 100),
      total_lost_value: data.value,
      predictive_signals: LOSS_TO_SIGNAL_MAP[reason] ?? [],
    }))
    .sort((a, b) => b.loss_count - a.loss_count);
}
