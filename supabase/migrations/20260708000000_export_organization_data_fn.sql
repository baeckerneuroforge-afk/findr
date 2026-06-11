-- ─────────────────────────────────────────────────────────────────────────────
-- DSGVO export — return ALL of an org's data as one JSON object.
--
-- The previous TS export hand-listed ~18 tables and had frozen while the schema
-- grew to 43 — so research studies, interview transcripts, syntheses, CS/PD
-- data, panel and voice rows were silently missing from "export all data". This
-- function dynamically covers every table carrying an org_id (plus the two
-- org-less transcript tables, scoped via calls), so it stays complete as new
-- tables are added.
--
-- Secret material is stripped uniformly by column name (jsonb - text[]) across
-- every table, so a token can't leak from a table a curated list never knew
-- about. token_hint / encryption_key_id / *_expires_at are non-secret metadata
-- and are intentionally retained.
--
-- SECURITY DEFINER + service_role-only EXECUTE: the app invokes this from the
-- admin-gated export route via the service-role client.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function export_organization_data(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  result jsonb := '{}'::jsonb;
  rows jsonb;
  secret_cols text[] := array[
    'access_token', 'refresh_token', 'webhook_url',
    'encrypted_api_token', 'token_iv', 'token_auth_tag', 'token_hash'
  ];
begin
  -- Every table carrying an org_id (organizations itself is the parent → skip).
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'org_id'
      and table_name <> 'organizations'
    order by table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t.*) - $2), ''[]''::jsonb) '
      || 'from public.%I t where t.org_id = $1',
      r.table_name
    ) into rows using p_org_id, secret_cols;
    result := result || jsonb_build_object(r.table_name, rows);
  end loop;

  -- call_speakers + transcript_segments have no org_id; scope them via calls.
  execute 'select coalesce(jsonb_agg(to_jsonb(t.*) - $2), ''[]''::jsonb) '
       || 'from call_speakers t join calls c on c.id = t.call_id '
       || 'where c.org_id = $1'
    into rows using p_org_id, secret_cols;
  result := result || jsonb_build_object('call_speakers', rows);

  execute 'select coalesce(jsonb_agg(to_jsonb(t.*) - $2), ''[]''::jsonb) '
       || 'from transcript_segments t join calls c on c.id = t.call_id '
       || 'where c.org_id = $1'
    into rows using p_org_id, secret_cols;
  result := result || jsonb_build_object('transcript_segments', rows);

  return result;
end;
$$;

-- Only the service-role client (used by the admin-gated export route) may run it.
-- anon + authenticated are revoked EXPLICITLY: Supabase default-grants EXECUTE on
-- public functions to those roles directly, so `from public` alone would leave a
-- SECURITY DEFINER function (RLS-bypassing, arbitrary org_id) callable via the
-- anon PostgREST RPC endpoint.
revoke all on function export_organization_data(uuid) from public, anon, authenticated;
grant execute on function export_organization_data(uuid) to service_role;
