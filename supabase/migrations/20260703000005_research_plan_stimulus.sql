-- Stimulus foundation for Market Research studies.
--
-- Additive, idempotent, nullable, and backfill-free by decision:
--   stimulus_url text null
--   stimulus_type text null
--   stimulus_description text null
--
-- No DEFAULT, enum CHECK, or UPDATE/backfill. Existing plans remain valid and
-- future stimulus types can be introduced without changing the DB constraint.

alter table research_plans
  add column if not exists stimulus_url text,
  add column if not exists stimulus_type text,
  add column if not exists stimulus_description text;

notify pgrst, 'reload schema';
