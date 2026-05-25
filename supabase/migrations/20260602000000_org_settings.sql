-- Sprint: deal → interview, part 4 (auto-trigger setting).
--
-- General per-org settings, mirroring the slack_alert_preferences mechanic (one
-- row per org, upserted). First setting: automatically start the post-loss
-- interview AND send the invitation when a deal is marked lost. Default OFF.

create table if not exists org_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  auto_start_post_loss_interview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table org_settings enable row level security;

-- Org-internal access mirrors the other per-org tables. Server-side reads/writes
-- go through the service role (RLS-bypassing), always scoped by org_id.
drop policy if exists org_settings_org_isolation on org_settings;
create policy org_settings_org_isolation
  on org_settings
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
