import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { analyzeAccountTranscript } from "@/lib/accounts/health-service";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { analyzeDealRiskWithFallback } from "@/lib/risk/classifier";
import { getResearchPlan } from "@/lib/research/plans-service";
import { persistResearchTranscriptAndDiscovery } from "@/lib/research/transcript-service";
import type { RoutableAssignment } from "@/lib/schemas/voice-ingest";

/**
 * Klymeo Voice — Meeting-Typ-Router (Etappe 1).
 *
 * routeIngestedCall() schaltet auf assignment.kind und ruft GENAU EINE der
 * BESTEHENDEN Engine-Eintritte. KEINE neue KI-Logik, KEINE Änderung an den
 * Engines. Die calls-XOR (account_id XOR deal_id; calls_single_parent_chk) ist
 * per Konstruktion erfüllt, weil jeder Zweig nur seinen eigenen Parent setzt:
 *
 *   existing_customer → analyzeAccountTranscript  → calls.account_id (deal_id null)
 *   sales_call        → insertVoiceCall(deal_id)  → calls.deal_id    (account_id null)
 *                       + analyzeDealRiskWithFallback über ALLE Calls des Deals
 *   discovery         → persistResearchTranscriptAndDiscovery → calls (beide null) + plan_id
 *
 * Jeder Zweig macht zuerst einen org-gescopten Existenz-Check, damit ein
 * veralteter/feindlicher Client nicht in eine fremde oder nicht existente
 * Entität routen kann (Defense-in-Depth; analyzeAccountTranscript prüft selbst).
 */

export type RouteEngine = "health" | "risk" | "discovery";

export type RouteResult =
  | {
      ok: true;
      engine: RouteEngine;
      /** The calls row produced (null if the engine produced no call row). */
      callId: string | null;
      /** Engine-specific result id (health score / risk score / call id). */
      resultRef: string | null;
    }
  | {
      ok: false;
      code: "account_not_found" | "deal_not_found" | "plan_not_found";
    };

/** Providerneutrale Ingest-Nutzlast, die der Router an die Engines weiterreicht. */
export interface VoiceCallInput {
  transcriptText: string;
  externalMeetingId: string;
  recordedAt?: string;
  durationSeconds?: number;
  segments?: { speaker: string; text: string; tStart?: number }[];
}

type RiskAnalysis = Awaited<ReturnType<typeof analyzeDealRiskWithFallback>>;

/**
 * Insert a calls row for the SALES path (deal_id set → account_id null → XOR ok).
 * Mirrors buildManualCallInsert. Health + Discovery insert their OWN calls rows
 * inside their engine entries, so this helper is sales-only by design.
 */
async function insertVoiceCall(
  orgId: string,
  dealId: string,
  input: VoiceCallInput,
): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const recordedAt = input.recordedAt
    ? new Date(input.recordedAt).toISOString()
    : now;

  const { data, error } = await supabase
    .from("calls")
    .insert({
      org_id: orgId,
      deal_id: dealId,
      // calls.source is free text (no CHECK) — honest provenance, no migration.
      source: "findr_voice",
      call_type: "voice_meeting",
      transcript: input.transcriptText,
      duration_seconds: input.durationSeconds ?? null,
      recorded_at: recordedAt,
      participants: {
        source: "findr_voice",
        external_meeting_id: input.externalMeetingId,
        segments: input.segments ?? null,
        hint: "Klymeo Voice desktop recording. Speaker prefixes parsed during analysis when present.",
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to insert voice call: ${error?.message ?? "no row returned"}`,
    );
  }
  return data.id;
}

/**
 * Persist a risk score — identical insert shape to POST /api/risk. Returns the
 * new risk_scores id (null on insert failure, logged; the engine still ran).
 */
async function persistRiskScore(
  orgId: string,
  dealId: string,
  result: RiskAnalysis["result"],
  source: RiskAnalysis["source"],
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("risk_scores")
    .insert({
      org_id: orgId,
      deal_id: dealId,
      risk_score: result.riskScore,
      risk_level: result.riskLevel,
      overall_reasoning: result.overallReasoning,
      recommendations: result.recommendations ?? [],
      signals: result.signals as unknown as Json,
      // Honest provenance: "ai" = Claude, "heuristic" = rule-based fallback.
      analysis_method: source === "llm" ? "ai" : "heuristic",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[voice/router] risk_scores insert failed:", error?.message);
    return null;
  }
  return data.id;
}

/**
 * Dispatch one ingested, speaker-labeled transcript to exactly one engine.
 * Exhaustive over RoutableAssignment's three kinds — TS guarantees no kind is
 * unhandled, so the disambiguation can't silently drop a meeting.
 */
export async function routeIngestedCall(
  orgId: string,
  input: VoiceCallInput,
  assignment: RoutableAssignment,
): Promise<RouteResult> {
  switch (assignment.kind) {
    case "existing_customer": {
      // analyzeAccountTranscript verifies the account belongs to this org
      // (returns null otherwise) AND inserts the calls row with account_id.
      const r = await analyzeAccountTranscript(
        orgId,
        assignment.accountId,
        input.transcriptText,
      );
      if (!r) return { ok: false, code: "account_not_found" };
      return {
        ok: true,
        engine: "health",
        callId: r.health.source_call_id,
        resultRef: r.health.id,
      };
    }

    case "sales_call": {
      const deal = await getDealById(orgId, assignment.dealId);
      if (!deal) return { ok: false, code: "deal_not_found" };

      // Insert the new call FIRST (risk scores over the deal's full history),
      // then re-fetch all calls and analyze — mirrors POST /api/risk, which
      // assumes the calls already exist.
      const callId = await insertVoiceCall(orgId, deal.id, input);
      const calls = await getCallsByDealId(orgId, deal.id);
      const { result, source } = await analyzeDealRiskWithFallback(
        deal,
        calls,
        orgId,
      );
      const scoreId = await persistRiskScore(orgId, deal.id, result, source);
      return { ok: true, engine: "risk", callId, resultRef: scoreId };
    }

    case "discovery": {
      const plan = await getResearchPlan(orgId, assignment.planId);
      if (!plan) return { ok: false, code: "plan_not_found" };

      // persistResearchTranscriptAndDiscovery inserts the calls row (both
      // parents null), stamps plan_id, and runs analyzeCallForProductDiscovery.
      const r = await persistResearchTranscriptAndDiscovery({
        orgId,
        planId: plan.id,
        inviteId: null,
        transcript: input.transcriptText,
      });
      return {
        ok: true,
        engine: "discovery",
        callId: r.callId,
        resultRef: r.callId,
      };
    }
  }
}
