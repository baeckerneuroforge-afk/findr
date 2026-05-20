import { describe, expect, it } from "vitest";
import { analyzeRisk, calculateCompositeRiskScore, scoreToSeverity } from "./orchestrator";
import type { DetectedSignal } from "./types";
import { makeCall, makeInput } from "./detectors/test-helpers";

describe("analyzeRisk orchestrator", () => {
  it("aggregates signals from multiple detectors", async () => {
    const result = await analyzeRisk(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir evaluieren parallel Salesforce." },
          { text: "Pricing ist ein Thema und der CFO braucht ROI Zahlen." },
        ]),
      ]),
    );

    expect(result.signals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining(["competitor_pressure", "budget_friction"]),
    );
    expect(result.overall_risk_score).toBeGreaterThanOrEqual(40);
  });

  it("returns low risk for a healthy deal", async () => {
    const result = await analyzeRisk(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Decision criteria sind klar, Procurement ist eingebunden und Dienstag ist unser naechster Termin." },
        ]),
      ]),
    );

    expect(result.signals).toHaveLength(0);
    expect(result.overall_risk_score).toBeLessThan(35);
    expect(result.overall_severity).toBe("low");
  });

  it("generates recommendations for detected signals", async () => {
    const result = await analyzeRisk(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir evaluieren parallel Gong und Clari." },
        ]),
      ]),
    );

    expect(result.recommendations[0]?.signal_type).toBe("competitor_pressure");
    expect(result.detector_versions).toHaveProperty("competitor_pressure", "1.0.0");
  });
});

describe("composite scoring", () => {
  it("scores no signals as zero", () => {
    expect(calculateCompositeRiskScore([])).toBe(0);
    expect(scoreToSeverity(0)).toBe("low");
  });

  it("adds bounded bonus for additional signals", () => {
    const signal = (severity: DetectedSignal["severity"]): DetectedSignal => ({
      type: "stalling",
      confidence: 0.8,
      severity,
      evidence: [],
      detected_at: "2026-04-01T00:00:00.000Z",
    });

    expect(calculateCompositeRiskScore([signal("high"), signal("medium")])).toBe(70);
    expect(scoreToSeverity(90)).toBe("critical");
  });
});

