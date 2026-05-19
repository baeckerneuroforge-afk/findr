-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 5 — Slack Alerts
--
-- One Slack integration per org (incoming webhook + alert thresholds), and an
-- alert_history audit log of every dispatch attempt (sent / failed / skipped).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists slack_integrations (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references organizations(id) on delete cascade,
  workspace_name           text,
  channel_id               text not null,
  channel_name             text not null,
  webhook_url              text not null,
  alert_threshold          int  not null default 70 check (alert_threshold between 0 and 100),
  alert_on_critical_only   boolean not null default false,
  enabled                  boolean not null default true,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  unique (org_id)
);

create table if not exists alert_history (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  deal_id         text not null,
  risk_score_id   uuid references risk_scores(id) on delete set null,
  alert_type      text not null check (alert_type in ('threshold_crossed', 'critical_signal', 'score_spike')),
  channel_id      text not null,
  payload         jsonb not null,
  sent_at         timestamptz default now(),
  status          text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error_message   text
);

create index if not exists alert_history_deal_id_idx on alert_history (deal_id);
create index if not exists alert_history_sent_at_idx on alert_history (sent_at desc);

notify pgrst, 'reload schema';
