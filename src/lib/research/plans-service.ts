import "server-only";

import type { Json } from "@/types/database";
import type {
  ResearchPlanContext,
  ResearchTopic,
} from "@/lib/voice-agent/interviewer";
import {
  createResearchSupabase,
  type ResearchPlanRow,
  type ResearchPlanStudyType,
} from "./db";
import {
  ScreeningQuestionSchema,
  type ScreeningQuestion,
} from "@/lib/schemas/screening";

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
  /** Per-study Visual-Intelligence capture switch. Defaults false for legacy
   *  rows and pre-migration reads, so research interviews stay chat-only until
   *  a study explicitly enables capture. */
  visualCaptureEnabled: boolean;
  /** Per-study Voice switch. Defaults false for legacy rows and pre-migration
   *  reads, so audio transport stays opt-in per study. */
  voiceEnabled: boolean;
  screeningQuestions: ScreeningQuestion[];
  /** Studientyp-Diskriminator (Phase M0). Trägt 'product_discovery' für jeden
   *  Bestandsplan (DB-DEFAULT). In M0 liest KEIN Verhaltenspfad dieses Feld —
   *  es ist reines Typ-Fundament; die typ-bewusste Verzweigung (Markt-Prompt /
   *  Synthese-Persona / UI-Bereich) kommt in M1–M3. */
  studyType: ResearchPlanStudyType;
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

/**
 * Lenient read-mapper for screening_questions (jsonb). Mirrors coerceTopics:
 * never throws on a partial/legacy/hand-edited row. Reuses the canonical
 * per-question Zod schema as the single source of truth and drops any entry
 * that doesn't parse — a malformed question never crashes the editor or the
 * (Etappe-4) participant gate. The write path is Zod-validated in the route,
 * so app-written rows are always well-formed.
 */
function coerceScreeningQuestions(raw: unknown): ScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ScreeningQuestion[] = [];
  for (const entry of raw) {
    const parsed = ScreeningQuestionSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Defensive read-mapper for study_type. Mirrors coerceTopics /
 * coerceScreeningQuestions: never throws, always returns a valid member of the
 * union. Returns 'market_research' ONLY for that exact value; everything else
 * — including `undefined` (the runtime value before the 20260630000000
 * migration is applied, when select("*") doesn't return the column), `null`,
 * or a corrupt legacy value — falls back to 'product_discovery'. That fallback
 * is what makes every existing plan read byte-identically both before and after
 * the migration.
 */
// Exported as the SINGLE source of truth for this coercion: M2's synthesis
// engine (synthesis/engine.ts) reads study_type off its own plan query and
// reuses this exact mapping rather than duplicating the literal, so the
// pre-migration fail-safe (undefined → 'product_discovery') stays identical on
// every read path.
export function coerceStudyType(raw: unknown): ResearchPlanStudyType {
  return raw === "market_research" ? "market_research" : "product_discovery";
}

function coerceVisualCaptureEnabled(raw: unknown): boolean {
  return raw === true;
}

function coerceVoiceEnabled(raw: unknown): boolean {
  return raw === true;
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
    visualCaptureEnabled: coerceVisualCaptureEnabled(
      (row as { visual_capture_enabled?: unknown }).visual_capture_enabled,
    ),
    voiceEnabled: coerceVoiceEnabled(
      (row as { voice_enabled?: unknown }).voice_enabled,
    ),
    screeningQuestions: coerceScreeningQuestions(row.screening_questions),
    studyType: coerceStudyType(row.study_type),
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
 *
 * M3 — optional study_type filter for the two SEPARATE list surfaces on the
 * shared engine: the Product-Discovery research index passes
 * 'product_discovery', the Market-Research campaign index passes
 * 'market_research'. The parameter is OPTIONAL: omitting it returns every plan
 * (the pre-M3 behaviour), so any existing caller is byte-identical. The .eq is
 * only added when a type is given — a discovery list of pre-M3 plans (all
 * 'product_discovery' by DB DEFAULT) therefore returns the exact same rows it
 * did before M3.
 */
export async function listResearchPlans(
  orgId: string,
  studyType?: ResearchPlanStudyType,
): Promise<ResearchPlanRecord[]> {
  const supabase = createResearchSupabase();
  let query = supabase
    .from("research_plans")
    .select("*")
    .eq("org_id", orgId);
  if (studyType !== undefined) {
    query = query.eq("study_type", studyType);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toRecord);
}

/**
 * The set of plan_ids in an org whose study_type is 'market_research'.
 *
 * Powers the §6 KPI de-contamination in product-discovery's
 * getAllInsightsForOrg: a market-research study's Stage-1 findings live in the
 * SHARED product_discovery_insights table (M1 reuse decision, separation plan
 * §9 #1), tagged ONLY by their plan's study_type — so the Product-Discovery
 * overview must exclude those rows from its product KPIs. The discriminator
 * (plan_id → study_type) is one indexed research_plans read; the caller drops
 * insights whose plan_id is in this set.
 *
 * FAIL-OPEN: returns an EMPTY set on any error — including the pre-migration
 * state where the study_type column does not exist yet and the .eq filter
 * errors. An empty set excludes nothing, i.e. degrades to the exact M1
 * behaviour (market rows still folded in), never a crash. After the
 * 20260630000000 migration is applied this filters correctly. Same fail-safe
 * posture as coerceStudyType.
 */
export async function getMarketResearchPlanIds(
  orgId: string,
): Promise<Set<string>> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .select("id")
    .eq("org_id", orgId)
    .eq("study_type", "market_research");
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.id));
}

/**
 * Anzahl ABGESCHLOSSENER Interview-Sessions einer Studie — die Mess-Seite des
 * studienweiten Ziel-Pools (`sample_target`, separation plan §7, "47 von 200").
 *
 * Byte-genauer Klon von countOpenLinkSessions (open-links.ts:230-242), nur der
 * Prädikat-Satz unterscheidet sich: org+plan-scoped, status='completed'.
 * head:true → kein Zeilen-Transfer; trifft den vorhandenen
 * interview_sessions_plan_idx. number = exakter COUNT; null = Query-Fehler
 * (fail-open: der Aufrufer zeigt "—" statt zu crashen — kein Spend-Schutz hier,
 * nur Anzeige).
 *
 * ⚠️ DIE DREI ZAHLEN BLEIBEN BEWUSST GETRENNT (§7) — NICHT vereinheitlichen:
 *   1. sample_target  — studienweites Ziel, gemessen NUR an status='completed'
 *      (dieser Zähler). „Wie viele fertige Interviews von N?"
 *   2. listQuotaProgress (participant-pool.ts) — per-ROLLE Pool-EINLADUNGEN,
 *      zählt „invited" pro Rolle, NICHT abgeschlossene Interviews.
 *   3. max_sessions (open-links.ts, E5) — link-scoped, ALL-STATUS Spend-Cap,
 *      zählt JEDE Session (auch open/abandoned) gegen ein Kosten-Limit.
 * Würde man (1) auf den all-status-Nenner von (3) ziehen, bräche der Spend-
 * Schutz; würde man (1) mit (2) verschmelzen, zählte man Einladungen statt
 * Abschlüsse. Sie koexistieren mit Absicht.
 */
export async function countCompletedSessionsForPlan(
  orgId: string,
  planId: string,
): Promise<number | null> {
  const supabase = createResearchSupabase();
  const { count, error } = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("status", "completed");
  if (error) return null;
  return count ?? 0;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface CreateResearchPlanInput {
  title: string;
  objective: string;
  topics: ResearchTopic[];
  persona?: string | null;
  sampleTarget?: number | null;
  visualCaptureEnabled?: boolean;
  voiceEnabled?: boolean;
  /**
   * Studientyp-Diskriminator (M3 write-side). OPTIONAL — undefined leaves the
   * insert WITHOUT a study_type key, so the DB DEFAULT ('product_discovery')
   * applies and a discovery create is byte-identical to pre-M3. Only the
   * Market-Research create path passes 'market_research'. This is what makes
   * "study_type sets the create, everything else is shared": a single new
   * column on the create, nothing else branches.
   */
  studyType?: ResearchPlanStudyType;
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
      visual_capture_enabled: input.visualCaptureEnabled ?? false,
      voice_enabled: input.voiceEnabled ?? false,
      // Market-only insert key: when the caller is the Product-Discovery path
      // (studyType undefined / 'product_discovery'), the column is OMITTED so
      // the DB DEFAULT writes 'product_discovery' — a byte-identical discovery
      // row. Only a Market-Research create stamps the discriminator explicitly.
      ...(input.studyType === "market_research"
        ? { study_type: "market_research" as const }
        : {}),
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
  screeningQuestions?: ScreeningQuestion[];
  persona?: string | null;
  sampleTarget?: number | null;
  status?: ResearchPlanRecord["status"];
  visualCaptureEnabled?: boolean;
  voiceEnabled?: boolean;
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
    screening_questions?: Json;
    persona?: string | null;
    sample_target?: number | null;
    status?: ResearchPlanRecord["status"];
    visual_capture_enabled?: boolean;
    voice_enabled?: boolean;
  } = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.objective !== undefined) update.objective = input.objective;
  if (input.topics !== undefined)
    update.topic_script = input.topics as unknown as Json;
  if (input.screeningQuestions !== undefined)
    update.screening_questions = input.screeningQuestions as unknown as Json;
  if (input.persona !== undefined) update.persona = input.persona;
  if (input.sampleTarget !== undefined)
    update.sample_target = input.sampleTarget;
  if (input.status !== undefined) update.status = input.status;
  if (input.visualCaptureEnabled !== undefined)
    update.visual_capture_enabled = input.visualCaptureEnabled;
  if (input.voiceEnabled !== undefined) update.voice_enabled = input.voiceEnabled;

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
