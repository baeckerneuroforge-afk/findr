import { describe, expect, it } from "vitest";

import {
  coerceSubmissionCounts,
  parseProlificStudySnapshot,
} from "./study-snapshot";

describe("parseProlificStudySnapshot", () => {
  it("extracts the status from a study response", () => {
    expect(
      parseProlificStudySnapshot({ id: "abc", status: "ACTIVE", reward: 100 }),
    ).toEqual({ status: "ACTIVE" });
  });

  it("trims and accepts provider statuses with spaces", () => {
    expect(parseProlificStudySnapshot({ status: " AWAITING REVIEW " })).toEqual({
      status: "AWAITING REVIEW",
    });
  });

  it("returns null for missing/empty status or non-objects", () => {
    expect(parseProlificStudySnapshot({ id: "abc" })).toBeNull();
    expect(parseProlificStudySnapshot({ status: "" })).toBeNull();
    expect(parseProlificStudySnapshot({ status: 42 })).toBeNull();
    expect(parseProlificStudySnapshot(null)).toBeNull();
    expect(parseProlificStudySnapshot("ACTIVE")).toBeNull();
    expect(parseProlificStudySnapshot([])).toEqual(null);
  });
});

describe("coerceSubmissionCounts", () => {
  it("keeps the documented Prolific bucket shape verbatim", () => {
    const api = {
      ACTIVE: 12,
      APPROVED: 285,
      "AWAITING REVIEW": 18,
      REJECTED: 5,
      RESERVED: 4,
      RETURNED: 1,
      "TIMED-OUT": 7,
      "PARTIALLY APPROVED": 3,
      "SCREENED OUT": 6,
      TOTAL: 341,
    };
    expect(coerceSubmissionCounts(api)).toEqual(api);
  });

  it("drops non-finite, negative and non-number values instead of failing", () => {
    expect(
      coerceSubmissionCounts({
        ACTIVE: 2,
        BAD: "3",
        NAN: Number.NaN,
        INF: Number.POSITIVE_INFINITY,
        NEG: -1,
        NULL: null,
        TOTAL: 2,
      }),
    ).toEqual({ ACTIVE: 2, TOTAL: 2 });
  });

  it("returns null for non-objects and arrays", () => {
    expect(coerceSubmissionCounts(null)).toBeNull();
    expect(coerceSubmissionCounts(undefined)).toBeNull();
    expect(coerceSubmissionCounts(7)).toBeNull();
    expect(coerceSubmissionCounts("x")).toBeNull();
    expect(coerceSubmissionCounts([1, 2])).toBeNull();
  });

  it("accepts an empty object (study without submissions)", () => {
    expect(coerceSubmissionCounts({})).toEqual({});
  });

  it("caps pathological inputs (overlong keys, too many entries)", () => {
    expect(coerceSubmissionCounts({ ["k".repeat(41)]: 1, OK: 2 })).toEqual({
      OK: 2,
    });
    const many = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`K${i}`, i]),
    );
    const coerced = coerceSubmissionCounts(many);
    expect(coerced).not.toBeNull();
    expect(Object.keys(coerced!)).toHaveLength(50);
  });
});
