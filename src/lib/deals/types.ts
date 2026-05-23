export type DealStage =
  | "qualified"
  | "demo"
  | "proposal_sent"
  | "negotiation"
  | "verbal_commit"
  | "closed_won"
  | "closed_lost";

export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Explicit close outcome of a deal (separate from the free-form `stage`). */
export type DealOutcome = "open" | "won" | "lost";

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
  dataSource?: string;
  // Post-loss-interview prerequisites (deal contact + outcome). Optional so
  // mock/demo deals without these still satisfy the type.
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  outcome?: DealOutcome;
  closedAt?: string | null;
  // Risk-fields, populated after classifier runs:
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskSignals?: string[];
  riskReasoning?: string;
  lastRiskUpdate?: string;
  // Mean confidence (0-1) across the deal's latest risk signals. Used to
  // scale how strongly risk pulls down the forecast win-probability.
  avgSignalConfidence?: number;
}

// RiskSignal / RiskAnalysisResult are canonical in @/lib/schemas/risk
// (single source of truth, Zod-validated). Re-exported here for backward
// compatibility of import paths.
export type { RiskSignal, RiskAnalysisResult } from "@/lib/schemas/risk";
