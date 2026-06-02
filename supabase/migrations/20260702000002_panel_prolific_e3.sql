-- Phase 4 — Baustein 3 (Panel-Anbieter), Etappe E3: Prolific credentials.
--
-- Per-Org API token for the Prolific provider. This is deliberately stronger
-- than the older HubSpot/Gong/Slack integrations, whose tokens/webhooks still
-- live in plaintext text columns today. Prolific tokens can create studies and
-- are money-adjacent once a customer manually publishes/funds a draft in
-- Prolific, so E3 stores only application-encrypted ciphertext at rest. The
-- app encryption key comes from PANEL_CREDENTIALS_ENCRYPTION_KEY; it is NOT in
-- the database and must be set by the operator.
--
-- Additive + idempotent: a new table only, org_id NOT NULL, RLS via the same
-- current_org_id() helper used by the rest of the research surface.

create table if not exists panel_provider_credentials (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  provider            text not null check (provider in ('prolific')),
  encrypted_api_token text not null,
  token_iv            text not null,
  token_auth_tag      text not null,
  encryption_key_id   text,
  token_hint          text,
  status              text not null default 'unknown'
    check (status in ('connected', 'invalid', 'unknown')),
  provider_user_id    text,
  provider_user_email text,
  last_validated_at   timestamptz,
  validation_error    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists panel_provider_credentials_org_idx
  on panel_provider_credentials(org_id);

alter table panel_provider_credentials enable row level security;

drop policy if exists panel_provider_credentials_org_isolation
  on panel_provider_credentials;
create policy panel_provider_credentials_org_isolation
  on panel_provider_credentials
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop trigger if exists panel_provider_credentials_updated_at
  on panel_provider_credentials;
create trigger panel_provider_credentials_updated_at
  before update on panel_provider_credentials
  for each row execute function set_updated_at();

notify pgrst, 'reload schema';
