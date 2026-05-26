-- Product Discovery — extracts feature requests, pain points, and themes from
-- a single customer conversation. Runs on BOTH pre-sale (deal_id) and
-- post-sale (account_id) calls — the classifier itself is etappe-agnostic.
-- The row carries both nullable FKs; the per-call XOR rule
-- (calls.calls_single_parent_chk: deal_id is null or account_id is null) is
-- inherited indirectly via source_call_id so we do not duplicate it here.
--
-- Output is pure extraction — featureRequests / painPoints / themes as JSONB
-- arrays plus a free-text summary. There is no aggregated score column by
-- design: Phase 3 is per-call only; cross-call rollups land in Phase 3.2 as
-- plain SQL over these JSONB arrays.
--
-- Mirrors risk_scores / account_health_scores: org-scoped, admin-client +
-- explicit org_id filter at the API layer, RLS-isolated by current_org_id().
-- Unlike account_health_scores.account_id (TEXT, no FK — legacy compat with
-- risk_scores.deal_id), this table uses proper UUID FKs to deals + accounts
-- because both columns are nullable and the constraint can stand on its own.

create table if not exists product_discovery_insights (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  -- The call whose transcript produced this extraction. CASCADE so a deleted
  -- call wipes its derived insights — they have no meaning without the
  -- source transcript. Stricter than account_health_scores' SET NULL because
  -- a discovery insight is purely derivative.
  source_call_id     uuid not null references calls(id) on delete cascade,
  -- Side-attach FKs. SET NULL on parent delete so an orphaned insight is
  -- still readable (its content is the source of truth), but the dead link
  -- doesn't dangle. Exactly one of these is non-null per row, enforced
  -- indirectly via calls.calls_single_parent_chk.
  deal_id            uuid references deals(id) on delete set null,
  account_id         uuid references accounts(id) on delete set null,
  feature_requests   jsonb not null default '[]',
  pain_points        jsonb not null default '[]',
  themes             jsonb not null default '[]',
  summary            text,
  -- Mirrors the column on risk_scores / account_health_scores. Today's
  -- classifier has no heuristic fallback (cf. src/lib/product-discovery/
  -- classifier.ts), so new rows are always 'ai'. The 'heuristic' option is
  -- kept open for future flexibility, identical to the Health schema.
  analysis_method    text not null default 'ai'
    check (analysis_method in ('ai', 'heuristic')),
  analyzed_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists product_discovery_insights_call_idx
  on product_discovery_insights (org_id, source_call_id, analyzed_at desc);

create index if not exists product_discovery_insights_deal_idx
  on product_discovery_insights (org_id, deal_id, analyzed_at desc)
  where deal_id is not null;

create index if not exists product_discovery_insights_account_idx
  on product_discovery_insights (org_id, account_id, analyzed_at desc)
  where account_id is not null;

-- Org-wide chronological scan, used by the Phase 3.2 rollup endpoint
-- (getAllInsightsForOrg).
create index if not exists product_discovery_insights_org_recent_idx
  on product_discovery_insights (org_id, analyzed_at desc);

alter table product_discovery_insights enable row level security;

drop policy if exists product_discovery_insights_org_isolation
  on product_discovery_insights;
create policy product_discovery_insights_org_isolation
  on product_discovery_insights
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
