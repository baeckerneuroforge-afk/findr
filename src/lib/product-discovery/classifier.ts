import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import {
  ProductDiscoveryResultSchema,
  type ProductDiscoveryResult,
} from "@/lib/schemas/product-discovery";
import {
  PRODUCT_DISCOVERY_SYSTEM_PROMPT,
  buildProductDiscoveryPrompt,
  type ProductDiscoveryInput,
} from "./prompts";

/**
 * Product Discovery LLM classifier. Mirrors src/lib/health/classifier.ts:
 * structured JSON output, Zod validation, one retry on schema failure, typed
 * errors. NO heuristic fallback — extraction is only worth surfacing if the
 * model produced a grounded one with verbatim evidence.
 *
 * Model: Opus by default (claude-opus-4-7). Override via the `model`
 * argument or process.env.PRODUCT_DISCOVERY_MODEL — same pattern as
 * HEALTH_MODEL / LOSS_MODEL / SOLUTION_MODEL / EVAL_MODEL.
 */

export const DEFAULT_PRODUCT_DISCOVERY_MODEL = CLAUDE_MODELS.opus;

export class ProductDiscoveryUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ProductDiscoveryUnavailableError";
  }
}

/**
 * Run the Product Discovery extractor over one transcript (+ optional
 * account context). Opus by default; pass `model` or set
 * PRODUCT_DISCOVERY_MODEL to override.
 *
 * Robust transport: forced tool-use via callClaudeStructured — the extraction
 * comes back as a parsed tool input (no text-JSON regex/parse). Same prompt,
 * same ProductDiscoveryResultSchema, same Opus default. Throws
 * ProductDiscoveryUnavailableError when the call ultimately fails — NO heuristic
 * fallback; fail-closed preserved.
 */
export async function analyzeProductDiscovery(
  input: ProductDiscoveryInput,
  model: string = process.env.PRODUCT_DISCOVERY_MODEL ??
    DEFAULT_PRODUCT_DISCOVERY_MODEL,
): Promise<ProductDiscoveryResult> {
  const userPrompt = buildProductDiscoveryPrompt(input);

  try {
    return await callClaudeStructured({
      schema: ProductDiscoveryResultSchema,
      system: PRODUCT_DISCOVERY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      maxTokens: 2048,
      // Extraction across three layers over a full transcript runs longer
      // than the shared client's 30s default; mirror the Risk/Health override.
      timeoutMs: 120_000,
      toolName: "emit_product_discovery",
      toolDescription:
        "Return the product-discovery extraction — feature requests, pain points and themes, each grounded in verbatim evidence from the transcript.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "Product Discovery structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new ProductDiscoveryUnavailableError(
        "Claude product discovery extraction returned invalid output twice",
        err,
      );
    }
    throw new ProductDiscoveryUnavailableError(
      "Claude product discovery extraction failed",
      err,
    );
  }
}
