import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { RiskAnalysisResult } from "@/lib/deals/types";
import { getSlackAlertPreferences } from "./service";
import {
  maybeTriggerChampionLost,
  maybeTriggerRiskSpike,
} from "./triggers";
import type { AlertContext } from "./types";

export async function maybeTriggerAlert(
  orgId: string,
  dealId: string,
  dealName: string,
  riskScoreId: string,
  result: RiskAnalysisResult,
  previousScore: number | null,
  dealContext: Partial<AlertContext> = {},
): Promise<{ triggered: boolean; reason?: string }> {
  void riskScoreId;

  const preferences = await getSlackAlertPreferences(orgId);
  const context: AlertContext = {
    org_id: orgId,
    deal_id: dealId,
    deal_name: dealContext.deal_name ?? dealName,
    deal_amount: dealContext.deal_amount,
    deal_owner: dealContext.deal_owner,
    metadata: dealContext.metadata,
  };

  const topSignal = [...result.signals].sort(
    (a, b) => b.confidence - a.confidence,
  )[0];
  const triggered: string[] = [];
  const skipped: string[] = [];

  const riskSpikeResult = await maybeTriggerRiskSpike({
    orgId,
    dealId,
    oldScore: previousScore,
    newScore: result.riskScore,
    threshold: preferences.risk_spike_threshold,
    topSignalDescription:
      topSignal?.reasoning ?? topSignal?.quotes[0] ?? result.overallReasoning,
    dealContext: context,
  });
  if (riskSpikeResult.triggered) triggered.push("risk_spike");
  else if (riskSpikeResult.reason) skipped.push(riskSpikeResult.reason);

  const championSignal = result.signals.find(
    (signal) => signal.type === "CHAMPION_LOSS",
  );
  if (championSignal) {
    const championResult = await maybeTriggerChampionLost({
      orgId,
      dealId,
      championName: String(context.metadata?.champion_name ?? "Champion"),
      evidence:
        championSignal.quotes.find((quote) => quote.trim().length > 0) ??
        championSignal.reasoning,
      dealContext: context,
    });
    if (championResult.triggered) triggered.push("champion_lost");
    else if (championResult.reason) skipped.push(championResult.reason);
  }

  if (triggered.length > 0) {
    return { triggered: true, reason: triggered.join(",") };
  }

  return { triggered: false, reason: skipped[0] ?? "no_alert_conditions_met" };
}

export async function getPreviousScore(
  orgId: string,
  dealId: string,
): Promise<number | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("risk_scores")
    .select("risk_score, analyzed_at")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  return data[0].risk_score;
}
