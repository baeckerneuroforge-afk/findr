export type DealStage =
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "verbal_commit"
  | "closed_won"
  | "closed_lost";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Deal {
  id: string;
  name: string;
  companyName: string;
  amount: number;
  currency: "USD" | "EUR";
  stage: DealStage;
  ownerName: string;
  championName: string;
  championTitle: string;
  daysSinceLastActivity: number;
  callsCompleted: number;
  emailsSent: number;
  stakeholdersCount: number;
  competitorsMentioned: string[];
  closeDate: string;
  createdAt: string;
  // Risk-fields, populated after classifier runs:
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskSignals?: string[];
  riskReasoning?: string;
  lastRiskUpdate?: string;
}

export interface RiskSignal {
  type: string;
  confidence: number;
  reasoning: string;
  quotes?: string[];
}

export interface RiskAnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  overallReasoning: string;
  recommendations?: string[];
}
