-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2a — per-study behavioural-capture master flags (integration plan L3,
-- docs/klymeo-ux-research-integration-plan-2026-06-22.md).
--
-- event_tracking_enabled / replay_capture_enabled mirror the existing
-- visual_capture_enabled (which already gates the screen-sampling tier): a
-- per-study opt-in, NOT NULL DEFAULT false, no backfill. DEFAULT false means
-- every existing AND future study captures nothing and stays byte-identical.
--
-- In THIS chunk these flags are only the additive ANCHOR — no capture code
-- (event collector, event store, /events route, replay) reads them yet; that is
-- a later phase. The screen-sampling tier (visual_capture_enabled) is unchanged
-- here; Phase 2a adds the participant-consent verification around it, not a new
-- toggle.
--
-- Strictly additive. Numbered after 20260723000000 (the Phase-1 task_definition
-- migration on a separate branch) to keep the module's migration sequence
-- monotonic and collision-free once both branches merge.
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists event_tracking_enabled boolean not null default false;

alter table research_plans
  add column if not exists replay_capture_enabled boolean not null default false;

notify pgrst, 'reload schema';
