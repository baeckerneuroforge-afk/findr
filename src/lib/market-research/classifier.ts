import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import {
  MarketResearchResultSchema,
  type MarketResearchResult,
} from "@/lib/schemas/market-research";
import {
  buildMarketResearchPrompt,
  selectMarketResearchSystemPrompt,
  type MarketResearchInput,
} from "./prompts";

/**
 * Market Research LLM classifier — Phase M1. Sibling of
 * src/lib/product-discovery/classifier.ts, intentionally byte-for-byte the
 * same transport posture: forced tool-use via callClaudeStructured, Zod
 * validation, one retry inside the client, typed error, NO heuristic fallback
 * (fail-closed). The ONLY differences are the lens-level inputs — the market
 * system prompt, the market schema, and the market tool name. That is the
 * whole point of the separation plan (Ebene 2): a different ANALYSIS LENS on
 * the SAME machinery, not a different machine.
 *
 * Selection: this classifier is reached only from analyzeCallForProductDiscovery
 * when the call's research_plan carries study_type='market_research'. The
 * product_discovery default path is untouched and byte-identical.
 *
 * Model: Opus by default (same default as Product Discovery — the extraction
 * task is the same difficulty class). Override via the `model` argument or
 * process.env.MARKET_RESEARCH_MODEL, mirroring PRODUCT_DISCOVERY_MODEL /
 * HEALTH_MODEL / LOSS_MODEL.
 */

export const DEFAULT_MARKET_RESEARCH_MODEL = CLAUDE_MODELS.opus;

export class MarketResearchUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MarketResearchUnavailableError";
  }
}

/**
 * Run the Market Research extractor over one transcript (+ optional study
 * context). Opus by default; pass `model` or set MARKET_RESEARCH_MODEL to
 * override.
 *
 * Robust transport: forced tool-use via callClaudeStructured — the extraction
 * comes back as a parsed tool input (no text-JSON regex/parse). Throws
 * MarketResearchUnavailableError when the call ultimately fails — NO heuristic
 * fallback; fail-closed preserved, identical to analyzeProductDiscovery.
 */
export async function analyzeMarketResearch(
  input: MarketResearchInput,
  model: string = process.env.MARKET_RESEARCH_MODEL ??
    DEFAULT_MARKET_RESEARCH_MODEL,
): Promise<MarketResearchResult> {
  const userPrompt = buildMarketResearchPrompt(input);

  try {
    return await callClaudeStructured({
      schema: MarketResearchResultSchema,
      system: selectMarketResearchSystemPrompt(input.useCase),
      messages: [{ role: "user", content: userPrompt }],
      model,
      // Larger budget than Product Discovery's 2048: a market extraction packs
      // up to 15 coded findings into a SINGLE array, each with a 2–3 sentence
      // description AND a long verbatim DACH evidence quote — measurably more
      // output than terse product feature/pain titles. At 2048 a rich
      // transcript truncated before the required `summary` field and failed
      // schema validation; 4096 gives the headroom to finish the object.
      maxTokens: 4096,
      // Extraction over a full transcript runs longer than the shared client's
      // 30s default; mirror the Product Discovery / Risk / Health override.
      timeoutMs: 120_000,
      toolName: "emit_market_research",
      toolDescription:
        "Return the market-research extraction — coded market findings (price sensitivity, purchase intent, competitive perception, segment need, brand perception) and themes, each grounded in verbatim evidence from the transcript.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "Market Research structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new MarketResearchUnavailableError(
        "Claude market research extraction returned invalid output twice",
        err,
      );
    }
    throw new MarketResearchUnavailableError(
      "Claude market research extraction failed",
      err,
    );
  }
}
