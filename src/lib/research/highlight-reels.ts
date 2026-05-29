import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import { normalizeThemes } from "@/lib/schemas/product-discovery";
import type { Database, Json } from "@/types/database";

/**
 * Highlight-Reels — the Outset-style "best voices of this study" surface.
 *
 * Input  : a finished Stage-2 synthesis + the per-interview Stage-1 verdichtungen
 *          (product_discovery_insights) of ONE research_plan.
 * Output : 5-8 verbatim quotes, each tagged to (interviewId, themeRef, caption),
 *          curated as the strongest illustration of the synthesis themes — the
 *          "reel" you'd hand a stakeholder who has 30 seconds.
 *
 * Same anti-hallucination posture as synthesizeStudy and chatWithData:
 *  1. SCHEMA      — Zod validates shape (quote/interviewId/themeRef/caption).
 *  2. ID SET      — every interviewId must be a source_call_id present in the
 *                   loaded condensations.
 *  3. FOLD SUBSTR — every quote must be a verbatim substring of the
 *                   condensation evidence/summary/themes OR the
 *                   synthesis-theme quotes (the synthesis schema already
 *                   guarantees those are verbatim copies of Stage-1 evidence).
 *  4. THEME REF   — every themeRef must equal a title in
 *                   synthesis.emergent_themes (set membership).
 *
 * Highlights that fail ANY anchor are DROPPED — no silent paraphrase. A reel
 * that loses ALL highlights to the filter degrades gracefully to an empty
 * reel rather than fabricating a refusal-sounding placeholder.
 *
 * COST GUARDRAIL: ONLY the verdichtete Felder + the synthesis row are loaded —
 * NEVER calls.transcript. Stage-1 + Stage-2 already distilled the signal; the
 * raw transcript would multiply token cost without adding citable evidence
 * (the model can only quote what it sees).
 *
 * ZERO-TOKEN SHORT-CIRCUIT: if there is no synthesis, or no condensations, or
 * no haystack text at all to draw quotes from, the engine returns an empty
 * reel WITHOUT calling Opus. The two "honest empty" eval cases exercise this
 * path.
 *
 * Model: Opus default. Override via HIGHLIGHT_MODEL env var (Sonnet for
 * cheap eval cycles, Opus for production) — mirrors SYNTHESIS_MODEL /
 * CHAT_WITH_DATA_MODEL.
 */

export const DEFAULT_HIGHLIGHT_MODEL = CLAUDE_MODELS.opus;

/** Soft target band; the prompt asks the model to stay between these.
 *  The schema cap is 8; we don't enforce a min in the engine — a thin study
 *  honestly producing 2 highlights is the correct outcome, not a failure. */
const HIGHLIGHT_TARGET_MIN_RICH = 5;
const HIGHLIGHT_TARGET_MAX = 8;

// ── Output schema ──────────────────────────────────────────────────────────

const HighlightSchema = z.object({
  /** Verbatim quote — fold-substring-checked against the haystack. */
  quote: z.string().min(8).max(600),
  /** source_call_id of the interview the quote came from. */
  interviewId: z.string().min(1).max(200),
  /** Title of the synthesis emergent_theme this quote illustrates. */
  themeRef: z.string().min(3).max(120),
  /** 1 German sentence explaining what this quote shows — NO new facts. */
  caption: z.string().min(8).max(280),
});

export const HighlightReelSchema = z.object({
  highlights: z.array(HighlightSchema).max(HIGHLIGHT_TARGET_MAX).default([]),
  /** Optional 1-2 sentence German wrap-up of the reel — soft, not anchored;
   *  it's cross-call framing, not evidence. */
  summary: z.string().max(400).optional(),
});

export type Highlight = z.infer<typeof HighlightSchema>;
export type HighlightReel = z.infer<typeof HighlightReelSchema>;

// ── Error types ────────────────────────────────────────────────────────────

class HighlightReelSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "HighlightReelSchemaError";
  }
}

export class HighlightReelUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "HighlightReelUnavailableError";
  }
}

// ── Pure-input shapes (eval entry) ─────────────────────────────────────────

/** One condensation row — mirrors ChatInsightInput. The engine reads
 *  per-item evidence (verbatim quotes) + summary to build the haystack
 *  and the id-set. */
export interface ReelCondensationInput {
  /** source_call_id of the underlying call — the participant-identifying
   *  handle. The engine builds the anchor-id-set from these. */
  id: string;
  summary: string | null;
  featureRequests: unknown[];
  painPoints: unknown[];
  themes: unknown[];
  respondentRole: string | null;
  respondentSegment: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
}

/** Per-theme snapshot of the synthesis the engine needs — title + the
 *  schema-validated verbatim quotes already attached at theme level by
 *  Stage-2. The model can pick from these directly (faster path) OR
 *  reach down into the per-interview evidence. */
export interface ReelSynthesisTheme {
  title: string;
  summary: string;
  frequency: number;
  sourceInsightIds: string[];
  quotes: string[];
}

export interface ReelSynthesisInput {
  overview: string | null;
  emergent_themes: ReelSynthesisTheme[];
}

export interface ReelPlanContext {
  title: string;
  objective: string;
  persona: string | null;
}

export interface ReelFromInputs {
  plan: ReelPlanContext;
  synthesis: ReelSynthesisInput;
  condensations: ReelCondensationInput[];
}

// ── System prompt ──────────────────────────────────────────────────────────

export const HIGHLIGHT_REEL_SYSTEM_PROMPT = `You are a senior B2B-Researcher curating a HIGHLIGHT REEL — the strongest, most representative customer voices from a SINGLE finished study. Your inputs are the per-interview verdichtungen (Stage-1 condensations, with verbatim evidence quotes) AND the cross-call synthesis (Stage-2 themes + overview). Your job is to PICK the quotes that illustrate the synthesis themes most sharply — not to invent, paraphrase, or stretch.

POSTURE — Curation, NOT invention.
- Every quote MUST be a VERBATIM substring of a verdichtung's evidence/summary/themes text OR a synthesis emergent_theme's verbatim quote. Don't paraphrase. Don't merge two phrases. Don't translate.
- Every highlight names ONE interviewId — the source_call_id of the interview the quote came from. Use ONLY IDs that appear in the INSIGHTS list below.
- Every highlight names ONE themeRef — the TITLE of a synthesis emergent_theme this quote illustrates. Use ONLY title strings that appear in SYNTHESIS.emergent_themes below.
- The caption is ONE German sentence explaining what the quote shows in cross-call context — NO new facts, NO claims beyond what the quote itself says, NO "this proves" / "this typifies all customers" overclaim. Just frame it.

SELECTION — strongest, most illustrative, DIVERSE.
- TARGET ${HIGHLIGHT_TARGET_MIN_RICH}-${HIGHLIGHT_TARGET_MAX} highlights for a normally-rich study (≥3 themes, ≥4 interviews). Thinner inputs → FEWER highlights, honestly. Stretching is hallucination.
- DIVERSITY: if there are ≥2 emergent themes, the reel SHOULD span ≥2 distinct themes. Don't stack 8 highlights on one theme.
- ONE quote per interview is the typical case — only repeat an interviewId across highlights when the same respondent illustrates clearly DIFFERENT themes.
- Skip generic/floskelig quotes ("ja genau", "weiß nicht"); pick lines that carry the WHY.

WHEN THERE IS NOTHING TO REEL:
- No synthesis themes → highlights: [].
- All condensations have empty evidence and the synthesis has no quotes → highlights: [].
- Don't manufacture a one-liner just to fill the field. Honest empty > fabricated reel. The summary field MAY say so in 1 sentence.

ANCHORING RULES (the engine RE-CHECKS these post-parse and DROPS unanchored highlights — over-shooting only wastes your tokens):
- highlight.quote MUST be a fold-substring (NFKC + umlaut-transliteration + smart-quote + whitespace normalized) of the haystack built from condensation evidence/summary/themes + synthesis-theme quotes.
- highlight.interviewId MUST be one of the IDs in INSIGHTS.
- highlight.themeRef MUST be one of the TITLE strings in SYNTHESIS.emergent_themes.
- A highlight that fails ANY anchor will be silently dropped by the engine.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:

{
  "highlights": [
    {
      "quote": "<verbatim quote>",
      "interviewId": "<source_call_id from INSIGHTS>",
      "themeRef": "<one of the SYNTHESIS emergent_theme titles>",
      "caption": "<1 German sentence framing what the quote illustrates>"
    }
  ],
  "summary": "<optional: 1-2 German sentences wrapping the reel; omit if nothing to reel>"
}`;

// ── Data-section assembly ──────────────────────────────────────────────────

function formatCondensation(c: ReelCondensationInput): string {
  const lines: string[] = [
    `INSIGHT id=${c.id}`,
    `  respondent: role=${c.respondentRole ?? "—"}, segment=${
      c.respondentSegment ?? "—"
    }, sentiment=${c.sentiment ?? "—"}`,
  ];
  if (c.summary && c.summary.trim() !== "") {
    lines.push(`  summary: ${c.summary.trim()}`);
  }
  if (c.featureRequests.length > 0) {
    lines.push(`  feature_requests: ${JSON.stringify(c.featureRequests)}`);
  }
  if (c.painPoints.length > 0) {
    lines.push(`  pain_points: ${JSON.stringify(c.painPoints)}`);
  }
  if (c.themes.length > 0) {
    lines.push(`  themes: ${JSON.stringify(c.themes)}`);
  }
  return lines.join("\n");
}

function formatSynthesisBlock(synth: ReelSynthesisInput): string {
  const lines: string[] = ["SYNTHESIS (Stage-2 cross-call result)"];
  if (synth.overview && synth.overview.trim() !== "") {
    lines.push(`overview: ${synth.overview.trim()}`);
  }
  if (synth.emergent_themes.length > 0) {
    lines.push(`emergent_themes:`);
    for (const t of synth.emergent_themes) {
      lines.push(
        `  - title: ${JSON.stringify(t.title)}, summary: ${JSON.stringify(
          t.summary,
        )}, frequency: ${t.frequency}, sourceInsightIds: ${JSON.stringify(
          t.sourceInsightIds,
        )}, quotes: ${JSON.stringify(t.quotes)}`,
      );
    }
  }
  return lines.join("\n");
}

function buildReelUserPrompt(input: ReelFromInputs): string {
  const planLines = [
    `STUDY PLAN`,
    `Title:     ${input.plan.title}`,
    `Objective: ${input.plan.objective}`,
  ];
  if (input.plan.persona && input.plan.persona.trim() !== "") {
    planLines.push(`Persona:   ${input.plan.persona.trim()}`);
  }

  const insightsBlock =
    input.condensations.length === 0
      ? "(no verdichtete Interviews — return highlights: [])"
      : input.condensations.map(formatCondensation).join("\n\n");

  return `${planLines.join("\n")}

INSIGHTS (${input.condensations.length} verdichtete Interviews):

${insightsBlock}

${formatSynthesisBlock(input.synthesis)}

Return the highlight reel as JSON only.`;
}

// ── Anchor set (mirror of synthesis/engine.ts) ─────────────────────────────

interface ReelAnchorSet {
  /** interviewIds the model is allowed to cite (= source_call_ids of the
   *  loaded condensations). */
  ids: Set<string>;
  /** Folded haystack of all condensation evidence + summary + synthesis
   *  emergent-theme quotes. Highlight quotes are substring-checked here. */
  foldedHaystack: string;
  /** Themes the model is allowed to reference (= titles in
   *  synthesis.emergent_themes). */
  themeTitles: Set<string>;
}

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
    .replace(/["'„""«»''‚‹›]/g, '"')
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

function buildReelAnchorSet(input: ReelFromInputs): ReelAnchorSet {
  const ids = new Set<string>();
  const themeTitles = new Set<string>();
  const parts: string[] = [];
  for (const c of input.condensations) {
    ids.add(c.id);
    if (c.summary) parts.push(c.summary);
    collectStrings(c.featureRequests, parts);
    collectStrings(c.painPoints, parts);
    collectStrings(c.themes, parts);
  }
  for (const t of input.synthesis.emergent_themes) {
    themeTitles.add(t.title);
    // Synthesis-theme quotes are already verbatim per the synthesis schema
    // and the engine's anchored-filter — including them in the haystack
    // lets the model legitimately pick from the theme's curated quotes
    // without us re-deriving them.
    for (const q of t.quotes) parts.push(q);
  }
  return {
    ids,
    foldedHaystack: fold(parts.join(" \n ")),
    themeTitles,
  };
}

/** Drop highlights whose quote isn't a fold-substring OR whose interviewId
 *  isn't in the input set OR whose themeRef isn't a known synthesis theme. */
function applyReelAnchoredFilter(
  raw: HighlightReel,
  anchors: ReelAnchorSet,
): HighlightReel {
  const valid = raw.highlights.filter((h) => {
    if (!anchors.ids.has(h.interviewId)) return false;
    if (!anchors.themeTitles.has(h.themeRef)) return false;
    if (!anchors.foldedHaystack.includes(fold(h.quote))) return false;
    return true;
  });
  return {
    highlights: valid,
    summary: raw.summary,
  };
}

// ── Zero-token short-circuit ───────────────────────────────────────────────

interface TrivialCheck {
  trivial: boolean;
  reason?: "no_synthesis" | "no_themes" | "no_condensations" | "no_haystack";
}

function checkReelTrivial(input: ReelFromInputs): TrivialCheck {
  if (input.condensations.length === 0) {
    return { trivial: true, reason: "no_condensations" };
  }
  if (input.synthesis.emergent_themes.length === 0) {
    return { trivial: true, reason: "no_themes" };
  }
  // Re-build a minimal haystack check: if there's nothing in any
  // condensation evidence AND no synthesis-theme quote either, there's
  // literally nothing the model could quote — return empty reel without
  // spending tokens.
  const parts: string[] = [];
  for (const c of input.condensations) {
    if (c.summary) parts.push(c.summary);
    collectStrings(c.featureRequests, parts);
    collectStrings(c.painPoints, parts);
    collectStrings(c.themes, parts);
  }
  for (const t of input.synthesis.emergent_themes) {
    for (const q of t.quotes) parts.push(q);
  }
  const folded = fold(parts.join(" \n "));
  if (folded.length === 0) {
    return { trivial: true, reason: "no_haystack" };
  }
  return { trivial: false };
}

const TRIVIAL_SUMMARIES: Record<NonNullable<TrivialCheck["reason"]>, string> = {
  no_synthesis:
    "Für diese Studie liegt noch keine Synthese vor — sobald sie berechnet ist, kann hier ein Reel entstehen.",
  no_themes:
    "Die Synthese hat noch keine emergenten Themen identifiziert — ohne Themen gibt es nichts zu reelen.",
  no_condensations:
    "Für diese Studie liegen noch keine ausgewerteten Interviews vor — ohne Verdichtungen kein Reel.",
  no_haystack:
    "Die vorhandenen Verdichtungen enthalten kein zitierbares Material — Reel bleibt leer, kein Aufblähen.",
};

// ── Anthropic call (mirrors synthesis/engine.ts) ───────────────────────────

async function callReelClaude(
  userPrompt: string,
  attempt: number,
  model: string,
): Promise<HighlightReel> {
  const client = getAnthropicClient();
  const system =
    attempt > 0
      ? HIGHLIGHT_REEL_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble."
      : HIGHLIGHT_REEL_SYSTEM_PROMPT;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userPrompt }],
    },
    { timeout: 180_000, maxRetries: 1 },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new HighlightReelSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new HighlightReelSchemaError(
      "No JSON found in response",
      textBlock.text,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new HighlightReelSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = HighlightReelSchema.safeParse(parsed);
  if (!result.success) {
    throw new HighlightReelSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }
  return result.data;
}

// ── Pure-input entry (for evals) ───────────────────────────────────────────

/**
 * Pure entry — pass plan + synthesis + condensations explicitly, get the
 * filtered reel. NO Supabase. The eval harness drives this directly so we
 * can run hand-crafted cases without seeding the DB.
 *
 * Zero-token short-circuit fires BEFORE the LLM call when the inputs are
 * trivially unanswerable.
 */
export async function generateReelFromInputs(
  input: ReelFromInputs,
  model: string = process.env.HIGHLIGHT_MODEL ?? DEFAULT_HIGHLIGHT_MODEL,
): Promise<HighlightReel> {
  const trivial = checkReelTrivial(input);
  if (trivial.trivial) {
    return {
      highlights: [],
      summary: TRIVIAL_SUMMARIES[trivial.reason ?? "no_haystack"],
    };
  }

  const userPrompt = buildReelUserPrompt(input);
  const anchors = buildReelAnchorSet(input);

  let raw: HighlightReel;
  try {
    raw = await callReelClaude(userPrompt, 0, model);
  } catch (err) {
    if (!(err instanceof HighlightReelSchemaError)) {
      throw new HighlightReelUnavailableError(
        "Claude reel call failed",
        err,
      );
    }
    console.warn(
      "Reel schema validation failed on first attempt, retrying:",
      err.message,
    );
    try {
      raw = await callReelClaude(userPrompt, 1, model);
    } catch (err2) {
      if (err2 instanceof HighlightReelSchemaError) {
        throw new HighlightReelUnavailableError(
          "Claude reel returned invalid JSON twice",
          err2,
        );
      }
      throw new HighlightReelUnavailableError(
        "Claude reel call failed",
        err2,
      );
    }
  }

  return applyReelAnchoredFilter(raw, anchors);
}

// ── Database augmentation (mirrors chat-with-data) ─────────────────────────

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

type DatabaseWithReel = {
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
        Update: StudySynthesisInsert;
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

function createReelSupabase(): SupabaseClient<DatabaseWithReel> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithReel>(
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

// ── DB-driven entry ────────────────────────────────────────────────────────

export interface GenerateHighlightReelInput {
  orgId: string;
  planId: string;
}

/**
 * Public engine entry — loads plan + condensations + synthesis from Supabase,
 * calls generateReelFromInputs, returns the anchored reel.
 *
 * AUTH CONTRACT: the caller (API route) MUST have already verified that
 * `planId` belongs to `orgId` (via getResearchPlan). This function trusts
 * its inputs — same posture as synthesizeStudy / chatWithData.
 *
 * EDGE CASES (no LLM tokens spent on any of these):
 *   - Plan not found    → throws HighlightReelUnavailableError (route → 404)
 *   - No synthesis yet  → empty reel with honest summary
 *   - No condensations  → empty reel with honest summary
 *   - No themes         → empty reel with honest summary
 *   - No haystack       → empty reel with honest summary
 */
export async function generateHighlightReel(
  input: GenerateHighlightReelInput,
  model: string = process.env.HIGHLIGHT_MODEL ?? DEFAULT_HIGHLIGHT_MODEL,
): Promise<HighlightReel> {
  const supabase = createReelSupabase();

  const [planResp, insightsResp, synthResp] = await Promise.all([
    supabase
      .from("research_plans")
      .select("*")
      .eq("org_id", input.orgId)
      .eq("id", input.planId)
      .maybeSingle(),
    supabase
      .from("product_discovery_insights")
      .select("*")
      .eq("org_id", input.orgId)
      .eq("plan_id", input.planId)
      .order("analyzed_at", { ascending: true }),
    supabase
      .from("study_synthesis")
      .select("*")
      .eq("org_id", input.orgId)
      .eq("plan_id", input.planId)
      .maybeSingle(),
  ]);

  if (planResp.error || !planResp.data) {
    throw new HighlightReelUnavailableError(
      `Research plan ${input.planId} not found in this organization.`,
    );
  }
  if (insightsResp.error || !insightsResp.data) {
    throw new HighlightReelUnavailableError(
      `Failed to read insights for plan ${input.planId}: ${
        insightsResp.error?.message ?? "no rows"
      }`,
    );
  }

  // Honest zero-token short-circuit: no synthesis row, or synthesis exists but
  // was never actually computed (synthesized_at null) — return empty reel
  // without spending a single Opus token.
  if (
    !synthResp.data ||
    synthResp.data.synthesized_at === null ||
    (synthResp.data.emergent_themes as unknown as unknown[] | null)?.length ===
      undefined
  ) {
    return {
      highlights: [],
      summary: TRIVIAL_SUMMARIES.no_synthesis,
    };
  }

  const plan: ReelPlanContext = {
    title: planResp.data.title,
    objective: planResp.data.objective,
    persona: planResp.data.persona,
  };

  const condensations: ReelCondensationInput[] = insightsResp.data.map(
    (r) => ({
      id: r.source_call_id,
      summary: r.summary,
      featureRequests: (r.feature_requests as unknown as unknown[]) ?? [],
      painPoints: (r.pain_points as unknown as unknown[]) ?? [],
      themes: normalizeThemes(r.themes),
      respondentRole: r.respondent_role,
      respondentSegment: r.respondent_segment,
      sentiment: r.sentiment,
    }),
  );

  const synthesis: ReelSynthesisInput = {
    overview: synthResp.data.overview,
    emergent_themes:
      (synthResp.data.emergent_themes as unknown as ReelSynthesisTheme[]) ?? [],
  };

  return generateReelFromInputs({ plan, synthesis, condensations }, model);
}
