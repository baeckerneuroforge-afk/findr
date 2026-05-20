import { describe, expect, it } from "vitest";
import {
  RECOMMENDATIONS_LIBRARY,
  generateRecommendations,
} from "./recommendations";
import type { DetectedSignal, SignalType } from "./types";

const SIGNAL_TYPES: SignalType[] = [
  "champion_loss",
  "competitor_pressure",
  "stalling",
  "budget_friction",
  "late_decision_maker",
  "stakeholder_churn",
  "engagement_drop",
  "multi_threading_failure",
];

function signal(type: SignalType, severity: DetectedSignal["severity"]): DetectedSignal {
  return {
    type,
    confidence: 0.8,
    severity,
    evidence: [],
    detected_at: "2026-04-01T00:00:00.000Z",
  };
}

describe("RECOMMENDATIONS_LIBRARY", () => {
  it("has three recommendations per signal type", () => {
    for (const type of SIGNAL_TYPES) {
      expect(RECOMMENDATIONS_LIBRARY[type]).toHaveLength(3);
    }
  });

  it("keeps recommendations tied to their signal type", () => {
    for (const type of SIGNAL_TYPES) {
      expect(
        RECOMMENDATIONS_LIBRARY[type].every(
          (recommendation) => recommendation.signal_type === type,
        ),
      ).toBe(true);
    }
  });
});

describe("generateRecommendations", () => {
  it("sorts urgent recommendations ahead of lower priorities", () => {
    const result = generateRecommendations([
      signal("engagement_drop", "medium"),
      signal("champion_loss", "critical"),
    ]);

    expect(result[0]?.priority).toBe("urgent");
    expect(result[0]?.signal_type).toBe("champion_loss");
  });

  it("deduplicates recommendations by signal type", () => {
    const result = generateRecommendations([
      signal("stalling", "high"),
      signal("stalling", "medium"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.signal_type).toBe("stalling");
  });
});

