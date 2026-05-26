-- Correction migration — product_discovery_insights.deal_id: uuid → text,
-- drop the FK to deals(id).
--
-- Background: the original migration (20260609000000_product_discovery_
-- insights.sql) declared deal_id as `uuid references deals(id)` because
-- that was the cleaner ideal. The E2E test on real data surfaced the
-- reason risk_scores.deal_id is deliberately `text` instead:
-- calls.deal_id holds a MIX of real UUIDs and legacy seed / external CRM
-- identifiers — in a 2000-row probe of calls, 30 of 37 non-null deal_ids
-- were non-UUID strings (e.g. "deal_001" through "deal_010"), only 7 were
-- valid UUIDs. The previous uuid + FK declaration therefore rejected the
-- majority of inserts with
--   ERROR:  invalid input syntax for type uuid: "deal_003"
-- This migration brings the column in line with the established pattern
-- on risk_scores.deal_id (text, no FK, see the comment block in
-- 20260520*_risk_scores.sql).
--
-- account_id stays as uuid + FK: the same probe found 0/9 non-UUID values
-- on calls.account_id and 0/3 on accounts.id, so the FK there holds. The
-- XOR routing (one of deal_id / account_id non-null per row) is still
-- enforced indirectly via the source call's calls.calls_single_parent_chk
-- — we do not need to duplicate that constraint here.
--
-- Existing rows: the two E2E test rows written in 2026-05-26 have either
-- a valid-UUID deal_id (which converts cleanly to its text representation
-- via `::text`) or a null deal_id (passes through unchanged). No data
-- loss; the indexes are rebuilt automatically by the ALTER.

alter table product_discovery_insights
  drop constraint if exists product_discovery_insights_deal_id_fkey;

alter table product_discovery_insights
  alter column deal_id type text using deal_id::text;

notify pgrst, 'reload schema';
