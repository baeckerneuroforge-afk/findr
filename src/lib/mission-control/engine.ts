import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import {
  MissionControlResultSchema,
  type MissionControlResult,
} from "@/lib/schemas/mission-control";
import {
  normalizeEmergentThemes,
  normalizeTensions,
} from "@/lib/schemas/synthesis";
import type { Database, Json } from "@/types/database";
import {
  MISSION_CONTROL_SYSTEM_PROMPT,
  buildMissionControlDataSection,
  type MissionControlFromInputs,
  type MissionControlSynthesisInput,
} from "./prompts";

/**
 * Mission-Control / Cross-Study-Chat engine (Etappe 1 — eval-faehiger Kern,
 * NOT wired to a route/UI yet). Mirrors src/lib/research/chat-with-data.ts and
 * src/lib/research-agent/engine.ts: forced tool-use via callClaudeStructured,
 * a fold-substring anchor filter, multi-turn history threaded in `messages`,
 * the data dump in a cacheable `system` prefix.
 *
 * The one new thing is CROSS-STUDY anchoring: the haystack is not one synthesis
 * but a PER-STUDY map of folded synthesis text. A citation is { studyId, quote }
 * and survives only if its quote is a verbatim substring of the cited study's
 * OWN haystack — never the union. That single design choice gives all three
 * cross-study guarantees: no hallucinated finding (quote must exist), no
 * wrong-study attribution (checked against the cited study only), and no
 * cross-study mixing (a claim can't merge two studies into one citation).
 *
 * Model: Opus by default — parity with chat-with-data (trust-critical). Override
 * via MISSION_CONTROL_MODEL. (A later eval may confirm Sonnet is identical-
 * quality + cheaper here, exactly as it did for research-agent.)
 */

export const DEFAULT_MISSION_CONTROL_MODEL = CLAUDE_MODELS.opus;

/** Honest fallback when the anchor filter drops every citation of a claimed
 *  answer — never let an unanchored cross-study claim escape. */
const MISSION_CONTROL_REFUSAL =
  "Dazu liegt in den Studien dieser Organisation keine eindeutige Evidenz vor.";

/** Distinct refusal when the org simply has no syntheses to ground on — the
 *  model is never even called. */
const MISSION_CONTROL_NO_STUDIES =
  "Für diese Organisation liegen noch keine Studien-Synthesen vor.";

export class MissionControlUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MissionControlUnavailableError";
  }
}

// ── Typography folding + string harvest (identical to chat-with-data) ────────

/** Normalize typography so a verbatim quote matches despite umlaut spelling,
 *  smart quotes, dash variants, and whitespace. Semantic-equivalents do NOT
 *  pass — only spelling-equivalents. */
export function fold(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/Ä/g, "Ae")
    .replace(/ä/g, "ae")
    .replace(/Ö/g, "Oe")
    .replace(/ö/g, "oe")
    .replace(/Ü/g, "Ue")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/["'„“”«»‘’‚‹›]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectStrings(value: unknown, sink: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, sink);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, sink);
    }
  }
}

// ── Per-study anchor set (the cross-study upgrade) ──────────────────────────

export interface MissionControlAnchorSet {
  /** studyIds the model is allowed to cite (= plan_ids of the loaded studies). */
  studyIds: Set<string>;
  /** studyId → folded haystack of THAT study's synthesis text only. A citation
   *  quote is substring-checked against its cited study's entry, never the
   *  union — so a quote belonging to study B fails when cited under study A. */
  haystackByStudy: Map<string, string>;
}

export function buildMissionControlAnchorSet(
  syntheses: MissionControlSynthesisInput[],
): MissionControlAnchorSet {
  const studyIds = new Set<string>();
  const haystackByStudy = new Map<string, string>();
  for (const s of syntheses) {
    studyIds.add(s.studyId);
    const parts: string[] = [];
    if (s.overview) parts.push(s.overview);
    collectStrings(s.emergent_themes, parts);
    collectStrings(s.tensions, parts);
    const folded = fold(parts.join(" \n "));
    // Defensive: if a studyId somehow appears twice, append rather than shadow.
    const prev = haystackByStudy.get(s.studyId);
    haystackByStudy.set(s.studyId, prev ? `${prev} \n ${folded}` : folded);
  }
  return { studyIds, haystackByStudy };
}

/**
 * Drop every citation whose studyId is unknown OR whose quote is not a verbatim
 * (folded) substring of THAT study's synthesis. Then enforce the answer
 * contract: a claimed answer with no surviving citation is downgraded to an
 * honest refusal; a refusal is stripped of any stray citations.
 */
export function applyMissionControlAnchorFilter(
  raw: MissionControlResult,
  anchors: MissionControlAnchorSet,
): MissionControlResult {
  const validCitations = raw.citations.filter((c) => {
    const hay = anchors.haystackByStudy.get(c.studyId);
    return hay !== undefined && hay.includes(fold(c.quote));
  });

  if (raw.answered && validCitations.length === 0) {
    return { answered: false, answer: MISSION_CONTROL_REFUSAL, citations: [] };
  }
  if (!raw.answered) {
    return { answered: false, answer: raw.answer, citations: [] };
  }
  return { answered: true, answer: raw.answer, citations: validCitations };
}

// ── Diagnostics entry (the eval drives this) ────────────────────────────────

/** Raw (pre-filter) + filtered (the guarantee) output plus the filter stats —
 *  the eval measures the filtered guarantee AND how much the filter had to
 *  strip (lower raw leakage = a more trustworthy model). */
export interface MissionControlDiagnostics {
  raw: MissionControlResult;
  filtered: MissionControlResult;
  /** Citations the model emitted that the per-study anchor check rejected. */
  droppedCitationCount: number;
  /** answered=true flipped to a refusal because every citation was dropped. */
  downgraded: boolean;
}

/**
 * Pure entry — pass the org's syntheses + question explicitly, get BOTH the raw
 * model output and the anchor-filtered answer. NO Supabase. The eval harness
 * drives this so hand-crafted multi-study scenarios run without seeding the DB.
 */
export async function runMissionControlDiagnostics(
  input: MissionControlFromInputs,
  model: string = process.env.MISSION_CONTROL_MODEL ??
    DEFAULT_MISSION_CONTROL_MODEL,
): Promise<MissionControlDiagnostics> {
  // No syntheses → honest refusal without a model call (nothing to ground on).
  if (input.syntheses.length === 0) {
    const refusal: MissionControlResult = {
      answered: false,
      answer: MISSION_CONTROL_NO_STUDIES,
      citations: [],
    };
    return {
      raw: refusal,
      filtered: refusal,
      droppedCitationCount: 0,
      downgraded: false,
    };
  }

  const systemPrompt = `${MISSION_CONTROL_SYSTEM_PROMPT}\n\n${buildMissionControlDataSection(
    input.syntheses,
  )}`;
  // The anchor haystacks are rebuilt from the SYNTHESES alone on every turn —
  // input.history is deliberately NOT folded in. A follow-up's citations are
  // re-checked against the fresh per-study syntheses, so prior turns can never
  // widen what counts as grounded.
  const anchors = buildMissionControlAnchorSet(input.syntheses);

  const messages = [
    ...(input.history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: input.question },
  ];

  let raw: MissionControlResult;
  try {
    raw = await callClaudeStructured({
      schema: MissionControlResultSchema,
      system: systemPrompt,
      messages,
      model,
      maxTokens: 1500,
      toolName: "emit_cross_study_answer",
      toolDescription:
        "Return the cross-study answer — answered, a short German answer, and verbatim citations (studyId + quote) each drawn ONLY from the named study's synthesis.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new MissionControlUnavailableError(
        "Claude mission-control returned invalid output twice",
        err,
      );
    }
    throw new MissionControlUnavailableError(
      "Claude mission-control call failed",
      err,
    );
  }

  const filtered = applyMissionControlAnchorFilter(raw, anchors);
  const rawCitationCount = raw.answered ? raw.citations.length : 0;
  const keptCitationCount = filtered.answered ? filtered.citations.length : 0;
  return {
    raw,
    filtered,
    droppedCitationCount: rawCitationCount - keptCitationCount,
    downgraded: raw.answered && !filtered.answered,
  };
}

/** Production-facing pure entry — the filtered guarantee only. */
export async function missionControlChatFromInputs(
  input: MissionControlFromInputs,
  model?: string,
): Promise<MissionControlResult> {
  return (await runMissionControlDiagnostics(input, model)).filtered;
}

// ── Database augmentation (read-only; mirrors chat-with-data) ────────────────
//
// Until src/types/database.ts is regenerated post-migration we declare the
// study_synthesis + research_plans rows inline so supabase-js narrows the
// org-scoped reads. Object-literal types, not Partial<Row> — same rationale as
// chat-with-data.ts / synthesis/engine.ts. READ-ONLY: Etappe 1 never writes.

type StudySynthesisRow = {
  id: string;
  org_id: string;
  plan_id: string;
  emergent_themes: Json;
  tensions: Json;
  overview: string | null;
  based_on_count: number;
  synthesized_at: string | null;
  model: string | null;
  created_at: string;
};

type ResearchPlanRow = {
  id: string;
  org_id: string | null;
  title: string;
  objective: string;
  topic_script: Json;
  persona: string | null;
  sample_target: number | null;
  status: string;
  created_at: string;
};

type DatabaseWithMC = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      study_synthesis: {
        Row: StudySynthesisRow;
        Insert: StudySynthesisRow;
        Update: StudySynthesisRow;
        Relationships: [];
      };
      research_plans: {
        Row: ResearchPlanRow;
        Insert: ResearchPlanRow;
        Update: ResearchPlanRow;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createMissionControlSupabase(): SupabaseClient<DatabaseWithMC> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new MissionControlUnavailableError(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin reads.",
    );
  }
  return createClient<DatabaseWithMC>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Load the UNION of an org's study syntheses, attributed per study. Org-scoped
 * (RLS-equivalent via the explicit org_id filter on the admin client). Each
 * synthesis is normalized (normalizeEmergentThemes / normalizeTensions) so
 * legacy/partial JSONB rows are safe to iterate — same guarantee
 * getStudySynthesis gives for the single-study path. The study title is
 * resolved from research_plans for source attribution + display.
 *
 * Read-only — the Etappe-1 seam between the engine and the DB. The route/UI
 * that calls missionControlChat() is Etappe 2.
 */
export async function loadOrgSyntheses(
  orgId: string,
): Promise<MissionControlSynthesisInput[]> {
  const supabase = createMissionControlSupabase();

  const { data: synthRows, error } = await supabase
    .from("study_synthesis")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !synthRows || synthRows.length === 0) return [];

  // Resolve study titles in one batched query (org-scoped).
  const planIds = [...new Set(synthRows.map((r) => r.plan_id))];
  const { data: planRows } = await supabase
    .from("research_plans")
    .select("id, title")
    .eq("org_id", orgId)
    .in("id", planIds);
  const titleByPlan = new Map<string, string>(
    (planRows ?? []).map((p) => [p.id, p.title]),
  );

  return synthRows.map((row) => ({
    studyId: row.plan_id,
    studyTitle: titleByPlan.get(row.plan_id) ?? "Untitled study",
    overview: row.overview,
    emergent_themes: normalizeEmergentThemes(row.emergent_themes),
    tensions: normalizeTensions(row.tensions),
    basedOnCount: row.based_on_count,
  }));
}

/**
 * Org entry — load all org syntheses, then answer the cross-study question with
 * full anchor discipline. The engine is complete and ready to wire; the route +
 * UI + any persistence of the conversation are Etappe 2.
 */
export async function missionControlChat(
  orgId: string,
  question: string,
  history?: MissionControlFromInputs["history"],
  model?: string,
): Promise<MissionControlResult> {
  const syntheses = await loadOrgSyntheses(orgId);
  return missionControlChatFromInputs({ syntheses, question, history }, model);
}
