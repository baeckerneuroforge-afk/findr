import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

export interface RiskSignal {
  type: string;
  confidence: number;
  reasoning: string;
  quotes: string[];
}

export interface RiskScoreRecord {
  id: string;
  deal_id: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  overall_reasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
  analyzed_at: string;
}

export async function getLatestRiskScore(
  dealId: string,
): Promise<RiskScoreRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores" as never)
    .select("*")
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as RiskScoreRecord;
}

export async function getRiskScoreHistory(
  dealId: string,
  limit = 10,
): Promise<RiskScoreRecord[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores" as never)
    .select("*")
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as RiskScoreRecord[];
}
