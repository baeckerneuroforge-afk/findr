import "server-only";

import { getAnthropicClient, CLAUDE_MODELS } from "@/lib/anthropic/client";
import type { Deal } from "@/lib/deals/types";
import {
  RiskAnalysisResultSchema,
  type RiskAnalysisResult,
} from "@/lib/schemas/risk";
import {
  RISK_CLASSIFIER_SYSTEM_PROMPT,
  buildRiskClassifierPrompt,
  type CallForPrompt,
} from "./prompts";

// === ANALYSIS MODEL — switch between opus (best quality) and sonnet (cheaper) here ===
export const ANALYSIS_MODEL = CLAUDE_MODELS.opus;

class LLMSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "LLMSchemaError";
  }
}

export class LLMUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

async function callClaude(
  userPrompt: string,
  attempt: number,
): Promise<RiskAnalysisResult> {
  const client = getAnthropicClient();

  const systemPrompt =
    attempt > 0
      ? RISK_CLASSIFIER_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble, no explanation."
      : RISK_CLASSIFIER_SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2048,
    // temperature: 0 for reproducible, consistent risk scoring — same transcript should yield the same assessment. Critical for a scoring tool and for meaningful evals.
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new LLMSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new LLMSchemaError("No JSON found in response", textBlock.text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new LLMSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = RiskAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new LLMSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }

  const filteredSignals = result.data.signals.filter(
    (signal) =>
      signal.confidence >= 0.65 &&
      signal.quotes.some((quote) => quote.trim().length > 0),
  );

  const adjustedScore =
    filteredSignals.length === 0
      ? Math.min(35, result.data.riskScore)
      : Math.max(40, result.data.riskScore);
  const adjustedLevel: RiskAnalysisResult["riskLevel"] =
    adjustedScore < 40
      ? "low"
      : adjustedScore < 60
        ? "medium"
        : adjustedScore < 80
          ? "high"
          : "critical";

  return {
    ...result.data,
    signals: filteredSignals,
    riskScore: adjustedScore,
    riskLevel: adjustedLevel,
  };
}

export async function analyzeDealRiskLLM(
  deal: Deal,
  calls: CallForPrompt[] = [],
): Promise<RiskAnalysisResult> {
  const userPrompt = buildRiskClassifierPrompt(deal, calls);

  try {
    return await callClaude(userPrompt, 0);
  } catch (err) {
    if (!(err instanceof LLMSchemaError)) {
      throw new LLMUnavailableError("Claude risk analysis failed", err);
    }
    console.warn(
      "LLM schema validation failed on first attempt, retrying:",
      err.message,
    );
  }

  try {
    return await callClaude(userPrompt, 1);
  } catch (err) {
    if (err instanceof LLMSchemaError) {
      console.error(
        "LLM schema validation failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new LLMUnavailableError(
        "Claude risk analysis returned invalid JSON twice",
        err,
      );
    }
    throw new LLMUnavailableError("Claude risk analysis failed", err);
  }
}
