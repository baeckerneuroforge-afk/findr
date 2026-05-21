import { describe, expect, it } from "vitest";
import {
  calculateWinProbability,
  getStageBaseline,
} from "@/lib/forecast/probability";

describe("calculateWinProbability", () => {
  it("applies stage baseline for verbal commit deals", () => {
    const forecast = calculateWinProbability({
      id: "deal_001",
      name: "Verbal Commit Deal",
      amount: 100_000,
      stage: "verbal_commit",
      riskScore: 0,
      lastActivityDays: 14,
    });

    expect(forecast.factors.stageBaseline).toBe(80);
    expect(forecast.win_probability).toBe(80);
  });

  it("uses a conservative fallback baseline for unknown stages", () => {
    expect(getStageBaseline("custom_stage")).toBe(30);
  });

  it("reduces win probability for high-risk deals", () => {
    const forecast = calculateWinProbability({
      id: "deal_002",
      name: "High Risk Deal",
      amount: 80_000,
      stage: "negotiation",
      riskScore: 80,
      lastActivityDays: 14,
    });

    expect(forecast.factors.riskAdjustment).toBe(-40);
    expect(forecast.win_probability).toBe(20);
  });

  it("increases win probability for very recent activity", () => {
    const forecast = calculateWinProbability({
      id: "deal_003",
      name: "Active Deal",
      amount: 60_000,
      stage: "proposal_sent",
      riskScore: 0,
      lastActivityDays: 2,
    });

    expect(forecast.factors.engagementBonus).toBe(10);
    expect(forecast.win_probability).toBe(50);
  });

  it("penalizes stalled deals with no recent activity", () => {
    const forecast = calculateWinProbability({
      id: "deal_004",
      name: "Stalled Deal",
      amount: 60_000,
      stage: "proposal_sent",
      riskScore: 0,
      lastActivityDays: 45,
    });

    expect(forecast.factors.engagementBonus).toBe(-15);
    expect(forecast.win_probability).toBe(25);
  });

  it("keeps win probability inside the 0-100 range", () => {
    const low = calculateWinProbability({
      id: "deal_005",
      name: "Very Risky Deal",
      amount: 60_000,
      stage: "closed_lost",
      riskScore: 100,
      lastActivityDays: 90,
    });
    const high = calculateWinProbability({
      id: "deal_006",
      name: "Closed Won Deal",
      amount: 60_000,
      stage: "closed_won",
      riskScore: 0,
      lastActivityDays: 0,
    });

    expect(low.win_probability).toBe(0);
    expect(high.win_probability).toBe(100);
  });

  it("calculates weighted value from amount and probability", () => {
    const forecast = calculateWinProbability({
      id: "deal_007",
      name: "Weighted Deal",
      amount: 50_000,
      stage: "negotiation",
      riskScore: 20,
      lastActivityDays: 14,
    });

    expect(forecast.win_probability).toBe(50);
    expect(forecast.weighted_value).toBe(25_000);
  });

  it("marks confidence high only when risk and recent activity are present", () => {
    const high = calculateWinProbability({
      id: "deal_008",
      name: "High Confidence",
      amount: 50_000,
      stage: "demo",
      riskScore: 20,
      lastActivityDays: 7,
    });
    const medium = calculateWinProbability({
      id: "deal_009",
      name: "Medium Confidence",
      amount: 50_000,
      stage: "demo",
      riskScore: 20,
      lastActivityDays: 30,
    });
    const low = calculateWinProbability({
      id: "deal_010",
      name: "Low Confidence",
      amount: 50_000,
      stage: "demo",
      lastActivityDays: 7,
    });

    expect(high.confidence).toBe("high");
    expect(medium.confidence).toBe("medium");
    expect(low.confidence).toBe("low");
  });
});
