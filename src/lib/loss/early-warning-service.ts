import "server-only";

import { getDealsByOrg } from "@/lib/deals/service";
import { getLatestRiskScoresForDeals } from "@/lib/risk/service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { SignalType } from "@/lib/risk/types";
import { computeLossPatterns, type LossPattern } from "./pattern-mapping";
import { findDealsAtLossRisk, type DealLossWarning } from "./early-warning";
import type { LossReasonType } from "./extractor";

export interface EarlyWarningReport {
  has_enough_data: boolean;
  total_losses_analyzed: number;
  top_loss_reason?: LossReasonType;
  top_loss_percentage?: number;
  loss_patterns: LossPattern[];
  warnings: DealLossWarning[];
}

type LossReasonRow = {
  primary_reason: LossReasonType;
  deals:
    | {
        amount: number | null;
      }
    | Array<{
        amount: number | null;
      }>
    | null;
};

const SIGNAL_ALIASES: Record<string, SignalType> = {
  champion_loss: "champion_loss",
  champion_lost: "champion_loss",
  championloss: "champion_loss",
  competitor_pressure: "competitor_pressure",
  competitorpressure: "competitor_pressure",
  stalling: "stalling",
  stalling_pattern: "stalling",
  stallingpattern: "stalling",
  budget_friction: "budget_friction",
  budgetfriction: "budget_friction",
  late_decision_maker: "late_decision_maker",
  latedecisionmaker: "late_decision_maker",
  stakeholder_churn: "stakeholder_churn",
  stakeholderchurn: "stakeholder_churn",
  engagement_drop: "engagement_drop",
  engagementdrop: "engagement_drop",
  champion_disengagement: "engagement_drop",
  championdisengagement: "engagement_drop",
  multi_threading_failure: "multi_threading_failure",
  multithreadingfailure: "multi_threading_failure",
};

function dealAmount(row: LossReasonRow): number {
  const deal = Array.isArray(row.deals) ? row.deals[0] : row.deals;
  return deal?.amount ?? 0;
}

export function normalizeSignalType(value: unknown): SignalType | null {
  if (typeof value !== "string") return null;
  const key = value
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .toLowerCase();

  return SIGNAL_ALIASES[key] ?? SIGNAL_ALIASES[key.replaceAll("_", "")] ?? null;
}

export function extractSignalTypes(signals: unknown): SignalType[] {
  if (!Array.isArray(signals)) return [];

  const normalized = signals
    .map((signal) => {
      if (!signal || typeof signal !== "object") return null;
      const record = signal as Record<string, Json | undefined>;
      return normalizeSignalType(record.type ?? record.signal_type);
    })
    .filter((signal): signal is SignalType => signal !== null);

  return Array.from(new Set(normalized));
}

export async function getEarlyWarnings(
  orgId: string,
): Promise<EarlyWarningReport> {
  const supabase = createAdminSupabaseClient();

  const { data: losses, error } = await supabase
    .from("loss_reasons")
    .select("primary_reason, deals!inner(amount)")
    .eq("org_id", orgId);

  const lossData = !error && losses
    ? (losses as unknown as LossReasonRow[]).map((row) => ({
        primary_reason: row.primary_reason,
        deal_amount: dealAmount(row),
      }))
    : [];

  if (lossData.length < 3) {
    return {
      has_enough_data: false,
      total_losses_analyzed: lossData.length,
      loss_patterns: [],
      warnings: [],
    };
  }

  const lossPatterns = computeLossPatterns(lossData);
  const deals = await getDealsByOrg(orgId);
  const openDeals = deals.filter(
    (deal) => !["closed_won", "closed_lost"].includes(deal.stage),
  );
  const riskScores = await getLatestRiskScoresForDeals(
    orgId,
    openDeals.map((deal) => deal.id),
  );

  const openDealsWithSignals = openDeals.map((deal) => ({
    id: deal.id,
    name: deal.name,
    amount: deal.amount,
    activeSignals: extractSignalTypes(riskScores.get(deal.id)?.signals ?? []),
  }));

  const warnings = findDealsAtLossRisk({
    lossPatterns,
    openDeals: openDealsWithSignals,
  });

  // TODO: Once alert deduplication rules are defined for this signal, high
  // warnings can call the Sprint 5 Slack dispatcher here.
  return {
    has_enough_data: true,
    total_losses_analyzed: lossData.length,
    top_loss_reason: lossPatterns[0]?.reason,
    top_loss_percentage: lossPatterns[0]?.loss_percentage,
    loss_patterns: lossPatterns,
    warnings,
  };
}
