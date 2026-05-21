import { describe, expect, it } from "vitest";
import { findDealsAtLossRisk } from "./early-warning";
import type { LossPattern } from "./pattern-mapping";

const patterns: LossPattern[] = [
  {
    reason: "compliance",
    loss_count: 4,
    loss_percentage: 50,
    total_lost_value: 400_000,
    predictive_signals: ["late_decision_maker", "budget_friction"],
  },
  {
    reason: "competitor",
    loss_count: 2,
    loss_percentage: 25,
    total_lost_value: 120_000,
    predictive_signals: ["competitor_pressure"],
  },
  {
    reason: "timing",
    loss_count: 1,
    loss_percentage: 12,
    total_lost_value: 20_000,
    predictive_signals: ["stalling"],
  },
];

describe("findDealsAtLossRisk", () => {
  it("matches open deals against predictive loss-pattern signals", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "deal_1",
          name: "Nordbank",
          amount: 100_000,
          activeSignals: ["late_decision_maker"],
        },
      ],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      deal_id: "deal_1",
      matched_pattern: "compliance",
      pattern_percentage: 50,
      matching_signals: ["late_decision_maker"],
      warning_strength: "medium",
    });
  });

  it("sets high warning only for frequent pattern plus multiple matching signals", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "deal_1",
          name: "Bank",
          amount: 100_000,
          activeSignals: ["late_decision_maker", "budget_friction"],
        },
      ],
    });

    expect(warnings[0]?.warning_strength).toBe("high");
  });

  it("sets medium warning for a 25% pattern with one matching signal", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "deal_2",
          name: "SaaSCo",
          amount: 80_000,
          activeSignals: ["competitor_pressure"],
        },
      ],
    });

    expect(warnings[0]?.matched_pattern).toBe("competitor");
    expect(warnings[0]?.warning_strength).toBe("medium");
  });

  it("sets low warning for a significant but weaker pattern", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: [
        {
          reason: "budget",
          loss_count: 1,
          loss_percentage: 16,
          total_lost_value: 30_000,
          predictive_signals: ["budget_friction"],
        },
      ],
      openDeals: [
        {
          id: "deal_3",
          name: "Helven",
          amount: 25_000,
          activeSignals: ["budget_friction"],
        },
      ],
    });

    expect(warnings[0]?.warning_strength).toBe("low");
  });

  it("ignores non-significant patterns below 15%", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "deal_4",
          name: "Timing Only",
          amount: 25_000,
          activeSignals: ["stalling"],
        },
      ],
    });

    expect(warnings).toEqual([]);
  });

  it("does not warn when no active signal matches", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "deal_5",
          name: "Clean Deal",
          amount: 25_000,
          activeSignals: ["engagement_drop"],
        },
      ],
    });

    expect(warnings).toEqual([]);
  });

  it("uses only the first significant matching pattern per deal", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "deal_6",
          name: "Mixed Deal",
          amount: 25_000,
          activeSignals: ["late_decision_maker", "competitor_pressure"],
        },
      ],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.matched_pattern).toBe("compliance");
  });

  it("sorts warnings by strength and then deal value", () => {
    const warnings = findDealsAtLossRisk({
      lossPatterns: patterns,
      openDeals: [
        {
          id: "low_value_high",
          name: "Low Value High",
          amount: 10_000,
          activeSignals: ["late_decision_maker", "budget_friction"],
        },
        {
          id: "high_value_medium",
          name: "High Value Medium",
          amount: 300_000,
          activeSignals: ["competitor_pressure"],
        },
        {
          id: "higher_value_medium",
          name: "Higher Value Medium",
          amount: 500_000,
          activeSignals: ["competitor_pressure"],
        },
      ],
    });

    expect(warnings.map((warning) => warning.deal_id)).toEqual([
      "low_value_high",
      "higher_value_medium",
      "high_value_medium",
    ]);
  });
});
