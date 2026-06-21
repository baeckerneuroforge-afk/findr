import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_QUESTION_CAP,
  DEFAULT_INTERVIEW_DEPTH,
  DEFAULT_RESEARCH_QUESTION_CEILING,
  DEPTH_LAYERS,
  MINUTES_PER_QUESTION,
  depthLayers,
  depthQuestionCeiling,
  effectiveQuestionCeiling,
  estimateInterviewMinutes,
  expectedQuestionCount,
  isDurationFromTimeCap,
  resolveEffectiveMaxRounds,
  resolveExpectedQuestions,
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

describe("interview depth — layers per topic", () => {
  it("maps the three depths to 1 / 2 / 4 layers", () => {
    expect(DEPTH_LAYERS).toEqual({ flach: 1, mittel: 2, tief: 4 });
    expect(depthLayers("flach")).toBe(1);
    expect(depthLayers("mittel")).toBe(2);
    expect(depthLayers("tief")).toBe(4);
  });

  it("defaults to the system depth (mittel) when null/undefined", () => {
    expect(depthLayers(null)).toBe(DEPTH_LAYERS[DEFAULT_INTERVIEW_DEPTH]);
    expect(depthLayers(undefined)).toBe(2);
  });
});

describe("expectedQuestionCount — layers × topics", () => {
  it("multiplies layers by the topic count — the depths separate by topic", () => {
    expect(expectedQuestionCount("flach", 3)).toBe(3);
    expect(expectedQuestionCount("mittel", 3)).toBe(6);
    expect(expectedQuestionCount("tief", 3)).toBe(12);
  });

  it("treats <1 topic as 1 so depth still differentiates topicless studies", () => {
    expect(expectedQuestionCount("flach", 0)).toBe(1);
    expect(expectedQuestionCount("tief", 0)).toBe(4);
  });
});

describe("depthQuestionCeiling — safety net above the expected count", () => {
  it("sits a fixed buffer (+2) above the expected count", () => {
    expect(depthQuestionCeiling("mittel", 2)).toBe(6); // 4 + 2
    expect(depthQuestionCeiling("tief", 2)).toBe(10); // 8 + 2
  });

  it("never exceeds the absolute hard cap (15)", () => {
    expect(depthQuestionCeiling("tief", 99)).toBe(ABSOLUTE_QUESTION_CAP);
    expect(depthQuestionCeiling("tief", 99)).toBeLessThanOrEqual(15);
  });
});

describe("resolveEffectiveMaxRounds — the snapshot ceiling", () => {
  it("lets an explicit expert maxRounds win", () => {
    expect(
      resolveEffectiveMaxRounds({ maxRounds: 8, depth: "tief", topicCount: 5 }),
    ).toBe(8);
  });

  it("derives from depth × topics when no explicit maxRounds", () => {
    expect(resolveEffectiveMaxRounds({ depth: "tief", topicCount: 2 })).toBe(10);
    expect(resolveEffectiveMaxRounds({ depth: "flach", topicCount: 2 })).toBe(4);
  });

  it("falls back to the flat legacy default when neither is set (byte-identical)", () => {
    expect(resolveEffectiveMaxRounds({ topicCount: 3 })).toBe(
      DEFAULT_RESEARCH_QUESTION_CEILING,
    );
  });
});

describe("resolveExpectedQuestions — the honest typical count", () => {
  it("expert maxRounds wins, else depth × topics, else default", () => {
    expect(
      resolveExpectedQuestions({ maxRounds: 9, depth: "tief", topicCount: 3 }),
    ).toBe(9);
    expect(resolveExpectedQuestions({ depth: "tief", topicCount: 3 })).toBe(12);
    expect(resolveExpectedQuestions({})).toBe(DEFAULT_RESEARCH_QUESTION_CEILING);
  });
});

describe("estimateInterviewMinutes — depth-aware", () => {
  it("derives the duration from depth × topics when set", () => {
    expect(estimateInterviewMinutes({ depth: "tief", topicCount: 3 })).toBe(
      Math.round(12 * MINUTES_PER_QUESTION),
    );
  });

  it("keeps the legacy default for pre-depth callers (byte-identical)", () => {
    expect(estimateInterviewMinutes({})).toBe(
      Math.round(DEFAULT_RESEARCH_QUESTION_CEILING * MINUTES_PER_QUESTION),
    );
  });

  it("an explicit maxRounds still wins over depth", () => {
    expect(
      estimateInterviewMinutes({ maxRounds: 4, depth: "tief", topicCount: 9 }),
    ).toBe(Math.round(4 * MINUTES_PER_QUESTION));
  });
});
