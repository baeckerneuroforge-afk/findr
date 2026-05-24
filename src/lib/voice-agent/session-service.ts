import "server-only";

import { randomBytes } from "node:crypto";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import {
  DEFAULT_INTERVIEW_LANGUAGE,
  DEFAULT_VOICE_MODEL,
  extractLossReasonFromInterview,
  nextInterviewMessage,
  type InterviewInput,
  type InterviewLanguage,
  type InterviewResult,
  type InterviewTurn,
} from "./interviewer";

/**
 * Persistence + orchestration for async post-loss interviews.
 *
 * SECURITY MODEL (token-based public access): RLS on interview_sessions stays
 * strict (org_isolation). The public chat page never uses the anon key — every
 * read/write goes through this service with the SERVICE-ROLE client (which
 * bypasses RLS) and is always scoped to the single row matching the caller's
 * access_token. The token is a 256-bit random string (capability URL). We never
 * list/enumerate sessions for the public path and never trust org_id from the
 * request, so possessing the unguessable token grants access to exactly one
 * session and nothing else.
 */

type Row = Database["public"]["Tables"]["interview_sessions"]["Row"];

const MAX_AGENT_TURNS = 6; // safety cap on conversation length / cost per session

export interface InterviewSession {
  id: string;
  orgId: string;
  dealId: string | null;
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  language: InterviewLanguage;
  conversation: InterviewTurn[];
  dealContext: InterviewInput | null;
  result: InterviewResult | null;
  model: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Minimal, safe-to-expose view for the public chat page. */
export interface PublicInterviewView {
  status: "open" | "completed" | "abandoned";
  conversation: InterviewTurn[];
  /** A friendly company name for the greeting, if available. */
  company: string | null;
}

function generateToken(): string {
  // 256-bit, URL-safe, unguessable — the capability credential for the link.
  return randomBytes(32).toString("base64url");
}

function toSession(row: Row): InterviewSession {
  return {
    id: row.id,
    orgId: row.org_id,
    dealId: row.deal_id,
    accessToken: row.access_token,
    status: row.status,
    language: row.language,
    conversation: (row.conversation as unknown as InterviewTurn[]) ?? [],
    dealContext: (row.deal_context as unknown as InterviewInput | null) ?? null,
    result: (row.result as unknown as InterviewResult | null) ?? null,
    model: row.model,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function toPublicView(session: InterviewSession): PublicInterviewView {
  return {
    status: session.status,
    conversation: session.conversation,
    company: session.dealContext?.deal.company ?? null,
  };
}

function agentTurnCount(conversation: InterviewTurn[]): number {
  return conversation.filter((t) => t.role === "agent").length;
}

async function loadByToken(token: string): Promise<InterviewSession | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return toSession(data);
}

/**
 * Create a session and generate the agent's opening question (empty history ->
 * first message). Returns the row including the access token. deal_id may be null
 * in this sprint (test sessions without a real deal).
 */
export async function createInterviewSession(params: {
  orgId: string;
  dealId?: string | null;
  dealContext: InterviewInput;
  language?: InterviewLanguage;
  model?: string;
}): Promise<InterviewSession> {
  const model = params.model ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const language = params.language ?? DEFAULT_INTERVIEW_LANGUAGE;

  const opening = await nextInterviewMessage(
    params.dealContext,
    [],
    language,
    model,
  );
  const conversation: InterviewTurn[] = [
    { role: "agent", text: opening.message },
  ];

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({
      org_id: params.orgId,
      deal_id: params.dealId ?? null,
      access_token: generateToken(),
      status: "open",
      language,
      conversation: conversation as unknown as Json,
      deal_context: params.dealContext as unknown as Json,
      model,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create interview_session: ${error?.message ?? "no row returned"}`,
    );
  }
  return toSession(data);
}

/** Public read for the chat page — minimal view, by token only. */
export async function getPublicSession(
  token: string,
): Promise<PublicInterviewView | null> {
  const session = await loadByToken(token);
  return session ? toPublicView(session) : null;
}

/** Org-internal view of a deal's interview (for the dashboard deal page). */
export interface DealInterviewView {
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
  /** Result fields — populated once the interview is completed. */
  extractedReason: string | null;
  evidence: string | null;
  matchedRiskPrediction: "yes" | "no" | "partial" | null;
  reasoning: string | null;
  conversation: InterviewTurn[];
}

/**
 * The most recent interview session linked to a deal, scoped to the org. Used by
 * the deal page to show an existing interview (status + link) and, once
 * completed, its result (extracted reason, evidence, risk-prediction match,
 * reasoning, full conversation). Org-internal — the dashboard user owns the
 * deal, so exposing the access token + result here is fine; this is NOT the
 * public token path.
 */
export async function getDealInterview(
  orgId: string,
  dealId: string,
): Promise<DealInterviewView | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(
      "access_token, status, created_at, completed_at, extracted_reason, evidence, matched_risk_prediction, result, conversation",
    )
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const result = (data.result as unknown as InterviewResult | null) ?? null;
  return {
    accessToken: data.access_token,
    status: data.status,
    createdAt: data.created_at,
    completedAt: data.completed_at,
    extractedReason: data.extracted_reason,
    evidence: data.evidence,
    matchedRiskPrediction:
      (data.matched_risk_prediction as "yes" | "no" | "partial" | null) ?? null,
    reasoning: result?.reasoning ?? null,
    conversation: (data.conversation as unknown as InterviewTurn[]) ?? [],
  };
}

/**
 * Append the buyer's message, generate the next agent message, persist, and run
 * the extraction when the agent (or the safety cap) closes the conversation.
 * Returns the updated public view, or null if the token doesn't match a session.
 */
export async function advanceInterview(
  token: string,
  buyerMessage: string,
): Promise<PublicInterviewView | null> {
  const session = await loadByToken(token);
  if (!session) return null;

  // Already finished, or missing the context needed to continue — no-op.
  if (session.status !== "open" || !session.dealContext) {
    return toPublicView(session);
  }

  const input = session.dealContext;
  const model = session.model ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;

  const history: InterviewTurn[] = [
    ...session.conversation,
    { role: "customer", text: buyerMessage.trim() },
  ];

  const { done, message } = await nextInterviewMessage(
    input,
    history,
    session.language,
    model,
  );
  history.push({ role: "agent", text: message });

  const finished = done || agentTurnCount(history) >= MAX_AGENT_TURNS;
  const supabase = createAdminSupabaseClient();

  if (finished) {
    const result = await extractLossReasonFromInterview(input, history, model);
    const { data, error } = await supabase
      .from("interview_sessions")
      .update({
        conversation: history as unknown as Json,
        status: "completed",
        extracted_reason: result.extractedReason,
        evidence: result.evidence,
        matched_risk_prediction: result.matchedRiskPrediction,
        result: result as unknown as Json,
        completed_at: new Date().toISOString(),
      })
      .eq("access_token", token)
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `Failed to finalize interview_session: ${error?.message ?? "no row returned"}`,
      );
    }
    return toPublicView(toSession(data));
  }

  const { data, error } = await supabase
    .from("interview_sessions")
    .update({ conversation: history as unknown as Json })
    .eq("access_token", token)
    .select()
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to update interview_session: ${error?.message ?? "no row returned"}`,
    );
  }
  return toPublicView(toSession(data));
}
