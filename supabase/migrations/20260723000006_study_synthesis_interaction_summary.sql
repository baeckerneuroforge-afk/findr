-- Phase D — per-STUDY usability aggregation on study_synthesis.
--
-- Additive nullable jsonb. Written by the synthesis engine as a SERVER-
-- DETERMINISTIC aggregate (never LLM), mirroring the E4 signals_summary / E7
-- stimulus extras: success-rate, avg time-on-task, avg clicks, friction rate,
-- and (if Phase C judgments exist) judge-agreement %. Shape validated in the TS
-- layer (src/lib/schemas/synthesis-interaction.ts), NOT by a DB CHECK.
--
-- AGGREGATE-ONLY (Art. 22 firebreak): only study-level numbers, never a
-- per-participant slice. Min-N gate (>= 3 completed sessions with task_result)
-- so a single respondent can never be singled out — below N the field stays null.
--
-- NULL = no aggregate yet (pre-migration, under min-N, or non-usability study).
-- Pre-migration select("*") omits the column → defensive read defaults to null
-- → the synthesis page renders byte-identically (no usability card). No backfill.

alter table study_synthesis
  add column if not exists interaction_summary jsonb;

notify pgrst, 'reload schema';
