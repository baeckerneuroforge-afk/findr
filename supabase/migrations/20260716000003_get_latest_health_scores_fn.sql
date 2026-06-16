-- ─────────────────────────────────────────────────────────────────────────────
-- Perf — latest account_health_score per account without loading the full history.
--
-- getLatestHealthScoresForAccounts (src/lib/accounts/health-service.ts) previously
-- fetched EVERY row for the requested accounts and de-duped in JS. The daily
-- check-in/reanalyze crons append one row per account per run, so that fetch grows
-- without bound on /dashboard/health and /dashboard/accounts. DISTINCT ON returns
-- exactly one (latest) row per account directly in the DB.
--
-- Mirrors get_latest_risk_scores_for_deals (20260710000000). account_id is TEXT
-- → p_account_ids text[]. analyzed_at is nullable → `nulls last` (so a NULL-dated
-- row never wins "latest" over a real timestamp). The existing index
-- account_health_scores_account_idx (org_id, account_id, analyzed_at desc) already
-- serves the DISTINCT ON/ORDER BY — NO new index.
--
-- SECURITY INVOKER (default): only ever called via the service-role admin client
-- (bypasses RLS); locked to service_role so the function is NOT exposed on the
-- anon/authenticated PostgREST RPC surface. The body still filters by p_org_id
-- because service-role bypasses the RLS policy.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_latest_health_scores_for_accounts(
  p_org_id uuid,
  p_account_ids text[]
)
returns setof account_health_scores
language sql
stable
security invoker
set search_path = 'public'
as $$
  select distinct on (account_id) *
  from account_health_scores
  where org_id = p_org_id
    and account_id = any(p_account_ids)
  order by account_id, analyzed_at desc nulls last;
$$;

revoke all on function get_latest_health_scores_for_accounts(uuid, text[])
  from public, anon, authenticated;
grant execute on function get_latest_health_scores_for_accounts(uuid, text[])
  to service_role;

notify pgrst, 'reload schema';
