-- Market Research use-case selector -- lightweight focus hint per study.
--
-- Additive, idempotent, nullable, backfill-free by decision:
--   use_case text null
--
-- No DEFAULT and no UPDATE/backfill: existing plans stay NULL until a caller
-- explicitly sets one. Value validation lives at the API/Zod boundary.

alter table research_plans
  add column if not exists use_case text;

notify pgrst, 'reload schema';
