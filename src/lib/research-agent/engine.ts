import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getStudySynthesis } from "@/lib/synthesis/service";
import {
  ResearchAgentResponseSchema,
  type DeliverableItem,
  type ResearchAgentHistoryTurn,
  type ResearchAgentRequest,
  type ResearchAgentResponse,
} from "@/lib/schemas/research-agent";
import {
  buildResearchAgentDataSection,
  RESEARCH_AGENT_SYSTEM_PROMPT,
  type ResearchAgentFromInputs,
  type ResearchAgentSynthesisInput,
} from "./prompts";

/**
 * Research-Agent engine — turns a researcher's free-text instruction into a
 * structured deliverable grounded in a study synthesis. OUTPUT-oriented
 * sibling of chatWithData: same anchor-fold discipline + callClaude retry, but
 * it BUILDS a deliverable (summary / breakdown / ranking) instead of answering
 * a question, and its evidence is the synthesis ALONE (no raw transcripts —
 * DSGVO + token cost).
 *
 * The anti-hallucination guarantee is the PRIMARY contract: every surfaced item
 * is re-checked against the synthesis and DROPPED if unanchored; a deliverable
 * whose items are all dropped is downgraded to an honest refusal. A research
 * agent that fabricates findings is worthless/dangerous — better
 * "steht nicht in den Daten" than invented.
 *
 * Model: default decided by the eval (RESEARCH_AGENT_MODEL env override).
 * evals-research-agent measured Sonnet and Opus EXACTLY ONCE each: both pass the
 * anti-hallucination gate identically (anchor-pass 9/9, impossible-numbers 0/9,
 * refusals 4/4) with ZERO raw leakage. Because the anchor FILTER enforces the
 * safety guarantee independent of the model — a weaker model can only cause
 * more honest refusals, never a hallucination — the default is the cheaper,
 * lower-latency Sonnet (same eval-driven posture as DEFAULT_LOSS_MODEL). Set
 * RESEARCH_AGENT_MODEL=claude-opus-4-7 to run the deepest model for
 * higher-stakes deliverables.
 */

export const DEFAULT_RESEARCH_AGENT_MODEL = CLAUDE_MODELS.sonnet;

/** Honest fallback when the anchor filter drops every item of a claimed
 *  deliverable — never let an unanchored deliverable escape. */
const RESEARCH_AGENT_REFUSAL_NOTE =
  "Dazu liegt in dieser Synthese keine eindeutige Evidenz vor.";

// ── Error types (mirror chat-with-data) ─────────────────────────────────────

class ResearchAgentSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "ResearchAgentSchemaError";
  }
}

export class ResearchAgentUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ResearchAgentUnavailableError";
  }
}

// ── Anchor set (mirror of chat-with-data fold/collectStrings) ───────────────

export interface SynthesisAnchorSet {
  /** Folded theme titles + tension descriptions — the legal `themeRefs`. */
  findingRefs: Set<string>;
  /** Folded haystack of every synthesis string (titles, summaries, quotes,
   *  tension descriptions, side labels, overview). Item anchors are
   *  substring-checked against this. */
  foldedHaystack: string;
}

/** Typography fold — identical to chat-with-data so anchoring is consistent
 *  across the two engines (umlauts, smart quotes, dashes, whitespace, case). */
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

/**
 * Build the anchor set from the SYNTHESIS ONLY — plan context is framing, not
 * evidence, so it never enters the haystack (a claim can't be "anchored" to the
 * study objective). Every theme/tension string is flattened recursively.
 */
export function buildSynthesisAnchorSet(
  synthesis: ResearchAgentSynthesisInput,
): SynthesisAnchorSet {
  const findingRefs = new Set<string>();
  const parts: string[] = [];
  if (synthesis.overview) parts.push(synthesis.overview);
  for (const theme of synthesis.emergent_themes) {
    findingRefs.add(fold(theme.title));
    collectStrings(theme, parts);
  }
  for (const tension of synthesis.tensions) {
    findingRefs.add(fold(tension.description));
    collectStrings(tension, parts);
  }
  return { findingRefs, foldedHaystack: fold(parts.join(" \n ")) };
}

// ── Anchor filter (the guarantee) ───────────────────────────────────────────

export interface AnchorFilterStats {
  rawItemCount: number;
  keptItemCount: number;
  /** Items removed entirely because nothing anchored them. */
  droppedItemCount: number;
  /** Paraphrased / fabricated quotes stripped from surviving items. */
  strippedQuoteCount: number;
  /** Invented theme refs stripped from surviving items. */
  strippedThemeRefCount: number;
  /** fulfilled flipped true→false because every item was dropped. */
  downgraded: boolean;
}

function refusal(
  deliverableType: ResearchAgentResponse["deliverableType"],
  note: string,
): ResearchAgentResponse {
  return { fulfilled: false, deliverableType, title: "", items: [], note };
}

/**
 * Re-check each item against the synthesis. An anchor (themeRef or quote) is
 * valid iff its folded form is a substring of the folded haystack. Invalid
 * anchors are stripped; an item with ZERO valid anchors left is dropped
 * (an unanchored claim). If fulfilled=true but every item is dropped, the whole
 * deliverable is downgraded to an honest refusal — same DOWNGRADE rule as
 * applyChatAnchoredFilter.
 */
function applyAnchorFilter(
  raw: ResearchAgentResponse,
  anchors: SynthesisAnchorSet,
): { filtered: ResearchAgentResponse; stats: AnchorFilterStats } {
  const baseStats: AnchorFilterStats = {
    rawItemCount: raw.items.length,
    keptItemCount: 0,
    droppedItemCount: raw.items.length,
    strippedQuoteCount: 0,
    strippedThemeRefCount: 0,
    downgraded: false,
  };

  // Refusal contract: a refusal carries no items, whatever the model emitted.
  if (!raw.fulfilled) {
    return {
      filtered: refusal(
        raw.deliverableType,
        raw.note.trim() !== "" ? raw.note : RESEARCH_AGENT_REFUSAL_NOTE,
      ),
      stats: baseStats,
    };
  }

  let strippedQuoteCount = 0;
  let strippedThemeRefCount = 0;
  const keptItems: DeliverableItem[] = [];

  for (const item of raw.items) {
    const validThemeRefs = item.themeRefs.filter(
      (r) => fold(r) !== "" && anchors.foldedHaystack.includes(fold(r)),
    );
    const validQuotes = item.quotes.filter(
      (q) => fold(q) !== "" && anchors.foldedHaystack.includes(fold(q)),
    );
    strippedThemeRefCount += item.themeRefs.length - validThemeRefs.length;
    strippedQuoteCount += item.quotes.length - validQuotes.length;

    // Unanchored claim → drop the whole item.
    if (validThemeRefs.length === 0 && validQuotes.length === 0) continue;

    keptItems.push({
      heading: item.heading,
      text: item.text,
      themeRefs: validThemeRefs,
      quotes: validQuotes,
    });
  }

  const droppedItemCount = raw.items.length - keptItems.length;

  // DOWNGRADE: claimed fulfilled but nothing survived the anchor check.
  if (keptItems.length === 0) {
    return {
      filtered: refusal(raw.deliverableType, RESEARCH_AGENT_REFUSAL_NOTE),
      stats: {
        ...baseStats,
        strippedQuoteCount,
        strippedThemeRefCount,
        downgraded: true,
      },
    };
  }

  return {
    filtered: {
      fulfilled: true,
      deliverableType: raw.deliverableType,
      title: raw.title,
      items: keptItems,
      note: "",
    },
    stats: {
      rawItemCount: raw.items.length,
      keptItemCount: keptItems.length,
      droppedItemCount,
      strippedQuoteCount,
      strippedThemeRefCount,
      downgraded: false,
    },
  };
}

// ── Anthropic call (mirror callChatClaude; multi-turn since Etappe 2) ───────

/**
 * Structured-output tool. Forcing this tool (tool_choice) makes the model
 * return its deliverable as a tool_use block whose `input` the SDK hands back
 * already parsed — so a malformed-JSON failure (e.g. an unescaped quote inside
 * a prose value, which reliably broke free-text JSON parsing on the number-trap
 * case) is structurally impossible. The schema mirrors ResearchAgentResponse;
 * only `fulfilled` (top) and item `text` are required — Zod fills every other
 * default, so a refusal (just fulfilled+note) still parses.
 */
const RESEARCH_AGENT_TOOL: Anthropic.Tool = {
  name: "emit_deliverable",
  description:
    "Return the structured research deliverable — or an honest refusal — for the researcher's instruction, grounded STRICTLY in the supplied synthesis. Call this exactly once with the complete result.",
  input_schema: {
    type: "object",
    properties: {
      fulfilled: {
        type: "boolean",
        description:
          "false if the instruction cannot be fulfilled from THIS synthesis (it asks for data the synthesis does not contain). On a refusal: empty items + a 1-sentence note.",
      },
      deliverableType: {
        type: "string",
        enum: ["summary", "breakdown", "theme_ranking", "custom"],
        description:
          "The kind of deliverable the instruction asked for. Use 'custom' if genuinely unsure.",
      },
      title: {
        type: "string",
        description:
          "Short German headline for the whole deliverable. Empty on refusal.",
      },
      items: {
        type: "array",
        description:
          "The deliverable body — one entry per bullet / ranked theme / breakdown part. Empty on refusal.",
        items: {
          type: "object",
          properties: {
            heading: {
              type: "string",
              description: "Short German label for this unit, or empty.",
            },
            text: {
              type: "string",
              description: "The German deliverable prose for this unit.",
            },
            themeRefs: {
              type: "array",
              items: { type: "string" },
              description:
                "Verbatim emergent-theme titles or tension descriptions copied from the synthesis that ground this item.",
            },
            quotes: {
              type: "array",
              items: { type: "string" },
              description:
                "Verbatim source-language quotes copied from the synthesis. NEVER translated.",
            },
          },
          required: ["text"],
        },
      },
      note: {
        type: "string",
        description:
          "Empty when fulfilled=true; a 1-sentence honest German refusal when fulfilled=false.",
      },
    },
    required: ["fulfilled"],
  },
};

async function callResearchAgentClaude(
  instruction: string,
  systemPrompt: string,
  history: ResearchAgentHistoryTurn[] | undefined,
  attempt: number,
  model: string,
): Promise<ResearchAgentResponse> {
  const client = getAnthropicClient();
  const system =
    attempt > 0
      ? systemPrompt +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble."
      : systemPrompt;

  // Multi-turn: prior turns are threaded in BEFORE the current instruction so a
  // follow-up ("mach das kürzer", "jetzt nach Segment") has conversational
  // continuity — exactly like callChatClaude. The synthesis data section lives
  // in `system` (cacheable, not repeated per turn). The history is conversation
  // context ONLY: it is NEVER added to the anchor haystack (that is rebuilt from
  // the synthesis alone in runResearchAgentDiagnostics), so a follow-up cannot
  // launder an un-grounded finding through a prior assistant turn — the anchor
  // filter re-checks every item against the fresh synthesis regardless.
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: instruction },
  ];

  // No `temperature` — Opus 4.7 rejects the parameter (400). max_tokens is
  // higher than chat-with-data's 1024 because a deliverable can run to ~20
  // anchored items.
  //
  // FORCED TOOL-USE: we force a single structured tool call instead of asking
  // for JSON in free text. The SDK returns `tool_use.input` as an already-
  // parsed object, so a malformed-JSON failure (the unescaped-quote break that
  // reliably hit the number-trap case) is structurally impossible. Posture +
  // anchoring still come entirely from `system`; only the OUTPUT CHANNEL
  // changed, so the deliverable content the model produces is unchanged.
  const response = await client.messages.create(
    {
      model,
      max_tokens: 2048,
      system,
      messages,
      tools: [RESEARCH_AGENT_TOOL],
      tool_choice: { type: "tool", name: RESEARCH_AGENT_TOOL.name },
    },
    { timeout: 120_000, maxRetries: 1 },
  );

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new ResearchAgentSchemaError(
      "No tool_use block in response",
      JSON.stringify(response.content),
    );
  }

  // `toolUse.input` is already a parsed object — Zod fills defaults for any
  // omitted optional field (a refusal of just { fulfilled, note } still
  // parses). No JSON.parse, no regex — the brittle path is gone.
  const result = ResearchAgentResponseSchema.safeParse(toolUse.input);
  if (!result.success) {
    throw new ResearchAgentSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(toolUse.input),
    );
  }
  return result.data;
}

// ── Diagnostics entry (the eval drives this) ────────────────────────────────

/** Raw (pre-filter) + filtered (the guarantee) output plus the filter stats.
 *  The eval measures the filtered guarantee AND the raw model quality (how much
 *  the filter had to strip — lower = a more trustworthy model). */
export interface ResearchAgentDiagnostics extends AnchorFilterStats {
  raw: ResearchAgentResponse;
  filtered: ResearchAgentResponse;
}

/**
 * Pure entry point — pass plan context + synthesis + instruction explicitly,
 * get back BOTH the raw model output and the anchor-filtered deliverable. NO
 * Supabase. The eval harness drives this so hand-crafted synthetic syntheses
 * can be tested without seeding the DB.
 */
export async function runResearchAgentDiagnostics(
  input: ResearchAgentFromInputs,
  model: string = process.env.RESEARCH_AGENT_MODEL ??
    DEFAULT_RESEARCH_AGENT_MODEL,
): Promise<ResearchAgentDiagnostics> {
  const systemPrompt = `${RESEARCH_AGENT_SYSTEM_PROMPT}\n\n${buildResearchAgentDataSection(
    input,
  )}`;
  // The anchor haystack is rebuilt from the SYNTHESIS ALONE on every turn —
  // input.history is deliberately NOT passed here. This is the multi-turn
  // anti-hallucination guarantee: a follow-up's items are re-checked against
  // the fresh synthesis, never against the conversation, so prior turns can
  // never widen what counts as "grounded".
  const anchors = buildSynthesisAnchorSet(input.synthesis);

  let raw: ResearchAgentResponse;
  try {
    raw = await callResearchAgentClaude(
      input.instruction,
      systemPrompt,
      input.history,
      0,
      model,
    );
  } catch (err) {
    if (!(err instanceof ResearchAgentSchemaError)) {
      throw new ResearchAgentUnavailableError(
        "Claude research-agent call failed",
        err,
      );
    }
    console.warn(
      "Research-agent schema validation failed on first attempt, retrying:",
      err.message,
    );
    try {
      raw = await callResearchAgentClaude(
        input.instruction,
        systemPrompt,
        input.history,
        1,
        model,
      );
    } catch (err2) {
      if (err2 instanceof ResearchAgentSchemaError) {
        throw new ResearchAgentUnavailableError(
          "Claude research-agent returned invalid JSON twice",
          err2,
        );
      }
      throw new ResearchAgentUnavailableError(
        "Claude research-agent call failed",
        err2,
      );
    }
  }

  const { filtered, stats } = applyAnchorFilter(raw, anchors);
  return { raw, filtered, ...stats };
}

/**
 * Pure entry point — the production-shaped function. Returns ONLY the
 * anchor-filtered deliverable (the safe output). A thin wrapper over the
 * diagnostics so there is a single code path.
 */
export async function runResearchAgentFromInputs(
  input: ResearchAgentFromInputs,
  model: string = process.env.RESEARCH_AGENT_MODEL ??
    DEFAULT_RESEARCH_AGENT_MODEL,
): Promise<ResearchAgentResponse> {
  return (await runResearchAgentDiagnostics(input, model)).filtered;
}

// ── DB-driven entry (UNWIRED — Etappe 2 attaches a route to this) ───────────

/**
 * Public engine entry — loads the plan + synthesis via the CANONICAL readers
 * (getResearchPlan, getStudySynthesis — no parallel data path), then calls
 * runResearchAgentFromInputs. Reads only; persists nothing (Etappe 2).
 *
 * AUTH CONTRACT: the caller MUST have authenticated the user against `orgId`
 * before calling — both readers are org-scoped trust boundaries.
 *
 * EDGE CASES:
 *   - Plan not found    → throws ResearchAgentUnavailableError (route → 404).
 *   - No / empty synthesis → honest fulfilled=false, NO LLM call (zero-token
 *     short-circuit: a deliverable needs a synthesis to ground in).
 */
export async function runResearchAgent(
  request: ResearchAgentRequest,
  model: string = process.env.RESEARCH_AGENT_MODEL ??
    DEFAULT_RESEARCH_AGENT_MODEL,
): Promise<ResearchAgentResponse> {
  const [plan, synthesis] = await Promise.all([
    getResearchPlan(request.orgId, request.planId),
    getStudySynthesis(request.orgId, request.planId),
  ]);

  if (!plan) {
    throw new ResearchAgentUnavailableError(
      `Research plan ${request.planId} not found in this organization.`,
    );
  }

  const hasSynthesis =
    synthesis !== null &&
    (synthesis.emergent_themes.length > 0 ||
      synthesis.tensions.length > 0 ||
      (synthesis.overview !== null && synthesis.overview.trim() !== ""));

  if (!synthesis || !hasSynthesis) {
    return {
      fulfilled: false,
      deliverableType: "custom",
      title: "",
      items: [],
      note: "Für diese Studie liegt noch keine Synthese vor. Sobald eine Synthese berechnet wurde, kann ich daraus Deliverables erstellen.",
    };
  }

  return runResearchAgentFromInputs(
    {
      plan: {
        title: plan.title,
        objective: plan.objective,
        persona: plan.persona,
      },
      synthesis: {
        overview: synthesis.overview,
        emergent_themes: synthesis.emergent_themes,
        tensions: synthesis.tensions,
        basedOnCount: synthesis.based_on_count,
      },
      instruction: request.instruction,
      // Multi-turn (Etappe 2). Conversation context only — the anchor haystack
      // above is built from `synthesis` alone, never from these turns.
      history: request.history,
    },
    model,
  );
}
