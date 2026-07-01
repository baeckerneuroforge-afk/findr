import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Default Claude models. Override per-call via the `model` arg.
 *
 * - Opus 4.8 (1M context): deepest reasoning, slowest, most expensive.
 * - Sonnet 5: balanced default for most product features.
 * - Haiku 4.5: cheapest and fastest for high-volume / latency-sensitive paths.
 */
export const CLAUDE_MODELS = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-5",
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
    // 120s statt 30s: der Default gilt für jeden Call OHNE per-Call-Options —
    // konkret den Opus-Turn-Stream des Interviews (interviewer.ts). 30s waren
    // für Opus-First-Byte in Lastspitzen zu knapp (harter Abbruch mitten im
    // Interview); die übrigen Callsites überschreiben ohnehin mit eigenen
    // 120s-Budgets. Per-Call weiterhin via options.timeout übersteuerbar.
    timeout: 120_000,
    // SDK retries transient 429/500/529 errors with backoff and jitter.
    // 2 statt 4: bei Überlast (529) liefen sonst bis zu 5 Versuche desselben
    // teuren Opus-Calls (Kosten-Multiplikator), während der Nutzer längst ein
    // Timeout sah. 2 Retries fangen transiente Fehler weiterhin ab.
    maxRetries: 2,
  });
  return _client;
}
