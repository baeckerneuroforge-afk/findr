import type { SignalType } from "@/lib/risk/types";
import type { LossReasonType } from "./extractor";
import type { LossPattern } from "./pattern-mapping";

export type WarningStrength = "high" | "medium" | "low";

export interface DealLossWarning {
  deal_id: string;
  deal_name: string;
  deal_amount: number;
  matched_pattern: LossReasonType;
  pattern_percentage: number;
  matching_signals: SignalType[];
  warning_strength: WarningStrength;
}

interface OpenDealForLossRisk {
  id: string;
  name: string;
  amount: number;
  activeSignals: SignalType[];
}

function warningStrength(
  patternPercentage: number,
  matchingSignalCount: number,
): WarningStrength {
  if (patternPercentage >= 40 && matchingSignalCount >= 2) return "high";
  if (patternPercentage >= 25 || matchingSignalCount >= 2) return "medium";
  return "low";
}

export function findDealsAtLossRisk(params: {
  lossPatterns: LossPattern[];
  openDeals: OpenDealForLossRisk[];
}): DealLossWarning[] {
  const warnings: DealLossWarning[] = [];
  const significantPatterns = params.lossPatterns.filter(
    (pattern) => pattern.loss_percentage >= 15,
  );

  for (const deal of params.openDeals) {
    for (const pattern of significantPatterns) {
      const matchingSignals = pattern.predictive_signals.filter((signal) =>
        deal.activeSignals.includes(signal),
      );

      if (matchingSignals.length === 0) continue;

      warnings.push({
        deal_id: deal.id,
        deal_name: deal.name,
        deal_amount: deal.amount,
        matched_pattern: pattern.reason,
        pattern_percentage: pattern.loss_percentage,
        matching_signals: matchingSignals,
        warning_strength: warningStrength(
          pattern.loss_percentage,
          matchingSignals.length,
        ),
      });
      break;
    }
  }

  const strengthOrder: Record<WarningStrength, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return warnings.sort((a, b) => {
    const strengthDiff =
      strengthOrder[b.warning_strength] - strengthOrder[a.warning_strength];
    if (strengthDiff !== 0) return strengthDiff;
    return b.deal_amount - a.deal_amount;
  });
}
