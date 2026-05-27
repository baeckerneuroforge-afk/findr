import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import type { Database, Json } from "@/types/database";
import {
  StudySynthesisResultSchema,
  type EmergentTheme,
  type StudySynthesisResult,
  type Tension,
  type TensionSide,
} from "@/lib/schemas/synthesis";
import {
  STUDY_SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserPrompt,
  type SynthesisInput,
  type SynthesisInsightInput,
  type SynthesisPlanContext,
} from "./prompts";

/**
 * Stage-2 Study-Synthesis engine. Reads all product_discovery_insights of
 * ONE research_plan, runs ONE Opus call over the verdichteten Felder
 * (NEVER raw transcripts — cost guardrail), validates the JSON against
 * StudySynthesisResultSchema, applies a second anchored-filter to drop
 * any theme/tension that cites unknown insight ids or paraphrased
 * quotes, then upserts into study_synthesis.
 *
 * Model: Opus by default. Override via SYNTHESIS_MODEL env (cheap-run
 * the evals on Sonnet, ship Opus to production — same pattern as
 * HEALTH_MODEL / PRODUCT_DISCOVERY_MODEL).
 *
 * Anchoring is enforced THREE times:
 *  1. Schema (StudySynthesisResultSchema) — sourceInsightIds non-empty.
 *  2. ID set check — each cited id must appear in the input set.
 *  3. Quote fold-substring check — each quote must be a verbatim
 *     substring of the input verdichtungen after typography fold.
 * A theme that loses ALL its sourceInsightIds in step 2 or all its
 * quotes in step 3 is dropped entirely. A tension whose two sides
 * share any sourceInsightId is dropped (same respondent can't be on
 * both sides). frequency is always overridden post-filter with
 * unique(sourceInsightIds).length — the model's number is advisory,
 * the engine's number is authoritative.
 */

export const DEFAULT_SYNTHESIS_MODEL = CLAUDE_MODELS.opus;

class StudySynthesisSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "StudySynthesisSchemaError";
  }
}

export class StudySynthesisUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "StudySynthesisUnavailableError";
  }
}

// ── Database type augmentation ──────────────────────────────────────────────
//
// Mirrors src/lib/product-discovery/service.ts: until src/types/database.ts
// is regenerated post-migrations, we declare the new tables (study_synthesis)
// and the new columns (product_discovery_insights.{respondent_*, plan_id,
// respondent_source}) inline so supabase-js's .from(…).insert/upsert/select
// narrows correctly. Once `supabase gen types` runs, this block can shrink
// back to a thin Database alias.

type SentimentValue = "positive" | "neutral" | "negative" | "mixed";

type ProductDiscoveryInsightRow = {
  id: string;
  org_id: string;
  source_call_id: string;
  deal_id: string | null;
  account_id: string | null;
  feature_requests: Json;
  pain_points: Json;
  themes: Json;
  summary: string | null;
  analysis_method: string;
  analyzed_at: string;
  created_at: string;
  respondent_role: string | null;
  respondent_segment: string | null;
  sentiment: SentimentValue | null;
  plan_id: string | null;
  respondent_source: "ai" | "screening";
};

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

type StudySynthesisInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  emergent_themes?: Json;
  tensions?: Json;
  overview?: string | null;
  based_on_count?: number;
  synthesized_at?: string | null;
  model?: string | null;
  created_at?: string;
};

type StudySynthesisUpdate = Partial<StudySynthesisInsert>;

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

// Object-literal types (NOT Partial<Row>) — supabase-js's select-string
// parser narrows row shapes against the Row property; Partial collapses
// the keys into `GenericStringError` at the call site. Mirror the
// pattern from src/lib/product-discovery/service.ts.
type ProductDiscoveryInsightInsert = {
  id?: string;
  org_id?: string;
  source_call_id?: string;
  deal_id?: string | null;
  account_id?: string | null;
  feature_requests?: Json;
  pain_points?: Json;
  themes?: Json;
  summary?: string | null;
  analysis_method?: string;
  analyzed_at?: string;
  created_at?: string;
  respondent_role?: string | null;
  respondent_segment?: string | null;
  sentiment?: SentimentValue | null;
  plan_id?: string | null;
  respondent_source?: "ai" | "screening";
};

type ResearchPlanInsert = {
  id?: string;
  org_id?: string | null;
  title?: string;
  objective?: string;
  topic_script?: Json;
  persona?: string | null;
  sample_target?: number | null;
  status?: string;
  created_at?: string;
};

type DatabaseWithSynth = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      product_discovery_insights: {
        Row: ProductDiscoveryInsightRow;
        Insert: ProductDiscoveryInsightInsert;
        Update: ProductDiscoveryInsightInsert;
        Relationships: [];
      };
      study_synthesis: {
        Row: StudySynthesisRow;
        Insert: StudySynthesisInsert;
        Update: StudySynthesisUpdate;
        Relationships: [];
      };
      research_plans: {
        Row: ResearchPlanRow;
        Insert: ResearchPlanInsert;
        Update: ResearchPlanInsert;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createSynthSupabase(): SupabaseClient<DatabaseWithSynth> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithSynth>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// ── Anchored-filter helpers (the second layer on top of Zod) ────────────────

/** Same fold used by evals-product-discovery/run.ts so quote membership
 *  is robust against umlauts, smart quotes, and en/em-dashes. Kept inline
 *  rather than imported so this file doesn't depend on the evals tree. */
function fold(s: string): string {
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

interface AnchorSet {
  /** ids the LLM is allowed to cite (from the input insights). */
  ids: Set<string>;
  /** Folded haystack of all per-item evidence + summary text. quotes are
   *  checked as substrings against this. */
  foldedHaystack: string;
}

function buildAnchorSet(insights: SynthesisInsightInput[]): AnchorSet {
  const ids = new Set<string>();
  const parts: string[] = [];
  for (const ins of insights) {
    ids.add(ins.id);
    if (ins.summary) parts.push(ins.summary);
    // Pull every nested "evidence" / "quotes" / "summary" string out of the
    // jsonb-ish payloads — robust to the exact Stage-1 shape, just collects
    // anything that could be a verbatim quote.
    collectStrings(ins.featureRequests, parts);
    collectStrings(ins.painPoints, parts);
    collectStrings(ins.themes, parts);
  }
  return { ids, foldedHaystack: fold(parts.join(" \n ")) };
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

/** Drop ids that aren't in the anchor set; drop quotes that don't appear
 *  in the folded haystack. Returns a filtered side; caller decides whether
 *  the side has enough left to survive. */
function filterTensionSide(
  side: TensionSide,
  anchors: AnchorSet,
): TensionSide {
  return {
    label: side.label,
    sourceInsightIds: side.sourceInsightIds.filter((id) => anchors.ids.has(id)),
    quotes: side.quotes.filter((q) =>
      anchors.foldedHaystack.includes(fold(q)),
    ),
  };
}

/** Engine-side cleanup: drop hallucinated content, override frequency. */
function applyAnchoredFilter(
  raw: StudySynthesisResult,
  anchors: AnchorSet,
): StudySynthesisResult {
  const themes: EmergentTheme[] = [];
  for (const t of raw.emergent_themes) {
    const validIds = t.sourceInsightIds.filter((id) => anchors.ids.has(id));
    const validQuotes = t.quotes.filter((q) =>
      anchors.foldedHaystack.includes(fold(q)),
    );
    // Distinct count is the authoritative frequency — the LLM's number is
    // advisory. If the LLM said 5 but only 3 unique IDs survive, frequency
    // becomes 3.
    const uniqueIds = Array.from(new Set(validIds));
    if (uniqueIds.length === 0) continue; // wholly unanchored — drop
    themes.push({
      title: t.title,
      summary: t.summary,
      frequency: uniqueIds.length,
      sourceInsightIds: uniqueIds,
      quotes: validQuotes,
    });
  }

  const tensions: Tension[] = [];
  for (const t of raw.tensions) {
    const side_a = filterTensionSide(t.side_a, anchors);
    const side_b = filterTensionSide(t.side_b, anchors);
    // Each side must keep ≥1 anchored id after filtering.
    if (side_a.sourceInsightIds.length === 0) continue;
    if (side_b.sourceInsightIds.length === 0) continue;
    // Sides must be DISJOINT — the same respondent can't be on both
    // sides of the same disagreement. If they overlap, the model
    // conflated the disagreement; drop the tension.
    const aSet = new Set(side_a.sourceInsightIds);
    const overlap = side_b.sourceInsightIds.some((id) => aSet.has(id));
    if (overlap) continue;
    tensions.push({
      description: t.description,
      side_a,
      side_b,
    });
  }

  return {
    overview: raw.overview,
    emergent_themes: themes,
    tensions,
  };
}

// ── Opus call (mirrors product-discovery/classifier.ts) ─────────────────────

async function callClaude(
  userPrompt: string,
  attempt: number,
  model: string,
): Promise<StudySynthesisResult> {
  const client = getAnthropicClient();
  const system =
    attempt > 0
      ? STUDY_SYNTHESIS_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble."
      : STUDY_SYNTHESIS_SYSTEM_PROMPT;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userPrompt }],
    },
    { timeout: 180_000, maxRetries: 1 },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new StudySynthesisSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new StudySynthesisSchemaError(
      "No JSON found in response",
      textBlock.text,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new StudySynthesisSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = StudySynthesisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new StudySynthesisSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }
  return result.data;
}

/** Pure LLM entry — exposed for the eval runner so it can drive the
 *  synthesizer with hand-crafted inputs without going through Supabase.
 *  Schema-validates, applies the anchored-filter, returns the cleaned
 *  result. NO persistence. */
export async function synthesizeFromInputs(
  input: SynthesisInput,
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_SYNTHESIS_MODEL,
): Promise<StudySynthesisResult> {
  const userPrompt = buildSynthesisUserPrompt(input);
  const anchors = buildAnchorSet(input.insights);

  let raw: StudySynthesisResult;
  try {
    raw = await callClaude(userPrompt, 0, model);
  } catch (err) {
    if (!(err instanceof StudySynthesisSchemaError)) {
      throw new StudySynthesisUnavailableError(
        "Claude synthesis call failed",
        err,
      );
    }
    console.warn(
      "Synthesis schema validation failed on first attempt, retrying:",
      err.message,
    );
    try {
      raw = await callClaude(userPrompt, 1, model);
    } catch (err2) {
      if (err2 instanceof StudySynthesisSchemaError) {
        throw new StudySynthesisUnavailableError(
          "Claude synthesis returned invalid JSON twice",
          err2,
        );
      }
      throw new StudySynthesisUnavailableError(
        "Claude synthesis call failed",
        err2,
      );
    }
  }

  return applyAnchoredFilter(raw, anchors);
}

// ── DB-driven entry ─────────────────────────────────────────────────────────

export interface SynthesizeStudyResult {
  status: "synthesized" | "plan_not_found" | "no_insights";
  synthesis: StudySynthesisResult | null;
  basedOnCount: number;
  synthesizedAt: string | null;
  message: string | null;
}

/**
 * Full DB-driven entry point. Loads plan + insights, calls
 * synthesizeFromInputs, upserts study_synthesis on (org_id, plan_id).
 *
 * COST GUARDRAIL: we read ONLY the verdichteten Felder from
 * product_discovery_insights — not calls.transcript. The Stage-1 row
 * is the unit of input. Re-fetching transcripts would multiply token
 * cost without adding signal (Stage-1 already distilled what matters).
 */
export async function synthesizeStudy(
  orgId: string,
  planId: string,
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_SYNTHESIS_MODEL,
): Promise<SynthesizeStudyResult> {
  const supabase = createSynthSupabase();

  // Plan (for ground-context in the prompt). select("*") because supabase-js's
  // column-list parsing collapses to GenericStringError under the augmented
  // type; the row payload is tiny so `*` is no cost concern here.
  const { data: planRow, error: planErr } = await supabase
    .from("research_plans")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", planId)
    .maybeSingle();
  if (planErr || !planRow) {
    return {
      status: "plan_not_found",
      synthesis: null,
      basedOnCount: 0,
      synthesizedAt: null,
      message: "Research plan not found in this organization.",
    };
  }
  const plan: SynthesisPlanContext = {
    title: planRow.title,
    objective: planRow.objective,
    persona: planRow.persona,
  };

  // Insights — `select("*")` for the same type-narrowing reason as the plan
  // read above. The Stage-1 row never carries the raw transcript (that
  // lives in calls.transcript, which we explicitly do NOT join here —
  // cost guardrail). So `*` is bounded.
  const { data: insightRows, error: insErr } = await supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("analyzed_at", { ascending: true });

  if (insErr || !insightRows) {
    throw new StudySynthesisUnavailableError(
      `Failed to read insights for plan ${planId}: ${insErr?.message ?? "no rows"}`,
    );
  }

  if (insightRows.length === 0) {
    return {
      status: "no_insights",
      synthesis: null,
      basedOnCount: 0,
      synthesizedAt: null,
      message:
        "No product_discovery_insights yet for this plan — nothing to synthesize.",
    };
  }

  const insights: SynthesisInsightInput[] = insightRows.map((r) => ({
    // We expose source_call_id as the ID the synthesizer cites — that's
    // the participant-identifying handle (one call = one respondent).
    // The insight row's own id is internal.
    id: r.source_call_id,
    summary: r.summary,
    featureRequests: (r.feature_requests as unknown as unknown[]) ?? [],
    painPoints: (r.pain_points as unknown as unknown[]) ?? [],
    themes: (r.themes as unknown as unknown[]) ?? [],
    respondentRole: r.respondent_role,
    respondentSegment: r.respondent_segment,
    sentiment: r.sentiment,
  }));

  const synthesis = await synthesizeFromInputs({ plan, insights }, model);

  // Upsert on UNIQUE (org_id, plan_id) — re-run overwrites; no history.
  const synthesizedAt = new Date().toISOString();
  const { error: upsertErr } = await supabase
    .from("study_synthesis")
    .upsert(
      {
        org_id: orgId,
        plan_id: planId,
        overview: synthesis.overview,
        emergent_themes: synthesis.emergent_themes as unknown as Json,
        tensions: synthesis.tensions as unknown as Json,
        based_on_count: insights.length,
        synthesized_at: synthesizedAt,
        model,
      },
      { onConflict: "org_id,plan_id" },
    );

  if (upsertErr) {
    throw new StudySynthesisUnavailableError(
      `Failed to upsert study_synthesis: ${upsertErr.message}`,
    );
  }

  return {
    status: "synthesized",
    synthesis,
    basedOnCount: insights.length,
    synthesizedAt,
    message: null,
  };
}
