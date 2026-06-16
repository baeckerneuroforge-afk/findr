import "server-only";

import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import { getOrgName } from "@/lib/auth/org";
import { getOrgSettings } from "@/lib/settings/org-settings";
import { analyzeHealth } from "@/lib/health/classifier";
import { withAggregatedScores } from "@/lib/health/aggregate";
import type {
  AcuteSignal,
  AcuteSignalSeverity,
} from "@/lib/schemas/health";
import type { RiskSignal } from "@/lib/schemas/risk";
import { getAccount } from "./service";
import type { HealthLevel } from "./types";

type HealthRow = Database["public"]["Tables"]["account_health_scores"]["Row"];

/**
 * The signal shape STORED in the `signals` jsonb column and surfaced to the
 * existing dashboard + save-play readers. It mirrors RiskSignal (the legacy
 * shape used across the deal flow) so those readers keep working unchanged:
 *  - severity → derived confidence  (low 0.55, medium 0.7, high 0.85, critical 0.95)
 *  - evidence → quotes
 *  - type, reasoning            → unchanged
 *
 * The native `severity` is preserved as a sidecar field on the jsonb so
 * future migrations can read the original calibration without re-running
 * the classifier.
 */
export type StoredHealthSignal = RiskSignal & {
  severity: AcuteSignalSeverity;
};

export interface HealthScoreRecord {
  id: string;
  org_id: string;
  account_id: string;
  health_score: number;
  health_level: HealthLevel;
  /** The classifier's transcript summary (mapped from `summary` field). */
  overall_reasoning: string;
  /** Empty for rows written by the v2 classifier — retention actions now
   *  come from the save-play layer. Legacy rows may still carry recs. */
  recommendations: string[];
  signals: StoredHealthSignal[];
  /** The transcript (call) whose analysis produced this score, if still present. */
  source_call_id: string | null;
  /** "ai" = Claude classifier (always for v2 rows); "heuristic" = legacy
   *  rule-based fallback (only on old rows). */
  analysis_method: "ai" | "heuristic";
  analyzed_at: string;
}

export const AnalyzeTranscriptSchema = z.object({
  transcript: z.string().trim().min(1).max(100_000),
});
export type AnalyzeTranscriptInput = z.infer<typeof AnalyzeTranscriptSchema>;

// ── Signal mapping (acute → stored) ─────────────────────────────────────────
// Severity → confidence: monotonic mapping that preserves the strictest-first
// sort order in the dashboard's topSignal helper and renders sensibly in the
// existing ConfidenceIndicator + severity bar.
const SEVERITY_TO_CONFIDENCE: Record<AcuteSignalSeverity, number> = {
  low: 0.55,
  medium: 0.7,
  high: 0.85,
  critical: 0.95,
};

function acuteSignalToStored(s: AcuteSignal): StoredHealthSignal {
  return {
    type: s.type,
    confidence: SEVERITY_TO_CONFIDENCE[s.severity],
    reasoning: s.reasoning,
    quotes: s.evidence,
    severity: s.severity,
  };
}

// ── Level coercion (DB string → strict HealthLevel) ─────────────────────────
const HEALTH_LEVEL_SET: ReadonlySet<HealthLevel> = new Set([
  "thriving",
  "healthy",
  "lukewarm",
  "at_risk",
  "critical",
]);

function toHealthLevel(value: string): HealthLevel {
  // Coerce unknown DB values (e.g. a future fifth level not yet typed here, or
  // a manual SQL hack) to "at_risk" as a conservative default — surfacing
  // unknown as critical would be alarmist, as healthy would hide a problem.
  return HEALTH_LEVEL_SET.has(value as HealthLevel)
    ? (value as HealthLevel)
    : "at_risk";
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
    signals: (row.signals as unknown as StoredHealthSignal[]) ?? [],
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

/**
 * Fetch the latest health score for each of the given account IDs.
 * Returns a Map keyed by account_id; accounts without a stored score are absent.
 * One indexed DISTINCT ON query — mirrors getLatestRiskScoresForDeals. No Opus.
 */
export async function getLatestHealthScoresForAccounts(
  orgId: string,
  accountIds: string[],
): Promise<Map<string, HealthScoreRecord>> {
  if (accountIds.length === 0) return new Map();

  const supabase = createAdminSupabaseClient();
  // DISTINCT ON in SQL (get_latest_health_scores_fn migration) returns one
  // latest row per account, instead of loading the full per-account history
  // and de-duping in JS — the daily check-in/reanalyze crons append a row per
  // account per run, so that fetch grows without bound on /dashboard/health
  // and /dashboard/accounts. Mirrors getLatestRiskScoresForDeals.
  const { data, error } = await supabase.rpc(
    "get_latest_health_scores_for_accounts",
    { p_org_id: orgId, p_account_ids: accountIds },
  );

  if (error || !data) return new Map();

  const latest = new Map<string, HealthScoreRecord>();
  for (const row of data as unknown as HealthRow[]) {
    latest.set(row.account_id, toRecord(row));
  }
  return latest;
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

// ── analysis ────────────────────────────────────────────────────────────────

export interface AnalyzeAccountResult {
  health: HealthScoreRecord;
  /** v2 always "llm" — the dedicated health classifier has no heuristic
   *  fallback (a health analysis is only worth surfacing when the model
   *  produced a valid grounded one). Kept as a string union for response
   *  shape stability. */
  source: "llm";
}

/**
 * Store a transcript as a call on the account, run the DEDICATED CS Health
 * classifier (src/lib/health/) over it, aggregate the result deterministically
 * (axes + signals → score + 5-level), and persist one score point.
 * Returns null only if the account doesn't exist in this org.
 *
 * Replaces the legacy `riskToHealth` inversion. The classifier rates four
 * satisfaction axes (product, relationship, valueRealization, engagement)
 * independently and emits acute event signals using the same vocabulary as
 * the risk engine (CHAMPION_LOSS, BUDGET_FRICTION, …). The aggregator
 * combines them deterministically using fixed weights + signal caps.
 *
 * One score per transcript (mirrors the previous etappe): the account's
 * CURRENT health is the newest transcript's score; the history chart shows
 * every point, so a real recovery between conversations is visible.
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

  // 2) Pull lightweight account/org context — grounds the classifier in
  //    WHO is talking to WHOM. Failures here are non-fatal; we fall back to
  //    null so the classifier still runs without the labels.
  const [orgName, orgSettings] = await Promise.all([
    getOrgName(orgId).catch(() => null),
    getOrgSettings(orgId).catch(() => null),
  ]);

  // 3) Run the dedicated health classifier and aggregate.
  const raw = await analyzeHealth({
    transcript,
    account: {
      companyName: account.companyName,
      sponsorName: account.sponsorName,
      productName: orgSettings?.productName?.trim() || null,
      orgName: orgName?.trim() || null,
    },
    recordedAt: now,
  });
  const aggregated = withAggregatedScores(raw);

  // 4) Map acuteSignals → legacy RiskSignal shape so the existing dashboard
  //    + save-play layer keep reading without modification. Native severity
  //    is preserved on the jsonb sidecar.
  const signalsForDb = aggregated.acuteSignals.map(acuteSignalToStored);

  const { data: inserted, error: insertError } = await supabase
    .from("account_health_scores")
    .insert({
      org_id: orgId,
      account_id: accountId,
      health_score: aggregated.healthScore,
      health_level: aggregated.healthLevel,
      overall_reasoning: aggregated.summary,
      recommendations: [],
      signals: signalsForDb as unknown as Json,
      source_call_id: callRow.id,
      analysis_method: "ai",
      analyzed_at: now,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to persist health score: ${insertError?.message ?? "no row returned"}`,
    );
  }

  return { health: toRecord(inserted), source: "llm" };
}
