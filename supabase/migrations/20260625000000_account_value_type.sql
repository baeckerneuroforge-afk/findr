-- CS Health — flexible account value (monthly | yearly | one_time).
--
-- The account value field was MRR-only: the `mrr` numeric column assumed every
-- customer pays a monthly recurring fee. But the target customers (law firms,
-- Mittelstand, project businesses) often have NO subscription — they have a
-- one-time project contract value, or a yearly retainer. This migration makes
-- the value field flexible by adding a `value_type` discriminator that says how
-- to interpret the existing amount: monthly recurring, yearly recurring, or a
-- one-time project value.
--
-- ADDITIVE, NOT A RENAME. The `mrr` column is read in many places (the accounts
-- list, the account detail header + master-data card, the save-play prompt
-- context, the deal→account handover, the generated DB types). Renaming it would
-- have to touch every one of those read sites at once and risks a silent
-- breakage. Instead we KEEP `mrr` as the amount column and add `value_type`
-- ALONGSIDE it: `mrr` now holds "the contract value amount" and `value_type`
-- tells the UI how to label that amount. No existing read breaks — the new
-- column is purely additive. (Same least-breaking philosophy as the churned_at
-- migration 20260624000000 this builds on.)
--
-- DISPLAY / CONTEXT ONLY — NOT a health-score input. The health, severity and
-- risk engines never read `mrr` (verified: it appears in neither src/lib/health/
-- nor src/lib/risk/), and `value_type` does not feed them either. The CS Health
-- score measures customer satisfaction, not how — or how often — the customer
-- pays. This column is purely for human-facing context on the account.
--
-- RLS: `value_type` is a new column on the existing `accounts` table. RLS is
-- row-level — the existing accounts_org_isolation policy (org_id =
-- current_org_id()) already governs reads/writes of this column. No new policy
-- is required (mirrors how churned_at was added).

-- ── The column ────────────────────────────────────────────────────────────────
-- NOT NULL with a 'monthly' default so EVERY existing row keeps its current
-- meaning: today `mrr` IS monthly recurring revenue, so the only safe backfill
-- for legacy rows is value_type = 'monthly'. Nothing flips for accounts created
-- before this change. The CHECK constraint mirrors the status check-constraint
-- style already on this table.
alter table accounts
  add column if not exists value_type text not null default 'monthly'
    check (value_type in ('monthly', 'yearly', 'one_time'));

notify pgrst, 'reload schema';
