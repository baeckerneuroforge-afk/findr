import { describe, it, expect } from "vitest";

import { coerceTaskResult } from "./task-result";

describe("coerceTaskResult (lenient read-mapper, behavioural only — L8)", () => {
  const valid = {
    version: 1 as const,
    success: true,
    time_on_task_seconds: 12,
    click_count: 3,
    friction_events: [],
  };

  it("passes a well-formed result through unchanged", () => {
    expect(coerceTaskResult(valid)).toEqual(valid);
  });

  it("smooths null/undefined to null (never computed / column absent)", () => {
    expect(coerceTaskResult(null)).toBeNull();
    expect(coerceTaskResult(undefined)).toBeNull();
  });

  it("rejects a negative time_on_task_seconds (producer clamps; schema now matches)", () => {
    expect(coerceTaskResult({ ...valid, time_on_task_seconds: -5 })).toBeNull();
  });

  it("accepts null time_on_task_seconds (no terminal event yet)", () => {
    expect(coerceTaskResult({ ...valid, time_on_task_seconds: null })).toEqual({
      ...valid,
      time_on_task_seconds: null,
    });
  });

  it("reads a foreign version as 'no result' (byte-identical result-less view)", () => {
    expect(coerceTaskResult({ ...valid, version: 2 })).toBeNull();
  });
});
