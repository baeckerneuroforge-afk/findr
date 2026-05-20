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

class LLMSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "LLMSchemaError";
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
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
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

  return result.data;
}

export async function analyzeDealRisk(
  deal: Deal,
  calls: CallForPrompt[] = [],
): Promise<RiskAnalysisResult> {
  const userPrompt = buildRiskClassifierPrompt(deal, calls);

  try {
    return await callClaude(userPrompt, 0);
  } catch (err) {
    if (!(err instanceof LLMSchemaError)) throw err;
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
      return {
        riskScore: 0,
        riskLevel: "low",
        signals: [],
        overallReasoning:
          "Risk analysis failed due to invalid AI response. Please retry analysis or contact support.",
        recommendations: [],
      };
    }
    throw err;
  }
}
