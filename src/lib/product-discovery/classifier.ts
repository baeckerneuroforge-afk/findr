import "server-only";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
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

class ProductDiscoverySchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "ProductDiscoverySchemaError";
  }
}

export class ProductDiscoveryUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ProductDiscoveryUnavailableError";
  }
}

async function callClaude(
  userPrompt: string,
  attempt: number,
  model: string,
): Promise<ProductDiscoveryResult> {
  const client = getAnthropicClient();

  const system =
    attempt > 0
      ? PRODUCT_DISCOVERY_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble."
      : PRODUCT_DISCOVERY_SYSTEM_PROMPT;

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
      // Extraction across three layers over a full transcript runs longer
      // than the shared client's 30s default; mirror the Risk/Health
      // per-request override.
      timeout: 120_000,
      maxRetries: 1,
    },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ProductDiscoverySchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new ProductDiscoverySchemaError(
      "No JSON found in response",
      textBlock.text,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new ProductDiscoverySchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = ProductDiscoveryResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProductDiscoverySchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }

  return result.data;
}

/**
 * Run the Product Discovery extractor over one transcript (+ optional
 * account context). Opus by default; pass `model` or set
 * PRODUCT_DISCOVERY_MODEL to override. Throws
 * ProductDiscoveryUnavailableError when the model call ultimately fails
 * after one retry.
 */
export async function analyzeProductDiscovery(
  input: ProductDiscoveryInput,
  model: string = process.env.PRODUCT_DISCOVERY_MODEL ??
    DEFAULT_PRODUCT_DISCOVERY_MODEL,
): Promise<ProductDiscoveryResult> {
  const userPrompt = buildProductDiscoveryPrompt(input);

  try {
    return await callClaude(userPrompt, 0, model);
  } catch (err) {
    if (!(err instanceof ProductDiscoverySchemaError)) {
      throw new ProductDiscoveryUnavailableError(
        "Claude product discovery extraction failed",
        err,
      );
    }
    console.warn(
      "Product Discovery schema validation failed on first attempt, retrying:",
      err.message,
    );
  }

  try {
    return await callClaude(userPrompt, 1, model);
  } catch (err) {
    if (err instanceof ProductDiscoverySchemaError) {
      console.error(
        "Product Discovery schema validation failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new ProductDiscoveryUnavailableError(
        "Claude product discovery extraction returned invalid JSON twice",
        err,
      );
    }
    throw new ProductDiscoveryUnavailableError(
      "Claude product discovery extraction failed",
      err,
    );
  }
}
