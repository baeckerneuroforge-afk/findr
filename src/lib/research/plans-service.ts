import "server-only";

import type {
  ResearchPlanContext,
  ResearchTopic,
} from "@/lib/voice-agent/interviewer";
import { createResearchSupabase, type ResearchPlanRow } from "./db";

/**
 * Read-side helpers for the research layer. Mirrors the read pattern of
 * health-service / risk-service: typed admin client, always org-scoped, soft
 * shapes for the JSONB columns (topic_script is validated leniently — see
 * coerceTopics — so a partially-malformed row doesn't crash the agent).
 *
 * Write-side (createResearchPlan, addInvites …) lands when the plan-editor UI
 * is built. Today only the read path is needed to drive the agent.
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
