import { describe, expect, it } from "vitest";
import {
  OPEN_LINK_HARD_CAP,
  effectiveOpenLinkCap,
  isOpenLinkAtCapacity,
} from "./open-link-capacity";

describe("effectiveOpenLinkCap", () => {
  it("clamps an unset (null) cap to the hard ceiling — no unlimited mode", () => {
    expect(effectiveOpenLinkCap(null)).toBe(OPEN_LINK_HARD_CAP);
  });

  it("respects an explicit value below the ceiling", () => {
    expect(effectiveOpenLinkCap(50)).toBe(50);
  });

  it("clamps an explicit value above the ceiling down to it", () => {
    expect(effectiveOpenLinkCap(OPEN_LINK_HARD_CAP + 1000)).toBe(
      OPEN_LINK_HARD_CAP,
    );
  });
});

describe("isOpenLinkAtCapacity", () => {
  it("treats a null count as full (fail-closed) regardless of cap", () => {
    expect(isOpenLinkAtCapacity(10, null)).toBe(true);
    expect(isOpenLinkAtCapacity(null, null)).toBe(true);
  });

  it("bounds an unset (null) cap by the hard ceiling", () => {
    expect(isOpenLinkAtCapacity(null, OPEN_LINK_HARD_CAP - 1)).toBe(false);
    expect(isOpenLinkAtCapacity(null, OPEN_LINK_HARD_CAP)).toBe(true);
  });

  it("enforces an explicit cap normally", () => {
    expect(isOpenLinkAtCapacity(50, 49)).toBe(false);
    expect(isOpenLinkAtCapacity(50, 50)).toBe(true);
  });

  it("clamps an explicit cap above the ceiling down to it", () => {
    expect(isOpenLinkAtCapacity(10_000, OPEN_LINK_HARD_CAP - 1)).toBe(false);
    expect(isOpenLinkAtCapacity(10_000, OPEN_LINK_HARD_CAP)).toBe(true);
  });
});
