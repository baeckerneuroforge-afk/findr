import { z } from "zod";

export const RISK_SIGNAL_TYPES = [
  "CHAMPION_LOSS",
  "COMPETITOR_PRESSURE",
  "STALLING_PATTERN",
  "BUDGET_FRICTION",
  "CHAMPION_DISENGAGEMENT",
  "LATE_DECISION_MAKER",
  "STAKEHOLDER_CHURN",
  "ENGAGEMENT_DROP",
] as const;

export const RiskSignalSchema = z.object({
  type: z.enum(RISK_SIGNAL_TYPES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(2000),
  quotes: z.array(z.string()).max(10).default([]),
});

export const RiskAnalysisResultSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  signals: z.array(RiskSignalSchema).max(8),
  overallReasoning: z.string().min(1).max(5000),
  recommendations: z.array(z.string()).max(5).default([]),
});

export type RiskSignal = z.infer<typeof RiskSignalSchema>;
export type RiskAnalysisResult = z.infer<typeof RiskAnalysisResultSchema>;

export const AnalyzeRiskRequestSchema = z.object({
  dealId: z.string().min(1).max(200),
});

export type AnalyzeRiskRequest = z.infer<typeof AnalyzeRiskRequestSchema>;
