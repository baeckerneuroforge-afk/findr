import "server-only";

import type { Json } from "@/types/database";
import { analyzeCallForProductDiscovery } from "@/lib/product-discovery/service";
import { appendVisualCaptureToTranscript } from "@/lib/visual-intelligence/vision";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";
import { createResearchSupabase } from "./db";

/**
 * Persistence-side helper for finished research interviews. Lives in its own
 * file (not in research-orchestration.ts) to break the import cycle:
 *
 *   session-service.ts  →  this file        (invoked on finish in advanceInterview)
 *   research-orchestration.ts  →  session-service.ts  (createInterviewSession)
 *
 * If persistResearchTranscriptAndDiscovery sat next to createResearchInterview,
 * session-service would import research-orchestration which imports back
 * session-service — TS compiles such cycles but the runtime semantics are
 * fragile (one side sees `undefined` mid-init). Splitting it out keeps the
 * dependency graph one-way.
 */

/**
 * call_type-Stempel der Research-Transkriptkopien in calls — EINE Quelle für
 * Insert (hier), DSGVO-Withdraw (session-service) und Retention-Sweep (cron),
 * damit die drei Stellen nie auseinanderlaufen.
 */
export const RESEARCH_INTERVIEW_CALL_TYPE = "research_interview";

export interface PersistResearchTranscriptResult {
  callId: string | null;
  discoveryRan: boolean;
}

/** Flatten a participant conversation into the canonical transcript string. */
export function conversationToTranscript(conversation: InterviewTurn[]): string {
  return conversation
    .map((t) => `${t.role === "agent" ? "Assistant" : "Customer"}: ${t.text}`)
    .join("\n");
}

/**
 * On a finished research interview: store the conversation as a calls row so
 * the Product Discovery pipeline can analyze it, then trigger the classifier.
 *
 * Why a calls row? analyzeCallForProductDiscovery takes a callId and derives
 * org_id from the call row itself (see its docstring). Reusing the existing
 * calls table — and the existing classifier entry-point — means research-
 * sourced insights land in the same product_discovery_insights table as
 * sales/CS-sourced ones, and surface in the same /dashboard/product-discovery
 * rollup with no extra wiring.
 *
 * Both deal_id and account_id are intentionally NULL. calls_single_parent_chk
 * (account_id IS NULL OR deal_id IS NULL) permits both-null — Product
 * Discovery's resolveAccountContext returns undefined in that case and the
 * classifier runs without an account/deal label. A future plan→customer
 * mapping (if any) lands on the research_invites side, not here.
 *
 * Throws on calls-insert failure (the caller logs + swallows). Discovery
 * classifier errors also propagate; advanceInterview wraps this whole call
 * in try/catch so the conversation save is never blocked.
 */
export async function persistResearchTranscriptAndDiscovery(params: {
  orgId: string;
  sessionId?: string | null;
  planId: string | null;
  inviteId: string | null;
  transcript: string;
  visualCapture?: Json | null;
}): Promise<PersistResearchTranscriptResult> {
  const supabase = createResearchSupabase();
  const now = new Date().toISOString();
  const transcript = appendVisualCaptureToTranscript(
    params.transcript,
    params.visualCapture,
  );

  // participants is a free-form JSONB column — we stamp planId/inviteId for
  // traceability so a later analytics view can join research insights back
  // to their plan without adding a column on calls.
  const { data: callRow, error: callError } = await supabase
    .from("calls")
    .insert({
      org_id: params.orgId,
      account_id: null,
      deal_id: null,
      source: "research",
      call_type: RESEARCH_INTERVIEW_CALL_TYPE,
      transcript,
      recorded_at: now,
      participants: {
        source: "research",
        ...(params.sessionId ? { session_id: params.sessionId } : {}),
        plan_id: params.planId,
        invite_id: params.inviteId,
        hint: "Plan-driven research interview transcript (text mode).",
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (callError || !callRow) {
    throw new Error(
      `Failed to persist research transcript as call row: ${
        callError?.message ?? "no row returned"
      }`,
    );
  }

  // Discovery classifier — its own errors propagate. The calls row is
  // already saved, so a failure here leaves a recoverable state: the row
  // can be reanalysed later via /api/calls/[id]/product-discovery.
  //
  // planId wird durchgereicht: dieser Call gehört zu einer Studie
  // (research-Flow), und der Studien-Bezug landet in
  // product_discovery_insights.plan_id — Voraussetzung für Stage-2
  // (cross-call) Synthese. Bei null/missing planId (theoretischer
  // Edge: research-Session ohne Plan-Link) bleibt das Feld null.
  await analyzeCallForProductDiscovery(callRow.id, {
    planId: params.planId,
  });

  return { callId: callRow.id, discoveryRan: true };
}

export interface ApplyVisualCaptureResult {
  callId: string | null;
  discoveryRan: boolean;
  createdCall: boolean;
}

export interface VisualCaptureSessionRow {
  id: string;
  org_id: string;
  kind: string;
  status: string;
  plan_id: string | null;
  invite_id: string | null;
  conversation: Json | null;
  capture_source: string | null;
  visual_capture: Json | null;
  // Phase 2a — per-tier capture-consent stamps, read so the route can fail-
  // closed via assertCaptureConsent('screen'). Undefined pre-migration
  // (select("*") omits absent columns) → treated as "no consent" → 403.
  events_consent_at?: string | null;
  replay_consent_at?: string | null;
  screen_consent_at?: string | null;
}

export type ResolveVisualCaptureSessionResult =
  | { ok: true; session: VisualCaptureSessionRow }
  | {
      ok: false;
      reason: "not_found" | "wrong_kind" | "not_completed" | "already_captured";
    };

/**
 * Resolve the token-owned session and run the cheap eligibility checks.
 * Exposed separately from applyVisualCaptureToCompletedResearchTranscript so
 * the route can gate BEFORE spending the vision LLM call — an invalid or
 * ineligible token must never trigger frame analysis.
 */
export async function resolveVisualCaptureSession(
  accessToken: string,
): Promise<ResolveVisualCaptureSessionResult> {
  const supabase = createResearchSupabase();
  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    // select("*") rather than an explicit list so the new per-tier consent
    // columns are picked up post-migration AND absent-column-safe pre-migration
    // (the route then fail-closes via assertCaptureConsent, never 500s).
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (sessionError) {
    throw new Error(`Failed to read interview session: ${sessionError.message}`);
  }
  if (!session) {
    return { ok: false, reason: "not_found" };
  }
  if (session.kind !== "research") {
    return { ok: false, reason: "wrong_kind" };
  }
  if (session.status !== "completed") {
    return { ok: false, reason: "not_completed" };
  }
  // Idempotenz-Gate (Security-Sweep 2026-07-01, MITTEL): visual_capture wird
  // pro Session genau EINMAL verarbeitet. Ohne dieses Gate konnte jeder
  // Inhaber eines gültigen Tokens (inkl. Open-Link-Walk-ins) die Route
  // beliebig oft aufrufen und pro Call bis zu DEFAULT_MAX_VISUAL_FRAMES
  // Frames durch das Vision-LLM + einen Product-Discovery-Rerun jagen —
  // reiner Kosten-DoS. Ein bereits gefülltes visual_capture → 409 in der
  // Route, kein LLM-Spend.
  if (session.visual_capture !== null) {
    return { ok: false, reason: "already_captured" };
  }
  return { ok: true, session: session as VisualCaptureSessionRow };
}

/**
 * Add browser-derived visual observation notes to an already completed research
 * session and rerun the existing Stage-1 Product Discovery entry point.
 *
 * `session` must come from resolveVisualCaptureSession — token ownership and
 * kind/status eligibility have already been checked there.
 *
 * Data minimization: `visualCapture` must already be text/metadata-only. This
 * helper persists no raw video and no base64 frame payloads.
 */
export async function applyVisualCaptureToCompletedResearchTranscript(params: {
  session: VisualCaptureSessionRow;
  visualCapture: Json;
}): Promise<ApplyVisualCaptureResult> {
  const supabase = createResearchSupabase();
  const session = params.session;

  const { error: visualUpdateError } = await supabase
    .from("interview_sessions")
    .update({
      capture_source: "browser_screen",
      visual_capture: params.visualCapture,
    })
    .eq("id", session.id)
    .eq("org_id", session.org_id);
  if (visualUpdateError) {
    throw new Error(
      `Failed to attach visual capture metadata: ${visualUpdateError.message}`,
    );
  }

  const { data: call, error: callError } = await supabase
    .from("calls")
    .select("id, transcript")
    .eq("org_id", session.org_id)
    .contains("participants", { session_id: session.id })
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (callError) {
    throw new Error(`Failed to find research call row: ${callError.message}`);
  }

  if (!call) {
    const conversation =
      (session.conversation as unknown as InterviewTurn[] | null) ?? [];
    const result = await persistResearchTranscriptAndDiscovery({
      orgId: session.org_id,
      sessionId: session.id,
      planId: session.plan_id,
      inviteId: session.invite_id,
      transcript: conversationToTranscript(conversation),
      visualCapture: params.visualCapture,
    });
    return { ...result, createdCall: true };
  }

  const transcript = appendVisualCaptureToTranscript(
    call.transcript ?? "",
    params.visualCapture,
  );
  const { error: transcriptError } = await supabase
    .from("calls")
    .update({ transcript })
    .eq("id", call.id)
    .eq("org_id", session.org_id);
  if (transcriptError) {
    throw new Error(
      `Failed to append visual capture to call transcript: ${transcriptError.message}`,
    );
  }

  await analyzeCallForProductDiscovery(call.id, {
    planId: session.plan_id,
  });

  return { callId: call.id, discoveryRan: true, createdCall: false };
}
