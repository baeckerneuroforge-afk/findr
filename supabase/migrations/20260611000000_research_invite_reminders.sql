-- Research-invite reminder tracking — additive columns on research_invites.
--
-- Reason: the reminder cron (/api/cron/research-reminders) needs to dedup
-- 24h + 1h reminders across runs. Without these timestamps the cron has to
-- rely on time-window detection alone, which double-fires if Vercel runs
-- the schedule with jitter or if a single invite hits two consecutive
-- windowed runs (clock drift, cron overlap).
--
-- Idempotent — `add column if not exists` so the file can be re-applied
-- without effect if the sister-branch schema already has these. Pure
-- additive: existing rows get NULL, the cron treats NULL as "not yet
-- sent" so existing data behaves correctly under the new logic.
--
-- The sister-branch advanceInterview work does NOT touch these columns,
-- so this migration is conflict-free at merge time.

alter table research_invites
  add column if not exists reminder_24h_sent_at timestamptz;

alter table research_invites
  add column if not exists reminder_1h_sent_at timestamptz;

-- Index for the cron's "upcoming invites with reminders pending" scan.
-- Partial: only rows with a scheduled_at are candidates for reminders.
create index if not exists research_invites_scheduled_at_idx
  on research_invites (scheduled_at)
  where scheduled_at is not null;

notify pgrst, 'reload schema';
