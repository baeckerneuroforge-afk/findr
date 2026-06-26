import "server-only";

import { createHash } from "node:crypto";

import type { CoachItem, CoachFrames } from "./engine";

/**
 * Opportunistic in-process cache for the Konsoul COACH framing, mirroring
 * `voice-interview/tts-cache.ts`. The Heute page auto-refreshes every 30s
 * (router.refresh re-runs the server component), so without a cross-request
 * cache every poll would pay a fresh Opus call. This memoises the framing keyed
 * by (org, locale, deterministic signal state) so a repeat render within the TTL
 * is free.
 *
 * BEST-EFFORT and per-instance by design (Vercel Fluid Compute reuses warm
 * instances; a cold start simply re-frames). Correctness NEVER depends on it —
 * a miss re-calls Opus, a stale entry is at worst slightly-old phrasing of the
 * SAME deterministic situation (the cache key already changes whenever a count/
 * study/theme changes, so a different situation never reads a stale frame).
 * Bounded with LRU eviction so it can never grow unbounded. Holds only org-side
 * coaching headlines (no participant PII), never persisted or logged.
 *
 * TWO TTLs: a NON-empty result is cached 30 min (spares the 30s auto-refresh
 * polls). An EMPTY result — a transient model failure OR a render where every
 * frame was anchor-dropped — is cached only 60s, so a transient hiccup recovers
 * within a poll cycle or two instead of suppressing the coach for half an hour.
 */

const MAX_ENTRIES = 256;
/** Non-empty framing: long enough to spare the 30s auto-refresh polls. */
const TTL_MS = 30 * 60 * 1000;
/** Empty framing (failure / all-dropped): short, so a transient failure or a
 *  recovered model re-frames soon. */
const EMPTY_TTL_MS = 60 * 1000;

interface Entry {
  frames: CoachFrames;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

/**
 * Stable cache key for (org, locale, deterministic item state). The item state
 * is canonicalised — sorted by key, only the fields that change the framing
 * (key/kind/entity/requireEntity) — and hashed, so the raw titles are never held
 * as a map key and the key is identical across reloads of an unchanged portfolio.
 */
export function coachCacheKey(
  orgId: string,
  locale: string,
  items: CoachItem[],
): string {
  const canonical = [...items]
    .map((it) => ({
      key: it.key,
      kind: it.kind,
      entity: it.entity,
      requireEntity: it.requireEntity,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const hash = createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 24);
  return `${orgId}:${locale}:${hash}`;
}

export function getCachedFrames(key: string): CoachFrames | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // LRU: re-insert to mark most-recently-used.
  cache.delete(key);
  cache.set(key, hit);
  return hit.frames;
}

export function setCachedFrames(key: string, frames: CoachFrames): void {
  if (cache.has(key)) cache.delete(key);
  const ttl = frames.size > 0 ? TTL_MS : EMPTY_TTL_MS;
  cache.set(key, { frames, expiresAt: Date.now() + ttl });
  // Insertion order == LRU order: drop the oldest entries beyond the cap.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Test-only: reset module state between cases. */
export function __clearCoachCacheForTests(): void {
  cache.clear();
}
