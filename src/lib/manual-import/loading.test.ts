import { describe, expect, it } from "vitest";
import {
  ANALYSIS_LOADING_MESSAGES,
  getAnalysisLoadingMessage,
} from "./loading";

describe("manual import analysis loading messages", () => {
  it("starts with transcript-reading feedback", () => {
    expect(getAnalysisLoadingMessage(0)).toBe("Reading transcript...");
  });

  it("cycles through the loading messages", () => {
    expect(getAnalysisLoadingMessage(ANALYSIS_LOADING_MESSAGES.length)).toBe(
      ANALYSIS_LOADING_MESSAGES[0],
    );
    expect(getAnalysisLoadingMessage(ANALYSIS_LOADING_MESSAGES.length + 1)).toBe(
      ANALYSIS_LOADING_MESSAGES[1],
    );
  });

  it("guards negative and fractional indexes", () => {
    expect(getAnalysisLoadingMessage(-1)).toBe(ANALYSIS_LOADING_MESSAGES[0]);
    expect(getAnalysisLoadingMessage(1.8)).toBe(ANALYSIS_LOADING_MESSAGES[1]);
  });
});
