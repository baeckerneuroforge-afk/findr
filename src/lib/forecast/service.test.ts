import { describe, expect, it } from "vitest";
import { buildForecastSummary } from "@/lib/forecast/service";
import type { Deal } from "@/lib/deals/types";

function makeDeal(overrides: Partial<Deal>): Deal {
  return {
    id: "deal_default",
    name: "Default Deal",
    companyName: "Default GmbH",
    amount: 10_000,
    currency: "EUR",
    stage: "qualified",
    ownerName: "Sarah Mueller",
    championName: "Nina Bauer",
    championTitle: "VP Sales",
    daysSinceLastActivity: 14,
    callsCompleted: 2,
    emailsSent: 5,
    stakeholdersCount: 3,
    competitorsMentioned: [],
    closeDate: "2026-06-30T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildForecastSummary", () => {
  it("excludes closed deals from forecast totals", () => {
    const summary = buildForecastSummary([
      makeDeal({ id: "open", amount: 100_000, stage: "negotiation" }),
      makeDeal({ id: "won", amount: 900_000, stage: "closed_won" }),
      makeDeal({ id: "lost", amount: 800_000, stage: "closed_lost" }),
    ]);

    expect(summary.open_deal_count).toBe(1);
    expect(summary.total_pipeline_value).toBe(100_000);
    expect(summary.forecasts).toHaveLength(1);
  });

  it("sums total and weighted pipeline values", () => {
    const summary = buildForecastSummary([
      makeDeal({
        id: "qualified",
        amount: 10_000,
        stage: "qualified",
        riskScore: 0,
        daysSinceLastActivity: 2,
      }),
      makeDeal({
        id: "negotiation",
        amount: 50_000,
        stage: "negotiation",
        riskScore: 20,
        daysSinceLastActivity: 14,
      }),
      makeDeal({
        id: "verbal",
        amount: 40_000,
        stage: "verbal_commit",
        riskScore: 10,
        daysSinceLastActivity: 1,
      }),
    ]);

    expect(summary.total_pipeline_value).toBe(100_000);
    expect(summary.weighted_pipeline_value).toBe(62_000);
    expect(summary.likely_case).toBe(62_000);
  });

  it("calculates best and worst case scenarios from win probabilities", () => {
    const summary = buildForecastSummary([
      makeDeal({
        id: "low",
        amount: 10_000,
        stage: "qualified",
        riskScore: 0,
        daysSinceLastActivity: 2,
      }),
      makeDeal({
        id: "best_only",
        amount: 50_000,
        stage: "negotiation",
        riskScore: 0,
        daysSinceLastActivity: 2,
      }),
      makeDeal({
        id: "best_and_worst",
        amount: 40_000,
        stage: "verbal_commit",
        riskScore: 0,
        daysSinceLastActivity: 2,
      }),
    ]);

    expect(summary.best_case).toBe(90_000);
    expect(summary.worst_case).toBe(40_000);
  });

  it("calculates at-risk value from deals with risk score 60 or higher", () => {
    const summary = buildForecastSummary([
      makeDeal({ id: "safe", amount: 20_000, riskScore: 59 }),
      makeDeal({ id: "risky", amount: 30_000, riskScore: 60 }),
      makeDeal({ id: "critical", amount: 40_000, riskScore: 90 }),
    ]);

    expect(summary.deals_at_risk_value).toBe(70_000);
  });

  it("groups count, raw value, and weighted value by stage", () => {
    const summary = buildForecastSummary([
      makeDeal({
        id: "demo_1",
        amount: 20_000,
        stage: "demo",
        riskScore: 0,
        daysSinceLastActivity: 2,
      }),
      makeDeal({
        id: "demo_2",
        amount: 10_000,
        stage: "demo",
        riskScore: 50,
        daysSinceLastActivity: 14,
      }),
      makeDeal({
        id: "proposal",
        amount: 30_000,
        stage: "proposal_sent",
        riskScore: 0,
        daysSinceLastActivity: 14,
      }),
    ]);

    const demo = summary.by_stage.find((stage) => stage.stage === "demo");
    const proposal = summary.by_stage.find(
      (stage) => stage.stage === "proposal_sent",
    );

    expect(demo).toEqual({
      stage: "demo",
      count: 2,
      value: 30_000,
      weighted: 8_500,
    });
    expect(proposal).toEqual({
      stage: "proposal_sent",
      count: 1,
      value: 30_000,
      weighted: 12_000,
    });
  });

  it("sorts deal forecasts by weighted value descending", () => {
    const summary = buildForecastSummary([
      makeDeal({ id: "small", amount: 10_000, stage: "verbal_commit" }),
      makeDeal({ id: "large", amount: 100_000, stage: "negotiation" }),
      makeDeal({ id: "medium", amount: 50_000, stage: "proposal_sent" }),
    ]);

    expect(summary.forecasts.map((forecast) => forecast.deal_id)).toEqual([
      "large",
      "medium",
      "small",
    ]);
  });

  it("returns an empty summary for an empty deal list", () => {
    const summary = buildForecastSummary([]);

    expect(summary).toMatchObject({
      total_pipeline_value: 0,
      weighted_pipeline_value: 0,
      best_case: 0,
      likely_case: 0,
      worst_case: 0,
      deals_at_risk_value: 0,
      open_deal_count: 0,
      forecasts: [],
      by_stage: [],
    });
  });
});
