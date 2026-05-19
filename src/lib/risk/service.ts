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
  org_id: string;
  deal_id: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  overall_reasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
  analyzed_at: string;
}

export async function getLatestRiskScore(
  orgId: string,
  dealId: string,
): Promise<RiskScoreRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores" as never)
    .select("*")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as RiskScoreRecord;
}

export async function getRiskScoreHistory(
  orgId: string,
  dealId: string,
  limit = 10,
): Promise<RiskScoreRecord[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores" as never)
    .select("*")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as RiskScoreRecord[];
}

/**
 * Fetch the latest risk_score for each of the given deal IDs.
 * Returns a Map keyed by deal_id; deals without a stored score are absent.
 */
export async function getLatestRiskScoresForDeals(
  orgId: string,
  dealIds: string[],
): Promise<Map<string, RiskScoreRecord>> {
  if (dealIds.length === 0) return new Map();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores" as never)
    .select("*")
    .eq("org_id", orgId)
    .in("deal_id", dealIds)
    .order("analyzed_at", { ascending: false });

  if (error || !data) return new Map();

  const latest = new Map<string, RiskScoreRecord>();
  for (const row of data as unknown as RiskScoreRecord[]) {
    if (!latest.has(row.deal_id)) {
      latest.set(row.deal_id, row);
    }
  }
  return latest;
}
