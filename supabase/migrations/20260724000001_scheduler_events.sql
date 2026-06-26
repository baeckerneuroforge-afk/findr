-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduler audit log — Phase 1 of the Kalender/Scheduler feature
-- (docs/klymeo-scheduler-kalender-plan-2026-06-26.md, §4 Migration 2).
--
-- One append-only row per scheduler lifecycle event on a research plan: a study
-- was scheduled / rescheduled / its schedule cancelled / manually activated / an
-- activation failed. Gives a who-did-what-when trail for the deferred-activation
-- flow (and a debugging surface once the Phase-2 cron joins as triggered_by='cron').
--
-- LEAF by design: FK in (org_id, plan_id), NO inbound FK. ON DELETE CASCADE on
-- both, so events die with the plan (deleteResearchPlan) and with the org
-- (delete_organization_data) — no extra deletion wiring.
--
-- triggered_by_user_id = the Zitadel subject (session.user.id); null for the
-- future cron path. triggered_by_email is best-effort (the session may not carry
-- one). detail is a small bounded jsonb (e.g. the invite-release summary).
--
-- org_id is NOT NULL by design: research_plans.org_id is nullable (reserved for
-- future external pools), but every scheduler event in Phase 1 necessarily has a
-- real org — the only writers are the org-scoped /schedule and /activate routes,
-- which fetch the plan via getResearchPlan(orgId, planId) (a .eq("org_id",orgId)
-- query that CANNOT return a null-org plan) and 404 before any event is recorded.
-- So a null-org plan is unreachable here. If Phase 2 adds external-panel
-- scheduling for null-org plans, this column (and recordSchedulerEvent) must be
-- revisited then.
--
-- CRITICAL on RLS: the policy below is enabled but DOES NOT gate the app/cron.
-- The service-role client (createResearchSupabase) ALWAYS bypasses RLS in
-- Postgres. The real org-scoping boundary is the explicit .eq("org_id", orgId) in
-- application code — that filter, not RLS, is the trust boundary for every
-- service-role write. The policy is a fail-closed backstop for accidental human
-- SQL only, mirroring research_session_events / synthesis_shares.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists scheduler_events (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  plan_id             uuid not null references research_plans(id) on delete cascade,
  event_type          text not null check (
    event_type in (
      'scheduled', 'rescheduled', 'schedule_cancelled',
      'manual_activated', 'auto_activated', 'activation_failed', 'reminder_sent'
    )
  ),
  triggered_by        text not null default 'manual' check (
    triggered_by in ('manual', 'cron')
  ),
  triggered_by_user_id text,
  triggered_by_email   text,
  detail              jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists scheduler_events_org_created_idx
  on scheduler_events (org_id, created_at desc);
create index if not exists scheduler_events_plan_created_idx
  on scheduler_events (plan_id, created_at desc);

alter table scheduler_events enable row level security;
drop policy if exists scheduler_events_org_isolation on scheduler_events;
create policy scheduler_events_org_isolation
  on scheduler_events
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
