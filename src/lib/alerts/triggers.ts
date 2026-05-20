import { dispatchAlert } from "./dispatcher";
import type { AlertContext, AlertPayload, AlertSeverity } from "./types";

export function riskSpikeSeverity(newScore: number): AlertSeverity {
  return newScore >= 80 ? "critical" : "warning";
}

export function shouldTriggerRiskSpike(
  oldScore: number | null,
  newScore: number,
  threshold = 25,
): boolean {
  if (oldScore === null) return false;
  return newScore - oldScore >= threshold;
}

export function calculatePctChange(
  oldPipelineValue: number,
  newPipelineValue: number,
): number {
  if (oldPipelineValue === 0) return newPipelineValue > 0 ? 100 : 0;
  return ((newPipelineValue - oldPipelineValue) / oldPipelineValue) * 100;
}

export function shouldTriggerForecastChange(
  oldPipelineValue: number,
  newPipelineValue: number,
  threshold = 20,
): boolean {
  return Math.abs(calculatePctChange(oldPipelineValue, newPipelineValue)) >= threshold;
}

export function forecastChangeSeverity(pctChange: number): AlertSeverity {
  return pctChange < 0 ? "critical" : "info";
}

export function buildRiskSpikeAlert(params: {
  orgId: string;
  dealId: string;
  oldScore: number;
  newScore: number;
  topSignalDescription?: string;
  dealContext: AlertContext;
}): AlertPayload {
  return {
    type: "risk_spike",
    severity: riskSpikeSeverity(params.newScore),
    title: `Risk spike on ${params.dealContext.deal_name ?? "deal"}`,
    body: `Risk score increased from ${params.oldScore} to ${params.newScore}.`,
    context: {
      ...params.dealContext,
      org_id: params.orgId,
      deal_id: params.dealId,
      metadata: {
        ...params.dealContext.metadata,
        old_score: params.oldScore,
        new_score: params.newScore,
        top_signal_description: params.topSignalDescription,
      },
    },
  };
}

export async function maybeTriggerRiskSpike(params: {
  orgId: string;
  dealId: string;
  oldScore: number | null;
  newScore: number;
  threshold?: number;
  topSignalDescription?: string;
  dealContext: AlertContext;
}): Promise<{ triggered: boolean; reason?: string }> {
  if (
    !shouldTriggerRiskSpike(
      params.oldScore,
      params.newScore,
      params.threshold ?? 25,
    )
  ) {
    return { triggered: false, reason: "below_risk_spike_threshold" };
  }

  const alert = buildRiskSpikeAlert({
    ...params,
    oldScore: params.oldScore ?? 0,
  });
  const result = await dispatchAlert(alert);
  return { triggered: result.sent, reason: result.reason };
}

export function buildChampionLostAlert(params: {
  orgId: string;
  dealId: string;
  championName: string;
  evidence: string;
  dealContext: AlertContext;
}): AlertPayload {
  return {
    type: "champion_lost",
    severity: "critical",
    title: `Champion lost on ${params.dealContext.deal_name ?? "deal"}`,
    body: `${params.championName} appears to be leaving or disengaging.`,
    context: {
      ...params.dealContext,
      org_id: params.orgId,
      deal_id: params.dealId,
      metadata: {
        ...params.dealContext.metadata,
        champion_name: params.championName,
        evidence: params.evidence,
      },
    },
  };
}

export async function maybeTriggerChampionLost(params: {
  orgId: string;
  dealId: string;
  championName: string;
  evidence: string;
  dealContext: AlertContext;
}): Promise<{ triggered: boolean; reason?: string }> {
  const result = await dispatchAlert(buildChampionLostAlert(params));
  return { triggered: result.sent, reason: result.reason };
}

export function buildDealLostAlert(params: {
  orgId: string;
  dealId: string;
  dealContext: AlertContext;
}): AlertPayload {
  return {
    type: "deal_lost",
    severity: "warning",
    title: `Deal lost: ${params.dealContext.deal_name ?? "deal"}`,
    body: `${params.dealContext.deal_name ?? "Deal"} was marked as Closed-Lost.`,
    context: {
      ...params.dealContext,
      org_id: params.orgId,
      deal_id: params.dealId,
    },
  };
}

export async function maybeTriggerDealLost(params: {
  orgId: string;
  dealId: string;
  dealContext: AlertContext;
}): Promise<{ triggered: boolean; reason?: string }> {
  const result = await dispatchAlert(buildDealLostAlert(params));
  return { triggered: result.sent, reason: result.reason };
}

export function buildForecastChangeAlert(params: {
  orgId: string;
  oldPipelineValue: number;
  newPipelineValue: number;
}): AlertPayload {
  const pctChange = calculatePctChange(
    params.oldPipelineValue,
    params.newPipelineValue,
  );

  return {
    type: "forecast_change",
    severity: forecastChangeSeverity(pctChange),
    title: `Forecast change: ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%`,
    body: `Pipeline value moved from ${params.oldPipelineValue} to ${params.newPipelineValue}.`,
    context: {
      org_id: params.orgId,
      metadata: {
        old_value: params.oldPipelineValue,
        new_value: params.newPipelineValue,
        pct_change: pctChange,
      },
    },
  };
}

export async function maybeTriggerForecastChange(params: {
  orgId: string;
  oldPipelineValue: number;
  newPipelineValue: number;
  threshold?: number;
}): Promise<{ triggered: boolean; reason?: string }> {
  if (
    !shouldTriggerForecastChange(
      params.oldPipelineValue,
      params.newPipelineValue,
      params.threshold ?? 20,
    )
  ) {
    return { triggered: false, reason: "below_forecast_change_threshold" };
  }

  const result = await dispatchAlert(buildForecastChangeAlert(params));
  return { triggered: result.sent, reason: result.reason };
}
