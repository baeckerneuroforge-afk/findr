import { describe, expect, it } from "vitest";

import { assertCaptureConsent, CAPTURE_TIER_COLUMN } from "./capture-consent";

describe("assertCaptureConsent (Phase 2a fail-closed gate, L7)", () => {
  it("returns true only when the matching tier stamp is a non-empty string", () => {
    const at = "2026-06-22T00:00:00.000Z";
    expect(assertCaptureConsent({ screen_consent_at: at }, "screen")).toBe(true);
    expect(assertCaptureConsent({ events_consent_at: at }, "events")).toBe(true);
    expect(assertCaptureConsent({ replay_consent_at: at }, "replay")).toBe(true);
  });

  it("returns false when the tier stamp is null, absent, or empty (fail-closed)", () => {
    expect(assertCaptureConsent({ screen_consent_at: null }, "screen")).toBe(
      false,
    );
    // Pre-migration: the column is absent → undefined → false (never open).
    expect(assertCaptureConsent({}, "screen")).toBe(false);
    expect(assertCaptureConsent({ screen_consent_at: "" }, "screen")).toBe(
      false,
    );
  });

  it("checks ONLY the requested tier — a granted tier never satisfies another", () => {
    const at = "2026-06-22T00:00:00.000Z";
    expect(assertCaptureConsent({ screen_consent_at: at }, "events")).toBe(
      false,
    );
    expect(assertCaptureConsent({ events_consent_at: at }, "screen")).toBe(
      false,
    );
  });

  it("maps each tier to its own consent column (no affect tier — red line)", () => {
    expect(CAPTURE_TIER_COLUMN).toEqual({
      events: "events_consent_at",
      replay: "replay_consent_at",
      screen: "screen_consent_at",
    });
  });
});
