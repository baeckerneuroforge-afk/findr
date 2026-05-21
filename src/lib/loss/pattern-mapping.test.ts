import { describe, expect, it } from "vitest";
import { computeLossPatterns, LOSS_TO_SIGNAL_MAP } from "./pattern-mapping";

describe("LOSS_TO_SIGNAL_MAP", () => {
  it("maps historical loss reasons to current orchestrator signal names", () => {
    expect(LOSS_TO_SIGNAL_MAP.competitor).toEqual(["competitor_pressure"]);
    expect(LOSS_TO_SIGNAL_MAP.budget).toEqual(["budget_friction"]);
    expect(LOSS_TO_SIGNAL_MAP.champion_lost).toEqual([
      "champion_loss",
      "stakeholder_churn",
    ]);
  });

  it("maps compliance to existing predictive signals without inventing a detector", () => {
    expect(LOSS_TO_SIGNAL_MAP.compliance).toEqual([
      "late_decision_maker",
      "budget_friction",
    ]);
  });
});

describe("computeLossPatterns", () => {
  it("returns empty patterns for empty input", () => {
    expect(computeLossPatterns([])).toEqual([]);
  });

  it("computes counts, percentages, values, and predictive signals", () => {
    const patterns = computeLossPatterns([
      { primary_reason: "compliance", deal_amount: 100_000 },
      { primary_reason: "compliance", deal_amount: 50_000 },
      { primary_reason: "competitor", deal_amount: 25_000 },
      { primary_reason: "budget", deal_amount: 10_000 },
    ]);

    expect(patterns[0]).toEqual({
      reason: "compliance",
      loss_count: 2,
      loss_percentage: 50,
      total_lost_value: 150_000,
      predictive_signals: ["late_decision_maker", "budget_friction"],
    });
    expect(patterns[1]?.loss_percentage).toBe(25);
  });

  it("sorts by loss count, then lost value", () => {
    const patterns = computeLossPatterns([
      { primary_reason: "budget", deal_amount: 100_000 },
      { primary_reason: "competitor", deal_amount: 40_000 },
      { primary_reason: "competitor", deal_amount: 10_000 },
      { primary_reason: "pricing", deal_amount: 30_000 },
      { primary_reason: "pricing", deal_amount: 40_000 },
    ]);

    expect(patterns.map((pattern) => pattern.reason)).toEqual([
      "pricing",
      "competitor",
      "budget",
    ]);
  });

  it("rounds loss percentages to whole numbers", () => {
    const patterns = computeLossPatterns([
      { primary_reason: "budget", deal_amount: 10 },
      { primary_reason: "competitor", deal_amount: 10 },
      { primary_reason: "competitor", deal_amount: 10 },
    ]);

    expect(patterns[0]?.loss_percentage).toBe(67);
    expect(patterns[1]?.loss_percentage).toBe(33);
  });
});
