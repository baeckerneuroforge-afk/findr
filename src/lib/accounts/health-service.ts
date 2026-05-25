import "server-only";

import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { Deal } from "@/lib/deals/types";
import type { CallForPrompt } from "@/lib/risk/prompts";
import type { RiskSignal } from "@/lib/schemas/risk";
import { analyzeDealRiskWithFallback } from "@/lib/risk/classifier";
import { getAccount } from "./service";
import type { Account, HealthLevel } from "./types";

type HealthRow = Database["public"]["Tables"]["account_health_scores"]["Row"];

export interface HealthScoreRecord {
  id: string;
  org_id: string;
  account_id: string;
  health_score: number;
  health_level: HealthLevel;
  overall_reasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
  /** The transcript (call) whose analysis produced this score, if still present. */
  source_call_id: string | null;
  /** "ai" = Claude classifier, "heuristic" = rule-based fallback. */
  analysis_method: "ai" | "heuristic";
  analyzed_at: string;
}

export const AnalyzeTranscriptSchema = z.object({
  transcript: z.string().trim().min(1).max(100_000),
});
export type AnalyzeTranscriptInput = z.infer<typeof AnalyzeTranscriptSchema>;

/**
 * Invert a churn-RISK score (high = bad) into a HEALTH score (high = good).
 * health = 100 - risk; level by thirds (healthy ≥ 67, at_risk ≥ 34, else critical).
 */
export function riskToHealth(riskScore: number): {
  healthScore: number;
  healthLevel: HealthLevel;
} {
  const healthScore = Math.max(0, Math.min(100, 100 - Math.round(riskScore)));
  const healthLevel: HealthLevel =
    healthScore >= 67 ? "healthy" : healthScore >= 34 ? "at_risk" : "critical";
  return { healthScore, healthLevel };
}

function toHealthLevel(value: string): HealthLevel {
  return value === "healthy" || value === "critical" ? value : "at_risk";
}

function toRecord(row: HealthRow): HealthScoreRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    account_id: row.account_id,
    health_score: row.health_score,
    health_level: toHealthLevel(row.health_level),
    overall_reasoning: row.overall_reasoning,
    recommendations: row.recommendations ?? [],
    signals: (row.signals as unknown as RiskSignal[]) ?? [],
    source_call_id: row.source_call_id,
    analysis_method:
      (row.analysis_method as "ai" | "heuristic" | undefined) ?? "ai",
    analyzed_at: row.analyzed_at ?? new Date(0).toISOString(),
  };
}

// ── reads ───────────────────────────────────────────────────────────────────

export async function getLatestHealthScore(
  orgId: string,
  accountId: string,
): Promise<HealthScoreRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("account_health_scores")
    .select("*")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toRecord(data);
}

export async function getHealthScoreHistory(
  orgId: string,
  accountId: string,
  limit = 30,
): Promise<HealthScoreRecord[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("account_health_scores")
    .select("*")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(toRecord).reverse();
}

/** Number of transcripts (calls) stored for this account — drives the honesty line. */
export async function getAccountTranscriptCount(
  orgId: string,
  accountId: string,
): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("account_id", accountId);

  if (error || count === null) return 0;
  return count;
}

// ── analysis ─────────────────────────────────────────────────────────────────

async function loadAccountPromptCalls(
  orgId: string,
  accountId: string,
): Promise<CallForPrompt[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      "call_type, duration_seconds, recorded_at, transcript_summary, transcript",
    )
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("recorded_at", { ascending: false });

  if (error || !data) return [];
  return data.map((c) => ({
    call_type: c.call_type,
    duration_seconds: c.duration_seconds,
    recorded_at: c.recorded_at,
    transcript_summary: c.transcript_summary,
    transcript: c.transcript,
  }));
}

/**
 * Synthetic Deal built from an account so the deal risk engine can run unchanged.
 * Post-sale relationship signals (champion disengagement, stalling, engagement
 * drop, …) carry over directly; only the framing differs. A dedicated post-sale
 * prompt is a deliberate later refinement, not part of this stage.
 */
function accountToSyntheticDeal(account: Account, callCount: number): Deal {
  return {
    id: account.id,
    name: account.companyName,
    companyName: account.companyName,
    amount: account.mrr ?? 0,
    currency: account.currency,
    stage: "closed_won",
    ownerName: "—",
    championName: account.sponsorName ?? "Unknown",
    championTitle: "Sponsor",
    daysSinceLastActivity: 0,
    callsCompleted: callCount,
    emailsSent: 0,
    stakeholdersCount: account.sponsorName ? 1 : 0,
    competitorsMentioned: [],
    closeDate: account.renewalDate ?? account.createdAt,
    createdAt: account.createdAt,
  };
}

export interface AnalyzeAccountResult {
  health: HealthScoreRecord;
  source: "llm" | "heuristic";
}

/**
 * Store a transcript as a call on the account, run the EXISTING risk engine over
 * all of the account's transcripts, invert the result to a health score, and
 * persist it. Returns null only if the account doesn't exist in this org.
 *
 * The attach point (account_id) is what makes this "health" rather than "risk" —
 * there is no phase auto-detection.
 */
export async function analyzeAccountTranscript(
  orgId: string,
  accountId: string,
  transcript: string,
): Promise<AnalyzeAccountResult | null> {
  const account = await getAccount(orgId, accountId);
  if (!account) return null;

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  // 1) Persist the transcript as a post-sale call attached to the account.
  const { data: callRow, error: callError } = await supabase
    .from("calls")
    .insert({
      org_id: orgId,
      account_id: accountId,
      deal_id: null,
      source: "manual",
      call_type: "manual_transcript",
      transcript,
      recorded_at: now,
      participants: {
        source: "manual",
        hint: "Post-sale transcript pasted for account health analysis.",
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (callError || !callRow) {
    throw new Error(
      `Failed to store transcript: ${callError?.message ?? "no row returned"}`,
    );
  }

  // 2) Run the existing engine over ALL of the account's transcripts.
  const promptCalls = await loadAccountPromptCalls(orgId, accountId);
  const syntheticDeal = accountToSyntheticDeal(account, promptCalls.length);
  const { result, source } = await analyzeDealRiskWithFallback(
    syntheticDeal,
    promptCalls,
    orgId,
  );

  // 3) Invert risk → health and persist (with honest provenance).
  const { healthScore, healthLevel } = riskToHealth(result.riskScore);
  const { data: inserted, error: insertError } = await supabase
    .from("account_health_scores")
    .insert({
      org_id: orgId,
      account_id: accountId,
      health_score: healthScore,
      health_level: healthLevel,
      overall_reasoning: result.overallReasoning,
      recommendations: result.recommendations ?? [],
      signals: result.signals as unknown as Json,
      source_call_id: callRow.id,
      analysis_method: source === "llm" ? "ai" : "heuristic",
      analyzed_at: now,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to persist health score: ${insertError?.message ?? "no row returned"}`,
    );
  }

  return { health: toRecord(inserted), source };
}
