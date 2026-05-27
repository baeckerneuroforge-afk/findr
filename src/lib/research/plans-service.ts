import "server-only";

import type { Json } from "@/types/database";
import type {
  ResearchPlanContext,
  ResearchTopic,
} from "@/lib/voice-agent/interviewer";
import { createResearchSupabase, type ResearchPlanRow } from "./db";

/**
 * Read + write helpers for the research layer. Mirrors the pattern of
 * health-service / risk-service: typed admin client, always org-scoped, soft
 * shapes for the JSONB columns (topic_script is validated leniently — see
 * coerceTopics — so a partially-malformed row doesn't crash the agent).
 *
 * Write-side note: route handlers validate inputs with Zod BEFORE calling
 * the create/update functions here. The service trusts what it gets and
 * persists it; the only soft-coercion that happens client-side of DB is on
 * READ (coerceTopics).
 */

export interface ResearchPlanRecord {
  id: string;
  orgId: string | null;
  title: string;
  objective: string;
  topics: ResearchTopic[];
  persona: string | null;
  sampleTarget: number | null;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: string;
}

/**
 * Lenient mapper: topic_script is jsonb in DB and the column intentionally
 * has NO Zod schema in src/lib/schemas/ yet (the editor UI hasn't pinned the
 * exact shape). Defensive parse — drop entries that are missing the two
 * required strings; keep the rest. An empty topics array is valid (the
 * agent then runs purely off `objective`).
 */
function coerceTopics(raw: unknown): ResearchTopic[] {
  if (!Array.isArray(raw)) return [];
  const out: ResearchTopic[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const topic = typeof e.topic === "string" ? e.topic.trim() : "";
    const intent = typeof e.intent === "string" ? e.intent.trim() : "";
    if (!topic || !intent) continue;
    const hypothesesRaw = e.hypotheses;
    const hypotheses = Array.isArray(hypothesesRaw)
      ? hypothesesRaw
          .filter((h): h is string => typeof h === "string" && h.trim() !== "")
          .map((h) => h.trim())
      : undefined;
    out.push(
      hypotheses && hypotheses.length > 0
        ? { topic, intent, hypotheses }
        : { topic, intent },
    );
  }
  return out;
}

function toRecord(row: ResearchPlanRow): ResearchPlanRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    objective: row.objective,
    topics: coerceTopics(row.topic_script),
    persona: row.persona,
    sampleTarget: row.sample_target,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Fetch ONE plan, org-scoped. Returns null when the plan doesn't exist or
 * belongs to a different org. The orgId parameter is the trust boundary —
 * the route handler must have authenticated the user against this org
 * before calling.
 */
export async function getResearchPlan(
  orgId: string,
  planId: string,
): Promise<ResearchPlanRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

/**
 * View of a plan as the agent consumes it — strip DB-side fields, keep
 * exactly what RESEARCH_INTERVIEWER_SYSTEM_PROMPT + buildResearchPrompt need.
 * Pure derivation, no DB call.
 */
export function planToAgentContext(plan: ResearchPlanRecord): ResearchPlanContext {
  return {
    title: plan.title,
    objective: plan.objective,
    topics: plan.topics,
    persona: plan.persona,
  };
}

/**
 * All plans for an org, newest first. Powers /dashboard/research-plans.
 * Returns [] on any error — empty list reads as "no plans yet" in the UI,
 * which is correct in both the no-data and the transient-failure case;
 * the failure is logged at the supabase-js layer.
 */
export async function listResearchPlans(
  orgId: string,
): Promise<ResearchPlanRecord[]> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toRecord);
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface CreateResearchPlanInput {
  title: string;
  objective: string;
  topics: ResearchTopic[];
  persona?: string | null;
  sampleTarget?: number | null;
}

/**
 * Insert a new plan. Status defaults to 'draft' via the DB column default —
 * we deliberately do NOT pass it here so the lifecycle starts on the floor
 * (Activate / Complete / Archive happens via setResearchPlanStatus).
 *
 * Throws on insert failure (mirrors the existing risk/health write patterns).
 * The route handler wraps and translates to an HTTP response.
 */
export async function createResearchPlan(
  orgId: string,
  input: CreateResearchPlanInput,
): Promise<ResearchPlanRecord> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .insert({
      org_id: orgId,
      title: input.title,
      objective: input.objective,
      topic_script: input.topics as unknown as Json,
      persona: input.persona ?? null,
      sample_target: input.sampleTarget ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create research plan: ${error?.message ?? "no row returned"}`,
    );
  }
  return toRecord(data);
}

export interface UpdateResearchPlanInput {
  title?: string;
  objective?: string;
  topics?: ResearchTopic[];
  persona?: string | null;
  sampleTarget?: number | null;
  status?: ResearchPlanRecord["status"];
}

/**
 * Partial update. Only the keys actually present in `input` are written —
 * an empty input degrades to a re-read of the current row, which is the
 * sensible no-op (the UI sometimes posts an unchanged form on Save).
 *
 * Returns null when the plan doesn't exist or belongs to another org.
 * Throws ONLY on transport / DB-error after the row was found — the
 * caller distinguishes between "not found" (null) and "could not save"
 * (thrown error).
 */
export async function updateResearchPlan(
  orgId: string,
  planId: string,
  input: UpdateResearchPlanInput,
): Promise<ResearchPlanRecord | null> {
  // Build a sparse update so we don't accidentally null-out columns the
  // caller didn't mean to touch. supabase-js's Update type allows any
  // subset.
  const update: {
    title?: string;
    objective?: string;
    topic_script?: Json;
    persona?: string | null;
    sample_target?: number | null;
    status?: ResearchPlanRecord["status"];
  } = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.objective !== undefined) update.objective = input.objective;
  if (input.topics !== undefined)
    update.topic_script = input.topics as unknown as Json;
  if (input.persona !== undefined) update.persona = input.persona;
  if (input.sampleTarget !== undefined)
    update.sample_target = input.sampleTarget;
  if (input.status !== undefined) update.status = input.status;

  if (Object.keys(update).length === 0) {
    return getResearchPlan(orgId, planId);
  }

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", planId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return toRecord(data);
}

/**
 * Status-only update — convenience wrapper around updateResearchPlan for
 * lifecycle buttons (Activate / Mark complete / Archive). Keeps the
 * status-transition policy out of the DB (the column CHECK is just an
 * enum); the UI restricts which transitions are offered.
 */
export async function setResearchPlanStatus(
  orgId: string,
  planId: string,
  status: ResearchPlanRecord["status"],
): Promise<ResearchPlanRecord | null> {
  return updateResearchPlan(orgId, planId, { status });
}
