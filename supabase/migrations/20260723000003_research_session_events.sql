-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2b — behavioural interaction EVENT STORE (integration plan §5, L5/L6/L8).
--
-- Leaf table: one row per semantic interaction event a participant produces in a
-- usability task (click / scroll / dwell / nav / input focus-blur / task
-- start-complete-abandon). Captured ONLY when the study opted in
-- (research_plans.event_tracking_enabled, 20260723000001) AND the participant
-- granted the events tier (interview_sessions.events_consent_at, 20260723000002)
-- — both enforced FAIL-CLOSED in the /events route (assertCaptureConsent).
--
-- LEAF by design: FK in (session_id, org_id), NO inbound FK. ON DELETE CASCADE
-- on both, so events die with the session (withdraw / retention cron) and with
-- the org (delete_organization_data's org_id loop) — no extra deletion wiring.
--
-- ts_ms = CLIENT event time (relative, for ordering + time-on-task); created_at =
-- SERVER time (the authoritative retention clock — client ts_ms is untrusted).
-- payload is a small bounded jsonb; it MUST NOT carry raw input values (the
-- route rejects 'value'/'text' on input events — data minimisation).
--
-- STRUCTURAL RED LINE (L8): event_type is a closed behavioural set. There is NO
-- voice/face/webcam channel and NO affect/emotion column anywhere — friction is
-- derived (server-side) only from behaviour, never as an emotion label.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists research_session_events (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references interview_sessions(id) on delete cascade,
  org_id         uuid not null references organizations(id) on delete cascade,
  event_type     text not null check (
    event_type in (
      'click', 'scroll', 'dwell', 'input_focus', 'input_blur',
      'nav', 'task_start', 'task_complete', 'task_abandon'
    )
  ),
  ts_ms          bigint not null,
  target_selector text,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists research_session_events_session_idx
  on research_session_events (session_id, ts_ms);
create index if not exists research_session_events_org_created_idx
  on research_session_events (org_id, created_at);

alter table research_session_events enable row level security;
drop policy if exists research_session_events_org_isolation on research_session_events;
create policy research_session_events_org_isolation
  on research_session_events
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
