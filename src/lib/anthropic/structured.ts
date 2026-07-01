import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { DEFAULT_MODEL, getAnthropicClient } from "./client";

/**
 * Structured Claude output via FORCED TOOL-USE — the JSON-robustness primitive.
 * --------------------------------------------------------------------------
 * The fragile pattern (ask for JSON in free text, then `text.match(/\{…\}/)` +
 * `JSON.parse`) breaks whenever the model emits an unescaped quote inside a
 * string value — a confirmed prod crash class (save-play / health "returned
 * invalid JSON twice", and others). This helper forces a single tool call and
 * reads `tool_use.input`, which the SDK hands back as an ALREADY-PARSED object,
 * so a malformed-JSON failure is structurally impossible. Zod still validates
 * the shape; the ONLY retryable failure left is a wrong-typed field.
 *
 * Single source for every module that needs structured output: pass the
 * module's EXISTING response Zod schema (no schema change — same fields), the
 * system prompt, and the messages. The Anthropic tool `input_schema` is derived
 * from the Zod schema via `z.toJSONSchema(io:"input")`, so defaulted/optional
 * fields are not required (the model may omit them; Zod fills the default) —
 * matching the hand-written research-agent reference tool.
 *
 * FAIL-CLOSED is preserved by the CALLER: this throws on failure (a
 * StructuredOutputError for an unparseable/invalid result after one retry, or
 * the original transport error otherwise). Each module maps that to its own
 * fail-closed outcome (a typed *UnavailableError, a heuristic fallback, …) —
 * exactly as before. It NEVER returns garbage.
 */

/** Thrown when the model's tool output can't be validated after one retry.
 *  Callers map this to their own fail-closed fallback. (Transport/SDK errors
 *  are NOT wrapped — they propagate so callers can tell "model produced bad
 *  output" from "the call itself failed", mirroring the old SchemaError vs
 *  non-SchemaError split.) */
export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export interface StructuredMessage {
  role: "user" | "assistant";
  /** Plain text for every classic caller. Vision callers (stimulus-analysis)
   *  pass content BLOCKS (text + base64 image) instead — the array form is the
   *  SDK's own MessageParam.content union, passed through verbatim, so the
   *  string path stays byte-identical for all existing callers. */
  content: string | Anthropic.ContentBlockParam[];
}

export interface CallClaudeStructuredOptions<T> {
  /** The module's response Zod schema. Its TOP LEVEL must be a z.object —
   *  Anthropic's tool input_schema must be `type: "object"`. Wrap a bare
   *  z.array/primitive in z.object({ … }) at the call site. */
  schema: z.ZodType<T>;
  /** System prompt (posture + data). Stable prefix — cacheable across turns. */
  system: string;
  /**
   * OPT-IN Anthropic prompt-caching (default false → byte-identical request for
   * every existing caller). When true, the `system` string is sent as a single
   * cache-breakpointed text block (`cache_control: {type:'ephemeral'}`) instead
   * of a plain string. Anthropic then caches the stable prefix — render order is
   * tools → system → messages, so the breakpoint on the (only) system block
   * caches `tools + system` together; the volatile `messages` (history +
   * question) render AFTER the breakpoint and stay outside the cached span, so
   * the cache is NOT invalidated turn-to-turn.
   *
   * Behaviourally transparent: a single text block with the same text is the
   * exact prompt the string form produces — the model sees identical tokens, so
   * responses are unchanged; caching only alters what is re-sent vs. read from
   * cache. Set this ONLY for the multi-turn loop callers (chat-with-data,
   * mission-control) whose large data dump is re-sent every turn; single-shot
   * extractors gain nothing and should leave it false. Requires SDK ≥ 0.96
   * (CacheControlEphemeral on TextBlockParam, GA — no beta header). The minimum
   * cacheable prefix on Opus is ~4096 tokens; shorter prefixes silently won't
   * cache (no error, just no benefit). */
  cacheSystemPrompt?: boolean;
  /** Conversation. Single-shot = [{ role: "user", content: prompt }]. */
  messages: StructuredMessage[];
  model?: string;
  maxTokens: number;
  /** Tool the model is forced to call. Defaults to "emit_result". */
  toolName?: string;
  toolDescription?: string;
  /** Per-request timeout (ms). Default 120s (the longer generations). */
  timeoutMs?: number;
  /** SDK transient-error retries (429/5xx). Default 1 — matches the per-module
   *  calls this replaces. */
  maxRetries?: number;
}

const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const DEFAULT_TOOL_DESCRIPTION =
  "Return the result as the structured fields of this tool. Call it exactly once with the complete result.";

/**
 * Force the model to emit `schema`-shaped structured output via a single tool
 * call and return the Zod-validated value. Throws on failure (see class doc) —
 * the caller owns the fail-closed fallback.
 */
export async function callClaudeStructured<T>(
  opts: CallClaudeStructuredOptions<T>,
): Promise<T> {
  const {
    schema,
    system,
    messages,
    model = DEFAULT_MODEL,
    maxTokens,
    toolName = "emit_result",
    toolDescription = DEFAULT_TOOL_DESCRIPTION,
    timeoutMs = 120_000,
    maxRetries = 1,
    cacheSystemPrompt = false,
  } = opts;

  if (!TOOL_NAME_RE.test(toolName)) {
    throw new Error(`callClaudeStructured: invalid tool name "${toolName}".`);
  }

  // Derive the Anthropic tool input_schema from the Zod schema. io:"input" so
  // defaulted/optional fields drop out of `required` (the model may omit them
  // and Zod fills the default). Strip the $schema meta key — not part of a tool
  // input_schema.
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  if (jsonSchema.type !== "object") {
    throw new Error(
      `callClaudeStructured: schema must be a top-level object (got type ${String(
        jsonSchema.type,
      )}). Wrap an array/primitive schema in z.object({ … }).`,
    );
  }

  const tool: Anthropic.Tool = {
    name: toolName,
    description: toolDescription,
    input_schema: jsonSchema as unknown as Anthropic.Tool.InputSchema,
  };

  const client = getAnthropicClient();

  // Two attempts. Forced tool-use already makes malformed JSON impossible, so
  // the only retryable failure is a Zod mismatch (a wrong-typed field); the
  // retry appends a structural nag. Transport errors propagate (not caught) so
  // the caller distinguishes "bad model output" from "the call failed".
  let lastRaw = "";
  for (let attempt = 0; attempt <= 1; attempt++) {
    const sys =
      attempt > 0
        ? system +
          "\n\nIMPORTANT: Your previous tool call did not match the required schema. Provide EVERY field with its correct type — arrays as arrays of objects (never as a string), and include all required fields. Call the tool exactly once."
        : system;

    // OPT-IN prompt-caching: wrap the (identical) system text in one
    // cache-breakpointed block. The breakpoint sits on the LAST stable block —
    // tools + system render before `messages`, so the volatile history+question
    // stay outside the cached span and never invalidate it. Default path keeps
    // the plain string → byte-identical request for every non-caching caller.
    // (On the rare schema-retry, `sys` carries the appended nag, so attempt 1's
    // prefix differs from attempt 0's cached write — a benign one-off miss, not
    // a cross-turn issue: `sys` is re-derived per call, so the next turn starts
    // clean at attempt 0 and reads the cache.)
    const systemParam: string | Anthropic.TextBlockParam[] = cacheSystemPrompt
      ? [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }]
      : sys;

    // STREAMING-Transport (Perf/Robustheit): die großen Erzeuger (Synthese
    // 10k, Meta-Synthese 10k, Personas 16k maxTokens auf Opus) liefen hier
    // vorher als blockierender messages.create — 1–3 Minuten ohne ein Byte auf
    // der Leitung, genau die Zone, in der lange Requests von Timeouts gekillt
    // werden. `stream(...).finalMessage()` hält die Verbindung mit Events am
    // Leben und liefert am Ende DIESELBE Message (inkl. tool_use.input als
    // geparstes Objekt) — kein Verhaltens- oder Schnittstellenwechsel für die
    // Aufrufer, kein UI-Zwang. Der SDK-Stream retryt Transportfehler wie
    // create gemäß maxRetries.
    const response = await client.messages
      .stream(
        {
          model,
          max_tokens: maxTokens,
          // No `temperature` — Opus 4.7 rejects the parameter (400).
          system: systemParam,
          messages,
          tools: [tool],
          tool_choice: { type: "tool", name: toolName },
        },
        { timeout: timeoutMs, maxRetries },
      )
      .finalMessage();

    // stop_reason-Guard (Review-Fund 2026-07-01): Beim Streaming baut das SDK
    // tool_use.input client-seitig per partialParse aus den input_json_deltas.
    // Bricht die Generierung mit max_tokens ab, entsteht ein PARTIELL
    // geparstes Objekt, das trotzdem Zod-VALIDE sein kann (z. B. ein kürzeres
    // themes-Array) — der alte create-Pfad lieferte dafür einen harten
    // Schema-Fehler. Trunkierung daher explizit als Fehlversuch behandeln
    // (Retry, dann StructuredOutputError) statt still gekürzte Daten
    // zurückzugeben.
    if (response.stop_reason === "max_tokens") {
      lastRaw = `stop_reason=max_tokens (maxTokens=${maxTokens})`;
      if (attempt === 0) {
        console.warn(
          "Structured output hit max_tokens on first attempt (truncated tool input), retrying.",
        );
      }
      continue;
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (toolUse) {
      const parsed = schema.safeParse(toolUse.input);
      if (parsed.success) return parsed.data;
      lastRaw = JSON.stringify(toolUse.input);
      if (attempt === 0) {
        console.warn(
          "Structured output schema validation failed on first attempt, retrying:",
          JSON.stringify(parsed.error.flatten()),
        );
      }
    } else {
      lastRaw = JSON.stringify(response.content);
      if (attempt === 0) {
        console.warn(
          "Structured output: no tool_use block on first attempt, retrying.",
        );
      }
    }
  }

  throw new StructuredOutputError(
    "Structured output failed schema validation twice",
    lastRaw,
  );
}
