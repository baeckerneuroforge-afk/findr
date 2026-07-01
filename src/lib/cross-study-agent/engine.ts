import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import {
  cachedSystem,
  withCacheBreakpointOnLastMessage,
} from "@/lib/anthropic/cache";
import {
  applyMissionControlAnchorFilter,
  buildMissionControlAnchorSet,
} from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import type {
  MissionControlHistoryTurn,
  MissionControlResult,
} from "@/lib/schemas/mission-control";
import {
  CrossStudyAgentResultSchema,
  type CrossStudyAgentRequest,
  type CrossStudyAgentResult,
} from "@/lib/schemas/cross-study-agent";
import {
  CROSS_STUDY_AGENT_SYSTEM_PROMPT,
  formatAggregateResultForTool,
  formatStudyBlockForTool,
  formatStudyIndexForTool,
} from "./prompts";
import {
  aggregateThemeFrequency,
  AGGREGATE_THEME_FREQUENCY_TOOL,
  createOrgToolset,
  LIST_STUDIES_TOOL,
  LOAD_SYNTHESIS_TOOL,
  type CrossStudyToolset,
} from "./tools";

/**
 * Cross-Study-Agent engine — the agentic LOOP-KERN. This is the one NEW
 * primitive: callClaudeStructured is single-shot forced tool-use and cannot
 * loop, so the research loop is hand-rolled here. The CITATION guarantee is
 * reused from Mission-Control, so the iteration changes only WHICH studies form
 * the haystack, never HOW citations are filtered.
 *
 * Two phases:
 *  1. RESEARCH LOOP — the model drives list_studies → load_synthesis →
 *     aggregate_theme_frequency (real tool-use, tool_choice auto), bounded by a
 *     HARD step budget. It builds the set of ACTUALLY-loaded studies. Its free
 *     text is NEVER the answer.
 *  2. FINAL EMIT — a forced emit_cross_study_answer (the model may also emit
 *     itself inside the loop when done), validated by CrossStudyAgentResultSchema,
 *     whose {answered, answer, citations} subset is run through
 *     applyMissionControlAnchorFilter against the per-study anchor map of ONLY the
 *     loaded studies. A citation to an unloaded study has no haystack entry →
 *     dropped; a wrong-study / paraphrased quote → dropped; all dropped → honest
 *     refusal. Identical CITATION guarantee to Mission-Control.
 *
 * Bau 2 — the anchor filter guards CITATIONS, not PROSE (plan §6). Two additive
 * guardrails close that gap as far as it can be closed:
 *  - aggregate_theme_frequency: cross-study COUNTS are computed deterministically
 *    in code (tools.ts), so a "in N studies" claim is a reported tool number, not
 *    an estimate (prompt forbids estimating one).
 *  - interpretation: a soft trend/pattern observation that can be backed by
 *    NEITHER an exact count NOR per-study citations goes in the additive,
 *    clearly-non-evidenced `interpretation` field (re-attached around the filter,
 *    cleared on refusal) — never asserted as fact in `answer`. The residual soft
 *    space stays honestly bounded (it is prompt/UI discipline, not a hard filter).
 *
 * Model: Opus by default (parity with Mission-Control — trust-critical). Override
 * via CROSS_STUDY_AGENT_MODEL.
 *
 * Fail-closed: any transport failure, or a final answer that won't validate
 * after one forced retry, throws CrossStudyAgentUnavailableError. It NEVER
 * returns un-anchored content.
 */

export const DEFAULT_CROSS_STUDY_AGENT_MODEL = CLAUDE_MODELS.opus;

/** Hard upper bound on research-loop turns. The agent must list + load within
 *  this many model turns; on overrun we force ONE final emit (so it always
 *  terminates with a safe answer, never hangs). */
const STEP_BUDGET = 10;
const MAX_TOKENS = 1500;
const EMIT_TOOL_NAME = "emit_cross_study_answer";

export class CrossStudyAgentUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "CrossStudyAgentUnavailableError";
  }
}

// ── emit tool (final answer) — schema derived from CrossStudyAgentResultSchema ─

/** The forced final-answer tool. Its input_schema is derived from
 *  CrossStudyAgentResultSchema (Mission-Control's {answered, answer, citations}
 *  PLUS the additive `interpretation` field; io:"input", so defaulted fields
 *  aren't required). The grounded subset is still a MissionControlResult, so the
 *  anchor filter is reused verbatim; the engine re-attaches interpretation. */
function buildEmitTool(): Anthropic.Tool {
  const jsonSchema = z.toJSONSchema(CrossStudyAgentResultSchema, {
    target: "draft-2020-12",
    io: "input",
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return {
    name: EMIT_TOOL_NAME,
    description:
      "Return the final cross-study answer — answered, a short German answer, verbatim citations (studyId + quote) each drawn ONLY from a study you LOADED, and an OPTIONAL `interpretation` (a clearly non-evidenced soft observation; usually empty, never a fact or a number). Call exactly once when research is done.",
    input_schema: jsonSchema as unknown as Anthropic.Tool.InputSchema,
  };
}
const EMIT_TOOL = buildEmitTool();

// ── diagnostics (the eval drives this) ──────────────────────────────────────

export interface CrossStudyAgentDiagnostics {
  /** The emit result BEFORE the anchor filter (raw model output). */
  raw: CrossStudyAgentResult;
  /** The anchor-filtered answer — the guarantee handed to the user. */
  filtered: CrossStudyAgentResult;
  /** studyIds the agent ACTUALLY loaded via load_synthesis (the citation
   *  universe + the tool-use recall/precision ground for the eval). */
  loadedStudyIds: string[];
  /** Research-loop turns taken (≤ STEP_BUDGET). */
  steps: number;
  listCallCount: number;
  loadCallCount: number;
  /** aggregate_theme_frequency calls — the deterministic-count discipline the
   *  eval checks (a "in N studies" claim must be backed by a tool call). */
  aggregateCallCount: number;
  toolCallCount: number;
  /** True if the loop exhausted the budget and we had to force the final emit. */
  hitBudget: boolean;
  /** True if the final answer came from the forced-emit fallback, not a model
   *  emit inside the loop. */
  forcedEmit: boolean;
  /** Citations the per-study anchor check rejected. */
  droppedCitationCount: number;
  /** answered=true flipped to a refusal because every citation was dropped. */
  downgraded: boolean;
}

function readStudyId(input: unknown): string | null {
  if (input && typeof input === "object" && "studyId" in input) {
    const v = (input as Record<string, unknown>).studyId;
    return typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return null;
}

function readThemeQuery(input: unknown): string | null {
  if (input && typeof input === "object" && "themeQuery" in input) {
    const v = (input as Record<string, unknown>).themeQuery;
    return typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return null;
}

/**
 * Forced final emit — used when the research loop ends (budget) without the model
 * having emitted. The model is FORCED to answer now, grounded ONLY in what it
 * loaded. One schema retry, then fail-closed.
 */
async function forceFinalEmit(
  client: Anthropic,
  model: string,
  baseMessages: Anthropic.MessageParam[],
): Promise<CrossStudyAgentResult> {
  const messages: Anthropic.MessageParam[] = [
    ...baseMessages,
    {
      role: "user",
      content:
        "Beende jetzt. Rufe emit_cross_study_answer genau einmal auf — nutze ausschließlich die bereits geladenen Studien. Wenn sie die Frage nicht stützen: answered=false mit leerem citations-Array.",
    },
  ];

  for (let attempt = 0; attempt <= 1; attempt++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          system: cachedSystem(CROSS_STUDY_AGENT_SYSTEM_PROMPT),
          messages: withCacheBreakpointOnLastMessage(messages),
          // VOLLE Tool-Liste beibehalten (identisch zum Loop): tool_choice
          // erzwingt ohnehin den Emit; eine geschrumpfte Tool-Liste würde nur
          // den gecachten Präfix aller Loop-Steps brechen (Cache-Reihenfolge:
          // tools → system → messages).
          tools: [
            LIST_STUDIES_TOOL,
            LOAD_SYNTHESIS_TOOL,
            AGGREGATE_THEME_FREQUENCY_TOOL,
            EMIT_TOOL,
          ],
          tool_choice: { type: "tool", name: EMIT_TOOL_NAME },
        },
        { timeout: 120_000, maxRetries: 1 },
      );
    } catch (err) {
      throw new CrossStudyAgentUnavailableError(
        "Cross-study agent final-emit call failed",
        err,
      );
    }
    const tu = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (tu) {
      const parsed = CrossStudyAgentResultSchema.safeParse(tu.input);
      if (parsed.success) return parsed.data;
    }
    messages.push({
      role: "assistant",
      content: response.content as Anthropic.ContentBlockParam[],
    });
    messages.push({
      role: "user",
      content:
        "Das emit_cross_study_answer-Schema war ungültig. Rufe es erneut mit { answered:boolean, answer:string, citations:[{studyId:string, quote:string}] } auf.",
    });
  }

  throw new CrossStudyAgentUnavailableError(
    "Cross-study agent could not produce a valid final answer (schema invalid twice)",
  );
}

/**
 * Pure entry — drive the loop with an injected toolset (production: org-backed;
 * eval: fixture-backed fake tools), return BOTH the raw emit and the
 * anchor-filtered answer plus loop stats. NO Supabase here — the toolset owns
 * data access — so the eval can run hand-crafted multi-study scenarios.
 */
export async function runCrossStudyAgentDiagnostics(
  toolset: CrossStudyToolset,
  question: string,
  history?: MissionControlHistoryTurn[],
  model: string = process.env.CROSS_STUDY_AGENT_MODEL ??
    DEFAULT_CROSS_STUDY_AGENT_MODEL,
): Promise<CrossStudyAgentDiagnostics> {
  const client = getAnthropicClient();

  // History is conversational context ONLY — it is never folded into any anchor
  // haystack (the haystack is rebuilt from the loaded studies alone), so a prior
  // turn can never widen what counts as grounded.
  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: question },
  ];

  const loadedById = new Map<string, MissionControlSynthesisInput>();
  let listCallCount = 0;
  let loadCallCount = 0;
  let aggregateCallCount = 0;
  let steps = 0;
  let hitBudget = false;
  let forcedEmit = false;
  let rawEmit: CrossStudyAgentResult | null = null;

  while (steps < STEP_BUDGET) {
    steps++;
    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          // Prompt-Caching (Muster interviewer.ts): Breakpoint auf System
          // (deckt die Tool-Defs davor mit) + auf der letzten stabilen
          // Message — jeder Step verlängert den gecachten Präfix des
          // vorherigen statt den wachsenden Kontext (inkl. großer
          // load_synthesis-Results) jede Runde voll zu bezahlen.
          system: cachedSystem(CROSS_STUDY_AGENT_SYSTEM_PROMPT),
          messages: withCacheBreakpointOnLastMessage(messages),
          tools: [
            LIST_STUDIES_TOOL,
            LOAD_SYNTHESIS_TOOL,
            AGGREGATE_THEME_FREQUENCY_TOOL,
            EMIT_TOOL,
          ],
          // Force SOME tool on the first turn (the agent must act, not free-
          // text); auto afterwards so it controls when to load / aggregate / emit.
          tool_choice: steps === 1 ? { type: "any" } : { type: "auto" },
        },
        { timeout: 120_000, maxRetries: 1 },
      );
    } catch (err) {
      throw new CrossStudyAgentUnavailableError(
        "Cross-study agent research call failed",
        err,
      );
    }

    messages.push({
      role: "assistant",
      content: response.content as Anthropic.ContentBlockParam[],
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      // Free text instead of a tool. We NEVER use that text as the answer (no
      // scratchpad leak — plan §5). Nudge back to the tools; budget bounds it.
      messages.push({
        role: "user",
        content:
          "Bitte rufe ein Tool auf — list_studies, load_synthesis oder emit_cross_study_answer. Gib keine Freitext-Antwort; nur emit_cross_study_answer liefert die Antwort.",
      });
      continue;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let emitCandidate: CrossStudyAgentResult | null = null;
    let emitInvalidId: string | null = null;

    for (const tu of toolUses) {
      if (tu.name === EMIT_TOOL_NAME) {
        const parsed = CrossStudyAgentResultSchema.safeParse(tu.input);
        if (parsed.success) emitCandidate = parsed.data;
        else emitInvalidId = tu.id;
      } else if (tu.name === LIST_STUDIES_TOOL.name) {
        listCallCount++;
        const entries = await toolset.listStudies();
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: formatStudyIndexForTool(entries),
        });
      } else if (tu.name === LOAD_SYNTHESIS_TOOL.name) {
        loadCallCount++;
        const studyId = readStudyId(tu.input);
        const syn = studyId ? await toolset.loadSynthesis(studyId) : null;
        if (syn) {
          loadedById.set(syn.studyId, syn);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: formatStudyBlockForTool(syn),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `STUDY id=${studyId ?? "?"}: nicht gefunden.`,
            is_error: true,
          });
        }
      } else if (tu.name === AGGREGATE_THEME_FREQUENCY_TOOL.name) {
        // Deterministic count over the studies loaded SO FAR — pure code, no
        // model judgement. The model reports this number; it does not invent it.
        aggregateCallCount++;
        const themeQuery = readThemeQuery(tu.input);
        if (themeQuery) {
          const result = aggregateThemeFrequency(themeQuery, [
            ...loadedById.values(),
          ]);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: formatAggregateResultForTool(result),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content:
              "aggregate_theme_frequency benötigt eine themeQuery (eine kurze Themen-Phrase).",
            is_error: true,
          });
        }
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unbekanntes Tool: ${tu.name}`,
          is_error: true,
        });
      }
    }

    if (emitCandidate) {
      // Model produced its answer — terminal. Any co-occurring tool calls are
      // irrelevant now (we never call the API again, so unanswered tool_use
      // blocks don't matter).
      rawEmit = emitCandidate;
      break;
    }

    if (emitInvalidId) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: emitInvalidId,
        content:
          "Das emit_cross_study_answer-Schema war ungültig. Rufe es erneut mit { answered:boolean, answer:string, citations:[{studyId:string, quote:string}] } auf.",
        is_error: true,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Budget exhausted without a model emit → ONE forced final emit. Guarantees
  // termination WITH a safe, anchor-filtered answer.
  if (!rawEmit) {
    hitBudget = true;
    forcedEmit = true;
    rawEmit = await forceFinalEmit(client, model, messages);
  }

  // Final answer = Mission-Control's CITATION guarantee, restricted to the LOADED
  // subset. The anchor filter operates on the {answered, answer, citations}
  // subset (a valid MissionControlResult); we re-attach `interpretation` around
  // it. interpretation survives ONLY when the grounded answer survives — a
  // refusal (incl. the all-citations-dropped downgrade) carries nothing.
  const loadedStudies = [...loadedById.values()];
  const anchors = buildMissionControlAnchorSet(loadedStudies);
  const filteredMC: MissionControlResult = applyMissionControlAnchorFilter(
    rawEmit,
    anchors,
  );
  const filtered: CrossStudyAgentResult = {
    ...filteredMC,
    interpretation: filteredMC.answered ? rawEmit.interpretation : "",
  };

  const rawCitationCount = rawEmit.answered ? rawEmit.citations.length : 0;
  const keptCitationCount = filtered.answered ? filtered.citations.length : 0;

  return {
    raw: rawEmit,
    filtered,
    loadedStudyIds: loadedStudies.map((s) => s.studyId),
    steps,
    listCallCount,
    loadCallCount,
    aggregateCallCount,
    toolCallCount: listCallCount + loadCallCount + aggregateCallCount,
    hitBudget,
    forcedEmit,
    droppedCitationCount: rawCitationCount - keptCitationCount,
    downgraded: rawEmit.answered && !filtered.answered,
  };
}

/** Production-shaped pure entry — the filtered guarantee only. */
export async function runCrossStudyAgentFromToolset(
  toolset: CrossStudyToolset,
  question: string,
  history?: MissionControlHistoryTurn[],
  model?: string,
): Promise<CrossStudyAgentResult> {
  return (
    await runCrossStudyAgentDiagnostics(toolset, question, history, model)
  ).filtered;
}

/**
 * Org entry — build the org-backed toolset, then run the agent. Read-only;
 * persists nothing (Bau 1). The route + UI are Bau 3.
 *
 * AUTH CONTRACT: the caller MUST have authenticated the user against
 * request.orgId before calling — createOrgToolset → loadOrgSyntheses is an
 * org-scoped trust boundary.
 */
export async function runCrossStudyAgent(
  request: CrossStudyAgentRequest,
  model?: string,
): Promise<CrossStudyAgentResult> {
  const toolset = await createOrgToolset(request.orgId);
  return runCrossStudyAgentFromToolset(
    toolset,
    request.question,
    request.history,
    model,
  );
}
