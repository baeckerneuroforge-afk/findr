-- Phase 4 — Baustein 3 (Panel-Anbieter), Etappe E4: Draft-Persistenz.
--
-- Schließt die Keystone-Lücke der Prolific-Integration: provider_study_id
-- existierte bisher NUR als transienter Client-State im Draft-Panel — nach
-- einem Reload wusste findr nicht mehr, dass (und welche) Studie angelegt
-- wurde (bekanntes Doppel-Draft-Risiko). Ab E4 schreibt
-- createProlificDraftForPlan hier eine Zeile; die Detailseiten lesen den
-- jüngsten Draft pro Plan. submission_counts / total_cost_cents /
-- last_synced_at sind bewusst schon angelegt, aber bleiben bis E5 (Sync) /
-- E6 (Kosten) unbefüllt — additiv, kein zweiter Schema-Schnitt nötig.
--
-- status trägt das PROVIDER-Vokabular (Prolific: UNPUBLISHED, ACTIVE, …)
-- und ist deshalb bewusst ohne CHECK — E5 schreibt hier Fremd-Statusse.
--
-- Additiv + idempotent: neue Tabelle only; org_id/RLS exakt wie
-- 20260702000002 (current_org_id-Isolation, Code greift via Service-Role zu
-- und filtert explizit auf org_id).

create table if not exists panel_studies (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  plan_id            uuid not null references research_plans(id) on delete cascade,
  provider           text not null check (provider in ('prolific')),
  provider_study_id  text not null,
  status             text not null,
  draft_input        jsonb,
  submission_counts  jsonb,
  total_cost_cents   integer,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, provider, provider_study_id)
);

-- Lesepfad der Detailseiten: jüngster Draft pro (org, plan).
create index if not exists panel_studies_org_plan_idx
  on panel_studies(org_id, plan_id, created_at desc);

alter table panel_studies enable row level security;

drop policy if exists panel_studies_org_isolation on panel_studies;
create policy panel_studies_org_isolation
  on panel_studies
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop trigger if exists panel_studies_updated_at on panel_studies;
create trigger panel_studies_updated_at
  before update on panel_studies
  for each row execute function set_updated_at();

notify pgrst, 'reload schema';
