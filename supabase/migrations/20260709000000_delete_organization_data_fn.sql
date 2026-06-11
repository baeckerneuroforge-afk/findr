-- ─────────────────────────────────────────────────────────────────────────────
-- DSGVO deletion — remove ALL of an org's data + the org row, atomically.
--
-- A pure `delete from organizations` is NOT sufficient: four org_id-bearing
-- tables have no ON DELETE CASCADE foreign key to organizations
-- (risk_scores, alert_history, account_health_scores,
-- product_discovery_insights), so a cascade-only delete would orphan their
-- rows (org_id pointing at a deleted org — including PII). This function
-- instead deletes from EVERY table carrying an org_id (covering the
-- CASCADE-FK'd tables, the non-FK'd ones, and any future table) plus the two
-- org-less transcript tables, then the organizations row — all in one
-- transaction.
--
-- Order-independent: every inter-table FK in this schema is CASCADE or
-- SET NULL (never RESTRICT), so no delete can be blocked regardless of order.
--
-- SECURITY DEFINER + service_role-only EXECUTE: invoked from the admin-gated
-- delete-org route via the service-role client.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function delete_organization_data(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- org-less transcript tables, scoped via the parent call's org
  delete from transcript_segments t using calls c
    where t.call_id = c.id and c.org_id = p_org_id;
  delete from call_speakers t using calls c
    where t.call_id = c.id and c.org_id = p_org_id;

  -- every table carrying an org_id (organizations itself is the parent → skip)
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'org_id'
      and table_name <> 'organizations'
  loop
    execute format('delete from public.%I where org_id = $1', r.table_name)
      using p_org_id;
  end loop;

  -- finally the organization row itself
  delete from organizations where id = p_org_id;
end;
$$;

-- Only the service-role client (used by the admin-gated delete route) may run it.
-- anon + authenticated are revoked EXPLICITLY: Supabase default-grants EXECUTE on
-- public functions to those roles directly, so `from public` alone would leave a
-- SECURITY DEFINER function (RLS-bypassing, arbitrary org_id) callable via the
-- anon PostgREST RPC endpoint.
revoke all on function delete_organization_data(uuid) from public, anon, authenticated;
grant execute on function delete_organization_data(uuid) to service_role;
