import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { RiskSignal } from "@/lib/schemas/risk";

export type { RiskSignal };

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

type RiskScoreRow = Database["public"]["Tables"]["risk_scores"]["Row"];

/**
 * Map a raw Supabase row to our typed RiskScoreRecord. Two narrowing casts
 * remain by design: `signals` is stored as JSONB (Database type: `Json`) and
 * `risk_level` is stored as text with a check-constraint enforcing the union
 * shape — TypeScript can't see the constraint, so we trust the DB here.
 */
function toRecord(row: RiskScoreRow): RiskScoreRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    deal_id: row.deal_id,
    risk_score: row.risk_score,
    risk_level: row.risk_level as RiskScoreRecord["risk_level"],
    overall_reasoning: row.overall_reasoning,
    recommendations: row.recommendations ?? [],
    signals: (row.signals as unknown as RiskSignal[]) ?? [],
    analyzed_at: row.analyzed_at ?? new Date(0).toISOString(),
  };
}

/**
 * Mean confidence (0-1) across a set of risk signals, or undefined when there
 * are no signals. Callers use this to scale forecast risk-adjustment by how
 * sure the analysis is.
 */
export function averageSignalConfidence(
  signals: RiskSignal[],
): number | undefined {
  if (signals.length === 0) return undefined;
  const sum = signals.reduce((acc, signal) => acc + signal.confidence, 0);
  return sum / signals.length;
}

export async function getLatestRiskScore(
  orgId: string,
  dealId: string,
): Promise<RiskScoreRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores")
    .select("*")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toRecord(data);
}

export async function getRiskScoreHistory(
  orgId: string,
  dealId: string,
  limit = 30,
): Promise<RiskScoreRecord[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores")
    .select("*")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(toRecord).reverse();
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
    .from("risk_scores")
    .select("*")
    .eq("org_id", orgId)
    .in("deal_id", dealIds)
    .order("analyzed_at", { ascending: false });

  if (error || !data) return new Map();

  const latest = new Map<string, RiskScoreRecord>();
  for (const row of data) {
    if (!latest.has(row.deal_id)) {
      latest.set(row.deal_id, toRecord(row));
    }
  }
  return latest;
}
