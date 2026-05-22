import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Default Claude models. Override per-call via the `model` arg.
 *
 * - Opus 4.7 (1M context): deepest reasoning, slowest, most expensive.
 * - Sonnet 4.6: balanced default for most product features.
 * - Haiku 4.5: cheapest and fastest for high-volume / latency-sensitive paths.
 */
export const CLAUDE_MODELS = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const;

export const DEFAULT_MODEL = CLAUDE_MODELS.sonnet;

let _client: Anthropic | null = null;

/**
 * Singleton Anthropic client. Lazily initialized so missing env vars only
 * blow up when the client is actually used, not at module import.
 */
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  _client = new Anthropic({
    apiKey,
    timeout: 30_000,
    // SDK retries transient 429/500/529 errors with backoff and jitter.
    maxRetries: 4,
  });
  return _client;
}
