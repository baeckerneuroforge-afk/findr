-- ─────────────────────────────────────────────────────────────────────────────
-- interview_sessions.started_at — "room entered" timestamp.
--
-- Stamped exactly when the opening agent turn is first persisted
-- (session-service ensureOpeningTurn, the race-guarded conversation = '[]'
-- update) — i.e. when the interview content actually begins. This is the clock
-- the per-study time limit (research_plans.max_duration_seconds) measures
-- against. It is DELIBERATELY NOT created_at: for research, created_at is set
-- at invite time, often long before the participant starts.
--
-- Nullable, no backfill: every existing/legacy session reads null → no clock →
-- the time-limit check is a no-op for them (byte-identical). New sessions get
-- it stamped on their first load.
-- ─────────────────────────────────────────────────────────────────────────────

alter table interview_sessions
  add column if not exists started_at timestamptz;

notify pgrst, 'reload schema';
