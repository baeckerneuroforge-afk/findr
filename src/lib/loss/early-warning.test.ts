import { describe, expect, it } from "vitest";
import {
  findDealsAtLossRisk,
  SIGNIFICANT_PATTERN_THRESHOLD,
} from "./early-warning";
import type { LossPattern } from "./pattern-mapping";

const pattern = (
  reason: LossPattern["reason"],
  pct: number,
  signals: string[],
  count = 5,
): LossPattern => ({
  reason,
  loss_count: count,
  loss_percentage: pct,
  total_lost_value: 100_000,
  predictive_signals: signals,
});

const openDeal = (
  id: string,
  signals: string[],
  amount = 50_000,
  name = `Deal ${id}`,
) => ({ id, name, amount, activeSignals: signals });

describe("findDealsAtLossRisk", () => {
  it("returns empty when no significant patterns exist", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 10, ["budget_friction"])],
      openDeals: [openDeal("d1", ["budget_friction"])],
    });
    expect(warnings).toEqual([]);
  });

  it("filters patterns below SIGNIFICANT_PATTERN_THRESHOLD", () => {
    expect(SIGNIFICANT_PATTERN_THRESHOLD).toBe(15);
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 14, ["budget_friction"])],
      openDeals: [openDeal("d1", ["budget_friction"])],
    });
    expect(warnings).toHaveLength(0);
  });

  it("emits a warning when a significant pattern's signal matches", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 30, ["budget_friction"])],
      openDeals: [openDeal("d1", ["budget_friction"])],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].deal_id).toBe("d1");
    expect(warnings[0].matched_pattern).toBe("pricing");
    expect(warnings[0].pattern_percentage).toBe(30);
    expect(warnings[0].matching_signals).toEqual(["budget_friction"]);
  });

  it("does NOT emit a warning when no signal overlaps", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 50, ["budget_friction"])],
      openDeals: [openDeal("d1", ["champion_loss"])],
    });
    expect(warnings).toHaveLength(0);
  });

  it("classifies as 'high' only when pct>=40 AND >=2 matching signals", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [
        pattern("compliance", 50, ["late_decision_maker", "stalling"]),
      ],
      openDeals: [openDeal("d1", ["late_decision_maker", "stalling"])],
    });
    expect(warnings[0].warning_strength).toBe("high");
  });

  it("classifies as 'medium' when pct>=25 (one signal)", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 30, ["budget_friction"])],
      openDeals: [openDeal("d1", ["budget_friction"])],
    });
    expect(warnings[0].warning_strength).toBe("medium");
  });

  it("classifies as 'medium' when >=2 signals match (regardless of pct over 15)", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [
        pattern("compliance", 20, ["late_decision_maker", "stalling"]),
      ],
      openDeals: [openDeal("d1", ["late_decision_maker", "stalling"])],
    });
    expect(warnings[0].warning_strength).toBe("medium");
  });

  it("classifies as 'low' for borderline single-signal matches under 25%", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 20, ["budget_friction"])],
      openDeals: [openDeal("d1", ["budget_friction"])],
    });
    expect(warnings[0].warning_strength).toBe("low");
  });

  it("assigns each deal at most one warning (strongest first pattern wins)", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [
        pattern("pricing", 40, ["budget_friction"]),
        pattern("competitor", 25, ["competitor_pressure"]),
      ],
      openDeals: [
        openDeal("d1", ["budget_friction", "competitor_pressure"]),
      ],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].matched_pattern).toBe("pricing");
  });

  it("sorts warnings by strength then by deal_amount", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [
        pattern("compliance", 50, ["late_decision_maker", "stalling"]),
        pattern("pricing", 30, ["budget_friction"]),
      ],
      openDeals: [
        openDeal("low-small", ["budget_friction"], 10_000),
        openDeal("medium-big", ["budget_friction"], 200_000),
        openDeal("high", ["late_decision_maker", "stalling"], 50_000),
        openDeal("low-big", ["budget_friction"], 100_000),
      ],
    });

    expect(warnings.map((w) => w.deal_id)).toEqual([
      "high",
      "medium-big",
      "low-big",
      "low-small",
    ]);
  });

  it("returns empty for deal without active signals", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 50, ["budget_friction"])],
      openDeals: [openDeal("d1", [])],
    });
    expect(warnings).toHaveLength(0);
  });

  it("ignores patterns with empty predictive_signals (e.g. 'other')", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("other", 50, [])],
      openDeals: [openDeal("d1", ["budget_friction"])],
    });
    expect(warnings).toHaveLength(0);
  });

  it("preserves only the matching signals (not the whole predictive set)", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [
        pattern("compliance", 30, ["late_decision_maker", "stalling"]),
      ],
      openDeals: [openDeal("d1", ["late_decision_maker"])],
    });
    expect(warnings[0].matching_signals).toEqual(["late_decision_maker"]);
  });

  it("handles multiple deals in parallel", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [pattern("pricing", 50, ["budget_friction"])],
      openDeals: [
        openDeal("d1", ["budget_friction"]),
        openDeal("d2", []),
        openDeal("d3", ["budget_friction"]),
      ],
    });
    expect(warnings).toHaveLength(2);
    expect(warnings.map((w) => w.deal_id).sort()).toEqual(["d1", "d3"]);
  });
});
