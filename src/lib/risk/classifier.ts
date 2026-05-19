import "server-only";

import { getAnthropicClient, CLAUDE_MODELS } from "@/lib/anthropic/client";
import type { Deal, RiskAnalysisResult } from "@/lib/deals/types";
import {
  RISK_CLASSIFIER_SYSTEM_PROMPT,
  buildRiskClassifierPrompt,
  type CallForPrompt,
} from "./prompts";

export async function analyzeDealRisk(
  deal: Deal,
  calls: CallForPrompt[] = [],
): Promise<RiskAnalysisResult> {
  const client = getAnthropicClient();
  const userPrompt = buildRiskClassifierPrompt(deal, calls);

  const response = await client.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 2048,
    system: RISK_CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned no text response");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in response: ${textBlock.text}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as RiskAnalysisResult;
  return parsed;
}
