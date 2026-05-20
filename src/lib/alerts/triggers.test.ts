import { describe, expect, it } from "vitest";
import {
  buildChampionLostAlert,
  buildForecastChangeAlert,
  buildRiskSpikeAlert,
  calculatePctChange,
  forecastChangeSeverity,
  riskSpikeSeverity,
  shouldTriggerForecastChange,
  shouldTriggerRiskSpike,
} from "./triggers";

describe("risk spike trigger helpers", () => {
  it("requires a previous score", () => {
    expect(shouldTriggerRiskSpike(null, 90, 25)).toBe(false);
  });

  it("triggers when score increases by threshold", () => {
    expect(shouldTriggerRiskSpike(40, 65, 25)).toBe(true);
    expect(shouldTriggerRiskSpike(40, 64, 25)).toBe(false);
  });

  it("maps critical severity for high new scores", () => {
    expect(riskSpikeSeverity(82)).toBe("critical");
    expect(riskSpikeSeverity(79)).toBe("warning");
  });

  it("builds risk-spike payload metadata", () => {
    const alert = buildRiskSpikeAlert({
      orgId: "org_1",
      dealId: "deal_1",
      oldScore: 42,
      newScore: 73,
      topSignalDescription: "Stalling",
      dealContext: {
        org_id: "org_1",
        deal_name: "Nordbank Enterprise",
      },
    });

    expect(alert.type).toBe("risk_spike");
    expect(alert.context.metadata?.old_score).toBe(42);
    expect(alert.context.metadata?.new_score).toBe(73);
  });
});
describe("champion lost trigger helpers", () => {
  it("builds champion-lost payload with evidence", () => {
    const alert = buildChampionLostAlert({
      orgId: "org_1",
      dealId: "deal_1",
      championName: "Anna Becker",
      evidence: "Ich verlasse die Firma.",
      dealContext: {
        org_id: "org_1",
        deal_name: "Nordbank Enterprise",
      },
    });

    expect(alert.type).toBe("champion_lost");
    expect(alert.severity).toBe("critical");
    expect(alert.context.metadata?.champion_name).toBe("Anna Becker");
  });
});

describe("forecast-change trigger helpers", () => {
  it("calculates percentage change", () => {
    expect(calculatePctChange(100, 120)).toBe(20);
    expect(calculatePctChange(100, 75)).toBe(-25);
  });

  it("handles zero old pipeline value", () => {
    expect(calculatePctChange(0, 100)).toBe(100);
    expect(calculatePctChange(0, 0)).toBe(0);
  });

  it("checks absolute threshold", () => {
    expect(shouldTriggerForecastChange(100, 121, 20)).toBe(true);
    expect(shouldTriggerForecastChange(100, 85, 20)).toBe(false);
  });

  it("maps severity based on direction", () => {
    expect(forecastChangeSeverity(-21)).toBe("critical");
    expect(forecastChangeSeverity(21)).toBe("info");
  });

  it("builds forecast-change payload metadata", () => {
    const alert = buildForecastChangeAlert({
      orgId: "org_1",
      oldPipelineValue: 500000,
      newPipelineValue: 350000,
    });

    expect(alert.type).toBe("forecast_change");
    expect(alert.context.metadata?.pct_change).toBe(-30);
  });
});
