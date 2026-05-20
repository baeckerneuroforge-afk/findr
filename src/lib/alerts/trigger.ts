import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  getSlackIntegration,
  sendSlackAlert,
  logAlert,
  type SlackAlertPayload,
} from "@/lib/slack/service";
import type { RiskAnalysisResult } from "@/lib/deals/types";

export async function maybeTriggerAlert(
  orgId: string,
  dealId: string,
  dealName: string,
  riskScoreId: string,
  result: RiskAnalysisResult,
  previousScore: number | null,
): Promise<{ triggered: boolean; reason?: string }> {
  const integration = await getSlackIntegration(orgId);
  if (!integration) {
    return { triggered: false, reason: "no_integration" };
  }

  if (integration.alert_on_critical_only && result.riskLevel !== "critical") {
    return { triggered: false, reason: "below_critical_threshold" };
  }

  if (
    !integration.alert_on_critical_only &&
    result.riskScore < integration.alert_threshold
  ) {
    return { triggered: false, reason: "below_score_threshold" };
  }

  let alertType: "threshold_crossed" | "critical_signal" | "score_spike" =
    "threshold_crossed";
  if (result.riskLevel === "critical") alertType = "critical_signal";
  if (previousScore !== null && result.riskScore - previousScore >= 20) {
    alertType = "score_spike";
  }

  const topSignals = [...result.signals]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((s) => ({ type: s.type, confidence: s.confidence }));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const payload: SlackAlertPayload = {
    dealName,
    dealId,
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    topSignals,
    overallReasoning: result.overallReasoning,
    topRecommendation: result.recommendations?.[0],
    dashboardUrl: `${baseUrl}/dashboard?deal=${dealId}`,
  };

  const sendResult = await sendSlackAlert(integration, payload);

  await logAlert(
    orgId,
    dealId,
    riskScoreId,
    alertType,
    integration.channel_id,
    payload,
    sendResult.success ? "sent" : "failed",
    sendResult.error,
  );

  return { triggered: sendResult.success, reason: sendResult.error };
}

/**
 * Returns the second-most-recent risk_score for the deal (i.e. the score
 * immediately before the one we're about to insert). Returns null if there's
 * only one or zero stored scores.
 */
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
    .limit(2);

  if (!data || data.length < 2) return null;
  return data[1].risk_score;
}
