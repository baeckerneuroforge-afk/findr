import { describe, expect, it } from "vitest";
import { getCronAnalysisMode, isRealActiveDeal } from "./helpers";

describe("cron reanalyze guards", () => {
  it("allows real active hubspot deals", () => {
    expect(
      isRealActiveDeal({
        stage: "negotiation",
        dataSource: "hubspot",
      }),
    ).toBe(true);
  });

  it("skips mock deals before analysis", () => {
    expect(
      isRealActiveDeal({
        stage: "negotiation",
        dataSource: "mock",
      }),
    ).toBe(false);
  });

  it("skips closed-won deals", () => {
    expect(
      isRealActiveDeal({
        stage: "closed_won",
        dataSource: "hubspot",
      }),
    ).toBe(false);
  });

  it("skips closed-lost deals", () => {
    expect(
      isRealActiveDeal({
        stage: "closed_lost",
        dataSource: "hubspot",
      }),
    ).toBe(false);
  });

  it("runs in heuristic-only mode when Anthropic key is absent", () => {
    expect(getCronAnalysisMode({})).toBe("heuristic_only");
  });

  it("records AI availability without changing heuristic execution", () => {
    expect(getCronAnalysisMode({ ANTHROPIC_API_KEY: "present" })).toBe(
      "heuristic_with_ai_available",
    );
  });
});
