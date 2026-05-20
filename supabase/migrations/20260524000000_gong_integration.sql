-- Sprint 3 — Gong OAuth + Call Transcript Sync
-- OAuth connection state, Gong call metadata, raw segment storage, and
-- optional user cache. Embedding generation is intentionally not part of
-- this sprint; `call_segments.embedding` stays nullable.

create table if not exists gong_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  gong_company_id text,
  api_base_url text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scope text,
  last_synced_at timestamptz,
  sync_status text not null default 'idle' check (sync_status in ('idle', 'syncing', 'failed')),
  sync_error text,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id)
);

alter table gong_integrations enable row level security;

drop policy if exists gong_integrations_org_isolation on gong_integrations;
create policy gong_integrations_org_isolation on gong_integrations
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create index if not exists gong_integrations_org_id_idx on gong_integrations(org_id);

create table if not exists gong_users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  gong_user_id text not null,
  email text,
  name text,
  title text,
  raw_data jsonb,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, gong_user_id)
);

alter table gong_users enable row level security;

drop policy if exists gong_users_org_isolation on gong_users;
create policy gong_users_org_isolation on gong_users
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create index if not exists gong_users_org_id_idx on gong_users(org_id);
create index if not exists gong_users_email_idx on gong_users(org_id, email);

alter table calls add column if not exists gong_call_id text;
alter table calls add column if not exists gong_url text;
alter table calls add column if not exists gong_workspace_id text;
alter table calls add column if not exists gong_primary_user_id text;
alter table calls add column if not exists deal_mapping_method text;
alter table calls add column if not exists deal_mapping_confidence numeric(4, 3);

create unique index if not exists calls_gong_unique
  on calls(org_id, gong_call_id)
  where gong_call_id is not null;

create index if not exists calls_org_gong_call_idx on calls(org_id, gong_call_id);
create index if not exists calls_org_source_recorded_idx on calls(org_id, source, recorded_at desc);

create table if not exists call_segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  call_id uuid not null references calls(id) on delete cascade,
  gong_call_id text not null,
  speaker_id text,
  speaker_name text,
  speaker_email text,
  speaker_role text,
  start_seconds int not null default 0,
  end_seconds int not null default 0,
  text text not null,
  embedding vector(1536),
  raw_data jsonb,
  created_at timestamptz default now()
);

alter table call_segments enable row level security;

drop policy if exists call_segments_org_isolation on call_segments;
create policy call_segments_org_isolation on call_segments
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create index if not exists call_segments_org_call_idx on call_segments(org_id, call_id);
create index if not exists call_segments_gong_call_idx on call_segments(org_id, gong_call_id);

notify pgrst, 'reload schema';
