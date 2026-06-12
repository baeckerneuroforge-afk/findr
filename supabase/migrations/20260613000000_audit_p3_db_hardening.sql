-- Audit-Paket 3 (2026-06-13): DB-Härtung aus dem Plattform-Audit.
--
-- 1) SECURITY-DEFINER-Lockdown (gleiche Lehre wie der G-Block-Permission-
--    Hotfix): current_org_id() und rls_auto_enable() waren via
--    /rest/v1/rpc/* von anon + authenticated aufrufbar. Es existiert KEIN
--    client-seitiger Supabase-Query-Pfad (useSupabaseClient hat null
--    Importer; alle Daten laufen über Service-Role-API-Routen, Service-Role
--    bypassed RLS). Der Revoke bricht daher nichts — direkte REST-Probes mit
--    dem public anon-Key schlagen künftig fail-closed fehl, statt die
--    Funktionen auszuführen.
revoke execute on function public.current_org_id() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.current_org_id() to service_role;

-- 2) search_path-Pins (Supabase-Lint 0011 function_search_path_mutable):
--    'public' = exakt das heutige Auflösungsverhalten, nur nicht mehr vom
--    Caller manipulierbar. set_churned_at/snapshot_account_value referenzieren
--    unqualifizierte public-Tabellen, daher 'public' statt ''.
alter function public.set_updated_at() set search_path = 'public';
alter function public.set_churned_at() set search_path = 'public';
alter function public.snapshot_account_value() set search_path = 'public';
alter function public.get_latest_risk_scores_for_deals(uuid, text[]) set search_path = 'public';

-- 3) RLS-Initplan-Fix (Supabase-Lint 0003 auth_rls_initplan) auf users:
--    (select …) lässt Postgres die auth-/org-Funktion einmal pro Query statt
--    einmal pro Zeile auswerten. Semantik identisch.
alter policy users_self_or_org_read on public.users
  using (
    (clerk_user_id = (select auth.jwt() ->> 'sub'))
    or (org_id = (select public.current_org_id()))
  );

-- 4) Fehlende FK-Indizes (Supabase-Lint 0001 unindexed_foreign_keys) —
--    nur Tabellen der aktiven Module (Risk-Analyse-/CS-/Product-Discovery-
--    eigene Tabellen bewusst ausgelassen, Module sind abgekündigt).
--    Kleines, junges Datenvolumen → normale CREATE INDEX (kein CONCURRENTLY
--    nötig, Migration läuft transaktional).
create index if not exists interview_sessions_deal_id_fk_idx on public.interview_sessions (deal_id);
create index if not exists bridge_suggestions_approved_plan_id_fk_idx on public.bridge_suggestions (approved_plan_id);
create index if not exists call_segments_call_id_fk_idx on public.call_segments (call_id);
create index if not exists findings_deal_id_fk_idx on public.findings (deal_id);
create index if not exists findings_interview_id_fk_idx on public.findings (interview_id);
create index if not exists interviews_deal_id_fk_idx on public.interviews (deal_id);
create index if not exists oauth_states_org_id_fk_idx on public.oauth_states (org_id);
create index if not exists panel_studies_plan_id_fk_idx on public.panel_studies (plan_id);
create index if not exists participant_pool_invites_org_id_fk_idx on public.participant_pool_invites (org_id);
create index if not exists research_open_links_org_id_fk_idx on public.research_open_links (org_id);
create index if not exists research_plan_stimuli_org_id_fk_idx on public.research_plan_stimuli (org_id);
create index if not exists research_screening_responses_org_id_fk_idx on public.research_screening_responses (org_id);
create index if not exists slack_alerts_deal_id_fk_idx on public.slack_alerts (deal_id);
create index if not exists solution_reports_deal_id_fk_idx on public.solution_reports (deal_id);
create index if not exists study_synthesis_plan_id_fk_idx on public.study_synthesis (plan_id);
