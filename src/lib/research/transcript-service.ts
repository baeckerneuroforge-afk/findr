import "server-only";

import type { Json } from "@/types/database";
import { analyzeCallForProductDiscovery } from "@/lib/product-discovery/service";
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

export interface PersistResearchTranscriptResult {
  callId: string | null;
  discoveryRan: boolean;
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
  planId: string | null;
  inviteId: string | null;
  transcript: string;
}): Promise<PersistResearchTranscriptResult> {
  const supabase = createResearchSupabase();
  const now = new Date().toISOString();

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
      call_type: "research_interview",
      transcript: params.transcript,
      recorded_at: now,
      participants: {
        source: "research",
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
  await analyzeCallForProductDiscovery(callRow.id);

  return { callId: callRow.id, discoveryRan: true };
}
