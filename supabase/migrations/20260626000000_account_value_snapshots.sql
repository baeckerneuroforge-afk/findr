-- CS Health — account value history (for real Net Revenue Retention over time).
--
-- THE PROBLEM NRR NEEDS SOLVED. Net Revenue Retention compares the recurring
-- revenue of a customer COHORT at two points in time: their revenue at the end of
-- a period ÷ their revenue at the start (churn and downgrades pull it below 100%,
-- expansion pushes it above). The `accounts` table stores only the CURRENT value
-- (`mrr` + `value_type`) — it has no memory of what an account was worth a year
-- ago. Without a second point in time, a true NRR is NOT computable; any number
-- derived from a single snapshot would be fabricated. This table starts recording
-- the missing history so NRR becomes real one full period from now.
--
-- WHY A TRIGGER (snapshot-on-change), not a monthly cron job: the value of an
-- account changes from several code paths (the master-data editor's updateAccount,
-- a born-from-deal createAccount, a raw SQL edit). A BEFORE/AFTER trigger is the
-- one place that captures every writer automatically — exactly the same reasoning
-- as the churned_at trigger (20260624000000) and the set_updated_at trigger. It is
-- also the simpler of the two options the task offered (job vs. on-change): no new
-- route, no schedule, no app-side write path that could drift out of sync. The
-- table is append-only; a snapshot is written on INSERT and on any UPDATE that
-- actually changes the value (amount, type or currency) — unrelated edits (a
-- check-in toggle, a note) write nothing, keeping the table lean.
--
-- POINT-IN-TIME RECONSTRUCTION. "The value of account A as of date D" is the
-- latest snapshot with captured_at <= D. Change-event snapshots plus the one-time
-- backfill below are sufficient for this: an account that never changes keeps its
-- backfill snapshot as its value for all D. Churn is read separately from
-- accounts.churned_at (the canonical churn moment) — a churned account counts as
-- 0 recurring revenue at period end, which is what makes NRR drop on a loss.
--
-- DISPLAY / CONTEXT ONLY — NOT a health-score input. NRR is a financial metric.
-- The health, severity and risk engines never read account value and do not read
-- this table either; nothing here feeds a satisfaction score. one_time (project)
-- accounts are stored here for completeness but are EXCLUDED from the retention
-- math in src/lib/accounts/retention.ts — NRR is a recurring-revenue metric.
--
-- RLS: org-isolated exactly like accounts (org_id = current_org_id()), so a
-- tenant only ever sees its own value history. New table → its own policy.

-- ── 1. The history table ─────────────────────────────────────────────────────
create table if not exists account_value_snapshots (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  account_id   uuid not null references accounts(id) on delete cascade,
  -- The account value AS CAPTURED. Nullable: an account with an unknown amount
  -- snapshots a null value (excluded from the recurring math downstream).
  value        numeric(14, 2),
  value_type   text not null default 'monthly'
    check (value_type in ('monthly', 'yearly', 'one_time')),
  currency     text not null default 'EUR',
  captured_at  timestamptz not null default now()
);

-- "Latest snapshot <= D for this account" — the core reconstruction query.
create index if not exists account_value_snapshots_account_idx
  on account_value_snapshots (account_id, captured_at desc);
-- Org-scoped scan for the retention roll-up on the health overview.
create index if not exists account_value_snapshots_org_captured_idx
  on account_value_snapshots (org_id, captured_at desc);

-- ── 2. RLS — org isolation, mirroring the accounts policy ────────────────────
alter table account_value_snapshots enable row level security;

drop policy if exists account_value_snapshots_org_isolation on account_value_snapshots;
create policy account_value_snapshots_org_isolation
  on account_value_snapshots
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ── 3. Trigger: snapshot the value on insert + on any value change ───────────
-- AFTER row trigger so the accounts row already exists for the FK. On UPDATE we
-- write only when amount, type or currency actually moved (is distinct from) —
-- editing a note or a check-in setting leaves the value history untouched. Direct
-- inserts into account_value_snapshots (the backfill below) do NOT re-enter this
-- trigger; only writes to `accounts` do.
create or replace function snapshot_account_value()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.mrr is not distinct from old.mrr
     and new.value_type is not distinct from old.value_type
     and new.currency is not distinct from old.currency then
    return new; -- value unchanged → no snapshot
  end if;

  insert into account_value_snapshots
    (org_id, account_id, value, value_type, currency, captured_at)
  values
    (new.org_id, new.id, new.mrr, new.value_type, new.currency, now());

  return new;
end;
$$;

drop trigger if exists accounts_value_snapshot on accounts;
create trigger accounts_value_snapshot
  after insert or update on accounts
  for each row execute function snapshot_account_value();

-- ── 4. One-time backfill: a starting point for every existing account ────────
-- Every account that exists now gets one snapshot at the migration moment. This
-- is the FIRST observation — it does NOT pretend to know the historical value, it
-- just marks "from here on we measure". A true period-over-period NRR is therefore
-- available one full period (e.g. 12 months) AFTER this migration is applied.
-- Idempotent: the `not exists` guard skips accounts that already have a snapshot,
-- so re-running the migration is a no-op.
insert into account_value_snapshots
  (org_id, account_id, value, value_type, currency, captured_at)
select a.org_id, a.id, a.mrr, a.value_type, a.currency, now()
from accounts a
where not exists (
  select 1 from account_value_snapshots s where s.account_id = a.id
);

notify pgrst, 'reload schema';
