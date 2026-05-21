import type { LossPattern } from "./pattern-mapping";
import type { LossReasonType } from "./extractor";

export type WarningStrength = "high" | "medium" | "low";

export interface DealLossWarning {
  deal_id: string;
  deal_name: string;
  deal_amount: number;
  matched_pattern: LossReasonType;
  pattern_percentage: number;
  matching_signals: string[];
  warning_strength: WarningStrength;
}

interface OpenDealForMatching {
  id: string;
  name: string;
  amount: number;
  activeSignals: string[]; // normalized lowercase signal-types
}

/**
 * Patterns under 15% of total losses are filtered out — too noisy to act on.
 * Tune via the constant if the threshold needs to change for tests.
 */
export const SIGNIFICANT_PATTERN_THRESHOLD = 15;

function classifyStrength(
  patternPct: number,
  matchCount: number,
): WarningStrength {
  if (patternPct >= 40 && matchCount >= 2) return "high";
  if (patternPct >= 25 || matchCount >= 2) return "medium";
  return "low";
}

/**
 * Match open deals against significant historical loss-patterns.
 * Each deal is matched against AT MOST one pattern (the first significant
 * match wins, since patterns are pre-sorted by loss-count desc).
 */
export function findDealsAtLossRisk(params: {
  lossPatterns: LossPattern[];
  openDeals: OpenDealForMatching[];
}): DealLossWarning[] {
  const significantPatterns = params.lossPatterns.filter(
    (p) => p.loss_percentage >= SIGNIFICANT_PATTERN_THRESHOLD,
  );
  if (significantPatterns.length === 0) return [];

  const warnings: DealLossWarning[] = [];

  for (const deal of params.openDeals) {
    const activeSet = new Set(deal.activeSignals);

    for (const pattern of significantPatterns) {
      const matchingSignals = pattern.predictive_signals.filter((sig) =>
        activeSet.has(sig),
      );

      if (matchingSignals.length === 0) continue;

      warnings.push({
        deal_id: deal.id,
        deal_name: deal.name,
        deal_amount: deal.amount,
        matched_pattern: pattern.reason,
        pattern_percentage: pattern.loss_percentage,
        matching_signals: matchingSignals,
        warning_strength: classifyStrength(
          pattern.loss_percentage,
          matchingSignals.length,
        ),
      });
      break; // first matching pattern wins per deal
    }
  }

  const strengthOrder: Record<WarningStrength, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  return warnings.sort((a, b) => {
    const s = strengthOrder[b.warning_strength] - strengthOrder[a.warning_strength];
    if (s !== 0) return s;
    return b.deal_amount - a.deal_amount;
  });
}
