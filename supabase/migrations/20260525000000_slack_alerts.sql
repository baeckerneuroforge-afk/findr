-- Sprint 5 — Slack alert engine
-- Adds dedup/snooze-capable alert audit and per-org alert preferences.

create table if not exists slack_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  alert_type text not null check (
    alert_type in ('risk_spike', 'champion_lost', 'deal_lost', 'forecast_change')
  ),
  deal_id text references deals(id) on delete set null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  metadata jsonb default '{}'::jsonb,
  slack_message_ts text,
  sent_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists slack_alerts_org_deal_idx
  on slack_alerts(org_id, deal_id);

create index if not exists slack_alerts_org_type_sent_idx
  on slack_alerts(org_id, alert_type, sent_at desc);

create table if not exists slack_alert_preferences (
  org_id uuid primary key references organizations(id) on delete cascade,
  risk_spike_enabled boolean not null default true,
  risk_spike_threshold integer not null default 25,
  champion_lost_enabled boolean not null default true,
  deal_lost_enabled boolean not null default true,
  forecast_change_enabled boolean not null default true,
  forecast_change_threshold numeric(5,2) not null default 20.00,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (risk_spike_threshold between 1 and 100),
  check (forecast_change_threshold >= 1 and forecast_change_threshold <= 100)
);

alter table slack_alerts enable row level security;
alter table slack_alert_preferences enable row level security;

drop policy if exists slack_alerts_org_isolation on slack_alerts;
create policy slack_alerts_org_isolation
  on slack_alerts
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists slack_alert_preferences_org_isolation on slack_alert_preferences;
create policy slack_alert_preferences_org_isolation
  on slack_alert_preferences
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
