import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getDealsByOrg } from "@/lib/deals/service";
import { computeLossPatterns } from "./pattern-mapping";
import {
  findDealsAtLossRisk,
  type DealLossWarning,
} from "./early-warning";
import type { LossReasonType } from "./extractor";

const MIN_LOSSES_FOR_PATTERNS = 3;

export interface EarlyWarningReport {
  has_enough_data: boolean;
  total_losses_analyzed: number;
  top_loss_reason?: LossReasonType;
  top_loss_percentage?: number;
  warnings: DealLossWarning[];
}

/**
 * Normalize signal-type strings to lowercase snake_case.
 * Handles two upstream formats:
 *   - Orchestrator detectors: "champion_loss" (already canonical)
 *   - Legacy LLM classifier: "CHAMPION_LOSS" (uppercase)
 */
function normalizeSignalType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw.toLowerCase();
}

function extractSignalTypes(signals: unknown): string[] {
  if (!Array.isArray(signals)) return [];
  return signals
    .map((s): string | null => {
      if (!s || typeof s !== "object") return null;
      const record = s as Record<string, unknown>;
      const raw = record.type ?? record.signal_type;
      return normalizeSignalType(raw);
    })
    .filter((t): t is string => t !== null);
}

const CLOSED_STAGES = new Set(["closed_won", "closed_lost"]);

export async function getEarlyWarnings(
  orgId: string,
): Promise<EarlyWarningReport> {
  const supabase = createAdminSupabaseClient();

  const { data: losses, error: lossError } = await supabase
    .from("loss_reasons")
    .select("primary_reason, deals!inner(amount)")
    .eq("org_id", orgId);

  if (lossError) {
    console.error("Failed to fetch loss_reasons:", lossError.message);
  }

  const lossData = (losses ?? [])
    .map((row) => {
      const reason = (row as { primary_reason?: string }).primary_reason;
      const dealsRel = (row as { deals?: { amount?: number } | { amount?: number }[] }).deals;
      const amount = Array.isArray(dealsRel)
        ? (dealsRel[0]?.amount ?? 0)
        : (dealsRel?.amount ?? 0);
      return {
        primary_reason: reason as LossReasonType,
        deal_amount: amount,
      };
    })
    .filter((row) => Boolean(row.primary_reason));

  if (lossData.length < MIN_LOSSES_FOR_PATTERNS) {
    return {
      has_enough_data: false,
      total_losses_analyzed: lossData.length,
      warnings: [],
    };
  }

  const patterns = computeLossPatterns(lossData);

  const deals = await getDealsByOrg(orgId);
  const openDeals = deals.filter((d) => !CLOSED_STAGES.has(d.stage));

  const dealIds = openDeals.map((d) => d.id);
  const signalsByDeal = new Map<string, string[]>();

  if (dealIds.length > 0) {
    const { data: riskScores } = await supabase
      .from("risk_scores")
      .select("deal_id, signals, analyzed_at")
      .eq("org_id", orgId)
      .in("deal_id", dealIds)
      .order("analyzed_at", { ascending: false });

    for (const row of riskScores ?? []) {
      const dealId = (row as { deal_id?: string }).deal_id;
      if (!dealId || signalsByDeal.has(dealId)) continue;
      const signalsValue = (row as { signals?: unknown }).signals;
      signalsByDeal.set(dealId, extractSignalTypes(signalsValue));
    }
  }

  const openDealsWithSignals = openDeals.map((d) => ({
    id: d.id,
    name: d.name,
    amount: d.amount,
    activeSignals: signalsByDeal.get(d.id) ?? [],
  }));

  const warnings = findDealsAtLossRisk({
    lossPatterns: patterns,
    openDeals: openDealsWithSignals,
  });

  // TODO: when a high-strength warning fires on a high-value deal, dispatch a
  // Slack alert via the Sprint 5 dispatcher (alerts/trigger). Skipped for now
  // to avoid unintended notifications during demo + initial rollout.

  return {
    has_enough_data: true,
    total_losses_analyzed: lossData.length,
    top_loss_reason: patterns[0]?.reason,
    top_loss_percentage: patterns[0]?.loss_percentage,
    warnings,
  };
}
