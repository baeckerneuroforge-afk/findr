import { describe, expect, it } from "vitest";
import {
  ALERT_DEDUP_WINDOW_MS,
  getDedupWindowStart,
  isAlertTypeEnabled,
  isInQuietHours,
} from "./dispatcher";
import type { AlertPreferences } from "./types";

const preferences: AlertPreferences = {
  org_id: "org_1",
  risk_spike_enabled: true,
  risk_spike_threshold: 25,
  champion_lost_enabled: true,
  deal_lost_enabled: true,
  forecast_change_enabled: true,
  forecast_change_threshold: 20,
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: "Europe/Berlin",
};

describe("dispatcher preference checks", () => {
  it("allows enabled alert types", () => {
    expect(isAlertTypeEnabled(preferences, "risk_spike")).toBe(true);
    expect(isAlertTypeEnabled(preferences, "champion_lost")).toBe(true);
  });

  it("blocks disabled alert types", () => {
    expect(
      isAlertTypeEnabled(
        {
          ...preferences,
          deal_lost_enabled: false,
        },
        "deal_lost",
      ),
    ).toBe(false);
  });
});

describe("isInQuietHours", () => {
  it("returns false when quiet hours are not configured", () => {
    expect(isInQuietHours(preferences, new Date("2026-05-20T20:00:00.000Z"))).toBe(
      false,
    );
  });

  it("detects quiet hours within a same-day window", () => {
    expect(
      isInQuietHours(
        {
          ...preferences,
          quiet_hours_start: "10:00",
          quiet_hours_end: "12:00",
          timezone: "UTC",
        },
        new Date("2026-05-20T10:30:00.000Z"),
      ),
    ).toBe(true);
  });

  it("detects quiet hours across midnight", () => {
    expect(
      isInQuietHours(
        {
          ...preferences,
          quiet_hours_start: "22:00",
          quiet_hours_end: "08:00",
          timezone: "UTC",
        },
        new Date("2026-05-20T23:30:00.000Z"),
      ),
    ).toBe(true);
  });

  it("returns false outside a wraparound quiet-hours window", () => {
    expect(
      isInQuietHours(
        {
          ...preferences,
          quiet_hours_start: "22:00",
          quiet_hours_end: "08:00",
          timezone: "UTC",
        },
        new Date("2026-05-20T13:30:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("dedup window", () => {
  it("uses a four-hour duplicate suppression window", () => {
    expect(ALERT_DEDUP_WINDOW_MS).toBe(14_400_000);
    expect(getDedupWindowStart(new Date("2026-05-20T12:00:00.000Z"))).toBe(
      "2026-05-20T08:00:00.000Z",
    );
  });
});
