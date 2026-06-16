import { describe, expect, it } from "vitest";
import { cronHadAnyError, cronIsTotalFailure } from "./status";

describe("cronHadAnyError (strict policy)", () => {
  it("is false when no errors were recorded", () => {
    expect(cronHadAnyError(0)).toBe(false);
  });

  it("is true on any error", () => {
    expect(cronHadAnyError(1)).toBe(true);
    expect(cronHadAnyError(5)).toBe(true);
  });
});

describe("cronIsTotalFailure (threshold policy)", () => {
  it("is false when nothing happened (no work, no errors)", () => {
    expect(cronIsTotalFailure(0, 0)).toBe(false);
  });

  it("is false on partial success (some succeeded, some errored)", () => {
    expect(cronIsTotalFailure(3, 2)).toBe(false);
  });

  it("is false when all attempted work succeeded", () => {
    expect(cronIsTotalFailure(5, 0)).toBe(false);
  });

  it("is true on total failure (nothing succeeded, at least one error)", () => {
    expect(cronIsTotalFailure(0, 1)).toBe(true);
    expect(cronIsTotalFailure(0, 4)).toBe(true);
  });
});
