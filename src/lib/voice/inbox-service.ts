import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import {
  routeIngestedCall,
  type RouteEngine,
  type RouteResult,
  type VoiceCallInput,
} from "./router";
import type { RoutableAssignment } from "@/lib/schemas/voice-ingest";

/**
 * Findr Voice — voice_inbox: gleichzeitig Idempotenz-Ledger JEDES Ingests
 * (UNIQUE org+external_meeting_id) UND Posteingang (status='pending'). Spiegelt
 * das Ein-Tabellen-/Human-Gate-Muster aus src/lib/bridge/cs-to-research.ts.
 */

// ── Inline-Augmentation (voice_inbox noch nicht in database.ts) ─────────────

type VoiceInboxStatus = "pending" | "routed" | "assigned" | "dismissed";

type VoiceInboxRow = {
  id: string;
  org_id: string;
  external_meeting_id: string;
  status: VoiceInboxStatus;
  engine: RouteEngine | null;
  result_ref: string | null;
  payload: Json;
  decided_at: string | null;
  created_at: string;
};
type VoiceInboxInsert = {
  id?: string;
  org_id: string;
  external_meeting_id: string;
  status?: VoiceInboxStatus;
  engine?: RouteEngine | null;
  result_ref?: string | null;
  payload?: Json;
  decided_at?: string | null;
  created_at?: string;
};
type VoiceInboxUpdate = Partial<VoiceInboxInsert>;

type DatabaseWithVoiceInbox = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      voice_inbox: {
        Row: VoiceInboxRow;
        Insert: VoiceInboxInsert;
        Update: VoiceInboxUpdate;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createVoiceSupabase(): SupabaseClient<DatabaseWithVoiceInbox> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithVoiceInbox>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Public shapes ───────────────────────────────────────────────────────────

export interface VoiceInboxItem {
  id: string;
  externalMeetingId: string;
  status: VoiceInboxStatus;
  engine: RouteEngine | null;
  resultRef: string | null;
  payload: Record<string, unknown>;
  decidedAt: string | null;
  createdAt: string;
}

/** What a 'pending' row stores so the assign action can rebuild VoiceCallInput. */
interface StoredPayload {
  transcriptText?: string;
  externalMeetingId?: string;
  recordedAt?: string;
  durationSeconds?: number;
  segments?: { speaker: string; text: string; tStart?: number }[];
  callId?: string | null;
}

function toItem(row: VoiceInboxRow): VoiceInboxItem {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    externalMeetingId: row.external_meeting_id,
    status: row.status,
    engine: row.engine,
    resultRef: row.result_ref,
    payload,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

function asStoredPayload(payload: Record<string, unknown>): StoredPayload {
  return payload as StoredPayload;
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** Idempotency lookup: the existing ledger row for this meeting, if any. */
export async function findByExternalId(
  orgId: string,
  externalMeetingId: string,
): Promise<VoiceInboxItem | null> {
  const supabase = createVoiceSupabase();
  const { data, error } = await supabase
    .from("voice_inbox")
    .select("*")
    .eq("org_id", orgId)
    .eq("external_meeting_id", externalMeetingId)
    .maybeSingle();
  if (error || !data) return null;
  return toItem(data);
}

/** The Posteingang: items awaiting assignment, newest first. */
export async function listVoiceInbox(orgId: string): Promise<VoiceInboxItem[]> {
  const supabase = createVoiceSupabase();
  const { data, error } = await supabase
    .from("voice_inbox")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toItem);
}

// ── Writes ──────────────────────────────────────────────────────────────────

/** Insert one ledger row; on a UNIQUE(org,external_id) clash, return the
 *  already-recorded row (idempotent — a webhook retry never double-inserts). */
async function insertLedgerRow(
  orgId: string,
  externalMeetingId: string,
  row: VoiceInboxInsert,
): Promise<VoiceInboxItem> {
  const supabase = createVoiceSupabase();
  const { data, error } = await supabase
    .from("voice_inbox")
    .insert(row)
    .select("*")
    .single();
  if (!error && data) return toItem(data);

  // 23505 = unique_violation → the meeting was already recorded (race with a
  // concurrent identical ingest). Return the existing row instead of failing.
  if ((error as { code?: string } | null)?.code === "23505") {
    const existing = await findByExternalId(orgId, externalMeetingId);
    if (existing) return existing;
  }
  throw new Error(
    `Failed to record voice_inbox row: ${error?.message ?? "no row returned"}`,
  );
}

/** Record a meeting that was routed at ingest time (engine already ran). The
 *  transcript lives in the calls row now, so payload keeps metadata only. */
export async function recordRouted(
  orgId: string,
  input: VoiceCallInput,
  route: Extract<RouteResult, { ok: true }>,
): Promise<VoiceInboxItem> {
  const payload: StoredPayload = {
    externalMeetingId: input.externalMeetingId,
    recordedAt: input.recordedAt,
    durationSeconds: input.durationSeconds,
    callId: route.callId,
  };
  return insertLedgerRow(orgId, input.externalMeetingId, {
    org_id: orgId,
    external_meeting_id: input.externalMeetingId,
    status: "routed",
    engine: route.engine,
    result_ref: route.resultRef,
    payload: payload as unknown as Json,
    decided_at: new Date().toISOString(),
  });
}

/** Record a meeting deferred to the Posteingang ("später zuordnen"). Stores the
 *  full transcript so the assign action can run an engine later. */
export async function recordPending(
  orgId: string,
  input: VoiceCallInput,
): Promise<VoiceInboxItem> {
  const payload: StoredPayload = {
    transcriptText: input.transcriptText,
    externalMeetingId: input.externalMeetingId,
    recordedAt: input.recordedAt,
    durationSeconds: input.durationSeconds,
    segments: input.segments,
  };
  return insertLedgerRow(orgId, input.externalMeetingId, {
    org_id: orgId,
    external_meeting_id: input.externalMeetingId,
    status: "pending",
    payload: payload as unknown as Json,
  });
}

export type AssignResult =
  | { ok: true; item: VoiceInboxItem; route: Extract<RouteResult, { ok: true }> }
  | {
      ok: false;
      code:
        | "not_found"
        | "not_pending"
        | "missing_transcript"
        | "account_not_found"
        | "deal_not_found"
        | "plan_not_found";
    };

/**
 * Human-gate: assign a pending Posteingang item to a target → runs the SAME
 * routeIngestedCall as a direct ingest, then flips the row to 'assigned'.
 */
export async function assignVoiceInboxItem(
  orgId: string,
  id: string,
  assignment: RoutableAssignment,
): Promise<AssignResult> {
  const supabase = createVoiceSupabase();
  const { data: row, error } = await supabase
    .from("voice_inbox")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return { ok: false, code: "not_found" };
  if (row.status !== "pending") return { ok: false, code: "not_pending" };

  const stored = asStoredPayload(toItem(row).payload);
  if (!stored.transcriptText || stored.transcriptText.trim() === "") {
    return { ok: false, code: "missing_transcript" };
  }

  const input: VoiceCallInput = {
    transcriptText: stored.transcriptText,
    externalMeetingId: stored.externalMeetingId ?? row.external_meeting_id,
    recordedAt: stored.recordedAt,
    durationSeconds: stored.durationSeconds,
    segments: stored.segments,
  };

  const route = await routeIngestedCall(orgId, input, assignment);
  if (!route.ok) return { ok: false, code: route.code };

  const { data: updated, error: upErr } = await supabase
    .from("voice_inbox")
    .update({
      status: "assigned",
      engine: route.engine,
      result_ref: route.resultRef,
      decided_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*")
    .single();

  // The engine already ran; if the status flip failed, surface the row as-is.
  if (upErr || !updated) {
    console.error("[voice/inbox] assign status update failed:", upErr?.message);
    return { ok: true, item: toItem(row), route };
  }
  return { ok: true, item: toItem(updated), route };
}

/** Verwerfen — schließt den Lebenszyklus ohne Engine-Lauf. */
export async function dismissVoiceInboxItem(
  orgId: string,
  id: string,
): Promise<VoiceInboxItem | null> {
  const supabase = createVoiceSupabase();
  const { data, error } = await supabase
    .from("voice_inbox")
    .update({ status: "dismissed", decided_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return toItem(data);
}
