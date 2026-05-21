import { describe, expect, it } from "vitest";
import {
  LOSS_TO_SIGNAL_MAP,
  computeLossPatterns,
} from "./pattern-mapping";
import type { LossReasonType } from "./extractor";

const loss = (reason: LossReasonType, amount = 1000) => ({
  primary_reason: reason,
  deal_amount: amount,
});

describe("computeLossPatterns", () => {
  it("returns empty array on empty input", () => {
    expect(computeLossPatterns([])).toEqual([]);
  });

  it("counts losses per reason", () => {
    const result = computeLossPatterns([
      loss("pricing"),
      loss("pricing"),
      loss("competitor"),
    ]);

    const pricing = result.find((p) => p.reason === "pricing");
    expect(pricing?.loss_count).toBe(2);
    expect(pricing?.loss_percentage).toBe(67);

    const competitor = result.find((p) => p.reason === "competitor");
    expect(competitor?.loss_count).toBe(1);
    expect(competitor?.loss_percentage).toBe(33);
  });

  it("sums deal amounts per reason", () => {
    const result = computeLossPatterns([
      loss("pricing", 50000),
      loss("pricing", 30000),
    ]);
    const pricing = result.find((p) => p.reason === "pricing");
    expect(pricing?.total_lost_value).toBe(80000);
  });

  it("sorts patterns by loss_count descending", () => {
    const result = computeLossPatterns([
      loss("pricing"),
      loss("competitor"),
      loss("competitor"),
      loss("competitor"),
      loss("compliance"),
      loss("compliance"),
    ]);

    expect(result.map((p) => p.reason)).toEqual([
      "competitor",
      "compliance",
      "pricing",
    ]);
  });

  it("attaches predictive_signals from the mapping", () => {
    const result = computeLossPatterns([loss("compliance")]);
    expect(result[0].predictive_signals).toEqual(
      LOSS_TO_SIGNAL_MAP.compliance,
    );
  });

  it("handles all 10 LossReasonTypes without crashing", () => {
    const reasons: LossReasonType[] = [
      "pricing",
      "budget",
      "compliance",
      "competitor",
      "timing",
      "champion_lost",
      "feature_gap",
      "no_decision",
      "internal_priority",
      "other",
    ];
    const result = computeLossPatterns(reasons.map((r) => loss(r)));
    expect(result).toHaveLength(10);
    for (const r of result) {
      expect(r.loss_percentage).toBe(10);
    }
  });
});

describe("LOSS_TO_SIGNAL_MAP", () => {
  it("uses snake_case signal type names (matching orchestrator detectors)", () => {
    const allSignals = Object.values(LOSS_TO_SIGNAL_MAP).flat();
    for (const sig of allSignals) {
      expect(sig).toMatch(/^[a-z_]+$/);
    }
  });

  it("maps 'other' to no predictive signals", () => {
    expect(LOSS_TO_SIGNAL_MAP.other).toEqual([]);
  });

  it("maps pricing + budget to budget_friction", () => {
    expect(LOSS_TO_SIGNAL_MAP.pricing).toContain("budget_friction");
    expect(LOSS_TO_SIGNAL_MAP.budget).toContain("budget_friction");
  });

  it("maps champion_lost to both champion_loss and stakeholder_churn", () => {
    expect(LOSS_TO_SIGNAL_MAP.champion_lost).toEqual(
      expect.arrayContaining(["champion_loss", "stakeholder_churn"]),
    );
  });
});
