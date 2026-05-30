import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import {
  HealthAnalysisResultSchema,
  type HealthAnalysisResult,
} from "@/lib/schemas/health";
import {
  HEALTH_CLASSIFIER_SYSTEM_PROMPT,
  buildHealthClassifierPrompt,
  type HealthClassifierInput,
} from "./prompts";

/**
 * CS Health LLM classifier. Mirrors src/lib/risk/llm-classifier.ts: structured
 * JSON output, Zod validation, one retry on schema failure, typed errors. NO
 * heuristic fallback — a health analysis is only worth surfacing if the model
 * produced a valid grounded one.
 *
 * Model: Opus by default (claude-opus-4-7). Override via the `model` argument
 * (the eval runner passes its own choice) or process.env.HEALTH_MODEL — same
 * pattern as LOSS_MODEL / SOLUTION_MODEL / EVAL_MODEL.
 */

export const DEFAULT_HEALTH_MODEL = CLAUDE_MODELS.opus;

export class HealthUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "HealthUnavailableError";
  }
}

/**
 * Run the health classifier over one transcript (+ optional account context).
 * Opus by default; pass `model` or set HEALTH_MODEL to override.
 *
 * Robust transport: forced tool-use via callClaudeStructured — the analysis
 * comes back as a parsed tool input (no text-JSON regex/parse, so the "invalid
 * JSON twice" crash class is gone). Same prompt, same HealthAnalysisResultSchema,
 * same Opus default. Throws HealthUnavailableError when the call ultimately
 * fails — NO heuristic fallback here (callers own that); fail-closed preserved.
 */
export async function analyzeHealth(
  input: HealthClassifierInput,
  model: string = process.env.HEALTH_MODEL ?? DEFAULT_HEALTH_MODEL,
): Promise<HealthAnalysisResult> {
  const userPrompt = buildHealthClassifierPrompt(input);

  try {
    return await callClaudeStructured({
      schema: HealthAnalysisResultSchema,
      system: HEALTH_CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      maxTokens: 2048,
      // Four axes + signals from a full transcript runs past the shared
      // client's 30s default; mirror the Risk/Solution per-request override.
      timeoutMs: 120_000,
      toolName: "emit_health_analysis",
      toolDescription:
        "Return the customer-health analysis — the four satisfaction axes, acute signals with verbatim quotes, the score, level and summary — grounded strictly in the transcript.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "Health structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new HealthUnavailableError(
        "Claude health analysis returned invalid output twice",
        err,
      );
    }
    throw new HealthUnavailableError("Claude health analysis failed", err);
  }
}
