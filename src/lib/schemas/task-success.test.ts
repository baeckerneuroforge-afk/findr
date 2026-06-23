import { describe, it, expect } from "vitest";
import {
  coerceTaskSuccessJudgment,
  TASK_SUCCESS_JUDGMENT_VERSION,
} from "./task-success";

describe("coerceTaskSuccessJudgment", () => {
  const valid = {
    version: TASK_SUCCESS_JUDGMENT_VERSION,
    judgedAt: "2026-06-23T10:00:00.000Z",
    model: "claude-haiku",
    verdict: "partial" as const,
    confidence: 0.5,
    reasoning: "Teilweise erreicht.",
  };

  it("passes a well-formed record through unchanged", () => {
    expect(coerceTaskSuccessJudgment(valid)).toEqual(valid);
  });

  it("smooths null/undefined to null (never judged)", () => {
    expect(coerceTaskSuccessJudgment(null)).toBeNull();
    expect(coerceTaskSuccessJudgment(undefined)).toBeNull();
  });

  it("rejects a foreign version (forward-compat: v1 UI shows nothing)", () => {
    expect(coerceTaskSuccessJudgment({ ...valid, version: 2 })).toBeNull();
  });

  it("rejects an out-of-vocabulary verdict and malformed shapes", () => {
    expect(coerceTaskSuccessJudgment({ ...valid, verdict: "nope" })).toBeNull();
    expect(
      coerceTaskSuccessJudgment({ ...valid, confidence: 1.5 }),
    ).toBeNull();
    expect(coerceTaskSuccessJudgment({ foo: "bar" })).toBeNull();
  });
});
