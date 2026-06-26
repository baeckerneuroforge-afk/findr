import { describe, expect, it } from "vitest";

import {
  METRIC_COUNTS_WHITELIST,
  sanitizeMetricCounts,
} from "./metrics";

/**
 * Konsoul P5 — telemetry counts whitelist. The hard guarantee: NO text/PII/prose
 * can ever land in konsoul_metrics.counts (the table is metadata-only and the org
 * export dumps every column). Same discipline as action-audit sanitizeCounts.
 */
describe("sanitizeMetricCounts", () => {
  it("keeps only whitelisted numeric keys", () => {
    expect(
      sanitizeMetricCounts({ grounded: 2, refusal: 1, turn_count: 4 }),
    ).toEqual({ grounded: 2, refusal: 1, turn_count: 4 });
  });

  it("drops non-whitelisted keys (incl. any free-text key)", () => {
    expect(
      sanitizeMetricCounts({
        grounded: 1,
        question: "what did users say?",
        answer: "they liked it",
        org_id: "secret",
      }),
    ).toEqual({ grounded: 1 });
  });

  it("drops non-finite / non-numeric values", () => {
    expect(
      sanitizeMetricCounts({
        grounded: "3" as unknown as number,
        guidance: Number.NaN,
        refusal: Infinity,
        interpretation: 2,
      }),
    ).toEqual({ interpretation: 2 });
  });

  it("drops negative and non-integer values (a counter is never < 0 or fractional)", () => {
    expect(
      sanitizeMetricCounts({ grounded: -5, refusal: 3.7, turn_count: 3 }),
    ).toEqual({ turn_count: 3 });
  });

  it("returns {} for null/undefined/non-object", () => {
    expect(sanitizeMetricCounts(null)).toEqual({});
    expect(sanitizeMetricCounts(undefined)).toEqual({});
    expect(sanitizeMetricCounts("oops" as unknown as Record<string, unknown>)).toEqual({});
  });

  it("whitelist contains only metadata count keys (no text fields)", () => {
    for (const key of METRIC_COUNTS_WHITELIST) {
      expect(typeof key).toBe("string");
      expect(/answer|question|text|content|quote|rationale|prose/i.test(key)).toBe(
        false,
      );
    }
  });
});
