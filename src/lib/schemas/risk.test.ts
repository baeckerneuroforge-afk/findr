import { describe, expect, it } from "vitest";
import {
  AnalyzeRiskRequestSchema,
  RISK_SIGNAL_TYPES,
  RiskAnalysisResultSchema,
  RiskSignalSchema,
} from "./risk";

describe("RiskSignalSchema", () => {
  it("accepts valid signal", () => {
    const result = RiskSignalSchema.safeParse({
      type: "CHAMPION_LOSS",
      confidence: 0.85,
      reasoning: "Champion left the company",
      quotes: ["He resigned last week"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid signal type", () => {
    const result = RiskSignalSchema.safeParse({
      type: "MADE_UP_TYPE",
      confidence: 0.5,
      reasoning: "test",
      quotes: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const result = RiskSignalSchema.safeParse({
      type: "STALLING_PATTERN",
      confidence: 1.5,
      reasoning: "test",
      quotes: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative confidence", () => {
    const result = RiskSignalSchema.safeParse({
      type: "STALLING_PATTERN",
      confidence: -0.1,
      reasoning: "test",
      quotes: [],
    });

    expect(result.success).toBe(false);
  });

  it("defaults quotes to empty array", () => {
    const result = RiskSignalSchema.parse({
      type: "ENGAGEMENT_DROP",
      confidence: 0.5,
      reasoning: "test",
    });

    expect(result.quotes).toEqual([]);
  });
});

describe("RiskAnalysisResultSchema", () => {
  it("accepts valid result", () => {
    const result = RiskAnalysisResultSchema.safeParse({
      riskScore: 75,
      riskLevel: "high",
      signals: [
        {
          type: "CHAMPION_LOSS",
          confidence: 0.9,
          reasoning: "test",
          quotes: [],
        },
      ],
      overallReasoning: "Champion has left",
      recommendations: ["Reach out to backup champion"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects riskScore > 100", () => {
    const result = RiskAnalysisResultSchema.safeParse({
      riskScore: 105,
      riskLevel: "critical",
      signals: [],
      overallReasoning: "test",
      recommendations: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid risk level", () => {
    const result = RiskAnalysisResultSchema.safeParse({
      riskScore: 50,
      riskLevel: "extreme",
      signals: [],
      overallReasoning: "test",
      recommendations: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects > 8 signals", () => {
    const result = RiskAnalysisResultSchema.safeParse({
      riskScore: 50,
      riskLevel: "medium",
      signals: Array(9).fill({
        type: "STALLING_PATTERN",
        confidence: 0.5,
        reasoning: "test",
        quotes: [],
      }),
      overallReasoning: "test",
      recommendations: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("AnalyzeRiskRequestSchema", () => {
  it("requires dealId", () => {
    const result = AnalyzeRiskRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects empty dealId", () => {
    const result = AnalyzeRiskRequestSchema.safeParse({ dealId: "" });

    expect(result.success).toBe(false);
  });

  it("accepts valid dealId", () => {
    const result = AnalyzeRiskRequestSchema.safeParse({ dealId: "deal_001" });

    expect(result.success).toBe(true);
  });
});

describe("RISK_SIGNAL_TYPES constant", () => {
  it("has exactly 8 signal types", () => {
    expect(RISK_SIGNAL_TYPES).toHaveLength(8);
  });

  it("contains expected types", () => {
    expect(RISK_SIGNAL_TYPES).toContain("CHAMPION_LOSS");
    expect(RISK_SIGNAL_TYPES).toContain("COMPETITOR_PRESSURE");
    expect(RISK_SIGNAL_TYPES).toContain("STALLING_PATTERN");
  });
});
