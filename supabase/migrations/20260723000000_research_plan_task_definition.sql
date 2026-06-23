-- ─────────────────────────────────────────────────────────────────────────────
-- Per-study USABILITY TASK definition — Phase 1 of the UX-research / usability
-- module (docs/klymeo-ux-research-integration-plan-2026-06-22.md, L1/L2).
--
-- A usability study is the new use_case 'usability_test' INSIDE
-- study_type='market_research' (L1). use_case is free-text, validated only at
-- the TS/Zod boundary (coerceUseCase) — it has NO DB CHECK (confirmed in
-- 20260703000004), so adding 'usability_test' needs NO migration for the enum
-- itself (L2). This migration adds ONLY the task: a single nullable jsonb
-- column holding the v1 task shape
--     { instruction, successCriterion, targetUrl, prototypeHosting }
-- whose shape lives in the TS layer (src/lib/research/task.ts) and is validated
-- there, NOT via a DB CHECK — soft jsonb like topic_script / stimulus_analysis,
-- so prototypeHosting and future fields can grow without another migration.
--
-- Phase 1 is INFORMATION-ONLY: this adds NO event / consent / capture columns
-- (those are Phase 2 and legally gated). The task is never instrumented here.
--
-- NULL = every existing study AND every non-usability study → the read mapper
-- (plans-service coerceTaskDefinition) maps undefined/null → null → the agent
-- context and every code path stay BYTE-IDENTICAL. No DEFAULT, no backfill.
-- Before this migration lands select("*") omits the column; the mapper defaults
-- it to null, so the code path is byte-identical even pre-migration.
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists task_definition jsonb;

notify pgrst, 'reload schema';
