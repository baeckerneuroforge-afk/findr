-- ─────────────────────────────────────────────────────────────────────────────
-- Perf — latest risk_score per deal without loading the full history.
--
-- getLatestRiskScoresForDeals (src/lib/risk/service.ts) previously fetched
-- EVERY risk_scores row for the requested deals and de-duped in JS. The daily
-- reanalyze cron appends one row per deal per day, so that fetch grows without
-- bound — a self-reinforcing cliff on /dashboard and /forecast. DISTINCT ON
-- returns exactly one (latest) row per deal directly in the DB.
--
-- SECURITY INVOKER (default): called via the service-role client (bypasses
-- RLS); locked to service_role so it isn't exposed on the anon/authenticated
-- PostgREST RPC surface.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_latest_risk_scores_for_deals(
  p_org_id uuid,
  p_deal_ids uuid[]
)
returns setof risk_scores
language sql
stable
as $$
  select distinct on (deal_id) *
  from risk_scores
  where org_id = p_org_id
    and deal_id = any(p_deal_ids)
  order by deal_id, analyzed_at desc nulls last;
$$;

revoke all on function get_latest_risk_scores_for_deals(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function get_latest_risk_scores_for_deals(uuid, uuid[])
  to service_role;
