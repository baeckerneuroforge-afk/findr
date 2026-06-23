/**
 * Phase 2a — granular behavioural-capture consent (integration plan L3/L4/L7).
 *
 * Lightweight, dependency-free, server-safe helper shared by the consent write
 * path (markSessionConsentByToken) and every capture route's fail-closed gate.
 * Kept out of the heavy session-service graph so it stays trivially unit-testable
 * and importable from both server routes and the service layer.
 *
 * STRUCTURAL RED LINE (integration plan L8): there is NO affect/emotion tier and
 * no affect field anywhere here — only NON-biometric behavioural capture
 * (events / screen). Do not add an emotion/affect tier.
 *
 * NOTE: a third 'replay' tier was forward-declared but never wired (no UI ever
 * requested it, no capture route ever gated on it). It has been removed from
 * the consent surface so no opt-in can be stamped for a capture that does not
 * exist. The `replay_consent_at` DB column is left in place, reserved for a
 * future session-replay capture; re-add the tier here when that ships.
 */

/** The behavioural-capture tiers. Each maps 1:1 to its own per-session consent
 *  stamp column on interview_sessions. */
export type CaptureTier = "events" | "screen";

/** Tier → the `interview_sessions` timestamp column that records the
 *  participant's opt-in for that tier (server-stamped, idempotent). */
export const CAPTURE_TIER_COLUMN = {
  events: "events_consent_at",
  screen: "screen_consent_at",
} as const;

type ConsentStampColumn = (typeof CAPTURE_TIER_COLUMN)[CaptureTier];

/**
 * The SINGLE place a capture route verifies stored participant consent for a
 * tier (integration plan L7). Returns true iff the matching `<tier>_consent_at`
 * stamp is present on the session.
 *
 * A capture route MUST return 403 when this is false — FAIL-CLOSED: no
 * instrumentation, screen frame, or upload may be processed without a recorded,
 * server-stamped opt-in. A missing column (pre-migration) reads as undefined →
 * false → 403, so an un-migrated environment fails closed, never open.
 */
export function assertCaptureConsent(
  session: Partial<Record<ConsentStampColumn, string | null>>,
  tier: CaptureTier,
): boolean {
  const stamp = session[CAPTURE_TIER_COLUMN[tier]];
  return typeof stamp === "string" && stamp.length > 0;
}
