import type { DealStage } from "@/lib/deals/types";

export interface WinProbabilityFactors {
  stageBaseline: number;
  riskAdjustment: number;
  engagementBonus: number;
  agePenalty: number;
}

export interface DealForecast {
  deal_id: string;
  deal_name: string;
  amount: number;
  stage: DealStage | string;
  risk_score: number;
  win_probability: number;
  weighted_value: number;
  factors: WinProbabilityFactors;
  confidence: "high" | "medium" | "low";
  // Mean signal confidence (0-1) that scaled the risk-adjustment, when known.
  avg_confidence?: number;
}

export interface WinProbabilityInput {
  id: string;
  name: string;
  amount: number;
  stage: DealStage | string;
  riskScore?: number;
  lastActivityDays?: number;
  // Mean confidence (0-1) of the risk signals behind riskScore. When provided,
  // it dampens the risk-adjustment so uncertain analysis moves the forecast
  // less. Omitted → full risk effect (no regression).
  signalConfidence?: number;
}

/**
 * Map mean signal confidence (0-1) to a multiplier on the risk-adjustment.
 * Undefined confidence → 1.0 (full effect). confidence 0 → 0.5 (half effect),
 * confidence 1 → 1.0. So an uncertain risk signal pulls win-probability down
 * at most half as hard as a fully-confident one.
 */
export function confidenceFactor(signalConfidence?: number): number {
  if (signalConfidence === undefined) return 1;
  return 0.5 + clamp(signalConfidence, 0, 1) * 0.5;
}

const STAGE_BASELINES: Record<string, number> = {
  qualified: 20,
  discovery: 25,
  demo: 30,
  proposal_sent: 40,
  negotiation: 60,
  verbal_commit: 80,
  closed_won: 100,
  closed_lost: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getEngagementBonus(daysSinceActivity: number): number {
  if (daysSinceActivity <= 3) return 10;
  if (daysSinceActivity <= 7) return 5;
  if (daysSinceActivity <= 14) return 0;
  if (daysSinceActivity <= 30) return -5;
  return -15;
}

export function getStageBaseline(stage: DealStage | string): number {
  return STAGE_BASELINES[stage] ?? 30;
}

export function calculateWinProbability(deal: WinProbabilityInput): DealForecast {
  const stageBaseline = getStageBaseline(deal.stage);
  const riskScore = clamp(deal.riskScore ?? 0, 0, 100);
  const factor = confidenceFactor(deal.signalConfidence);
  const riskAdjustment = -((riskScore / 100) * 50) * factor;
  const daysSinceActivity = Math.max(0, deal.lastActivityDays ?? 30);
  const engagementBonus = getEngagementBonus(daysSinceActivity);
  const agePenalty = 0;

  const rawProbability =
    stageBaseline + riskAdjustment + engagementBonus + agePenalty;
  const winProbability = Math.round(clamp(rawProbability, 0, 100));

  let confidence: DealForecast["confidence"] = "low";
  if (deal.riskScore !== undefined && daysSinceActivity <= 14) {
    confidence = "high";
  } else if (deal.riskScore !== undefined) {
    confidence = "medium";
  }

  return {
    deal_id: deal.id,
    deal_name: deal.name,
    amount: deal.amount,
    stage: deal.stage,
    risk_score: riskScore,
    win_probability: winProbability,
    weighted_value: Math.round(deal.amount * (winProbability / 100)),
    factors: {
      stageBaseline,
      riskAdjustment: Math.round(riskAdjustment),
      engagementBonus,
      agePenalty,
    },
    confidence,
    avg_confidence: deal.signalConfidence,
  };
}
