import { describe, expect, it } from "vitest";
import { buildLossReportPdf, buildForecastPdf } from "./generator";
import type { LossReportData } from "@/lib/loss/reports";
import type { ForecastSummary } from "@/lib/forecast/service";

const fullReport: LossReportData = {
  period_start: "2026-01-01",
  period_end: "2026-03-31",
  total_lost_deals: 4,
  total_lost_value: 320000,
  breakdown: [
    {
      reason: "compliance",
      count: 2,
      value: 200000,
      percentage: 50,
      sample_quotes: ["We need SOC2 before we can sign.", "Legal flagged data residency."],
    },
    {
      reason: "pricing",
      count: 1,
      value: 80000,
      percentage: 25,
      sample_quotes: [],
    },
    {
      reason: "competitor",
      count: 1,
      value: 40000,
      percentage: 25,
      sample_quotes: ["Going with Salesforce."],
    },
  ],
  top_lost_companies: [
    { name: "Nordbank GmbH", value: 150000, reason: "compliance" },
    { name: "TechCorp Inc.", value: 80000, reason: "pricing" },
  ],
  trends: { vs_previous_period_count: 0, vs_previous_period_value: 0 },
};

const emptyReport: LossReportData = {
  period_start: "2026-01-01",
  period_end: "2026-03-31",
  total_lost_deals: 0,
  total_lost_value: 0,
  breakdown: [],
  top_lost_companies: [],
  trends: { vs_previous_period_count: 0, vs_previous_period_value: 0 },
};

const fullForecast: ForecastSummary = {
  total_pipeline_value: 500000,
  weighted_pipeline_value: 220000,
  best_case: 300000,
  likely_case: 220000,
  worst_case: 90000,
  deals_at_risk_value: 120000,
  open_deal_count: 3,
  forecasts: [
    {
      deal_id: "d1",
      deal_name: "Nordbank Enterprise",
      amount: 200000,
      stage: "negotiation",
      risk_score: 80,
      win_probability: 45,
      weighted_value: 90000,
      factors: {
        stageBaseline: 60,
        riskAdjustment: -15,
        engagementBonus: 0,
        agePenalty: 0,
      },
      confidence: "medium",
    },
    {
      deal_id: "d2",
      deal_name: "TechCorp Renewal",
      amount: 120000,
      stage: "verbal_commit",
      risk_score: 20,
      win_probability: 85,
      weighted_value: 102000,
      factors: {
        stageBaseline: 80,
        riskAdjustment: 5,
        engagementBonus: 0,
        agePenalty: 0,
      },
      confidence: "high",
    },
  ],
  by_stage: [
    { stage: "negotiation", count: 1, value: 200000, weighted: 90000 },
    { stage: "verbal_commit", count: 1, value: 120000, weighted: 102000 },
  ],
};

const emptyForecast: ForecastSummary = {
  total_pipeline_value: 0,
  weighted_pipeline_value: 0,
  best_case: 0,
  likely_case: 0,
  worst_case: 0,
  deals_at_risk_value: 0,
  open_deal_count: 0,
  forecasts: [],
  by_stage: [],
};

function isPdf(buf: Buffer): boolean {
  return buf.subarray(0, 4).toString("latin1") === "%PDF";
}

describe("buildLossReportPdf", () => {
  it("returns a non-empty buffer starting with the PDF magic bytes", async () => {
    const buf = await buildLossReportPdf(fullReport, "Test Org");
    expect(buf.length).toBeGreaterThan(0);
    expect(isPdf(buf)).toBe(true);
  });

  it("handles an empty report without crashing", async () => {
    const buf = await buildLossReportPdf(emptyReport, "Test Org");
    expect(buf.length).toBeGreaterThan(0);
    expect(isPdf(buf)).toBe(true);
  });

  it("handles a report whose reasons have no sample quotes", async () => {
    const noQuotes: LossReportData = {
      ...fullReport,
      breakdown: fullReport.breakdown.map((b) => ({
        ...b,
        sample_quotes: [],
      })),
    };
    const buf = await buildLossReportPdf(noQuotes, "Test Org");
    expect(isPdf(buf)).toBe(true);
  });

  it("handles a long org name", async () => {
    const buf = await buildLossReportPdf(
      fullReport,
      "A Very Long Organization Name That Could Wrap GmbH & Co. KG",
    );
    expect(isPdf(buf)).toBe(true);
  });
});

describe("buildForecastPdf", () => {
  it("returns a non-empty buffer starting with the PDF magic bytes", async () => {
    const buf = await buildForecastPdf(fullForecast, "Test Org");
    expect(buf.length).toBeGreaterThan(0);
    expect(isPdf(buf)).toBe(true);
  });

  it("handles an empty forecast (no open deals) without crashing", async () => {
    const buf = await buildForecastPdf(emptyForecast, "Test Org");
    expect(buf.length).toBeGreaterThan(0);
    expect(isPdf(buf)).toBe(true);
  });

  it("handles more than 10 deals (top-10 slice)", async () => {
    const many: ForecastSummary = {
      ...fullForecast,
      open_deal_count: 15,
      forecasts: Array.from({ length: 15 }, (_, i) => ({
        ...fullForecast.forecasts[0],
        deal_id: `deal-${i}`,
        deal_name: `Deal ${i}`,
      })),
    };
    const buf = await buildForecastPdf(many, "Test Org");
    expect(isPdf(buf)).toBe(true);
  });
});
