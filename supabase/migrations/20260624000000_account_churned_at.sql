-- CS Health — real `churned_at` timestamp (replaces the updated_at churn-proxy).
--
-- Bridge #1 (src/lib/bridge/cs-to-research.ts → detectChurnClusters) clustered
-- "accounts churned in the last 90 days" by filtering accounts.updated_at. That
-- was a proxy: updated_at moves on EVERY edit (set_updated_at trigger), not only
-- when an account actually churns — so an admin tweak to an old churned row made
-- it look freshly lost. This migration adds a dedicated churned_at timestamp and
-- a trigger that stamps it ONLY on the status transition into 'churned', so the
-- bridge can filter on the genuine moment of churn.
--
-- Why a DB trigger (not application code): the status flip to 'churned' is NOT
-- owned by a single code path — it can come from the manual master-data editor
-- (updateAccount / AccountStatusControl), from a born-churned createAccount, or
-- straight from the SQL editor. A BEFORE trigger is the one place that captures
-- every writer and, crucially, can see OLD vs NEW to stamp only on the TRANSITION
-- (application code would have to re-read the row to avoid re-stamping on every
-- edit — exactly the bug we are removing). This mirrors the existing
-- set_updated_at() trigger already on this table.
--
-- RLS: churned_at is a new column on the existing `accounts` table. RLS is
-- row-level — the existing accounts_org_isolation policy (org_id = current_org_id())
-- already governs reads/writes of this column. No new policy required.

-- ── 1. The column ────────────────────────────────────────────────────────────
-- Nullable: null = "never churned" (or a legacy churned row not yet backfilled).
-- The bridge's >= comparator naturally excludes null rows, which is the desired
-- fail-safe (a row with no real churn timestamp is simply not counted).
alter table accounts
  add column if not exists churned_at timestamptz;

-- ── 2. One-time backfill for accounts that are ALREADY churned ───────────────
-- Best available proxy for historical churns: the current updated_at. This is
-- the same (imperfect) value the bridge used before — but frozen ONCE here so it
-- stops drifting on future edits. Only touches rows that are churned now and have
-- no churned_at yet; re-running the migration is a no-op.
--
-- We temporarily disable the updated_at trigger around the backfill so these
-- existing rows keep their genuine "last edited" timestamp instead of all jumping
-- to the migration time. (Runs as the table owner in the SQL editor.)
alter table accounts disable trigger accounts_updated_at;

update accounts
  set churned_at = updated_at
  where status = 'churned'
    and churned_at is null;

alter table accounts enable trigger accounts_updated_at;

-- ── 3. Trigger: stamp churned_at on the transition into 'churned' ────────────
-- INSERT: a born-churned account (rare manual case) gets stamped now unless an
--         explicit churned_at was supplied.
-- UPDATE: stamp now() only when status crosses INTO 'churned'; clear it when an
--         account is reactivated OUT of 'churned' so it stops counting as a
--         recent loss downstream. An edit to an already-churned row leaves
--         churned_at untouched — that is the whole point.
create or replace function set_churned_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'churned' and new.churned_at is null then
      new.churned_at := now();
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'
  if new.status = 'churned' and old.status is distinct from 'churned' then
    new.churned_at := now();
  elsif new.status is distinct from 'churned' and old.status = 'churned' then
    new.churned_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_churned_at on accounts;
create trigger accounts_churned_at
  before insert or update on accounts
  for each row execute function set_churned_at();

-- ── 4. Index serving the bridge detector query ───────────────────────────────
-- detectChurnClusters filters (org_id, status='churned', churned_at >= since).
-- Partial index on the churned slice only — mirrors the accounts_source_deal_idx
-- partial-index style and keeps the index small.
create index if not exists accounts_org_churned_at_idx
  on accounts (org_id, churned_at desc)
  where status = 'churned';

notify pgrst, 'reload schema';
