import { describe, expect, it } from "vitest";
import { extractSignalTypes, normalizeSignalType } from "./early-warning-service";

describe("normalizeSignalType", () => {
  it("normalizes legacy uppercase risk signal names", () => {
    expect(normalizeSignalType("CHAMPION_LOSS")).toBe("champion_loss");
    expect(normalizeSignalType("COMPETITOR_PRESSURE")).toBe(
      "competitor_pressure",
    );
    expect(normalizeSignalType("STALLING_PATTERN")).toBe("stalling");
    expect(normalizeSignalType("MULTI_THREADING_FAILURE")).toBe(
      "multi_threading_failure",
    );
  });

  it("normalizes hyphenated and compact signal names", () => {
    expect(normalizeSignalType("budget-friction")).toBe("budget_friction");
    expect(normalizeSignalType("late decision maker")).toBe(
      "late_decision_maker",
    );
    expect(normalizeSignalType("multithreadingfailure")).toBe(
      "multi_threading_failure",
    );
  });

  it("returns null for unknown signals", () => {
    expect(normalizeSignalType("compliance-friction")).toBeNull();
    expect(normalizeSignalType(null)).toBeNull();
  });
});

describe("extractSignalTypes", () => {
  it("extracts unique normalized signal types from JSONB-style rows", () => {
    const result = extractSignalTypes([
      { type: "BUDGET_FRICTION" },
      { signal_type: "budget-friction" },
      { type: "LATE_DECISION_MAKER" },
      { type: "MADE_UP" },
    ]);

    expect(result).toEqual(["budget_friction", "late_decision_maker"]);
  });

  it("returns an empty list for non-array input", () => {
    expect(extractSignalTypes({ type: "BUDGET_FRICTION" })).toEqual([]);
  });
});
