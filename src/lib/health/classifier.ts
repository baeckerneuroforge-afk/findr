import "server-only";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
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

class HealthSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "HealthSchemaError";
  }
}

export class HealthUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "HealthUnavailableError";
  }
}

async function callClaude(
  userPrompt: string,
  attempt: number,
  model: string,
): Promise<HealthAnalysisResult> {
  const client = getAnthropicClient();

  const system =
    attempt > 0
      ? HEALTH_CLASSIFIER_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble."
      : HEALTH_CLASSIFIER_SYSTEM_PROMPT;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 2048,
      // Opus 4.7 rejects the temperature parameter; rely on the structured
      // prompt + schema validation.
      system,
      messages: [{ role: "user", content: userPrompt }],
    },
    {
      // Health analysis with four axes + signals from a full transcript runs
      // longer than the shared client's 30s default; mirror the Risk/Solution
      // per-request override.
      timeout: 120_000,
      maxRetries: 1,
    },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new HealthSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new HealthSchemaError("No JSON found in response", textBlock.text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new HealthSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = HealthAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new HealthSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }

  return result.data;
}

/**
 * Run the health classifier over one transcript (+ optional account context).
 * Opus by default; pass `model` or set HEALTH_MODEL to override. Throws
 * HealthUnavailableError when the model call ultimately fails after one retry.
 */
export async function analyzeHealth(
  input: HealthClassifierInput,
  model: string = process.env.HEALTH_MODEL ?? DEFAULT_HEALTH_MODEL,
): Promise<HealthAnalysisResult> {
  const userPrompt = buildHealthClassifierPrompt(input);

  try {
    return await callClaude(userPrompt, 0, model);
  } catch (err) {
    if (!(err instanceof HealthSchemaError)) {
      throw new HealthUnavailableError("Claude health analysis failed", err);
    }
    console.warn(
      "Health schema validation failed on first attempt, retrying:",
      err.message,
    );
  }

  try {
    return await callClaude(userPrompt, 1, model);
  } catch (err) {
    if (err instanceof HealthSchemaError) {
      console.error(
        "Health schema validation failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new HealthUnavailableError(
        "Claude health analysis returned invalid JSON twice",
        err,
      );
    }
    throw new HealthUnavailableError("Claude health analysis failed", err);
  }
}
