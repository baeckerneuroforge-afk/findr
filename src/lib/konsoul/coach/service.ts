import "server-only";

import { isKonsoulCoachEnabled } from "@/lib/konsoul/coach-flag";
import type { KonsoulSignal } from "@/lib/konsoul/signals";
import {
  buildCoachItems,
  runKonsoulCoach,
  type CoachFrames,
  type NextStepLike,
} from "./engine";
import { coachCacheKey, getCachedFrames, setCachedFrames } from "./cache";

/** Hard wall-clock deadline for the framing. runKonsoulCoach is already fail-open
 *  and the underlying call is capped per-HTTP at 12s with no SDK retry, but a
 *  degraded model could still stack the two schema attempts; this race
 *  guarantees the page-side wait can never exceed ~12s — the deterministic cards
 *  are already painted (Suspense fallback), so losing the race just keeps them. */
const COACH_DEADLINE_MS = 12_000;

/**
 * Heute-page seam for the Konsoul COACH (P4). Returns a Map<itemKey, headline>
 * the dashboard uses to OVERRIDE the deterministic `action`/`tip` line of a card
 * — every key absent from the Map keeps its deterministic text.
 *
 * Three short-circuits keep this cheap and inert:
 *  1. Flag OFF (default) → empty Map, NO Opus call → Heute byte-identical to P1.
 *  2. No coachable items → empty Map, no call.
 *  3. In-process cache hit (per org+locale+signal-hash) → no call.
 * Otherwise: ONE Opus framing call (anchor-filtered, fail-open) whose result is
 * cached. Wrapped so it NEVER throws — a coach failure must never break Heute.
 *
 * orgId is purely a cache-scoping/audit key here; the items are ALREADY built
 * from org-scoped reads on the page, and the engine itself touches no DB. The
 * model never receives the orgId.
 */
export async function konsoulCoach(args: {
  orgId: string;
  locale: string;
  nextSteps: NextStepLike[];
  signals: KonsoulSignal[];
}): Promise<CoachFrames> {
  const { orgId, locale, nextSteps, signals } = args;

  if (!isKonsoulCoachEnabled()) return new Map();

  const items = buildCoachItems(nextSteps, signals);
  if (items.length === 0) return new Map();

  try {
    const key = coachCacheKey(orgId, locale, items);
    const cached = getCachedFrames(key);
    if (cached) return cached;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<CoachFrames>((resolve) => {
      timer = setTimeout(() => resolve(new Map()), COACH_DEADLINE_MS);
    });
    let frames: CoachFrames;
    try {
      frames = await Promise.race([runKonsoulCoach(items, locale), deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    setCachedFrames(key, frames);
    return frames;
  } catch (err) {
    // Belt-and-suspenders: runKonsoulCoach is already fail-open, but a cache /
    // hashing hiccup must not break the page either.
    console.error("[konsoul-coach] service failed, falling back:", err);
    return new Map();
  }
}
