import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database, Json } from "@/types/database";
import {
  coerceUseCase,
  getResearchPlan,
  planToAgentContext,
  type ResearchPlanRecord,
} from "@/lib/research/plans-service";
import { analyzeProductDiscovery } from "@/lib/product-discovery/classifier";
import { analyzeMarketResearch } from "@/lib/market-research/classifier";
import { synthesizeFromInputs } from "@/lib/synthesis/engine";
import type {
  SynthesisInsightInput,
  SynthesisPlanContext,
} from "@/lib/synthesis/prompts";
import type { StudySynthesisResult } from "@/lib/schemas/synthesis";
import type { ResearchBrand } from "@/lib/voice-agent/interviewer";
import type {
  InterviewLanguage,
  InterviewTurn,
} from "@/lib/voice-agent/interviewer";
import { getDefaultPersona } from "./personas";
import { runSyntheticInterview } from "./orchestration";
import type { PersonaInput } from "./persona";

/**
 * Service layer for the Market-Research synthetic dry-run (Stufe 1).
 *
 * OWNS the two dedicated tables (synthetic_test_runs + synthetic_test_sessions)
 * and the step state-machine that drives a run forward. It REUSES only the pure
 * LLM entries:
 *   - runSyntheticInterview (agent ↔ persona loop)        → conversation
 *   - analyzeProductDiscovery (pure classifier, NO DB)    → per-session insight
 *   - synthesizeFromInputs (pure synthesizer, NO DB)      → run test-synthesis
 *
 * It NEVER calls createInterviewSession / advanceInterview /
 * persistResearchTranscriptAndDiscovery / synthesizeStudy, so it NEVER writes
 * interview_sessions, calls, product_discovery_insights or study_synthesis. That
 * is the whole strict-separation guarantee: synthetic rows physically live only
 * here, so every real read (countCompletedSessionsForPlan "47/200", synthesizeStudy,
 * loadOrgSyntheses cross-study, getAllInsightsForOrg insights) is structurally
 * blind to them — no WHERE-filter needed anywhere.
 *
 * OPERATIONAL MODEL: a run is advanced ONE step per request (the client loops):
 * each step runs exactly one synthetic interview (+ classify), or — once every
 * session is done — the single synthesis. This keeps each request bounded well
 * under the serverless timeout instead of one multi-minute mega-request.
 */

// ── Augmented DB client (keeps research/db.ts byte-identical) ────────────────

type RunStatus = "running" | "completed" | "failed";
type SessionStatus = "pending" | "running" | "completed" | "failed";

type SyntheticTestRunRow = {
  id: string;
  org_id: string;
  plan_id: string;
  status: RunStatus;
  requested_count: number;
  language: InterviewLanguage;
  synthesis: Json | null;
  synthesis_model: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type SyntheticTestRunInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  status?: RunStatus;
  requested_count: number;
  language?: InterviewLanguage;
  synthesis?: Json | null;
  synthesis_model?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SyntheticTestRunUpdate = Partial<SyntheticTestRunInsert>;

type SyntheticTestSessionRow = {
  id: string;
  run_id: string;
  org_id: string;
  persona_label: string;
  persona_prompt: string;
  status: SessionStatus;
  conversation: Json;
  transcript: string | null;
  insight: Json | null;
  error: string | null;
  position: number;
  created_at: string;
  completed_at: string | null;
};

type SyntheticTestSessionInsert = {
  id?: string;
  run_id: string;
  org_id: string;
  persona_label: string;
  persona_prompt: string;
  status?: SessionStatus;
  conversation?: Json;
  transcript?: string | null;
  insight?: Json | null;
  error?: string | null;
  position?: number;
  created_at?: string;
  completed_at?: string | null;
};

type SyntheticTestSessionUpdate = Partial<SyntheticTestSessionInsert>;

type DatabaseWithSynthetic = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      synthetic_test_runs: {
        Row: SyntheticTestRunRow;
        Insert: SyntheticTestRunInsert;
        Update: SyntheticTestRunUpdate;
        Relationships: [];
      };
      synthetic_test_sessions: {
        Row: SyntheticTestSessionRow;
        Insert: SyntheticTestSessionInsert;
        Update: SyntheticTestSessionUpdate;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createSyntheticSupabase(): SupabaseClient<DatabaseWithSynthetic> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithSynthetic>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Request schema (validated by the start route) ───────────────────────────

/** Max synthetic participants per run — a TEST, kept small + cost-bounded. */
export const MAX_SYNTHETIC_PARTICIPANTS = 8;

export const SyntheticPersonaRequestSchema = z.object({
  /** A DEFAULT_PERSONAS id (server resolves the canonical prompt) or null for a
   *  free-text custom persona. */
  id: z.string().min(1).max(64).nullable().default(null),
  label: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4000),
});

export const SyntheticRunRequestSchema = z.object({
  language: z.enum(["de", "en"]).default("de"),
  personas: z
    .array(SyntheticPersonaRequestSchema)
    .min(1)
    .max(MAX_SYNTHETIC_PARTICIPANTS),
});

export type SyntheticRunRequest = z.infer<typeof SyntheticRunRequestSchema>;

// ── Public view shapes (returned to the client) ─────────────────────────────

export interface SyntheticSessionView {
  id: string;
  personaLabel: string;
  personaPrompt: string;
  status: SessionStatus;
  conversation: InterviewTurn[];
  transcript: string | null;
  /** Stage-1 summary of the synthetic transcript, for display. */
  insightSummary: string | null;
  /** Number of coded market findings extracted from this synthetic interview. */
  findingCount: number;
  error: string | null;
  position: number;
}

export interface SyntheticRunState {
  runId: string;
  status: RunStatus;
  language: InterviewLanguage;
  requestedCount: number;
  /** Completed-or-failed sessions + (synthesis done ? 1 : 0). */
  step: number;
  /** requestedCount + 1 (the +1 is the synthesis step). */
  totalSteps: number;
  sessions: SyntheticSessionView[];
  /** The TEST synthesis — stored ONLY on the run, never in study_synthesis. */
  synthesis: StudySynthesisResult | null;
  synthesisModel: string | null;
  error: string | null;
  createdAt: string;
}

// ── Mappers ─────────────────────────────────────────────────────────────────

function toSessionView(row: SyntheticTestSessionRow): SyntheticSessionView {
  const insight = (row.insight as unknown as SessionInsight | null) ?? null;
  const findings = Array.isArray(insight?.featureRequests)
    ? insight!.featureRequests
    : [];
  return {
    id: row.id,
    personaLabel: row.persona_label,
    personaPrompt: row.persona_prompt,
    status: row.status,
    conversation: (row.conversation as unknown as InterviewTurn[]) ?? [],
    transcript: row.transcript,
    insightSummary:
      typeof insight?.summary === "string" ? insight.summary : null,
    findingCount: findings.length,
    error: row.error,
    position: row.position,
  };
}

function toRunState(
  run: SyntheticTestRunRow,
  sessionRows: SyntheticTestSessionRow[],
): SyntheticRunState {
  const sessions = sessionRows
    .map(toSessionView)
    .sort((a, b) => a.position - b.position);
  const settled = sessions.filter(
    (s) => s.status === "completed" || s.status === "failed",
  ).length;
  const synthesis =
    (run.synthesis as unknown as StudySynthesisResult | null) ?? null;
  return {
    runId: run.id,
    status: run.status,
    language: run.language,
    requestedCount: run.requested_count,
    step: settled + (synthesis ? 1 : 0),
    totalSteps: run.requested_count + 1,
    sessions,
    synthesis,
    synthesisModel: run.synthesis_model,
    error: run.error,
    createdAt: run.created_at,
  };
}

// ── Internal reads ──────────────────────────────────────────────────────────

/** Load a run row, org+plan scoped (the trust boundary — runId never trusted
 *  alone). Returns null when it doesn't belong to (orgId, planId). */
async function loadRunRow(
  supabase: SupabaseClient<DatabaseWithSynthetic>,
  orgId: string,
  planId: string,
  runId: string,
): Promise<SyntheticTestRunRow | null> {
  const { data, error } = await supabase
    .from("synthetic_test_runs")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function loadSessionRows(
  supabase: SupabaseClient<DatabaseWithSynthetic>,
  orgId: string,
  runId: string,
): Promise<SyntheticTestSessionRow[]> {
  const { data, error } = await supabase
    .from("synthetic_test_sessions")
    .select("*")
    .eq("org_id", orgId)
    .eq("run_id", runId)
    .order("position", { ascending: true });
  if (error || !data) return [];
  return data;
}

async function buildState(
  supabase: SupabaseClient<DatabaseWithSynthetic>,
  orgId: string,
  run: SyntheticTestRunRow,
): Promise<SyntheticRunState> {
  const sessions = await loadSessionRows(supabase, orgId, run.id);
  return toRunState(run, sessions);
}

// ── Agent / persona input construction (faithful to the real research flow) ──

/** Build the EXACT ResearchInput a real interview for this plan would use —
 *  plan context + best-effort brand (org name + product) — mirroring
 *  createResearchInterview, so the synthetic agent behaves identically.
 *
 *  getOrgName / getOrgSettings are pulled in via DYNAMIC import (not a top-level
 *  static import) so Clerk → next/navigation stays OFF this module's load graph.
 *  The brand is best-effort grounding only: any resolution failure (incl. a
 *  Clerk-free test harness like tsx --conditions=react-server) degrades to
 *  brand = null → the agent frames itself as independent research, exactly like
 *  the real flow's own .catch(() => null) fallback. Behaviour under the Next
 *  runtime is unchanged. */
async function buildAgentInput(orgId: string, plan: ResearchPlanRecord) {
  let brand: ResearchBrand | null = null;
  try {
    const [{ getOrgName }, { getOrgSettings }] = await Promise.all([
      import("@/lib/auth/org"),
      import("@/lib/settings/org-settings"),
    ]);
    const [orgName, orgSettings] = await Promise.all([
      getOrgName(orgId).catch(() => null),
      getOrgSettings(orgId).catch(() => null),
    ]);
    brand = orgName?.trim()
      ? {
          orgName: orgName.trim(),
          productName: orgSettings?.productName?.trim() || null,
        }
      : null;
  } catch {
    brand = null;
  }
  return { plan: planToAgentContext(plan), brand };
}

function buildPersonaInput(
  plan: ResearchPlanRecord,
  personaPrompt: string,
): PersonaInput {
  return {
    personaPrompt,
    study: { objective: plan.objective, targetPersona: plan.persona },
  };
}

/** Per-session Stage-1 extraction in the SHARED synthesis-input shape
 *  (featureRequests / painPoints / themes / summary / respondent fields), which
 *  feeds synthesizeFromInputs unchanged. */
export interface SessionInsight {
  summary: string | null;
  featureRequests: unknown[];
  painPoints: unknown[];
  themes: unknown[];
  respondentRole: string | null;
  respondentSegment: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
}

/**
 * Extract one synthetic transcript into the shared Stage-1 shape, branching by
 * study_type EXACTLY like the real pipeline (analyzeCallForProductDiscovery):
 *   - market_research → the MARKET lens (analyzeMarketResearch) + the same
 *     findings→featureRequests / pain_points=[] / themes-index mapping that
 *     persistMarketResearchInsight uses, so the TEST synthesis is faithful to
 *     what the real market study would produce (price / purchase-intent /
 *     competitor signal the discovery lens would discard).
 *   - product_discovery → the discovery lens (defensive default; the dry-run
 *     route guards market_research only, so this branch is currently unreached).
 *
 * Exported so the smoke can build a faithful in-memory test synthesis without
 * the DB.
 */
export async function extractSessionInsight(
  plan: ResearchPlanRecord,
  transcript: string,
): Promise<SessionInsight> {
  if (plan.studyType === "market_research") {
    const r = await analyzeMarketResearch({
      transcript,
      study: { subject: plan.title, market: plan.persona, orgName: null },
      useCase: coerceUseCase(plan.useCase),
    });
    const themes = r.themes.map((tm) => ({
      label: tm.label,
      summary: tm.summary,
      // findings live in featureRequests → carry the index refs there.
      relatedFeatureRequestIndices: tm.relatedFindingIndices,
      relatedPainPointIndices: [] as number[],
    }));
    return {
      summary: r.summary,
      featureRequests: r.findings,
      painPoints: [],
      themes,
      respondentRole: r.respondentRole,
      respondentSegment: r.respondentSegment,
      sentiment: r.sentiment,
    };
  }
  const r = await analyzeProductDiscovery({ transcript });
  return {
    summary: r.summary,
    featureRequests: r.featureRequests,
    painPoints: r.painPoints,
    themes: r.themes,
    respondentRole: r.respondentRole,
    respondentSegment: r.respondentSegment,
    sentiment: r.sentiment,
  };
}

// ── Public API: start ───────────────────────────────────────────────────────

/**
 * Start a synthetic dry-run: insert the run + one pending session per persona.
 * No LLM work happens here — the client then drives the run forward one step at
 * a time via advanceSyntheticTestRun. The plan is assumed already verified
 * (org-owned, market_research) by the route.
 */
export async function startSyntheticTestRun(params: {
  orgId: string;
  planId: string;
  request: SyntheticRunRequest;
}): Promise<SyntheticRunState> {
  const { orgId, planId, request } = params;
  const supabase = createSyntheticSupabase();

  // Resolve personas: a known default id pins the CANONICAL prompt (the client's
  // prompt for a default is ignored — no tampering with shipped dispositions);
  // a custom persona (id null / unknown) uses the user's free text verbatim.
  const resolved = request.personas.map((p) => {
    const def = p.id ? getDefaultPersona(p.id) : undefined;
    return { label: p.label, prompt: def ? def.prompt : p.prompt };
  });

  const { data: run, error: runError } = await supabase
    .from("synthetic_test_runs")
    .insert({
      org_id: orgId,
      plan_id: planId,
      status: "running",
      requested_count: resolved.length,
      language: request.language,
    })
    .select("*")
    .single();
  if (runError || !run) {
    throw new Error(
      `Failed to create synthetic_test_run: ${runError?.message ?? "no row"}`,
    );
  }

  const { error: sessError } = await supabase
    .from("synthetic_test_sessions")
    .insert(
      resolved.map((p, i) => ({
        run_id: run.id,
        org_id: orgId,
        persona_label: p.label,
        persona_prompt: p.prompt,
        status: "pending" as const,
        position: i,
      })),
    );
  if (sessError) {
    throw new Error(
      `Failed to create synthetic_test_sessions: ${sessError.message}`,
    );
  }

  return buildState(supabase, orgId, run);
}

// ── Public API: advance one step ─────────────────────────────────────────────

/**
 * Advance a run by ONE unit of work and return the new state. Returns null when
 * the run doesn't belong to (orgId, planId) → the route maps that to 404.
 *
 * Step semantics:
 *   1) If a pending session exists → run its full synthetic interview + classify,
 *      persist it, mark it completed (or failed on error — one bad persona does
 *      NOT abort the run).
 *   2) Else, if no synthesis yet → synthesize over the completed sessions'
 *      insights (in memory, via synthesizeFromInputs) and mark the run completed.
 *      Zero successful interviews → run completes with synthesis = null + a note.
 *   3) Already completed/failed → returns current state (idempotent no-op).
 */
export async function advanceSyntheticTestRun(params: {
  orgId: string;
  planId: string;
  runId: string;
}): Promise<SyntheticRunState | null> {
  const { orgId, planId, runId } = params;
  const supabase = createSyntheticSupabase();

  const run = await loadRunRow(supabase, orgId, planId, runId);
  if (!run) return null;

  // Idempotent: nothing to advance on a settled run.
  if (run.status !== "running") {
    return buildState(supabase, orgId, run);
  }

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    // Plan vanished mid-run — fail the run honestly rather than loop.
    const { data: failed } = await supabase
      .from("synthetic_test_runs")
      .update({ status: "failed", error: "plan_not_found" })
      .eq("org_id", orgId)
      .eq("id", runId)
      .select("*")
      .single();
    return failed ? buildState(supabase, orgId, failed) : null;
  }

  const sessions = await loadSessionRows(supabase, orgId, runId);
  // Next session needing work: a 'pending' one first; otherwise a leftover
  // 'running' is a STRANDED claim from a step whose serverless invocation died
  // mid-interview (before it could write completed/failed) — recover it by
  // re-processing rather than leaving the run wedged with a perpetual 'running'
  // session (which would silently drop it from the synthesis and stick the
  // progress bar below 100%).
  const target =
    sessions.find((s) => s.status === "pending") ??
    sessions.find((s) => s.status === "running");

  // ── Step type 1: run the next pending / recovered synthetic interview ──────
  if (target) {
    // COMPARE-AND-SWAP claim: flip the row to 'running' ONLY if it still holds
    // the status we observed (.eq("status", target.status) + row-count check).
    // A concurrent /step (e.g. a second browser tab) that loses this race gets
    // 0 rows back and returns the current state instead of double-processing
    // the same persona — and the same CAS makes recovery of a stranded
    // 'running' a single winner.
    const { data: claimed } = await supabase
      .from("synthetic_test_sessions")
      .update({ status: "running" })
      .eq("org_id", orgId)
      .eq("id", target.id)
      .eq("status", target.status)
      .select("id");
    if (!claimed || claimed.length === 0) {
      const refreshed = await loadRunRow(supabase, orgId, planId, runId);
      return refreshed ? buildState(supabase, orgId, refreshed) : null;
    }

    try {
      const agentInput = await buildAgentInput(orgId, plan);
      const personaInput = buildPersonaInput(plan, target.persona_prompt);
      const result = await runSyntheticInterview({
        agentInput,
        personaInput,
        language: run.language,
      });
      // Pure classifier (study-type-aware lens) — NO DB, NO
      // product_discovery_insights row.
      const insight = await extractSessionInsight(plan, result.transcript);

      await supabase
        .from("synthetic_test_sessions")
        .update({
          status: "completed",
          conversation: result.conversation as unknown as Json,
          transcript: result.transcript,
          insight: insight as unknown as Json,
          completed_at: new Date().toISOString(),
        })
        .eq("org_id", orgId)
        .eq("id", target.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error(`[synthetic-test] session ${target.id} failed:`, message);
      await supabase
        .from("synthetic_test_sessions")
        .update({
          status: "failed",
          error: message,
          completed_at: new Date().toISOString(),
        })
        .eq("org_id", orgId)
        .eq("id", target.id);
    }

    const refreshed = await loadRunRow(supabase, orgId, planId, runId);
    return refreshed ? buildState(supabase, orgId, refreshed) : null;
  }

  // ── Step type 2: all sessions settled → synthesize (once) ──────────────────
  // Collect every completed session's Stage-1 insight as a synthesis input. The
  // synthesizer cites the session id; the UI maps it back to the persona label.
  const completed = sessions.filter(
    (s) => s.status === "completed" && s.insight,
  );

  if (completed.length === 0) {
    // No usable interview → finish honestly, no synthesis.
    const { data: done } = await supabase
      .from("synthetic_test_runs")
      .update({ status: "completed", error: "no_successful_interviews" })
      .eq("org_id", orgId)
      .eq("id", runId)
      .select("*")
      .single();
    return done ? buildState(supabase, orgId, done) : null;
  }

  const insights: SynthesisInsightInput[] = completed.map((s) => {
    const r = s.insight as unknown as SessionInsight;
    return {
      id: s.id,
      summary: typeof r.summary === "string" ? r.summary : null,
      featureRequests: Array.isArray(r.featureRequests) ? r.featureRequests : [],
      painPoints: Array.isArray(r.painPoints) ? r.painPoints : [],
      themes: Array.isArray(r.themes) ? r.themes : [],
      respondentRole: r.respondentRole ?? null,
      respondentSegment: r.respondentSegment ?? null,
      sentiment: r.sentiment ?? null,
    };
  });

  const synthesisPlan: SynthesisPlanContext = {
    title: plan.title,
    objective: plan.objective,
    persona: plan.persona,
    // Market lens (M2) — the test synthesis matches what the real study would
    // produce, just stored separately.
    studyType: plan.studyType,
  };

  const synthesisModel = process.env.SYNTHESIS_MODEL ?? undefined;

  try {
    // Pure synthesizer — NO DB, NO study_synthesis upsert.
    const synthesis = await synthesizeFromInputs({
      plan: synthesisPlan,
      insights,
    });
    const { data: done } = await supabase
      .from("synthetic_test_runs")
      .update({
        status: "completed",
        synthesis: synthesis as unknown as Json,
        synthesis_model: synthesisModel ?? null,
        error: null,
      })
      .eq("org_id", orgId)
      .eq("id", runId)
      .select("*")
      .single();
    return done ? buildState(supabase, orgId, done) : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "synthesis failed";
    console.error(`[synthetic-test] run ${runId} synthesis failed:`, message);
    // Sessions are still there + viewable; mark the run failed at the synthesis
    // stage (the transcripts remain the useful output of the dry-run).
    const { data: failed } = await supabase
      .from("synthetic_test_runs")
      .update({ status: "failed", error: `synthesis: ${message}` })
      .eq("org_id", orgId)
      .eq("id", runId)
      .select("*")
      .single();
    return failed ? buildState(supabase, orgId, failed) : null;
  }
}

// ── Public API: read latest + delete ─────────────────────────────────────────

/** The most recent run for a plan, for the page's initial render. */
export async function getLatestSyntheticTestRun(
  orgId: string,
  planId: string,
): Promise<SyntheticRunState | null> {
  const supabase = createSyntheticSupabase();
  const { data, error } = await supabase
    .from("synthetic_test_runs")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return buildState(supabase, orgId, data);
}

/** Delete a run (sessions cascade). Org+plan scoped. Returns true if a row was
 *  removed. Used for test-data cleanup from the UI. */
export async function deleteSyntheticTestRun(params: {
  orgId: string;
  planId: string;
  runId: string;
}): Promise<boolean> {
  const { orgId, planId, runId } = params;
  const supabase = createSyntheticSupabase();
  const { data, error } = await supabase
    .from("synthetic_test_runs")
    .delete()
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("id", runId)
    .select("id");
  if (error) {
    throw new Error(`Failed to delete synthetic_test_run: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}
