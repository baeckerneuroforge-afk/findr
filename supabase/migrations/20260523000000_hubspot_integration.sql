-- Hubspot Connection per Org
create table if not exists hubspot_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  hubspot_portal_id text not null,
  hubspot_user_id text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  last_synced_at timestamptz,
  sync_status text not null default 'idle' check (sync_status in ('idle', 'syncing', 'failed')),
  sync_error text,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id)
);

alter table hubspot_integrations enable row level security;

create policy hubspot_integrations_org_isolation on hubspot_integrations
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create index hubspot_integrations_org_id_idx on hubspot_integrations(org_id);

-- Update deals table to track Hubspot sync state and normalized dashboard fields.
alter table deals add column if not exists hubspot_deal_id text;
alter table deals add column if not exists hubspot_last_synced_at timestamptz;
alter table deals add column if not exists data_source text not null default 'manual' check (data_source in ('manual', 'hubspot', 'salesforce', 'mock'));
alter table deals add column if not exists company_name text;
alter table deals add column if not exists owner_name text;
alter table deals add column if not exists last_activity_at timestamptz;
alter table deals add column if not exists currency text not null default 'USD' check (currency in ('USD', 'EUR'));

create unique index if not exists deals_hubspot_unique
  on deals(org_id, hubspot_deal_id);

create index if not exists deals_org_data_source_idx on deals(org_id, data_source);
create index if not exists deals_org_last_activity_idx on deals(org_id, last_activity_at desc);

-- OAuth state for CSRF protection during the OAuth flow.
create table if not exists oauth_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  state text not null unique,
  provider text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table oauth_states enable row level security;

create policy oauth_states_org_isolation on oauth_states
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create index oauth_states_state_idx on oauth_states(state);
create index oauth_states_expires_idx on oauth_states(expires_at);

notify pgrst, 'reload schema';
