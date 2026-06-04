-- Voice Stage 1 — per-study voice switch.
--
-- Additive, idempotent, backfill-free by decision:
--   voice_enabled boolean not null default false
--
-- The DEFAULT keeps every existing and future plan opt-out unless explicitly
-- enabled by the study owner. No separate UPDATE/backfill is run.

alter table research_plans
  add column if not exists voice_enabled boolean not null default false;

notify pgrst, 'reload schema';
