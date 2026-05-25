-- CS Health — Check-in agent, Etappe B: per-account auto check-in schedule.
--
-- The cadence lives on the ACCOUNT (not org_settings): check-in frequency is a
-- per-customer property — a high-touch account may get a 30-day cadence, another
-- 90, others none — and last_checkin_at is inherently per-account. A daily cron
-- reads these columns and triggers DUE accounts; there is no dynamic cron plan.
--
--   checkin_enabled       — opt in to automatic check-ins for this account.
--   checkin_interval_days — cadence in days (1-365); required while enabled.
--   last_checkin_at        — when a check-in was last triggered (manual OR cron);
--                            null = never → due immediately when enabled.

alter table accounts
  add column if not exists checkin_enabled boolean not null default false,
  add column if not exists checkin_interval_days int
    check (checkin_interval_days is null or checkin_interval_days between 1 and 365),
  add column if not exists last_checkin_at timestamptz;

-- Partial index for the cron's per-org scan of enabled accounts.
create index if not exists accounts_checkin_enabled_idx
  on accounts (org_id, checkin_enabled)
  where checkin_enabled;

notify pgrst, 'reload schema';
