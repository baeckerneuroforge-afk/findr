-- ─────────────────────────────────────────────────────────────────────────────
-- Findr — Initial schema
--
-- Multi-tenant B2B SaaS, scoped by Clerk Organizations.
-- Every tenant table carries org_id and is RLS-isolated via current_org_id(),
-- which resolves the active Clerk org from the request JWT.
--
-- Prerequisite: Clerk → Supabase third-party auth is configured so that
-- auth.jwt()->>'sub'    = Clerk user id
-- auth.jwt()->>'org_id' = active Clerk organization id
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"     with schema extensions;  -- gen_random_uuid()
create extension if not exists "vector"       with schema extensions;  -- pgvector


-- ─── Enums ───────────────────────────────────────────────────────────────────
create type plan_tier as enum ('free', 'starter', 'pro', 'enterprise');
create type user_role as enum ('owner', 'admin', 'member');
create type interview_status as enum
  ('scheduled', 'in_progress', 'completed', 'cancelled', 'failed');
create type finding_severity as enum ('low', 'medium', 'high', 'critical');


-- ─── Generic updated_at trigger fn ───────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ─── Tables ──────────────────────────────────────────────────────────────────
create table organizations (
  id              uuid primary key default gen_random_uuid(),
  clerk_org_id    text not null unique,
  name            text not null,
  plan            plan_tier not null default 'free',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table users (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text not null,
  org_id          uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            user_role not null default 'member',
  created_at      timestamptz not null default now(),
  -- A Clerk user may belong to multiple orgs → unique per (user, org)
  unique (clerk_user_id, org_id)
);

create table crm_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  provider        text not null,   -- 'hubspot', 'salesforce', 'pipedrive', …
  access_token    text not null,
  refresh_token   text,
  expires_at      timestamptz,
  scope           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, provider)
);
comment on column crm_connections.access_token is
  'Sensitive. Only readable by service-role; consider Supabase Vault for production.';
comment on column crm_connections.refresh_token is
  'Sensitive. Only readable by service-role; consider Supabase Vault for production.';

create table deals (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  external_id     text not null,
  source          text not null,    -- 'hubspot', 'salesforce', …
  name            text not null,
  amount          numeric(14, 2),
  stage           text,
  owner_email     text,
  closed_at       timestamptz,
  loss_reason     text,
  raw_data        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, source, external_id)
);

create table calls (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  deal_id           uuid references deals(id) on delete set null,
  source            text not null,    -- 'gong', 'chorus', 'manual', …
  recording_url     text,
  transcript        text,
  duration_seconds  integer check (duration_seconds is null or duration_seconds >= 0),
  participants      jsonb,
  recorded_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table risk_scores (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  call_id         uuid references calls(id) on delete cascade,
  deal_id         uuid references deals(id) on delete cascade,
  score           integer not null check (score between 0 and 100),
  signals         jsonb,
  model_version   text not null,
  created_at      timestamptz not null default now(),
  -- a score must be attached to a call, a deal, or both
  check (call_id is not null or deal_id is not null)
);

create table interviews (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  deal_id         uuid references deals(id) on delete set null,
  type            text not null,    -- 'win_loss', 'discovery', 'feedback', …
  status          interview_status not null default 'scheduled',
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  transcript      text,
  recording_url   text,
  vapi_call_id    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table findings (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  deal_id         uuid references deals(id) on delete set null,
  interview_id    uuid references interviews(id) on delete set null,
  category        text not null,    -- 'objection', 'pain_point', 'budget', …
  severity        finding_severity not null,
  content         text not null,
  embeddings      vector(1536),
  created_at      timestamptz not null default now()
);


-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index users_org_idx              on users        (org_id);
create index users_clerk_idx            on users        (clerk_user_id);

create index deals_org_stage_idx        on deals        (org_id, stage);
create index deals_org_closed_at_idx    on deals        (org_id, closed_at desc);
create index deals_org_owner_idx        on deals        (org_id, owner_email);

create index calls_org_deal_idx         on calls        (org_id, deal_id);
create index calls_org_recorded_at_idx  on calls        (org_id, recorded_at desc);

create index risk_scores_org_deal_idx   on risk_scores  (org_id, deal_id, created_at desc);
create index risk_scores_org_call_idx   on risk_scores  (org_id, call_id, created_at desc);

create index interviews_org_status_idx  on interviews   (org_id, status);
create index interviews_org_deal_idx    on interviews   (org_id, deal_id);
create index interviews_org_scheduled_idx
  on interviews (org_id, scheduled_at)
  where status = 'scheduled';

create index findings_org_deal_idx      on findings     (org_id, deal_id);
create index findings_org_category_idx  on findings     (org_id, category);
-- HNSW vector similarity index, cosine distance, partial to skip nulls
create index findings_embeddings_idx
  on findings using hnsw (embeddings vector_cosine_ops)
  where embeddings is not null;


-- ─── Triggers ────────────────────────────────────────────────────────────────
create trigger organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger crm_connections_updated_at
  before update on crm_connections
  for each row execute function set_updated_at();

create trigger deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

create trigger interviews_updated_at
  before update on interviews
  for each row execute function set_updated_at();


-- ─── Helper: resolve internal org_id from Clerk JWT claim ────────────────────
-- security definer + locked search_path so it can be called from RLS policies
-- regardless of the caller's access to organizations.
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.organizations
  where clerk_org_id = (auth.jwt()->>'org_id');
$$;
revoke all on function current_org_id() from public;
grant execute on function current_org_id() to authenticated, anon, service_role;


-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table organizations    enable row level security;
alter table users            enable row level security;
alter table crm_connections  enable row level security;
alter table deals            enable row level security;
alter table calls            enable row level security;
alter table risk_scores      enable row level security;
alter table interviews       enable row level security;
alter table findings         enable row level security;

-- organizations: a member can see their own org row
create policy "organizations_member_read"
  on organizations for select to authenticated
  using (id = current_org_id());

-- users: see own row OR rows in current org
create policy "users_self_or_org_read"
  on users for select to authenticated
  using (
    clerk_user_id = (auth.jwt()->>'sub')
    or org_id = current_org_id()
  );

-- crm_connections: read-only for org members; writes go through service-role
create policy "crm_connections_org_read"
  on crm_connections for select to authenticated
  using (org_id = current_org_id());

-- Generic org-isolation policies for tenant data
create policy "deals_org_isolation"
  on deals for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy "calls_org_isolation"
  on calls for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy "risk_scores_org_isolation"
  on risk_scores for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy "interviews_org_isolation"
  on interviews for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy "findings_org_isolation"
  on findings for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
