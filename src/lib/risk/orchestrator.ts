import { BudgetFrictionDetector } from "./detectors/budget-friction";
import { ChampionLossDetector } from "./detectors/champion-loss";
import { CompetitorPressureDetector } from "./detectors/competitor-pressure";
import { EngagementDropDetector } from "./detectors/engagement-drop";
import { LateDecisionMakerDetector } from "./detectors/late-decision-maker";
import { MultiThreadingFailureDetector } from "./detectors/multi-threading-failure";
import { StakeholderChurnDetector } from "./detectors/stakeholder-churn";
import { StallingDetector } from "./detectors/stalling";
import { generateRecommendations } from "./recommendations";
import type { Detector } from "./detectors/base";
import type {
  DetectedSignal,
  DetectorInput,
  Recommendation,
  Severity,
  SignalType,
} from "./types";

const ALL_DETECTORS: Detector[] = [
  new ChampionLossDetector(),
  new CompetitorPressureDetector(),
  new StallingDetector(),
  new BudgetFrictionDetector(),
  new LateDecisionMakerDetector(),
  new StakeholderChurnDetector(),
  new EngagementDropDetector(),
  new MultiThreadingFailureDetector(),
];

export interface RiskAnalysis {
  deal_id: string;
  overall_risk_score: number;
  overall_severity: Severity;
  signals: DetectedSignal[];
  recommendations: Recommendation[];
  analyzed_at: string;
  detector_versions: Record<SignalType, string>;
}

export async function analyzeRisk(input: DetectorInput): Promise<RiskAnalysis> {
  const results = await Promise.all(
    ALL_DETECTORS.map((detector) =>
      detector.detect(input).catch((err) => {
        console.error(`Detector ${detector.type} failed:`, err);
        return {
          signal_type: detector.type,
          detected: false,
          signals: [],
          detector_version: detector.version,
        };
      }),
    ),
  );

  const allSignals = results.flatMap((result) => result.signals);
  const overallScore = calculateCompositeRiskScore(allSignals);
  const overallSeverity = scoreToSeverity(overallScore);

  return {
    deal_id: input.deal_id,
    overall_risk_score: overallScore,
    overall_severity: overallSeverity,
    signals: allSignals,
    recommendations: generateRecommendations(allSignals),
    analyzed_at: new Date().toISOString(),
    detector_versions: Object.fromEntries(
      ALL_DETECTORS.map((detector) => [detector.type, detector.version]),
    ) as Record<SignalType, string>,
  };
}

export function calculateCompositeRiskScore(signals: DetectedSignal[]): number {
  if (signals.length === 0) return 0;

  const severityWeights: Record<Severity, number> = {
    low: 15,
    medium: 35,
    high: 65,
    critical: 90,
  };
  const maxSeverityScore = Math.max(
    ...signals.map((signal) => severityWeights[signal.severity]),
  );
  const additionalSignalsBonus = Math.min((signals.length - 1) * 5, 15);

  return Math.min(100, maxSeverityScore + additionalSignalsBonus);
}

export function scoreToSeverity(score: number): Severity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}
