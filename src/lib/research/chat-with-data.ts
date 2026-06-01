import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { normalizeThemes } from "@/lib/schemas/product-discovery";
import { coerceStudyType } from "./plans-service";
import type { ResearchPlanStudyType } from "./db";
import type { Database, Json } from "@/types/database";

/**
 * "Frag-deine-Daten" — Chat-with-data over ONE study's verdichtungen +
 * Stage-2 synthesis. The researcher asks a natural-language question; the
 * engine answers STRICTLY from the supplied data — never from world
 * knowledge, never from speculation.
 *
 * Same anti-hallucination posture as synthesizeStudy:
 *   1. SCHEMA — Zod validates shape (answered/answer/citations).
 *   2. ID set — every cited interviewId must appear in the actual
 *      product_discovery_insights set for this plan.
 *   3. Fold-substring — every cited quote must be a verbatim substring of
 *      the verdichtungen / synthesis text (typography-folded).
 * If a "true" answer ends up with ALL citations unanchored after the
 * filter, the engine DOWNGRADES it to answered=false rather than letting
 * an uncited claim escape — never trust a model that loses its sources.
 *
 * COST GUARDRAIL: only verdichtungen + synthesis are loaded — NEVER the
 * raw calls.transcript. Stage-1 already distilled the signal; re-sending
 * transcripts multiplies token cost without adding evidence the chat can
 * use (the model has no access to the raw text outside this engine).
 *
 * Model: Opus by default (vertrauenskritisch — a wrong answer here costs
 * trust). Override via CHAT_WITH_DATA_MODEL env (Sonnet for eval-cycles,
 * Opus for production), mirroring SYNTHESIS_MODEL / HEALTH_MODEL.
 */

export const DEFAULT_CHAT_WITH_DATA_MODEL = CLAUDE_MODELS.opus;

// ── Output schema ──────────────────────────────────────────────────────────

const ChatCitationSchema = z.object({
  /** product_discovery_insights.source_call_id of the interview the quote
   *  comes from. Engine drops citations whose ids aren't in the actual
   *  input set. */
  interviewId: z.string().min(1).max(200),
  /** Verbatim quote — must appear literally in the verdichtung / synthesis
   *  haystack after typography folding. Engine drops paraphrased quotes. */
  quote: z.string().min(1).max(800),
});

const ChatResultSchema = z.object({
  answered: z.boolean(),
  /** German answer, 1-4 sentences. Short refusal when not answerable. */
  answer: z.string().min(1).max(2000),
  /** Zero or more anchored citations. Empty array when answered=false. */
  citations: z.array(ChatCitationSchema).max(8).default([]),
});

export type ChatCitation = z.infer<typeof ChatCitationSchema>;
export type ChatWithDataResult = z.infer<typeof ChatResultSchema>;

/** History entry — chat-message pair from the researcher's session. The
 *  engine threads these into the Anthropic messages list verbatim so the
 *  model has multi-turn continuity (e.g. "Und was war mit X?") without
 *  losing the data anchor. */
export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatWithDataInput {
  orgId: string;
  planId: string;
  question: string;
  history?: ChatHistoryTurn[];
}

// ── Error types ────────────────────────────────────────────────────────────

export class ChatWithDataUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ChatWithDataUnavailableError";
  }
}

// ── Pure-input shapes (eval entry) ─────────────────────────────────────────

export interface ChatInsightInput {
  /** source_call_id of the underlying call — the participant-identifying
   *  handle. The engine builds the anchor-id-set from these. */
  id: string;
  summary: string | null;
  /** Stage-1 jsonb arrays, passed through as-is. The model reads the
   *  per-item evidence (verbatim quotes) and titles. */
  featureRequests: unknown[];
  painPoints: unknown[];
  themes: unknown[];
  respondentRole: string | null;
  respondentSegment: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
}

export interface ChatSynthesisInput {
  overview: string | null;
  emergent_themes: unknown[];
  tensions: unknown[];
}

export interface ChatPlanContext {
  title: string;
  objective: string;
  persona: string | null;
  /**
   * M3 — display lens. Optional so eval callers of chatWithDataFromInputs that
   * don't set it stay byte-identical (treated as product_discovery). When
   * 'market_research', the data section labels the coded findings as MARKET
   * findings instead of product feature_requests — per-plan scoped, the
   * study_type comes from THIS plan, so there is no KPI / cross-plan
   * contamination. Pure display correctness (separation plan §M3 part 4).
   */
  studyType?: ResearchPlanStudyType;
}

export interface ChatFromInputs {
  plan: ChatPlanContext;
  insights: ChatInsightInput[];
  synthesis: ChatSynthesisInput | null;
  question: string;
  history?: ChatHistoryTurn[];
}

// ── System prompt (posture only — data dump is appended per-call) ──────────

/**
 * Posture rules. Data is appended via buildChatDataSection() so the system
 * prompt's stable prefix can be cached across turns of a chat session
 * (Anthropic prompt-caching). The question itself goes in the user message.
 */
export const CHAT_WITH_DATA_SYSTEM_PROMPT = `You are a careful B2B research analyst answering a researcher's question about a SINGLE study. The researcher is asking about findings, not browsing the world — your knowledge is STRICTLY limited to the verdichtungen (Stage-1 condensations of each interview) and the cross-call synthesis (Stage-2 overview + emergent themes + tensions) of THIS one study, both supplied in the SECTIONS below.

POSTURE — Answer ONLY from the supplied data.
- You do NOT have access to the raw interview transcripts. The verdichtungen and the synthesis ARE the data.
- You do NOT have general knowledge about this product, this market, this company, or B2B best practices. If the supplied data doesn't say it, you don't know it.
- NEVER invent a fact, a quote, an interview, or a respondent. NEVER paraphrase a quote into something the data doesn't literally contain.
- When the question CANNOT be answered from the supplied data, return answered=false with a short, honest German explanation ("Dazu liegt in dieser Studie keine Evidenz vor.") and an EMPTY citations array. Do NOT speculate. Do NOT bridge to a "general best practice". Do NOT extrapolate from one mention to a pattern.

ANCHORING RULES (the engine re-checks these post-parse and DROPS unanchored citations; an answered=true with all citations dropped is downgraded to answered=false):
- Every citation.interviewId MUST be one of the IDs listed under INSIGHTS below. Don't invent IDs. Don't use synthesis-internal IDs that aren't in the INSIGHTS list.
- Every citation.quote MUST be a verbatim substring of an evidence string, summary, title, description, or quote that appears under that interviewId's INSIGHT, OR a verbatim substring of the SYNTHESIS overview / themes / tensions text. No paraphrasing, no merging two phrases. The engine matches with typography folding (umlauts, smart quotes, en/em dashes, whitespace), so spelling-equivalents are fine — semantic-equivalents are NOT.
- A citation whose quote comes from the SYNTHESIS section should still reference an interviewId whose insight INDIVIDUALLY carries that signal (the synthesis already names sourceInsightIds per theme; pick one of those).
- A claim in your answer SHOULD be backed by at least one citation. If you can't cite, set answered=false.

WHEN THERE IS SOMETHING TO SAY (answered=true):
- Write the answer in German, 1-4 sentences, directly addressing the question. Concise — this is a chat, not a report.
- Include 1-3 citations from the strongest evidence. Each is { interviewId, quote }. Don't duplicate the same quote twice.
- If the question is about a count ("wie viele sagen X?"), the answer should state the count and cite at least one example. Don't over-count: only cite respondents whose verdichtung actually contains the signal.

WHEN THERE IS NOTHING TO SAY (answered=false):
- answer: a 1-sentence honest German refusal, e.g. "Dazu liegt in dieser Studie keine Evidenz vor." — or a more specific variant like "Die Frage zu X wurde in keinem Interview thematisiert."
- citations: []
- DO NOT manufacture a thin answer just to fill the field.

MULTI-TURN: prior turns are passed as message history. Re-cite when you make a new claim; don't assume the previous citation carries over to a new statement.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:

{
  "answered": <bool>,
  "answer": "<short German answer or honest refusal>",
  "citations": [
    { "interviewId": "<id from the INSIGHTS list>", "quote": "<verbatim quote>" }
  ]
}`;

// ── Data-section assembly ──────────────────────────────────────────────────

/** Honest fallback used when the engine's anchor filter drops every citation
 *  from a claimed-answered response. Keeps the participant from seeing an
 *  uncited claim. */
const ANCHOR_FALLBACK_ANSWER =
  "Dazu liegt in dieser Studie keine eindeutige Evidenz vor.";

/** Mirror of synthesis/prompts.ts formatInsight — same shape so a researcher
 *  reading a chat answer recognizes the same evidence the synthesis surfaced.
 *
 *  M3 — `studyType` only changes the LABEL of the coded-findings line. A market
 *  study stores its MARKET findings (categories PRICE_SENSITIVITY /
 *  PURCHASE_INTENT / COMPETITIVE_PERCEPTION / SEGMENT_NEED / BRAND_PERCEPTION)
 *  in the SAME `feature_requests` column (M1 reuse decision); labelling them
 *  "market_findings" stops the model from framing a price signal as a product
 *  feature request. Discovery (undefined / 'product_discovery') is byte-
 *  identical. Market rows carry pain_points=[] by construction, so that block
 *  simply never renders for them. */
function formatInsight(
  insight: ChatInsightInput,
  studyType?: ResearchPlanStudyType,
): string {
  const isMarket = studyType === "market_research";
  const lines: string[] = [
    `INSIGHT id=${insight.id}`,
    `  respondent: role=${insight.respondentRole ?? "—"}, segment=${
      insight.respondentSegment ?? "—"
    }, sentiment=${insight.sentiment ?? "—"}`,
  ];
  if (insight.summary && insight.summary.trim() !== "") {
    lines.push(`  summary: ${insight.summary.trim()}`);
  }
  if (insight.featureRequests.length > 0) {
    lines.push(
      isMarket
        ? `  market_findings: ${JSON.stringify(insight.featureRequests)}`
        : `  feature_requests: ${JSON.stringify(insight.featureRequests)}`,
    );
  }
  if (insight.painPoints.length > 0) {
    lines.push(`  pain_points: ${JSON.stringify(insight.painPoints)}`);
  }
  if (insight.themes.length > 0) {
    lines.push(`  themes: ${JSON.stringify(insight.themes)}`);
  }
  return lines.join("\n");
}

function formatSynthesisBlock(synth: ChatSynthesisInput): string {
  const lines: string[] = ["SYNTHESIS (Stage-2 cross-call result)"];
  if (synth.overview && synth.overview.trim() !== "") {
    lines.push(`overview: ${synth.overview.trim()}`);
  }
  if (synth.emergent_themes.length > 0) {
    lines.push(`emergent_themes: ${JSON.stringify(synth.emergent_themes)}`);
  }
  if (synth.tensions.length > 0) {
    lines.push(`tensions: ${JSON.stringify(synth.tensions)}`);
  }
  return lines.join("\n");
}

/** Build the data section appended to the system prompt. Stable across the
 *  turns of one chat session — Anthropic prompt-caching can pick this up
 *  unchanged when the same researcher fires a follow-up question on the
 *  same plan. */
function buildChatDataSection(input: ChatFromInputs): string {
  const planLines = [
    `STUDY PLAN`,
    `Title:     ${input.plan.title}`,
    `Objective: ${input.plan.objective}`,
  ];
  if (input.plan.persona && input.plan.persona.trim() !== "") {
    planLines.push(`Persona:   ${input.plan.persona.trim()}`);
  }
  // M3 — market lens hint (additive, market-only → discovery byte-identical).
  // Tells the model the coded findings are MARKET signals so it interprets the
  // category vocabulary correctly instead of as product feedback.
  if (input.plan.studyType === "market_research") {
    planLines.push(
      `Study type: Market research — the coded findings below are MARKET signals (price sensitivity, purchase intent, competitive perception, segment need, brand perception), not product feature requests.`,
    );
  }

  const insightsBlock =
    input.insights.length === 0
      ? "(no insights in this study — answered=false for any question)"
      : input.insights
          .map((i) => formatInsight(i, input.plan.studyType))
          .join("\n\n");

  const synthesisBlock = input.synthesis
    ? formatSynthesisBlock(input.synthesis)
    : "(no Stage-2 synthesis yet — rely on the per-interview INSIGHTS only)";

  return `${planLines.join("\n")}

INSIGHTS (${input.insights.length} verdichtete Interviews):

${insightsBlock}

${synthesisBlock}`;
}

// ── Anchor set (mirror of synthesis/engine.ts) ─────────────────────────────

interface ChatAnchorSet {
  /** interviewIds the model is allowed to cite (= source_call_ids of the
   *  loaded insights). */
  ids: Set<string>;
  /** Folded haystack of all per-insight evidence + summary + synthesis text.
   *  Citation quotes are substring-checked against this. */
  foldedHaystack: string;
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

function buildChatAnchorSet(
  insights: ChatInsightInput[],
  synthesis: ChatSynthesisInput | null,
): ChatAnchorSet {
  const ids = new Set<string>();
  const parts: string[] = [];
  for (const ins of insights) {
    ids.add(ins.id);
    if (ins.summary) parts.push(ins.summary);
    collectStrings(ins.featureRequests, parts);
    collectStrings(ins.painPoints, parts);
    collectStrings(ins.themes, parts);
  }
  if (synthesis) {
    if (synthesis.overview) parts.push(synthesis.overview);
    collectStrings(synthesis.emergent_themes, parts);
    collectStrings(synthesis.tensions, parts);
  }
  return { ids, foldedHaystack: fold(parts.join(" \n ")) };
}

function applyChatAnchoredFilter(
  raw: ChatWithDataResult,
  anchors: ChatAnchorSet,
): ChatWithDataResult {
  // Drop citations with unknown interviewId OR paraphrased (non-substring)
  // quotes. The order matters: a citation must pass BOTH checks.
  const validCitations = raw.citations.filter(
    (c) =>
      anchors.ids.has(c.interviewId) &&
      anchors.foldedHaystack.includes(fold(c.quote)),
  );

  // DOWNGRADE rule: if the model claimed answered=true but its citations
  // were ALL paraphrased / unknown-id, we don't trust the answer either.
  // The safe move is to flip to answered=false with the standard refusal.
  // (Special case: answered=true with ZERO citations from the model means
  // the model gave an unsourced claim — also flip to false.)
  if (raw.answered && validCitations.length === 0) {
    return {
      answered: false,
      answer: ANCHOR_FALLBACK_ANSWER,
      citations: [],
    };
  }

  // ENFORCE refusal contract: if answered=false the model MAY still have
  // produced "citations" out of habit — strip them. The UI / API contract
  // expects citations=[] on a refusal.
  if (!raw.answered) {
    return {
      answered: false,
      answer: raw.answer,
      citations: [],
    };
  }

  return {
    answered: true,
    answer: raw.answer,
    citations: validCitations,
  };
}

// ── Anthropic call ─────────────────────────────────────────────────────────

// ── Pure-input entry (for evals) ───────────────────────────────────────────

/**
 * Pure entry point — pass plan + insights + synthesis explicitly, get the
 * filtered chat result. NO Supabase. The eval harness drives this directly
 * so we can run hand-crafted cases without seeding the DB.
 *
 * Robust transport: forced tool-use via callClaudeStructured (no text-JSON
 * regex/parse). Multi-turn preserved: prior `history` turns are threaded BEFORE
 * the current question in `messages`; the data dump stays in `system` (not
 * repeated per turn). Fail-closed preserved (ChatWithDataUnavailableError);
 * the anchored-filter still strips unanchored citations afterward.
 */
export async function chatWithDataFromInputs(
  input: ChatFromInputs,
  model: string = process.env.CHAT_WITH_DATA_MODEL ??
    DEFAULT_CHAT_WITH_DATA_MODEL,
): Promise<ChatWithDataResult> {
  const systemPrompt = `${CHAT_WITH_DATA_SYSTEM_PROMPT}\n\n${buildChatDataSection(input)}`;
  const anchors = buildChatAnchorSet(input.insights, input.synthesis);

  // History threaded BEFORE the current question — the data context lives in
  // `system`, so each turn carries only its conversational text.
  const messages = [
    ...(input.history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: input.question },
  ];

  let raw: ChatWithDataResult;
  try {
    raw = await callClaudeStructured({
      schema: ChatResultSchema,
      system: systemPrompt,
      messages,
      model,
      maxTokens: 1024,
      toolName: "emit_chat_answer",
      toolDescription:
        "Return the answer to the researcher's question — answered, a short German answer, and verbatim citations (interviewId + quote) drawn only from the supplied data.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new ChatWithDataUnavailableError(
        "Claude chat returned invalid output twice",
        err,
      );
    }
    throw new ChatWithDataUnavailableError("Claude chat call failed", err);
  }

  return applyChatAnchoredFilter(raw, anchors);
}

// ── Database augmentation (mirrors synthesis/engine.ts) ────────────────────
//
// Same pattern as src/lib/synthesis/engine.ts — until src/types/database.ts
// is regenerated post-migrations, we declare the new tables (study_synthesis)
// and new columns (product_discovery_insights.{respondent_*, plan_id,
// respondent_source}) inline so supabase-js's .from(...).select narrows
// correctly. Object-literal types, not Partial<Row> — see synthesis/engine.ts
// for the rationale.

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
  // M3 — optional/nullable on purpose: select("*") does not return the column
  // before the 20260630000000 migration is applied; coerceStudyType maps the
  // resulting undefined → 'product_discovery' (byte-identical pre-migration).
  study_type?: string | null;
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

type DatabaseWithChat = {
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

function createChatSupabase(): SupabaseClient<DatabaseWithChat> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithChat>(
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

/**
 * Public engine entry — loads plan + insights + synthesis from Supabase,
 * calls chatWithDataFromInputs, returns the anchored result.
 *
 * AUTH CONTRACT: the caller (API route) MUST have already verified that
 * `planId` belongs to `orgId` (via getResearchPlan). This function trusts
 * its inputs — same posture as synthesizeStudy.
 *
 * EDGE CASES:
 *   - Plan not found  → throws ChatWithDataUnavailableError (route maps to 404)
 *   - No insights yet → returns answered=false with a friendly "Studie hat
 *     noch keine Daten" message, NO LLM call (zero token spend on a study
 *     that physically can't be answered yet).
 *   - No synthesis yet → still answerable from insights alone; the system
 *     prompt notes the absence.
 */
export async function chatWithData(
  input: ChatWithDataInput,
  model: string = process.env.CHAT_WITH_DATA_MODEL ??
    DEFAULT_CHAT_WITH_DATA_MODEL,
): Promise<ChatWithDataResult> {
  const supabase = createChatSupabase();

  // Plan + insights + synthesis loaded in parallel — independent reads, all
  // org-scoped, same shape contract as synthesizeStudy.
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
    throw new ChatWithDataUnavailableError(
      `Research plan ${input.planId} not found in this organization.`,
    );
  }
  if (insightsResp.error || !insightsResp.data) {
    throw new ChatWithDataUnavailableError(
      `Failed to read insights for plan ${input.planId}: ${
        insightsResp.error?.message ?? "no rows"
      }`,
    );
  }

  if (insightsResp.data.length === 0) {
    // Zero-token short-circuit: a chat over a study with no verdichtete
    // Interviews can never produce a citation — answer honestly without
    // calling Opus.
    return {
      answered: false,
      answer:
        "Für diese Studie liegen noch keine ausgewerteten Interviews vor. Sobald Verdichtungen vorliegen, kann ich Fragen dazu beantworten.",
      citations: [],
    };
  }

  const plan: ChatPlanContext = {
    title: planResp.data.title,
    objective: planResp.data.objective,
    persona: planResp.data.persona,
    // M3 — display lens for THIS plan only (per-plan scoped, no contamination).
    studyType: coerceStudyType(planResp.data.study_type),
  };

  const insights: ChatInsightInput[] = insightsResp.data.map((r) => ({
    id: r.source_call_id,
    summary: r.summary,
    featureRequests: (r.feature_requests as unknown as unknown[]) ?? [],
    painPoints: (r.pain_points as unknown as unknown[]) ?? [],
    themes: normalizeThemes(r.themes),
    respondentRole: r.respondent_role,
    respondentSegment: r.respondent_segment,
    sentiment: r.sentiment,
  }));

  const synthesis: ChatSynthesisInput | null = synthResp.data
    ? {
        overview: synthResp.data.overview,
        emergent_themes:
          (synthResp.data.emergent_themes as unknown as unknown[]) ?? [],
        tensions: (synthResp.data.tensions as unknown as unknown[]) ?? [],
      }
    : null;

  return chatWithDataFromInputs(
    {
      plan,
      insights,
      synthesis,
      question: input.question,
      history: input.history,
    },
    model,
  );
}
