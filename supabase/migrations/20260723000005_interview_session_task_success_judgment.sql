-- Phase C — per-session TASK SUCCESS JUDGMENT (advisory LLM sidecar field).
--
-- Additive nullable jsonb on interview_sessions, written at session completion by
-- the Phase-C success-judge sidecar (after()-hook, async/non-blocking, fail-silent
-- — exact mirror of turn_signals). Shape lives in the TS layer
-- (src/lib/schemas/task-success.ts), validated there, NOT by a DB CHECK (soft
-- jsonb like turn_signals / task_result).
--
-- The judgment is ADVISORY ONLY. task_result.success stays the system of record
-- (event-based: task_complete/task_abandon from the participant). This column is
-- a SEPARATE LLM second-opinion (verdict success|partial|failure + confidence +
-- reasoning) for researcher analysis — it NEVER feeds back into task_result.
-- "Zahlen rechnet der Server, nie das Modell" stays intact.
--
-- RED LINE (EU AI Act, L8): the judge reads ONLY the orthographic transcript +
-- the task's successCriterion + the deterministic behavioural task_result. It
-- judges OUTCOME against the criterion — never affect, emotion, personality,
-- health or biometrics. Per-session only, never aggregated per participant
-- (Art. 22 firebreak).
--
-- NULL = never judged (sidecar didn't run, judge errored/timed out, use_case not
-- usability_test, no successCriterion, consent gate not met). Pre-migration
-- select("*") omits the column → the defensive read mapper (coerceTaskSuccess-
-- Judgment) defaults it to null → every existing session stays byte-identical.
-- No DEFAULT, no backfill.

alter table interview_sessions
  add column if not exists task_success_judgment jsonb;

notify pgrst, 'reload schema';
