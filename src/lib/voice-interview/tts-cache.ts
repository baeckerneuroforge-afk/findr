import { createHash } from "node:crypto";

/**
 * Opportunistic in-process TTS cache for /api/interview/[token]/speak.
 *
 * That route always synthesizes the LATEST agent turn via paid Deepgram TTS on
 * every POST. So a participant replaying the current question — or an attacker
 * hammering the public capability URL for a single session — pays for every
 * call. This cache makes a repeat synthesis of the SAME (session, turn,
 * language) free: the first request synthesizes, subsequent ones serve bytes.
 *
 * BEST-EFFORT and per-instance by design. Vercel Fluid Compute reuses warm
 * instances, so rapid repeats usually hit the same process, but there is NO
 * shared state across instances or after a cold start. A miss simply
 * re-synthesizes (identical to today), so correctness never depends on the
 * cache — it is purely a cost optimization, complementary to the separate
 * per-request rate-limiter. Bounded to MAX_ENTRIES with LRU eviction so it can
 * never grow unbounded. Holds only synthesized audio of the AGENT's question
 * text (no participant PII) in memory, never persisted or logged.
 */

export type CachedTts = { bytes: ArrayBuffer; contentType: string };

const MAX_ENTRIES = 64;
const cache = new Map<string, CachedTts>();

/**
 * Stable cache key for a (session, turn, language). The capability token is
 * hashed so the raw secret is never held as a map key.
 */
export function ttsCacheKey(
  accessToken: string,
  turnIndex: number,
  language: string,
): string {
  const tokenHash = createHash("sha256")
    .update(accessToken)
    .digest("hex")
    .slice(0, 16);
  return `${tokenHash}:${turnIndex}:${language}`;
}

export function getCachedTts(key: string): CachedTts | undefined {
  const hit = cache.get(key);
  if (hit) {
    // LRU: re-insert to mark most-recently-used.
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

export function setCachedTts(key: string, value: CachedTts): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  // Insertion order == LRU order: drop the oldest entries beyond the cap.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Test-only: reset module state between cases. */
export function __clearTtsCacheForTests(): void {
  cache.clear();
}
