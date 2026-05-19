-- ─────────────────────────────────────────────────────────────────────────────
-- Fix-Sprint 1 — Restore RLS and FKs lost during Sprint 4 drop+recreate
--
-- Sprint 4 (20260520000000_risk_drilldown.sql) dropped risk_scores cascade
-- and recreated it WITHOUT:
--   - RLS enable
--   - risk_scores_org_isolation policy
--   - org_id FK to organizations
--
-- Sprint 5 (20260521000000_slack_alerts.sql) created slack_integrations and
-- alert_history WITHOUT any RLS or policies.
--
-- We do NOT touch the existing current_org_id() function defined in
-- 20260518090000_initial_schema.sql — it correctly resolves Clerk
-- org_id → internal UUID via the organizations table. Replacing it with
-- a JWT-only cast would break all existing org-scoped policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── risk_scores: re-enable RLS + restore policy ─────────────────────────────
alter table risk_scores enable row level security;

drop policy if exists risk_scores_org_isolation on risk_scores;
create policy risk_scores_org_isolation
  on risk_scores
  for all
  to authenticated
  using      (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Restore org FK (deal_id stays text → no FK possible vs deals.id uuid)
alter table risk_scores
  drop constraint if exists risk_scores_org_id_fkey;
alter table risk_scores
  add  constraint risk_scores_org_id_fkey
  foreign key (org_id) references organizations(id) on delete cascade;


-- ─── slack_integrations: enable RLS + create policy ──────────────────────────
alter table slack_integrations enable row level security;

drop policy if exists slack_integrations_org_isolation on slack_integrations;
create policy slack_integrations_org_isolation
  on slack_integrations
  for all
  to authenticated
  using      (org_id = current_org_id())
  with check (org_id = current_org_id());


-- ─── alert_history: enable RLS + create policy + FK ──────────────────────────
alter table alert_history enable row level security;

drop policy if exists alert_history_org_isolation on alert_history;
create policy alert_history_org_isolation
  on alert_history
  for all
  to authenticated
  using      (org_id = current_org_id())
  with check (org_id = current_org_id());

alter table alert_history
  drop constraint if exists alert_history_org_id_fkey;
alter table alert_history
  add  constraint alert_history_org_id_fkey
  foreign key (org_id) references organizations(id) on delete cascade;


-- ─── Indexes for org-scoped queries ──────────────────────────────────────────
create index if not exists risk_scores_org_id_idx        on risk_scores        (org_id);
create index if not exists slack_integrations_org_id_idx on slack_integrations (org_id);
create index if not exists alert_history_org_id_idx      on alert_history      (org_id);


notify pgrst, 'reload schema';
