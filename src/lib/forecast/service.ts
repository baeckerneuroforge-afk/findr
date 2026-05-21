import "server-only";

import { getDealsByOrg } from "@/lib/deals/service";
import type { Deal, DealStage } from "@/lib/deals/types";
import {
  averageSignalConfidence,
  getLatestRiskScoresForDeals,
} from "@/lib/risk/service";
import {
  calculateWinProbability,
  type DealForecast,
} from "@/lib/forecast/probability";

export interface StageForecastBreakdown {
  stage: DealStage | string;
  count: number;
  value: number;
  weighted: number;
}

export interface ForecastSummary {
  total_pipeline_value: number;
  weighted_pipeline_value: number;
  best_case: number;
  likely_case: number;
  worst_case: number;
  deals_at_risk_value: number;
  open_deal_count: number;
  forecasts: DealForecast[];
  by_stage: StageForecastBreakdown[];
}

const CLOSED_STAGES = new Set<DealStage>(["closed_won", "closed_lost"]);

export function buildForecastSummary(deals: Deal[]): ForecastSummary {
  const openDeals = deals.filter((deal) => !CLOSED_STAGES.has(deal.stage));

  const forecasts = openDeals
    .map((deal) =>
      calculateWinProbability({
        id: deal.id,
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage,
        riskScore: deal.riskScore,
        lastActivityDays: deal.daysSinceLastActivity,
        signalConfidence: deal.avgSignalConfidence,
      }),
    )
    .sort((a, b) => b.weighted_value - a.weighted_value);

  const totalPipeline = openDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const weightedPipeline = forecasts.reduce(
    (sum, forecast) => sum + forecast.weighted_value,
    0,
  );
  const bestCase = forecasts
    .filter((forecast) => forecast.win_probability > 50)
    .reduce((sum, forecast) => sum + forecast.amount, 0);
  const worstCase = forecasts
    .filter((forecast) => forecast.win_probability > 75)
    .reduce((sum, forecast) => sum + forecast.amount, 0);
  const atRiskValue = forecasts
    .filter((forecast) => forecast.risk_score >= 60)
    .reduce((sum, forecast) => sum + forecast.amount, 0);

  const stageMap = new Map<
    string,
    { stage: string; count: number; value: number; weighted: number }
  >();

  for (const forecast of forecasts) {
    const existing = stageMap.get(forecast.stage) ?? {
      stage: forecast.stage,
      count: 0,
      value: 0,
      weighted: 0,
    };

    existing.count += 1;
    existing.value += forecast.amount;
    existing.weighted += forecast.weighted_value;
    stageMap.set(forecast.stage, existing);
  }

  return {
    total_pipeline_value: Math.round(totalPipeline),
    weighted_pipeline_value: Math.round(weightedPipeline),
    best_case: Math.round(bestCase),
    likely_case: Math.round(weightedPipeline),
    worst_case: Math.round(worstCase),
    deals_at_risk_value: Math.round(atRiskValue),
    open_deal_count: openDeals.length,
    forecasts,
    by_stage: Array.from(stageMap.values()).map((stage) => ({
      ...stage,
      value: Math.round(stage.value),
      weighted: Math.round(stage.weighted),
    })),
  };
}

export async function getForecast(orgId: string): Promise<ForecastSummary> {
  const baseDeals = await getDealsByOrg(orgId);
  const riskMap = await getLatestRiskScoresForDeals(
    orgId,
    baseDeals.map((deal) => deal.id),
  );

  const deals = baseDeals.map((deal) => {
    const risk = riskMap.get(deal.id);
    if (!risk) return deal;

    return {
      ...deal,
      riskScore: risk.risk_score,
      riskLevel: risk.risk_level,
      riskSignals: risk.signals.map((signal) => signal.type),
      riskReasoning: risk.overall_reasoning,
      lastRiskUpdate: risk.analyzed_at,
      avgSignalConfidence: averageSignalConfidence(risk.signals),
    };
  });

  return buildForecastSummary(deals);
}
