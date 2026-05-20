export interface EvalCase {
  id: string;
  description: string;
  category: "critical" | "high" | "medium" | "low";
  deal: {
    id: string;
    name: string;
    company: string;
    stage: string;
    amount: number;
    ownerName: string;
    lastActivity: string;
  };
  calls: Array<{
    id: string;
    title: string;
    duration_seconds: number;
    recorded_at: string;
    transcript_segments: Array<{
      speaker_role: "ae" | "buyer" | "champion" | "decision_maker";
      content: string;
    }>;
  }>;
  expected: {
    riskLevel: "low" | "medium" | "high" | "critical";
    scoreRangeMin: number;
    scoreRangeMax: number;
    requiredSignals: string[];
    forbiddenSignals?: string[];
  };
}

export interface EvalResult {
  caseId: string;
  passed: boolean;
  actual: {
    riskScore: number;
    riskLevel: string;
    detectedSignals: string[];
  };
  expected: EvalCase["expected"];
  errors: string[];
  durationMs: number;
}

export interface EvalReport {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  accuracyPct: number;
  signalPrecision: number;
  signalRecall: number;
  falsePositiveRate: number;
  levelAccuracy: number;
  totalDurationMs: number;
  estimatedCostUsd: number;
  perCategoryAccuracy: Record<string, { passed: number; total: number }>;
  failures: EvalResult[];
}
