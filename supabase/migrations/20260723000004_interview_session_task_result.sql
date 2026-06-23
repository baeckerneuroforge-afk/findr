-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2b — per-session usability TASK RESULT (integration plan §5/§6, L6/L8).
--
-- Additive nullable jsonb on interview_sessions, SERVER-COMPUTED from the
-- behavioural events in research_session_events (event-store computeTaskResult,
-- after each /events ingest). Shape:
--   { version: 1, success: boolean|null, time_on_task_seconds: number|null,
--     click_count: number, friction_events: [{ type, ts_ms }] }
-- "Zahlen rechnet der Server, nie das Modell" — like the E4/E7 signal/stimulus
-- blocks: the numbers are computed deterministically here, never by an LLM.
--
-- STRUCTURAL RED LINE (L8): friction_events are BEHAVIOURAL only (e.g. rage-click
-- runs) — there is NO affect/emotion field. NULL = not yet computed (no events).
-- Pre-migration select("*") omits the column → defensive reads default it to
-- null → byte-identical for every existing session.
-- ─────────────────────────────────────────────────────────────────────────────

alter table interview_sessions
  add column if not exists task_result jsonb;

notify pgrst, 'reload schema';
