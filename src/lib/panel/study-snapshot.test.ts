import { describe, expect, it } from "vitest";

import {
  coerceSubmissionCounts,
  parseProlificCalculatedCost,
  parseProlificErrorMessage,
  parseProlificStudyCost,
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

describe("parseProlificCalculatedCost", () => {
  it("reads the documented { total_cost } shape (cents)", () => {
    expect(parseProlificCalculatedCost({ total_cost: 56 })).toBe(56);
    expect(parseProlificCalculatedCost({ total_cost: 0 })).toBe(0);
    expect(parseProlificCalculatedCost({ total_cost: 1249.6 })).toBe(1250);
  });

  it("rejects missing/invalid totals and non-objects", () => {
    expect(parseProlificCalculatedCost({})).toBeNull();
    expect(parseProlificCalculatedCost({ total_cost: "56" })).toBeNull();
    expect(parseProlificCalculatedCost({ total_cost: -1 })).toBeNull();
    expect(parseProlificCalculatedCost({ total_cost: Number.NaN })).toBeNull();
    expect(parseProlificCalculatedCost(null)).toBeNull();
    expect(parseProlificCalculatedCost(56)).toBeNull();
  });
});

describe("parseProlificStudyCost", () => {
  it("sums the documented StudyTotalCost breakdown and picks the currency", () => {
    expect(
      parseProlificStudyCost({
        rewards: {
          rewards: { amount: 100, currency: "USD" },
          fees: { amount: 100, currency: "USD" },
          tax: { amount: 100, currency: "USD" },
        },
        bonuses: {
          rewards: { amount: 100, currency: "USD" },
          fees: { amount: 100, currency: "USD" },
          tax: { amount: 100, currency: "USD" },
        },
        _links: {},
      }),
    ).toEqual({ totalCents: 600, currency: "USD" });
  });

  it("treats missing sections/parts as 0 (draft without bonuses)", () => {
    expect(
      parseProlificStudyCost({
        rewards: {
          rewards: { amount: 5000, currency: "GBP" },
          fees: { amount: 1500 },
        },
      }),
    ).toEqual({ totalCents: 6500, currency: "GBP" });
  });

  it("skips invalid amounts instead of failing the whole parse", () => {
    expect(
      parseProlificStudyCost({
        rewards: {
          rewards: { amount: "100", currency: "EUR" },
          fees: { amount: 200, currency: "EUR" },
        },
      }),
    ).toEqual({ totalCents: 200, currency: "EUR" });
  });

  it("returns null when nothing is parseable", () => {
    expect(parseProlificStudyCost(null)).toBeNull();
    expect(parseProlificStudyCost({})).toBeNull();
    expect(parseProlificStudyCost({ rewards: { rewards: { amount: -5 } } })).toBeNull();
    expect(parseProlificStudyCost("x")).toBeNull();
  });
});

describe("parseProlificErrorMessage", () => {
  it("combines title and string detail from the documented envelope", () => {
    expect(
      parseProlificErrorMessage({
        error: {
          status: 400,
          error_code: 100,
          title: "Insufficient funds",
          detail: "Your workspace balance does not cover the study cost.",
        },
      }),
    ).toBe(
      "Insufficient funds: Your workspace balance does not cover the study cost.",
    );
  });

  it("handles title-only, detail-only and array details", () => {
    expect(parseProlificErrorMessage({ error: { title: "Bad request" } })).toBe(
      "Bad request",
    );
    expect(
      parseProlificErrorMessage({ error: { detail: ["a is required", "b too small"] } }),
    ).toBe("a is required; b too small");
  });

  it("returns null for object details, empty envelopes and non-objects", () => {
    expect(
      parseProlificErrorMessage({ error: { detail: { field: ["nested"] } } }),
    ).toBeNull();
    expect(parseProlificErrorMessage({ error: {} })).toBeNull();
    expect(parseProlificErrorMessage({})).toBeNull();
    expect(parseProlificErrorMessage(null)).toBeNull();
    expect(parseProlificErrorMessage("boom")).toBeNull();
  });

  it("caps overlong provider messages", () => {
    const msg = parseProlificErrorMessage({
      error: { title: "T", detail: "x".repeat(600) },
    });
    expect(msg).not.toBeNull();
    expect(msg!.length).toBeLessThanOrEqual(501);
    expect(msg!.endsWith("…")).toBe(true);
  });
});
