export type DealStage =
  | "qualified"
  | "demo"
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

// RiskSignal / RiskAnalysisResult are canonical in @/lib/schemas/risk
// (single source of truth, Zod-validated). Re-exported here for backward
// compatibility of import paths.
export type { RiskSignal, RiskAnalysisResult } from "@/lib/schemas/risk";
