-- Visual Intelligence Block 3 — per-study capture switch.
--
-- Additive, idempotent, backfill-free by decision:
--   visual_capture_enabled boolean not null default false
--
-- The DEFAULT keeps every existing and future plan opt-out unless explicitly
-- enabled by the study owner. No separate UPDATE/backfill is run.

alter table research_plans
  add column if not exists visual_capture_enabled boolean not null default false;

notify pgrst, 'reload schema';
