import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

export interface CallSpeakerRow {
  id: string;
  name: string;
  role: string;
  organization: string | null;
  speaker_type: "sales_rep" | "buyer" | "buyer_team" | "champion";
  talk_time_seconds: number | null;
}

export interface TranscriptSegmentRow {
  id: string;
  call_id: string;
  speaker_id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  signals: string[];
}

export interface CallRow {
  id: string;
  deal_id: string | null;
  call_type: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  source: string | null;
  transcript: string | null;
  transcript_summary: string | null;
  call_speakers: CallSpeakerRow[];
  transcript_segments: TranscriptSegmentRow[];
}

export async function getCallsByDealId(
  orgId: string,
  dealId: string,
): Promise<CallRow[]> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id, deal_id, call_type, duration_seconds, recorded_at, source,
      transcript, transcript_summary,
      call_speakers(*),
      transcript_segments(*)
    `,
    )
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Error fetching calls:", error.message);
    return [];
  }

  return (data ?? []) as CallRow[];
}

/**
 * Batch-Variante von getCallsByDealId für den Reanalyze-Cron: EIN Read für
 * einen Chunk von Deals statt einer Query pro Deal (bei O Orgs × D Deals
 * halbierte das nightly 2·O·D Queries auf O·⌈D/Chunk⌉+O). Identische Spalten,
 * identische Sortierung (recorded_at desc bleibt pro Deal erhalten, weil das
 * globale Ordering stabil je deal_id gefiltert wird). Fail-open wie das
 * Einzel-Pendant: Fehler → leere Map (der Cron zählt die Deals dann als
 * skipped, wie bei 0 Calls).
 */
export async function getCallsByDealIds(
  orgId: string,
  dealIds: string[],
): Promise<Map<string, CallRow[]>> {
  if (dealIds.length === 0) return new Map();
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id, deal_id, call_type, duration_seconds, recorded_at, source,
      transcript, transcript_summary,
      call_speakers(*),
      transcript_segments(*)
    `,
    )
    .eq("org_id", orgId)
    .in("deal_id", dealIds)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Error fetching calls (batch):", error.message);
    return new Map();
  }

  const byDeal = new Map<string, CallRow[]>();
  for (const row of (data ?? []) as CallRow[]) {
    if (!row.deal_id) continue;
    const list = byDeal.get(row.deal_id);
    if (list) list.push(row);
    else byDeal.set(row.deal_id, [row]);
  }
  return byDeal;
}

/**
 * Lean per-deal call list for the Deal-Detail page header + collapsed list.
 * Deliberately omits transcript / call_speakers / transcript_segments: those
 * heavy joins are loaded on demand (getCallById, via the loadCallDetail server
 * action) only when a call is expanded, so the page payload no longer carries
 * every segment of every call. Returns ALL calls (no limit) — the columns are
 * tiny, so length == true call count and the ids still feed the per-call
 * Product-Discovery batch lookup. The six analysis pipelines keep using the
 * full getCallsByDealId untouched. Same ordering as getCallsByDealId.
 */
export interface DealCallSummary {
  id: string;
  call_type: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  transcript_summary: string | null;
}

export async function getCallSummariesByDealId(
  orgId: string,
  dealId: string,
): Promise<DealCallSummary[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select("id, call_type, duration_seconds, recorded_at, transcript_summary")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Error fetching call summaries:", error.message);
    return [];
  }

  return (data ?? []) as DealCallSummary[];
}

/**
 * Lean per-account call list — only the columns the Account-Detail page's
 * Product Discovery section needs. Unlike getCallsByDealId we deliberately
 * do NOT pull speakers / transcript_segments here: the Account-Detail page
 * never rendered per-call detail historically (it's account-level: Health,
 * Save-Play, Check-in), and pulling those joins by default would balloon
 * the page payload.
 */
export interface AccountCallSummary {
  id: string;
  account_id: string | null;
  call_type: string | null;
  recorded_at: string | null;
  transcript_summary: string | null;
}

export async function getCallsByAccountId(
  orgId: string,
  accountId: string,
): Promise<AccountCallSummary[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select("id, account_id, call_type, recorded_at, transcript_summary")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("recorded_at", { ascending: false });
  if (error) {
    console.error("Error fetching calls by account:", error.message);
    return [];
  }
  return (data ?? []) as AccountCallSummary[];
}

export async function getCallById(
  orgId: string,
  callId: string,
): Promise<CallRow | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id, deal_id, call_type, duration_seconds, recorded_at, source,
      transcript, transcript_summary,
      call_speakers(*),
      transcript_segments(*)
    `,
    )
    .eq("org_id", orgId)
    .eq("id", callId)
    .single();

  if (error) {
    console.error("Error fetching call:", error.message);
    return null;
  }

  return data as CallRow;
}
