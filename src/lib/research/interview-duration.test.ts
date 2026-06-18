import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESEARCH_QUESTION_CEILING,
  MINUTES_PER_QUESTION,
  effectiveQuestionCeiling,
  estimateInterviewMinutes,
  isDurationFromTimeCap,
} from "./interview-duration";

describe("effectiveQuestionCeiling", () => {
  it("returns the configured maxRounds when set", () => {
    expect(effectiveQuestionCeiling(10)).toBe(10);
    expect(effectiveQuestionCeiling(2)).toBe(2);
  });

  it("falls back to the system default when null/undefined", () => {
    expect(effectiveQuestionCeiling(null)).toBe(DEFAULT_RESEARCH_QUESTION_CEILING);
    expect(effectiveQuestionCeiling(undefined)).toBe(
      DEFAULT_RESEARCH_QUESTION_CEILING,
    );
  });
});

describe("estimateInterviewMinutes", () => {
  it("lets the time limit win — it is the real cap", () => {
    // 3-Minuten-Cap (Andrés Fall): zeigt 3, nicht 45 oder 7-9.
    expect(estimateInterviewMinutes({ maxDurationSeconds: 180 })).toBe(3);
    // Cap gewinnt auch gegen einen hohen maxRounds-Wert.
    expect(
      estimateInterviewMinutes({ maxRounds: 15, maxDurationSeconds: 300 }),
    ).toBe(5);
  });

  it("rounds the time cap to whole minutes", () => {
    expect(estimateInterviewMinutes({ maxDurationSeconds: 150 })).toBe(3); // 2.5 → 3
    expect(estimateInterviewMinutes({ maxDurationSeconds: 200 })).toBe(3); // 3.33 → 3
  });

  it("derives from the question ceiling when no time limit is set", () => {
    expect(estimateInterviewMinutes({ maxRounds: 10 })).toBe(
      Math.round(10 * MINUTES_PER_QUESTION),
    );
    expect(estimateInterviewMinutes({ maxRounds: 4 })).toBe(
      Math.round(4 * MINUTES_PER_QUESTION),
    );
  });

  it("uses the default ceiling when neither value is set", () => {
    expect(estimateInterviewMinutes({})).toBe(
      Math.round(DEFAULT_RESEARCH_QUESTION_CEILING * MINUTES_PER_QUESTION),
    );
  });

  it("never returns less than 1 minute", () => {
    expect(estimateInterviewMinutes({ maxDurationSeconds: 0 })).toBe(1);
    expect(estimateInterviewMinutes({ maxRounds: 0 })).toBe(1);
  });
});

describe("isDurationFromTimeCap", () => {
  it("is true only when an explicit time limit is set", () => {
    expect(isDurationFromTimeCap({ maxDurationSeconds: 180 })).toBe(true);
    expect(isDurationFromTimeCap({ maxDurationSeconds: null })).toBe(false);
    expect(isDurationFromTimeCap({})).toBe(false);
  });
});
