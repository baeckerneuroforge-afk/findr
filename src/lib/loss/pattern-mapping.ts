import type { SignalType } from "@/lib/risk/types";
import type { LossReasonType } from "./extractor";

export const LOSS_TO_SIGNAL_MAP: Record<LossReasonType, SignalType[]> = {
  pricing: ["budget_friction"],
  budget: ["budget_friction"],
  compliance: ["late_decision_maker", "budget_friction"],
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
  predictive_signals: SignalType[];
}

export function computeLossPatterns(
  lossReasons: Array<{ primary_reason: LossReasonType; deal_amount: number }>,
): LossPattern[] {
  if (lossReasons.length === 0) return [];

  const total = lossReasons.length;
  const byReason = new Map<LossReasonType, { count: number; value: number }>();

  for (const loss of lossReasons) {
    const existing = byReason.get(loss.primary_reason) ?? { count: 0, value: 0 };
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
    .sort(
      (a, b) =>
        b.loss_count - a.loss_count || b.total_lost_value - a.total_lost_value,
    );
}
