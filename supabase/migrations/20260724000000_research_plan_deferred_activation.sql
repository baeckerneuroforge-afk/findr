-- ─────────────────────────────────────────────────────────────────────────────
-- Deferred Activation — Phase 1 of the Kalender/Scheduler feature
-- (docs/klymeo-scheduler-kalender-plan-2026-06-26.md).
--
-- A study can be PREPARED (status='draft' + pool/Prolific draft staged) and then
-- RELEASED later — manually ("Jetzt aktivieren") in Phase 1, or by a cron in
-- Phase 2. We deliberately do NOT add a 5th value to research_plans.status (that
-- would break the many existing status comparisons). Instead a SEPARATE field
-- activation_state carries the scheduling lifecycle, orthogonal to status:
--
--     none        — no schedule (every legacy row; the default)
--     scheduled   — a future activation time is set
--     activating  — a caller won the compare-and-set and is mid-activation
--     activated   — released (status flipped draft→active)
--     failed      — a release attempt hit a precondition error (retry-able)
--
-- A "geplante" study is logically status='draft' WITH activation_state='scheduled'.
-- The status column stays the unchanged 4-value union.
--
-- All columns are ADDITIVE. activation_state / activation_mode are NOT NULL with a
-- DEFAULT, so every existing row backfills to the inert ('none','manual') state —
-- the cron index never matches them. The read mapper (plans-service
-- coerceActivationState / coerceActivationMode) defaults undefined→'none'/'manual',
-- so reads are byte-identical even BEFORE this migration lands (select("*") omits
-- the columns). No behavior change for any non-scheduled study.
--
-- scheduled_by_user_id / scheduled_by_email = the Zitadel subject + email of the
-- researcher who scheduled it (audit + future reminder recipient — Phase 2). Not
-- PII beyond what the org already holds; null when nobody scheduled.
--
-- activation_reminder_*_sent_at are reserved for the Phase-2 reminder cron
-- (idempotency stamps, mirroring research_invites.reminder_*_sent_at). Unused in
-- Phase 1 (no cron) — added here so Phase 2 needs no further migration.
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists scheduled_activation_at timestamptz,
  add column if not exists activation_mode text not null default 'manual',
  add column if not exists activation_state text not null default 'none',
  add column if not exists activated_at timestamptz,
  add column if not exists activation_error jsonb,
  add column if not exists scheduled_by_user_id text,
  add column if not exists scheduled_by_email text,
  add column if not exists activation_reminder_24h_sent_at timestamptz,
  add column if not exists activation_reminder_1h_sent_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'research_plans_activation_mode_check'
  ) then
    alter table research_plans
      add constraint research_plans_activation_mode_check
        check (activation_mode in ('manual', 'auto'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'research_plans_activation_state_check'
  ) then
    alter table research_plans
      add constraint research_plans_activation_state_check
        check (
          activation_state in
          ('none', 'scheduled', 'activating', 'activated', 'failed')
        );
  end if;
end $$;

-- Partial index for the Phase-2 auto-activation cron scan only: just the due,
-- scheduled, auto-mode rows. The manual "Jetzt aktivieren" path looks up a single
-- row by id and does NOT use this index. Phase 1 has no cron — the index is inert
-- but harmless, and saves a Phase-2 migration.
create index if not exists research_plans_due_activation_idx
  on research_plans (scheduled_activation_at)
  where activation_state = 'scheduled' and activation_mode = 'auto';

notify pgrst, 'reload schema';
