-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2a — granular per-tier participant CONSENT stamps (integration plan L4,
-- docs/klymeo-ux-research-integration-plan-2026-06-22.md).
--
-- Three additive, nullable timestamptz columns — one per behavioural-capture
-- tier (events / replay / screen) — plus instrumentation_consent_version, the
-- DSGVO-Art.-7(1) text-version pin for the tier opt-ins (kept SEPARATE from the
-- E0 baseline consent_version). Server-stamped, idempotent (the writer guards
-- WHERE <col> IS NULL — first grant wins, like consent_accepted_at). NO backfill.
--
-- NULL = that tier was not granted → the capture route returns 403 (FAIL-CLOSED,
-- via assertCaptureConsent). Every existing session and the base E0 consent path
-- stay byte-identical (these columns are only ever written by the extended
-- consent path when a `purposes` opt-in is sent; pre-migration select("*") omits
-- them and the defensive reads default undefined→null).
--
-- Structural red line (L8): there is deliberately NO affect/emotion tier column.
--
-- ⚠️ PROD SAFETY: interview_sessions is read by the EXTERNAL Python voice-agent
-- (Hetzner) via select('*'). VERIFY that its row deserialization tolerates these
-- new, unknown columns BEFORE applying this migration in Prod.
-- ─────────────────────────────────────────────────────────────────────────────

alter table interview_sessions
  add column if not exists events_consent_at timestamptz;

alter table interview_sessions
  add column if not exists replay_consent_at timestamptz;

alter table interview_sessions
  add column if not exists screen_consent_at timestamptz;

alter table interview_sessions
  add column if not exists instrumentation_consent_version text;

notify pgrst, 'reload schema';
