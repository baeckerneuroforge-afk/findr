-- Stimulus-Analyse (Vision) for Market Research studies.
--
-- Additive, idempotent, nullable, and backfill-free — exact convention of
-- 20260703000005_research_plan_stimulus.sql:
--   stimulus_analysis        jsonb null  — versioned payload envelope
--                                          { version, model, generatedAt,
--                                            analysis, textBlock } written by
--                                          src/lib/research/stimulus-analysis.ts
--   stimulus_analysis_status text  null  — null (no image stimulus / legacy row)
--                                          | 'pending' | 'done' | 'failed'
--
-- No DEFAULT, no CHECK on status: future states must not require a DB change;
-- the read path (plans-service) coerces fail-open — anything unknown or
-- unparseable reads as null, so existing plans stay byte-identical.

alter table research_plans
  add column if not exists stimulus_analysis jsonb,
  add column if not exists stimulus_analysis_status text;

notify pgrst, 'reload schema';
