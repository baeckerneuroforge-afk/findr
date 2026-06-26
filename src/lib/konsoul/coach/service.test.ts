import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Coach SERVICE — the flag/cache/fail-open seam the Heute page calls. The actual
 * Opus framing (runKonsoulCoach) is mocked so we assert orchestration only:
 *  - flag OFF (default) ⇒ empty Map, framing NEVER called (inert merge);
 *  - no items ⇒ empty Map, framing not called;
 *  - flag ON ⇒ framing called once, result cached (a second identical call is a
 *    cache hit, framing not called again).
 */

// vi.mock is hoisted above imports → define the spy via vi.hoisted so the
// factory can close over it without a TDZ error.
const { runKonsoulCoach } = vi.hoisted(() => ({ runKonsoulCoach: vi.fn() }));

vi.mock("./engine", async (importActual) => {
  const actual = await importActual<typeof import("./engine")>();
  return { ...actual, runKonsoulCoach };
});

import { konsoulCoach } from "./service";
import {
  coachCacheKey,
  getCachedFrames,
  setCachedFrames,
  __clearCoachCacheForTests,
} from "./cache";
import { buildCoachItems } from "./engine";

const NEXT_STEPS = [{ key: "synthesis-p1", planTitle: "Pricing" }];

beforeEach(() => {
  __clearCoachCacheForTests();
  runKonsoulCoach.mockReset();
  runKonsoulCoach.mockResolvedValue(
    new Map([["synthesis-p1", "Verdichte die ersten Stimmen"]]),
  );
  delete process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED;
});

describe("konsoulCoach (service)", () => {
  it("returns an empty Map and never frames when the flag is OFF", async () => {
    const out = await konsoulCoach({
      orgId: "org_1",
      locale: "de",
      nextSteps: NEXT_STEPS,
      signals: [],
    });
    expect(out.size).toBe(0);
    expect(runKonsoulCoach).not.toHaveBeenCalled();
  });

  it("returns an empty Map and never frames when there are no items", async () => {
    process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED = "true";
    const out = await konsoulCoach({
      orgId: "org_1",
      locale: "de",
      nextSteps: [],
      signals: [],
    });
    expect(out.size).toBe(0);
    expect(runKonsoulCoach).not.toHaveBeenCalled();
  });

  it("frames once when the flag is ON and caches the result", async () => {
    process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED = "true";

    const first = await konsoulCoach({
      orgId: "org_1",
      locale: "de",
      nextSteps: NEXT_STEPS,
      signals: [],
    });
    expect(first.get("synthesis-p1")).toBe("Verdichte die ersten Stimmen");
    expect(runKonsoulCoach).toHaveBeenCalledTimes(1);

    // Identical inputs ⇒ cache hit ⇒ framing not called again.
    const second = await konsoulCoach({
      orgId: "org_1",
      locale: "de",
      nextSteps: NEXT_STEPS,
      signals: [],
    });
    expect(second.get("synthesis-p1")).toBe("Verdichte die ersten Stimmen");
    expect(runKonsoulCoach).toHaveBeenCalledTimes(1);
  });

  it("does not honor 'false' or other truthy-ish values (only exact 'true')", async () => {
    process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED = "1";
    const out = await konsoulCoach({
      orgId: "org_1",
      locale: "de",
      nextSteps: NEXT_STEPS,
      signals: [],
    });
    expect(out.size).toBe(0);
    expect(runKonsoulCoach).not.toHaveBeenCalled();
  });
});

describe("coach cache", () => {
  beforeEach(() => __clearCoachCacheForTests());

  it("derives a stable key independent of item order", () => {
    const a = buildCoachItems(
      [
        { key: "synthesis-p1", planTitle: "Pricing" },
        { key: "field-p2", planTitle: "Onboarding" },
      ],
      [],
    );
    const b = buildCoachItems(
      [
        { key: "field-p2", planTitle: "Onboarding" },
        { key: "synthesis-p1", planTitle: "Pricing" },
      ],
      [],
    );
    expect(coachCacheKey("org_1", "de", a)).toBe(coachCacheKey("org_1", "de", b));
  });

  it("changes the key when the org, locale, or an entity changes", () => {
    const base = buildCoachItems([{ key: "synthesis-p1", planTitle: "Pricing" }], []);
    const renamed = buildCoachItems([{ key: "synthesis-p1", planTitle: "Preise" }], []);
    const k = coachCacheKey("org_1", "de", base);
    expect(coachCacheKey("org_2", "de", base)).not.toBe(k);
    expect(coachCacheKey("org_1", "en", base)).not.toBe(k);
    expect(coachCacheKey("org_1", "de", renamed)).not.toBe(k);
  });

  it("round-trips frames through get/set", () => {
    const items = buildCoachItems([{ key: "synthesis-p1", planTitle: "Pricing" }], []);
    const key = coachCacheKey("org_1", "de", items);
    expect(getCachedFrames(key)).toBeUndefined();
    setCachedFrames(key, new Map([["synthesis-p1", "Los geht's"]]));
    expect(getCachedFrames(key)?.get("synthesis-p1")).toBe("Los geht's");
  });
});
