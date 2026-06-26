import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activationBucket,
  formatActivationDateTime,
  formatActivationTime,
  relativeActivation,
} from "./datetime";

afterEach(() => vi.useRealTimers());

describe("formatters — fixed display zone Europe/Berlin", () => {
  it("renders a UTC instant in Berlin wall-clock (CEST = +2 in July)", () => {
    // 12:00 UTC on 2026-07-01 is 14:00 in Berlin (summer time).
    expect(formatActivationTime("2026-07-01T12:00:00.000Z", "de")).toBe("14:00");
  });

  it("formatActivationDateTime includes the Berlin time, not the UTC time", () => {
    const out = formatActivationDateTime("2026-07-01T12:00:00.000Z", "de");
    expect(out).toContain("14:00");
  });

  it("malformed input falls back to the raw string", () => {
    expect(formatActivationTime("not-a-date", "de")).toBe("not-a-date");
  });
});

describe("activationBucket — day boundaries in the display zone", () => {
  const NOW = "2026-07-01T08:00:00.000Z"; // Berlin 10:00

  function withNow(fn: () => void) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    fn();
  }

  it("a time before now is 'past' (due now / overdue)", () => {
    withNow(() => {
      expect(activationBucket("2026-07-01T06:00:00.000Z")).toBe("past");
    });
  });

  it("later the same Berlin day is 'today'", () => {
    withNow(() => {
      expect(activationBucket("2026-07-01T18:00:00.000Z")).toBe("today");
    });
  });

  it("the next Berlin day is 'tomorrow'", () => {
    withNow(() => {
      expect(activationBucket("2026-07-02T09:00:00.000Z")).toBe("tomorrow");
    });
  });

  it("within 7 days is 'thisWeek'", () => {
    withNow(() => {
      expect(activationBucket("2026-07-04T09:00:00.000Z")).toBe("thisWeek");
    });
  });

  it("beyond 7 days is 'later'", () => {
    withNow(() => {
      expect(activationBucket("2026-07-25T09:00:00.000Z")).toBe("later");
    });
  });
});

describe("relativeActivation — timezone-independent instant difference", () => {
  it("a future time reads as a positive offset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T08:00:00.000Z"));
    // +3h → German "in 3 Stunden"
    expect(relativeActivation("2026-07-01T11:00:00.000Z", "de")).toContain("3");
  });
});
