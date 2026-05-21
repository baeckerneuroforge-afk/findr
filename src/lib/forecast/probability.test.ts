import { describe, expect, it } from "vitest";
import {
  calculateWinProbability,
  confidenceFactor,
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

  // ── Cohesion coupling 1: signal confidence scales the risk-adjustment ──

  it("applies full risk-adjustment when no signal confidence is given (no regression)", () => {
    const forecast = calculateWinProbability({
      id: "deal_conf_1",
      name: "No Confidence",
      amount: 80_000,
      stage: "negotiation",
      riskScore: 80,
      lastActivityDays: 14,
    });
    // Identical to the pre-coupling behavior: -(80/100)*50 = -40.
    expect(forecast.factors.riskAdjustment).toBe(-40);
    expect(forecast.win_probability).toBe(20);
    expect(forecast.avg_confidence).toBeUndefined();
  });

  it("applies full risk-adjustment at confidence 1.0", () => {
    const forecast = calculateWinProbability({
      id: "deal_conf_2",
      name: "Full Confidence",
      amount: 80_000,
      stage: "negotiation",
      riskScore: 80,
      lastActivityDays: 14,
      signalConfidence: 1,
    });
    expect(forecast.factors.riskAdjustment).toBe(-40);
    expect(forecast.win_probability).toBe(20);
    expect(forecast.avg_confidence).toBe(1);
  });

  it("dampens risk-adjustment to half at confidence 0.0", () => {
    const forecast = calculateWinProbability({
      id: "deal_conf_3",
      name: "Zero Confidence",
      amount: 80_000,
      stage: "negotiation",
      riskScore: 80,
      lastActivityDays: 14,
      signalConfidence: 0,
    });
    // factor 0.5 → -(80/100)*50*0.5 = -20. Risk pulls down half as hard.
    expect(forecast.factors.riskAdjustment).toBe(-20);
    expect(forecast.win_probability).toBe(40);
  });

  it("scales risk-adjustment proportionally for mid confidence", () => {
    const forecast = calculateWinProbability({
      id: "deal_conf_4",
      name: "Mid Confidence",
      amount: 80_000,
      stage: "negotiation",
      riskScore: 80,
      lastActivityDays: 14,
      signalConfidence: 0.6, // factor = 0.5 + 0.6*0.5 = 0.8 → -40*0.8 = -32
    });
    expect(forecast.factors.riskAdjustment).toBe(-32);
    expect(forecast.win_probability).toBe(28);
  });

  it("low-confidence risk keeps win probability higher than high-confidence risk", () => {
    const base = {
      id: "deal_conf_5",
      name: "Comparison",
      amount: 80_000,
      stage: "negotiation" as const,
      riskScore: 80,
      lastActivityDays: 14,
    };
    const lowConf = calculateWinProbability({ ...base, signalConfidence: 0.2 });
    const highConf = calculateWinProbability({ ...base, signalConfidence: 0.95 });
    expect(lowConf.win_probability).toBeGreaterThan(highConf.win_probability);
  });

  it("keeps win probability clamped to 0-100 with confidence scaling", () => {
    const forecast = calculateWinProbability({
      id: "deal_conf_6",
      name: "Clamp Check",
      amount: 80_000,
      stage: "closed_lost",
      riskScore: 100,
      lastActivityDays: 90,
      signalConfidence: 0,
    });
    expect(forecast.win_probability).toBeGreaterThanOrEqual(0);
    expect(forecast.win_probability).toBeLessThanOrEqual(100);
  });

  describe("confidenceFactor", () => {
    it("returns 1.0 when confidence is undefined", () => {
      expect(confidenceFactor(undefined)).toBe(1);
    });
    it("returns 0.5 at confidence 0 and 1.0 at confidence 1", () => {
      expect(confidenceFactor(0)).toBe(0.5);
      expect(confidenceFactor(1)).toBe(1);
    });
    it("clamps out-of-range confidence", () => {
      expect(confidenceFactor(-1)).toBe(0.5);
      expect(confidenceFactor(2)).toBe(1);
    });
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
