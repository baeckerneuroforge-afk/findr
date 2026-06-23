import "server-only";

import type { Json } from "@/types/database";
import type {
  InterviewTurn,
  ResearchPlanContext,
  ResearchStimulusContext,
  ResearchTopic,
} from "@/lib/voice-agent/interviewer";
import {
  createResearchSupabase,
  type ResearchPlanAudience,
  type ResearchPlanRow,
  type ResearchPlanStimulusRow,
  type ResearchPlanStudyType,
  type ResearchPlanUseCase,
} from "./db";
import {
  resolveEffectiveMaxRounds,
  type InterviewDepth,
} from "./interview-duration";
import {
  ScreeningQuestionSchema,
  type ScreeningQuestion,
} from "@/lib/schemas/screening";
import {
  coerceStimulusAnalysis,
  coerceStimulusAnalysisStatus,
  type StimulusAnalysisPayload,
  type StimulusAnalysisStatus,
} from "./stimulus-analysis";
import {
  coerceTurnSignalsRecord,
  type TurnSignalsRecord,
} from "@/lib/schemas/turn-signals";

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
  /** Per-study event-tracking switch (Phase 2b). Defaults false for legacy rows
   *  and pre-migration reads, so usability event capture stays opt-in per study. */
  eventTrackingEnabled: boolean;
  /** Per-study Voice switch. Defaults false for legacy rows and pre-migration
   *  reads, so audio transport stays opt-in per study. */
  voiceEnabled: boolean;
  /** Per-study TTS switch. Defaults false for legacy rows and pre-migration
   *  reads, so generated audio playback stays opt-in per study. */
  ttsEnabled: boolean;
  /** E1 Turn-Signale: per-study Opt-in für die nachgelagerte Affekt-/
   *  Direktheits-Analyse (Sidecar am Session-Ende). Defaults false for legacy
   *  rows and pre-migration reads — ohne explizites Opt-in läuft der Sidecar
   *  nie (Plan §3.2: default OFF, kein Backfill). */
  signalsEnabled: boolean;
  /** Lightweight Market-Research use-case. Null means no use-case focus block
   *  and therefore unchanged interviewer behavior. */
  useCase: ResearchPlanUseCase | null;
  /** B2C/B2B audience type. Drives the interview Anrede (b2c → "du", b2b →
   *  "Sie") and the guide-generator example framing. Defaults 'b2b' for legacy
   *  rows + pre-migration reads, so existing studies stay formal "Sie". */
  audienceType: ResearchPlanAudience;
  /** Optional single stimulus metadata. The interviewer consumes the text
   *  description plus a safe type label; the URL stays presentation-only. */
  stimulusUrl: string | null;
  stimulusType: string | null;
  stimulusDescription: string | null;
  /** Einmalige Vision-Analyse des Bild-Stimulus (20260703000007). Null für
   *  jede Bestandszeile, jeden Link-Stimulus und jede fehlgeschlagene/laufende
   *  Analyse — der Agent-Kontext liest sie NUR bei status 'done'. */
  stimulusAnalysis: StimulusAnalysisPayload | null;
  stimulusAnalysisStatus: StimulusAnalysisStatus | null;
  screeningQuestions: ScreeningQuestion[];
  /** Studientyp-Diskriminator (Phase M0). Trägt 'product_discovery' für jeden
   *  Bestandsplan (DB-DEFAULT). In M0 liest KEIN Verhaltenspfad dieses Feld —
   *  es ist reines Typ-Fundament; die typ-bewusste Verzweigung (Markt-Prompt /
   *  Synthese-Persona / UI-Bereich) kommt in M1–M3. */
  studyType: ResearchPlanStudyType;
  /** F2 — interview language for this study (de/en). Inherited by its invites,
   *  open-links and sessions. */
  language: "de" | "en";
  /** Per-study interview length — agent-question UPPER BOUND. Null = system
   *  default (6 for non-stimulus research; stimulus-SET studies keep
   *  stimulusSetCeiling regardless). The saturation engine may still close
   *  earlier — this is a ceiling, never a forced count. */
  maxRounds: number | null;
  /** Per-study interview time limit in seconds. Null = no limit. Voice enforces
   *  it hard (agent timer → closing line → disconnect); text enforces it softly
   *  (visible countdown, close on next answer once elapsed). Applies to ALL
   *  studies, including stimulus-set ones. */
  maxDurationSeconds: number | null;
  /** Per-study interview DEPTH — laddering layers per topic (the real depth
   *  lever; see interview-duration.ts DEPTH_LAYERS). Null = legacy study
   *  (pre-feature) → the engine uses the flat default ceiling, byte-identical.
   *  New studies carry 'mittel' by default. The effective agent-question ceiling
   *  is derived per study from depth × topics at the snapshot boundary
   *  (resolveEffectiveMaxRounds); an explicit maxRounds still wins. */
  interviewDepth: InterviewDepth | null;
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

// F2 — per-study interview language. Pre-migration fail-safe: undefined → 'de'
// (every existing study is German), mirroring coerceStudyType.
export function coerceLanguage(raw: unknown): "de" | "en" {
  return raw === "en" ? "en" : "de";
}

export function coerceUseCase(raw: unknown): ResearchPlanUseCase | null {
  if (
    raw === "general_survey" ||
    raw === "brand_research" ||
    raw === "creative_test" ||
    raw === "concept_test"
  ) {
    return raw;
  }
  return null;
}

// B2C/B2B audience. Pre-migration fail-safe: only 'b2c' flips to consumer;
// everything else (incl. undefined before the migration lands) → 'b2b', so
// existing studies stay formal "Sie", mirroring coerceLanguage/coerceStudyType.
export function coerceAudience(raw: unknown): ResearchPlanAudience {
  return raw === "b2c" ? "b2c" : "b2b";
}

function coerceVisualCaptureEnabled(raw: unknown): boolean {
  return raw === true;
}

function coerceEventTrackingEnabled(raw: unknown): boolean {
  return raw === true;
}

function coerceVoiceEnabled(raw: unknown): boolean {
  return raw === true;
}

function coerceTtsEnabled(raw: unknown): boolean {
  return raw === true;
}

function coerceSignalsEnabled(raw: unknown): boolean {
  return raw === true;
}

function coerceNullableString(raw: unknown): string | null {
  return typeof raw === "string" ? raw : null;
}

// Per-study interview length. Pre-migration fail-safe: undefined (select("*")
// omits the column) / null / non-numeric → null → system-default length,
// byte-identical. Truncates to an integer; the route's Zod enforces the 2..15
// bound on write, so a read just needs to be defensive, not validating.
function coerceNullableInt(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.trunc(raw)
    : null;
}

// Per-study interview DEPTH. Pre-migration / legacy fail-safe: undefined
// (select("*") omits the column) / null / any non-member → null → legacy
// default-length behavior, byte-identical. The route's Zod enforces the enum on
// write, so a read just needs to be defensive.
function coerceDepth(raw: unknown): InterviewDepth | null {
  return raw === "flach" || raw === "mittel" || raw === "tief" ? raw : null;
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
    eventTrackingEnabled: coerceEventTrackingEnabled(
      (row as { event_tracking_enabled?: unknown }).event_tracking_enabled,
    ),
    voiceEnabled: coerceVoiceEnabled(
      (row as { voice_enabled?: unknown }).voice_enabled,
    ),
    ttsEnabled: coerceTtsEnabled(
      (row as { tts_enabled?: unknown }).tts_enabled,
    ),
    signalsEnabled: coerceSignalsEnabled(
      (row as { signals_enabled?: unknown }).signals_enabled,
    ),
    useCase: coerceUseCase((row as { use_case?: unknown }).use_case),
    audienceType: coerceAudience(
      (row as { audience_type?: unknown }).audience_type,
    ),
    stimulusUrl: coerceNullableString(
      (row as { stimulus_url?: unknown }).stimulus_url,
    ),
    stimulusType: coerceNullableString(
      (row as { stimulus_type?: unknown }).stimulus_type,
    ),
    stimulusDescription: coerceNullableString(
      (row as { stimulus_description?: unknown }).stimulus_description,
    ),
    stimulusAnalysis: coerceStimulusAnalysis(
      (row as { stimulus_analysis?: unknown }).stimulus_analysis,
    ),
    stimulusAnalysisStatus: coerceStimulusAnalysisStatus(
      (row as { stimulus_analysis_status?: unknown }).stimulus_analysis_status,
    ),
    screeningQuestions: coerceScreeningQuestions(row.screening_questions),
    studyType: coerceStudyType(row.study_type),
    language: coerceLanguage((row as { language?: unknown }).language),
    maxRounds: coerceNullableInt((row as { max_rounds?: unknown }).max_rounds),
    maxDurationSeconds: coerceNullableInt(
      (row as { max_duration_seconds?: unknown }).max_duration_seconds,
    ),
    interviewDepth: coerceDepth(
      (row as { interview_depth?: unknown }).interview_depth,
    ),
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
export function planToAgentContext(
  plan: ResearchPlanRecord,
  // Multi-Stimulus E1 — OPTIONAL: das Stimulus-Set des Plans
  // (listPlanStimuli). Weggelassen/leer → Rückgabe byte-identisch zu vorher;
  // jeder Bestands-Aufrufer bleibt dadurch unverändert. Die Set-Verdrahtung
  // der Aufrufer (Session-Create, Voice-Kontext) kommt in E4/E6.
  stimuli?: ResearchPlanStimulusRecord[],
): ResearchPlanContext {
  const isStimulusSet =
    plan.studyType === "market_research" && !!stimuli && stimuli.length > 0;
  // Tiefe + effektive Runden-Obergrenze — NUR für Studien OHNE Stimulus-Set
  // (Sets behalten ihre inhaltsgetriebene stimulusSetCeiling). Die effektive
  // maxRounds wird themenbewusst aus Tiefe×Themen abgeleitet (oder ein
  // expliziter Experten-maxRounds gewinnt) und speist UNVERÄNDERT die gesamte
  // bestehende Zahlen-Pipeline (formatRoundCeiling, researchTotalCap, Fortschritt,
  // Dauer). `depth` wandert separat mit, damit der Prompt die Laddering-Schichten-
  // Direktive emittieren kann. Legacy (beide null) → beide Keys weggelassen →
  // Snapshot + Prompt byte-identisch zu heute.
  const lengthKeys: { maxRounds?: number; depth?: InterviewDepth } = {};
  if (!isStimulusSet && (plan.maxRounds != null || plan.interviewDepth != null)) {
    lengthKeys.maxRounds = resolveEffectiveMaxRounds({
      maxRounds: plan.maxRounds,
      depth: plan.interviewDepth,
      topicCount: plan.topics.length,
    });
    if (plan.interviewDepth != null) lengthKeys.depth = plan.interviewDepth;
  }
  return {
    title: plan.title,
    objective: plan.objective,
    topics: plan.topics,
    persona: plan.persona,
    ...(plan.studyType === "market_research" && plan.useCase
      ? { useCase: plan.useCase }
      : {}),
    // Anrede-Signal — NUR bei 'b2c' im Kontext (der nicht-Default). 'b2b'/legacy
    // lässt den Key weg → buildResearchContext byte-identisch zu heute (formelles
    // "Sie"), und der deal_context-Snapshot bestehender Studien bleibt unberührt.
    ...(plan.audienceType === "b2c" ? { audienceType: "b2c" as const } : {}),
    ...(plan.studyType === "market_research"
      ? {
          stimulusUrl: plan.stimulusUrl,
          stimulusType: plan.stimulusType,
          stimulusDescription: plan.stimulusDescription,
          // Nur der fertige, längenbegrenzte textBlock — NICHT das Roh-
          // Envelope — wandert in den Agent-Kontext (und damit in den
          // deal_context-Snapshot). Gelesen NUR bei status 'done'; pending/
          // failed/legacy → null → Prompt byte-identisch zu heute.
          stimulusAnalysis:
            plan.stimulusAnalysisStatus === "done"
              ? (plan.stimulusAnalysis?.textBlock ?? null)
              : null,
        }
      : {}),
    // Der stimuli-Key erscheint NUR, wenn der Aufrufer ein nicht-leeres Set
    // mitgibt — Bestands-Snapshots (deal_context) bleiben byte-identisch.
    ...(plan.studyType === "market_research" && stimuli && stimuli.length > 0
      ? { stimuli: sortStimuli(stimuli).map(stimulusToContext) }
      : {}),
    // Tiefe + effektive Runden-Obergrenze (oben berechnet) — beide nur ohne
    // Stimulus-Set; Set-Studien behalten ihre inhaltsgetriebene
    // stimulusSetCeiling. Legacy (depth+maxRounds null) → leer → byte-identisch.
    ...lengthKeys,
    // Zeitlimit — wandert IMMER in den Snapshot, wenn gesetzt (anders als
    // maxRounds): das Zeit-Cap gilt für ALLE Studien, auch Stimulus-Set. Fehlt
    // der Schlüssel → kein Limit (byte-identisch). Die Engine (Text-weich) und
    // der Voice-Agent (hart) lesen ihn aus dem deal_context.
    ...(plan.maxDurationSeconds != null
      ? { maxDurationSeconds: plan.maxDurationSeconds }
      : {}),
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

/**
 * ALL-Status-Zähler für die Mid-Study-Flip-Warnung (PATCH voiceEnabled):
 * zählt JEDE Session des Plans (auch open/abandoned). Bewusst ein VIERTER
 * Zähler neben dem §7-Trio oben — er beantwortet eine andere Frage („gab es
 * überhaupt schon Teilnehmer-Kontakt?"), nicht Fortschritt, nicht Quota,
 * nicht Spend. Fail-open null bei Lesefehler (der Aufrufer lässt die
 * Warnung dann weg statt falsch zu warnen).
 */
export async function countSessionsForPlan(
  orgId: string,
  planId: string,
): Promise<number | null> {
  const supabase = createResearchSupabase();
  const { count, error } = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (error) return null;
  return count ?? 0;
}

/**
 * Batched flavor of the §7 counter for LIST pages: ONE query for all plans
 * instead of N parallel head-COUNTs (Perf-Audit 4.1 / MR-Übersicht). Same
 * predicate set as countCompletedSessionsForPlan — the §7 separation note
 * above applies unchanged. Only the plan_id column travels; grouping happens
 * in JS (PostgREST aggregates are disabled on Supabase by default, so a
 * GROUP BY can't run API-side without an RPC; one uuid per completed session
 * stays tiny at today's volumes). Every requested plan id is present in the
 * map (0 when none). Fail-open: a read error returns null — the caller shows
 * the unknown marker for every plan, mirroring the single counter's null.
 */
export async function countCompletedSessionsForPlans(
  orgId: string,
  planIds: string[],
): Promise<Map<string, number> | null> {
  if (planIds.length === 0) return new Map();
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("plan_id")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .in("plan_id", planIds);
  if (error || !data) return null;
  const counts = new Map<string, number>(planIds.map((id) => [id, 0]));
  for (const row of data) {
    if (row.plan_id === null) continue;
    counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * „Seit gestern“-Variante des §7-Batch-Zählers (Konsole-v5, Heute-Digest):
 * identisches Prädikat-Set wie countCompletedSessionsForPlans, zusätzlich
 * auf ein rollierendes 24-h-Fenster über completed_at eingegrenzt. Bewusst
 * rollierend statt Kalender-Mitternacht: der Server kennt die Zeitzone des
 * Nutzers nicht, und ein gleitendes Fenster lügt nie um Mitternacht herum.
 * Fail-open: null bei Lesefehler — der Aufrufer lässt die Angabe dann weg
 * (kein „0“, das fälschlich Stillstand behauptet).
 */
export async function countRecentCompletedSessionsForPlans(
  orgId: string,
  planIds: string[],
  windowHours = 24,
): Promise<Map<string, number> | null> {
  if (planIds.length === 0) return new Map();
  const cutoff = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("plan_id")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("completed_at", cutoff)
    .in("plan_id", planIds);
  if (error || !data) return null;
  const counts = new Map<string, number>(planIds.map((id) => [id, 0]));
  for (const row of data) {
    if (row.plan_id === null) continue;
    counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + 1);
  }
  return counts;
}

// ── Session-Sichtbarkeit (Voice Phase 2 E2) ────────────────────────────────

export type PlanSessionStatus = "open" | "completed" | "abandoned";
export type PlanSessionMode = "text" | "voice" | "video";

/** Listen-Zeile der Interviews-Sektion — bewusst OHNE conversation-Payload
 *  über die Service-Grenze: nur die abgeleiteten Anzeigefelder reisen. */
export interface PlanSessionSummary {
  id: string;
  status: PlanSessionStatus;
  mode: PlanSessionMode;
  turnCount: number;
  /** Erster customer-Turn, gekürzt — null, solange der Teilnehmer noch
   *  nichts gesagt hat (z. B. frisch geöffnete Session). */
  preview: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Einzelansicht für die Transkript-Seite — volle conversation. */
export interface PlanSessionTranscript {
  id: string;
  status: PlanSessionStatus;
  mode: PlanSessionMode;
  conversation: InterviewTurn[];
  createdAt: string;
  completedAt: string | null;
  /** E2 Turn-Signale — das gehärtete Sidecar-Ergebnis (E1) für die
   *  Forscher-Ansicht. Null = nie analysiert (Toggle aus, kein Consent,
   *  Bestand, fremde Version) → Chips/Signal-Block rendern nicht, die
   *  Ansicht bleibt byte-identisch. NIE in Teilnehmer-Views durchreichen. */
  turnSignals: TurnSignalsRecord | null;
}

/** Server-seitiges Cap der Interviews-Liste (keine Pagination, E2-Scope).
 *  Wird als p_limit an die RPC list_sessions_for_plan durchgereicht. */
const SESSION_LIST_LIMIT = 50;

/**
 * Lenient read-mapper für conversation (jsonb) — Stil von coerceTopics:
 * niemals werfen, Einträge ohne die zwei Pflichtfelder fallen weg. Die
 * Schreibseite (advanceInterview / Voice-Bridge) ist wohlgeformt; das hier
 * schützt nur Lese-Ansichten vor Legacy-/Hand-editierten Zeilen.
 *
 * E3: das optionale `why` (Frage-Rationale, nur auf Agent-Turns geschrieben)
 * reist in FORSCHER-Ansichten mit — dies ist ein Forscher-Lesepfad; die
 * Teilnehmer-Seite strippt das Feld in toPublicView. Exported for unit tests.
 */
export function coerceConversation(raw: unknown): InterviewTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: InterviewTurn[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (e.role !== "agent" && e.role !== "customer") continue;
    if (typeof e.text !== "string") continue;
    const why =
      e.role === "agent" && typeof e.why === "string" && e.why.trim() !== ""
        ? e.why
        : undefined;
    // E4 — Reveal-Marker (Multi-Stimulus): kleine positive Ganzzahl, nur auf
    // Agent-Turns. Speist Transkript-Marker (E7) und Forscher-Ansichten.
    const shown =
      e.role === "agent" &&
      typeof e.shownStimulusPosition === "number" &&
      Number.isInteger(e.shownStimulusPosition) &&
      e.shownStimulusPosition >= 1
        ? e.shownStimulusPosition
        : undefined;
    out.push({
      role: e.role,
      text: e.text,
      ...(why !== undefined ? { why } : {}),
      ...(shown !== undefined ? { shownStimulusPosition: shown } : {}),
    });
  }
  return out;
}

/**
 * Alle Interview-Sessions EINER Studie für die Forscher-Ansicht — org+plan-
 * scoped (dieselbe Trust-Boundary wie getResearchPlan: der Aufrufer hat die
 * orgId bereits via requireOrgId authentifiziert), neueste zuerst, hartes
 * LIMIT 50. ALLE Status (open/completed/abandoned) — anders als der §7-Zähler
 * countCompletedSessionsForPlan, der NUR Abschlüsse misst; hier geht es um
 * Sichtbarkeit, nicht um Fortschritt. Fail-open [] wie listResearchPlans
 * (leere Liste liest sich als "noch keine Interviews").
 *
 * Perf: turnCount + die 140-Zeichen-Vorschau berechnet die RPC
 * list_sessions_for_plan server-seitig (Migration 20260715000000), damit NICHT
 * mehr das volle conversation-JSONB jeder Session geladen wird — die MR-
 * Übersicht refresht alle 30s, das war reiner Über-Fetch. Die RPC ist semantisch
 * äquivalent zur früheren JS-Logik (coerceConversation-Zählung + erster nicht-
 * leerer customer-Turn, getrimmt, >140 Zeichen gekürzt + "…"); empirisch über
 * alle Echtdaten-Sessions 0 Abweichungen. Einzige bewusste Differenz: die
 * Trunkierung zählt Codepoints statt UTF-16-Einheiten — bei Emoji in den ersten
 * 140 Zeichen schneidet sie sauberer (kein zerschnittenes Surrogat), nie
 * schlechter (Details in der Migration).
 */
export async function listSessionsForPlan(
  orgId: string,
  planId: string,
): Promise<PlanSessionSummary[]> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase.rpc("list_sessions_for_plan", {
    p_org_id: orgId,
    p_plan_id: planId,
    p_limit: SESSION_LIST_LIMIT,
  });
  if (error || !data) {
    if (error) {
      console.error("[listSessionsForPlan] rpc failed:", error.message);
    }
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    status: row.status as PlanSessionStatus,
    mode: row.mode as PlanSessionMode,
    turnCount: row.turn_count,
    preview: row.preview,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

/**
 * EINE Session inkl. vollem conversation-Array für die Transkript-Seite.
 * org+plan+id-scoped: die plan_id-Bindung wird hier serverseitig erzwungen,
 * damit eine fremde sessionId unter fremder Plan-URL nie auflöst (URL-
 * Manipulation → null → notFound() beim Aufrufer). Null auch bei Query-
 * Fehler — wie getResearchPlan.
 */
export async function getSessionWithTranscript(
  orgId: string,
  planId: string,
  sessionId: string,
): Promise<PlanSessionTranscript | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(
      "id, status, mode, conversation, created_at, completed_at, turn_signals",
    )
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    status: data.status,
    mode: data.mode,
    conversation: coerceConversation(data.conversation),
    createdAt: data.created_at,
    completedAt: data.completed_at,
    // E2: lenient (coerceTurnSignalsRecord glättet Bestand/fremde Versionen/
    // Müll zu null). Die Spalte existiert seit Migration 20260704000002 —
    // in Prod angewandt+verifiziert, daher darf sie im Narrow-Select stehen.
    turnSignals: coerceTurnSignalsRecord(
      (data as { turn_signals?: unknown }).turn_signals,
    ),
  };
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface CreateResearchPlanInput {
  title: string;
  objective: string;
  topics: ResearchTopic[];
  persona?: string | null;
  sampleTarget?: number | null;
  visualCaptureEnabled?: boolean;
  /** Per-study event-tracking opt-in (Phase 2b). Omitted/false → no capture. */
  eventTrackingEnabled?: boolean;
  voiceEnabled?: boolean;
  ttsEnabled?: boolean;
  signalsEnabled?: boolean;
  useCase?: ResearchPlanUseCase | null;
  /** B2C/B2B audience. Only 'b2c' is stamped explicitly; undefined/'b2b' falls
   *  to the DB DEFAULT 'b2b' so a Discovery create stays byte-identical. */
  audienceType?: ResearchPlanAudience;
  stimulusUrl?: string | null;
  stimulusType?: string | null;
  stimulusDescription?: string | null;
  /**
   * Studientyp-Diskriminator (M3 write-side). OPTIONAL — undefined leaves the
   * insert WITHOUT a study_type key, so the DB DEFAULT ('product_discovery')
   * applies and a discovery create is byte-identical to pre-M3. Only the
   * Market-Research create path passes 'market_research'. This is what makes
   * "study_type sets the create, everything else is shared": a single new
   * column on the create, nothing else branches.
   */
  studyType?: ResearchPlanStudyType;
  language?: "de" | "en";
  /** Per-study agent-question ceiling. Omitted/null → DB stays NULL → system
   *  default length (byte-identical create). */
  maxRounds?: number | null;
  /** Per-study time limit in seconds. Omitted/null → DB stays NULL → no limit. */
  maxDurationSeconds?: number | null;
  /** Per-study interview depth. Omitted/null → DB stays NULL → legacy default
   *  length (byte-identical create). New studies stamp 'mittel'. */
  interviewDepth?: InterviewDepth | null;
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
      event_tracking_enabled: input.eventTrackingEnabled ?? false,
      voice_enabled: input.voiceEnabled ?? false,
      tts_enabled: input.ttsEnabled ?? false,
      signals_enabled: input.signalsEnabled ?? false,
      use_case: input.useCase ?? null,
      // Only stamp 'b2c' explicitly; 'b2b'/undefined is OMITTED so the DB
      // DEFAULT writes 'b2b' (pre-migration-safe; Discovery create byte-
      // identical), mirroring the language/study_type insert discipline.
      ...(input.audienceType === "b2c" ? { audience_type: "b2c" as const } : {}),
      stimulus_url: input.stimulusUrl ?? null,
      stimulus_type: input.stimulusType ?? null,
      stimulus_description: input.stimulusDescription ?? null,
      // Market-only insert key: when the caller is the Product-Discovery path
      // (studyType undefined / 'product_discovery'), the column is OMITTED so
      // the DB DEFAULT writes 'product_discovery' — a byte-identical discovery
      // row. Only a Market-Research create stamps the discriminator explicitly.
      ...(input.studyType === "market_research"
        ? { study_type: "market_research" as const }
        : {}),
      // F2 — only stamp 'en' explicitly; 'de' is omitted so the DB DEFAULT
      // writes it (pre-migration-safe for the common German create).
      ...(input.language === "en" ? { language: "en" as const } : {}),
      // Interviewlänge — nur stempeln, wenn eine Länge gewählt wurde; sonst
      // weggelassen → Spalte bleibt NULL → System-Default. Spread (statt
      // direktem Key) hält den Insert pre-migration-sicher: ohne angewandte
      // Migration enthält der Insert den Schlüssel gar nicht erst.
      ...(input.maxRounds != null ? { max_rounds: input.maxRounds } : {}),
      ...(input.maxDurationSeconds != null
        ? { max_duration_seconds: input.maxDurationSeconds }
        : {}),
      // Tiefe — nur stempeln, wenn gesetzt; sonst weggelassen → Spalte bleibt
      // NULL → Legacy-Default (pre-migration-sicher via Spread).
      ...(input.interviewDepth != null
        ? { interview_depth: input.interviewDepth }
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
  /** Per-study event-tracking opt-in (Phase 2b). undefined leaves it untouched. */
  eventTrackingEnabled?: boolean;
  voiceEnabled?: boolean;
  ttsEnabled?: boolean;
  signalsEnabled?: boolean;
  useCase?: ResearchPlanUseCase | null;
  audienceType?: ResearchPlanAudience;
  stimulusUrl?: string | null;
  stimulusType?: string | null;
  stimulusDescription?: string | null;
  /** Vision-Analyse — geschrieben NUR von der Stimulus-Route (Trigger +
   *  Invalidierung). Kein anderer Pfad fasst diese Felder an. */
  stimulusAnalysis?: StimulusAnalysisPayload | null;
  stimulusAnalysisStatus?: StimulusAnalysisStatus | null;
  language?: "de" | "en";
  /** Per-study agent-question ceiling. `null` clears it back to the system
   *  default; a number sets the ceiling. `undefined` leaves it untouched. */
  maxRounds?: number | null;
  /** Per-study time limit in seconds. `null` clears it (no limit); a number
   *  sets it. `undefined` leaves it untouched. */
  maxDurationSeconds?: number | null;
  /** Per-study interview depth. `null` clears it (legacy default); a member sets
   *  it. `undefined` leaves it untouched. */
  interviewDepth?: InterviewDepth | null;
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
    event_tracking_enabled?: boolean;
    voice_enabled?: boolean;
    tts_enabled?: boolean;
    signals_enabled?: boolean;
    use_case?: ResearchPlanUseCase | null;
    audience_type?: ResearchPlanAudience;
    stimulus_url?: string | null;
    stimulus_type?: string | null;
    stimulus_description?: string | null;
    stimulus_analysis?: Json | null;
    stimulus_analysis_status?: string | null;
    language?: "de" | "en";
    max_rounds?: number | null;
    max_duration_seconds?: number | null;
    interview_depth?: InterviewDepth | null;
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
  if (input.eventTrackingEnabled !== undefined)
    update.event_tracking_enabled = input.eventTrackingEnabled;
  if (input.voiceEnabled !== undefined) update.voice_enabled = input.voiceEnabled;
  if (input.ttsEnabled !== undefined) update.tts_enabled = input.ttsEnabled;
  if (input.signalsEnabled !== undefined)
    update.signals_enabled = input.signalsEnabled;
  if (input.useCase !== undefined) update.use_case = input.useCase;
  if (input.audienceType !== undefined)
    update.audience_type = input.audienceType;
  if (input.stimulusUrl !== undefined) update.stimulus_url = input.stimulusUrl;
  if (input.stimulusType !== undefined) update.stimulus_type = input.stimulusType;
  if (input.stimulusDescription !== undefined)
    update.stimulus_description = input.stimulusDescription;
  if (input.stimulusAnalysis !== undefined)
    update.stimulus_analysis = input.stimulusAnalysis as unknown as Json;
  if (input.stimulusAnalysisStatus !== undefined)
    update.stimulus_analysis_status = input.stimulusAnalysisStatus;
  if (input.language !== undefined) update.language = input.language;
  if (input.maxRounds !== undefined) update.max_rounds = input.maxRounds;
  if (input.maxDurationSeconds !== undefined)
    update.max_duration_seconds = input.maxDurationSeconds;
  if (input.interviewDepth !== undefined)
    update.interview_depth = input.interviewDepth;

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

/**
 * Hard-delete a research plan and every child row the DB cascades: invites,
 * pool-invites, quotas, screening, open links, stimulus rows, synthesis +
 * shares, panel + synthetic-test data. Personas live in a JSONB column on the
 * plan row itself, so they go with it.
 *
 * interview_sessions carry `plan_id … ON DELETE SET NULL` by design — a plan
 * delete alone would NOT remove them, leaving orphaned rows that still hold
 * the conversation transcript + visual_capture (participant PII). A FULL study
 * delete must take its interviews with it, so we explicitly wipe
 * interview_sessions for the plan FIRST. Nothing references interview_sessions
 * (verified: no inbound FKs), so this is a clean leaf delete. If it fails we
 * abort BEFORE touching the plan row — never produce an orphan.
 *
 * The two deletes are not wrapped in a single transaction (PostgREST), so one
 * partial state is reachable: session wipe succeeds, then the plan delete
 * fails (transport/transient). That is the SAFE direction — the interviews the
 * user asked to delete are gone, no PII is stranded, and a retry deletes the
 * now-session-less plan cleanly (the route re-reads the count as 0). The unsafe
 * direction (plan gone, sessions stranded) cannot occur because of the order.
 *
 * The two OTHER SET-NULL referrers keep their designed behavior on purpose:
 * bridge_suggestions.approved_plan_id (a suggestion pointer) and
 * product_discovery_insights.plan_id (CRM-call-derived insights tied to a
 * `call`, not to this study's interviews) are NOT this study's data — their
 * pointer is nulled, the rows survive.
 *
 * The WHEN of deletion is the route's job (DELETE policy gate: no sessions, or
 * the study has been archived/closed first). This function is the mechanism and
 * always performs the complete removal.
 *
 * Returns the stimulus storage paths attached to the (now deleted) plan so the
 * caller can best-effort purge the bucket objects — the DB cascade removes the
 * rows, never the uploaded files. `deleted` is false when no row matched the
 * org-scoped predicate (not found / other org → maps to 404 at the route), or
 * when the interview-session wipe failed (→ 500 at the route).
 */
export async function deleteResearchPlan(
  orgId: string,
  planId: string,
): Promise<{ deleted: boolean; storagePaths: string[] }> {
  const supabase = createResearchSupabase();

  // Collect stimulus storage paths BEFORE the delete — afterwards the rows are
  // gone via ON DELETE CASCADE. The bucket cleanup itself runs in the route
  // (it owns the storage client + BUCKET name), mirroring removePlanStimulus.
  const stimuli = await listPlanStimuli(orgId, planId);
  const storagePaths = stimuli
    .map((s) => s.storagePath)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  // Take the interviews with the study. ON DELETE SET NULL would otherwise
  // strand these rows (transcript + visual_capture = PII). Abort on error so
  // a failed wipe never leaves the plan deleted with orphaned sessions.
  const { error: sessionsError } = await supabase
    .from("interview_sessions")
    .delete()
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (sessionsError) {
    console.error(
      "[deleteResearchPlan] interview_sessions wipe failed:",
      sessionsError.message,
    );
    return { deleted: false, storagePaths: [] };
  }

  const { data, error } = await supabase
    .from("research_plans")
    .delete()
    .eq("org_id", orgId)
    .eq("id", planId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { deleted: false, storagePaths: [] };
  return { deleted: true, storagePaths };
}

// ── Multi-Stimulus-Set (E1, docs/findr-multi-stimulus-plan.md) ───────────────
//
// Bis zu MAX_PLAN_STIMULI Assets pro Studie in fester Forscher-Reihenfolge
// (research_plan_stimuli, Migration 20260714000000). Dual-Read-Vertrag:
// Tabellen-Zeilen gewinnen; ohne Zeilen synthetisiert resolveStimulusSet den
// Legacy-Single-Slot der Plan-Spalten als 1-Element-Set (NUR wenn dort ein
// echtes Asset liegt — url+type). Die Legacy-Spalten werden von dieser
// Schicht NIE geschrieben.

/** Produkt-Invariante (Entscheidung O1, 12.06.2026). Die Route (E2) prüft
 *  zuerst; addPlanStimulus erzwingt zusätzlich als Defense-in-depth. */
export const MAX_PLAN_STIMULI = 5;

export interface ResearchPlanStimulusRecord {
  id: string;
  planId: string;
  orgId: string | null;
  /** 1-basiert; Lese-Ordnung ist (position, createdAt, id) — deterministisch
   *  auch bei transient doppelten Positionen (kein DB-unique, s. Migration). */
  position: number;
  stimulusType: string;
  url: string;
  storagePath: string | null;
  label: string | null;
  description: string | null;
  analysis: StimulusAnalysisPayload | null;
  analysisStatus: StimulusAnalysisStatus | null;
  createdAt: string;
}

function toStimulusRecord(
  row: ResearchPlanStimulusRow,
): ResearchPlanStimulusRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    orgId: row.org_id,
    position: row.position,
    stimulusType: row.stimulus_type,
    url: row.url,
    storagePath: row.storage_path,
    label: row.label,
    description: row.description,
    analysis: coerceStimulusAnalysis(row.analysis),
    analysisStatus: coerceStimulusAnalysisStatus(row.analysis_status),
    createdAt: row.created_at,
  };
}

/** Kanonische Set-Ordnung — exakt der Migrations-Vertrag
 *  (position, created_at, id). Pure, kopiert statt zu mutieren. */
function sortStimuli(
  records: ResearchPlanStimulusRecord[],
): ResearchPlanStimulusRecord[] {
  return [...records].sort(
    (a, b) =>
      a.position - b.position ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

function stimulusToContext(
  record: ResearchPlanStimulusRecord,
): ResearchStimulusContext {
  return {
    position: record.position,
    type: record.stimulusType,
    url: record.url,
    label: record.label,
    description: record.description,
    // Identisches Gating wie der Legacy-Pfad in planToAgentContext: NUR der
    // textBlock, NUR bei status 'done'.
    analysis:
      record.analysisStatus === "done"
        ? (record.analysis?.textBlock ?? null)
        : null,
  };
}

/** Das Stimulus-Set eines Plans in kanonischer Ordnung. [] bei Fehler —
 *  liest sich überall als "kein Set" und fällt damit auf den Legacy-Pfad
 *  zurück (fail-open wie listResearchPlans). */
export async function listPlanStimuli(
  orgId: string,
  planId: string,
): Promise<ResearchPlanStimulusRecord[]> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plan_stimuli")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error || !data) return [];
  return data.map(toStimulusRecord);
}

export interface AddPlanStimulusInput {
  stimulusType: string;
  url: string;
  storagePath?: string | null;
  label?: string | null;
  description?: string | null;
  analysis?: StimulusAnalysisPayload | null;
  analysisStatus?: StimulusAnalysisStatus | null;
}

/**
 * Hängt ein Asset ans Ende des Sets (position = max + 1). Gibt null zurück,
 * wenn der Plan nicht zur Org gehört, das Set voll ist (MAX_PLAN_STIMULI)
 * oder der Insert fehlschlägt — die Route übersetzt null in 4xx/5xx.
 * Kein Lock: die Draft-Phase ist Ein-Forscher-Betrieb; ein Positions-Race
 * erzeugt schlimmstenfalls ein transientes Duplikat, das die Lese-Ordnung
 * deterministisch auflöst und der nächste Reorder repariert.
 */
export async function addPlanStimulus(
  orgId: string,
  planId: string,
  input: AddPlanStimulusInput,
): Promise<ResearchPlanStimulusRecord | null> {
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) return null;

  const existing = await listPlanStimuli(orgId, planId);
  if (existing.length >= MAX_PLAN_STIMULI) return null;
  const position =
    existing.reduce((max, s) => Math.max(max, s.position), 0) + 1;

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plan_stimuli")
    .insert({
      org_id: orgId,
      plan_id: planId,
      position,
      stimulus_type: input.stimulusType,
      url: input.url,
      storage_path: input.storagePath ?? null,
      label: input.label ?? null,
      description: input.description ?? null,
      analysis: (input.analysis ?? null) as unknown as Json,
      analysis_status: input.analysisStatus ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return toStimulusRecord(data);
}

export interface UpdatePlanStimulusInput {
  label?: string | null;
  description?: string | null;
  /** Analyse-Felder — geschrieben NUR von der Stimuli-Route (Trigger +
   *  Invalidierung), Spiegel des updateResearchPlan-Vertrags. */
  analysis?: StimulusAnalysisPayload | null;
  analysisStatus?: StimulusAnalysisStatus | null;
}

/** Sparse-Update eines Set-Elements (Label/Beschreibung/Analyse). Null wenn
 *  die Zeile nicht existiert oder einer fremden Org gehört. */
export async function updatePlanStimulus(
  orgId: string,
  planId: string,
  stimulusId: string,
  input: UpdatePlanStimulusInput,
): Promise<ResearchPlanStimulusRecord | null> {
  const update: {
    label?: string | null;
    description?: string | null;
    analysis?: Json | null;
    analysis_status?: string | null;
  } = {};
  if (input.label !== undefined) update.label = input.label;
  if (input.description !== undefined) update.description = input.description;
  if (input.analysis !== undefined)
    update.analysis = input.analysis as unknown as Json;
  if (input.analysisStatus !== undefined)
    update.analysis_status = input.analysisStatus;
  if (Object.keys(update).length === 0) return null;

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plan_stimuli")
    .update(update)
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("id", stimulusId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return toStimulusRecord(data);
}

/**
 * Entfernt ein Asset und schließt die Positions-Lücke (Renumber 1…N in
 * kanonischer Ordnung). Das Renumber ist best-effort: schlägt es teilweise
 * fehl, bleibt die Lese-Ordnung trotzdem korrekt (Lücken sind harmlos, nur
 * die Anzeige-Nummern springen) und der nächste Reorder repariert.
 * Bucket-Objekte räumt die Route auf (sie kennt storage_path + BUCKET).
 */
export async function removePlanStimulus(
  orgId: string,
  planId: string,
  stimulusId: string,
): Promise<boolean> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plan_stimuli")
    .delete()
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("id", stimulusId)
    .select("id")
    .maybeSingle();
  if (error || !data) return false;

  const remaining = await listPlanStimuli(orgId, planId);
  for (const [index, record] of remaining.entries()) {
    const target = index + 1;
    if (record.position === target) continue;
    await supabase
      .from("research_plan_stimuli")
      .update({ position: target })
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .eq("id", record.id);
  }
  return true;
}

/**
 * Setzt die Forscher-Reihenfolge neu (O5: v1 = feste Reihenfolge). orderedIds
 * muss eine exakte Permutation des aktuellen Sets sein — sonst null (die
 * Route übersetzt in 400; schützt gegen Stale-UI nach parallelem Add/Remove).
 * Die Updates laufen einzeln (PostgREST, keine Transaktion) — ein Abbruch
 * mittendrin lässt eine Mischordnung zurück, die der nächste Reorder-Call
 * vollständig überschreibt; Reads bleiben durch die kanonische Ordnung
 * jederzeit deterministisch.
 */
export async function reorderPlanStimuli(
  orgId: string,
  planId: string,
  orderedIds: string[],
): Promise<ResearchPlanStimulusRecord[] | null> {
  const current = await listPlanStimuli(orgId, planId);
  if (current.length === 0 || orderedIds.length !== current.length) {
    return null;
  }
  const currentIds = new Set(current.map((s) => s.id));
  if (
    new Set(orderedIds).size !== orderedIds.length ||
    !orderedIds.every((id) => currentIds.has(id))
  ) {
    return null;
  }

  const supabase = createResearchSupabase();
  const positionById = new Map(current.map((s) => [s.id, s.position]));
  for (const [index, id] of orderedIds.entries()) {
    const target = index + 1;
    if (positionById.get(id) === target) continue;
    const { error } = await supabase
      .from("research_plan_stimuli")
      .update({ position: target })
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .eq("id", id);
    if (error) return null;
  }
  return listPlanStimuli(orgId, planId);
}

/**
 * Dual-Read (D1): die Wahrheit über das Stimulus-Set eines Plans.
 *   - Tabellen-Zeilen vorhanden → sie SIND das Set (kanonisch sortiert).
 *   - Keine Zeilen, aber Legacy-Single-ASSET (url + type) auf den Plan-
 *     Spalten → synthetisches 1-Element-Set (id "legacy:<planId>").
 *   - Sonst → leeres Set.
 * BEWUSST NICHT synthetisiert: ein Legacy-Plan mit NUR einer Beschreibung
 * (ohne Asset) — der Beschreibungs-Block läuft dort weiter über die
 * Legacy-Prompt-Felder (O3: kein Verhaltensbruch für Bestand). Pure Funktion,
 * kein DB-Call — Aufrufer kombinieren getResearchPlan + listPlanStimuli.
 */
export function resolveStimulusSet(
  plan: ResearchPlanRecord,
  stimuli: ResearchPlanStimulusRecord[],
): ResearchPlanStimulusRecord[] {
  if (stimuli.length > 0) return sortStimuli(stimuli);
  if (!plan.stimulusUrl || !plan.stimulusType) return [];
  return [
    {
      id: `legacy:${plan.id}`,
      planId: plan.id,
      orgId: plan.orgId,
      position: 1,
      stimulusType: plan.stimulusType,
      url: plan.stimulusUrl,
      storagePath: null,
      label: null,
      description: plan.stimulusDescription,
      analysis: plan.stimulusAnalysis,
      analysisStatus: plan.stimulusAnalysisStatus,
      createdAt: plan.createdAt,
    },
  ];
}
