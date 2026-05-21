import { describe, expect, it } from "vitest";
import { forecastRiskImpact, dealRiskImpact } from "./service";

describe("forecastRiskImpact", () => {
  it("computes absolute reduction as total minus weighted", () => {
    const impact = forecastRiskImpact({
      total_pipeline_value: 500_000,
      weighted_pipeline_value: 220_000,
    });
    expect(impact.absolute).toBe(280_000);
  });

  it("computes percentage of total pipeline", () => {
    const impact = forecastRiskImpact({
      total_pipeline_value: 500_000,
      weighted_pipeline_value: 250_000,
    });
    expect(impact.percentage).toBe(50);
  });

  it("returns 0 impact when weighted equals total (no reduction)", () => {
    const impact = forecastRiskImpact({
      total_pipeline_value: 100_000,
      weighted_pipeline_value: 100_000,
    });
    expect(impact.absolute).toBe(0);
    expect(impact.percentage).toBe(0);
  });

  it("returns 0 percentage for an empty pipeline (no divide-by-zero)", () => {
    const impact = forecastRiskImpact({
      total_pipeline_value: 0,
      weighted_pipeline_value: 0,
    });
    expect(impact.absolute).toBe(0);
    expect(impact.percentage).toBe(0);
  });

  it("never returns a negative absolute (defensive against rounding)", () => {
    const impact = forecastRiskImpact({
      total_pipeline_value: 100_000,
      weighted_pipeline_value: 100_001,
    });
    expect(impact.absolute).toBe(0);
  });
});

describe("dealRiskImpact", () => {
  it("returns amount minus weighted_value", () => {
    expect(dealRiskImpact({ amount: 100_000, weighted_value: 40_000 })).toBe(
      60_000,
    );
  });

  it("returns 0 when the deal is fully weighted", () => {
    expect(dealRiskImpact({ amount: 50_000, weighted_value: 50_000 })).toBe(0);
  });

  it("never returns negative", () => {
    expect(dealRiskImpact({ amount: 50_000, weighted_value: 60_000 })).toBe(0);
  });
});
