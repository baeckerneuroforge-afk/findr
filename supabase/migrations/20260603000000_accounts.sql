-- CS Health — Etappe 1: account foundation.
--
-- An `account` (customer) is a new top-level object with its own life after a
-- deal is won. This sprint adds ONLY the table + master data. The health-score
-- engine (its own `account_health_scores` table), post-sale call ingestion
-- (`calls.account_id`), and account interviews all land in later sprints.
--
-- An account may be born from a won deal (source_deal_id) — company_name and
-- contact details are copied over at creation — or created manually. Deleting
-- the originating deal must NOT delete the customer, so source_deal_id is
-- ON DELETE SET NULL (the account outlives the deal).
--
-- RLS mirrors org_settings / the other tenant tables: org-isolated, with
-- server-side reads/writes going through the service role (scoped by org_id).

create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  company_name    text not null,
  -- Primary post-sale contact (the "sponsor"). Seeded from the deal's contact.
  sponsor_name    text,
  sponsor_email   text,
  sponsor_phone   text,
  -- Monthly recurring revenue. Nullable (unknown for manually-added accounts).
  mrr             numeric(14, 2),
  currency        text not null default 'EUR',
  renewal_date    date,
  status          text not null default 'active'
    check (status in ('active', 'at_risk', 'churned')),
  -- The won deal this account was created from, if any. SET NULL on deal delete
  -- so the customer record survives.
  source_deal_id  uuid references deals(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists accounts_org_created_idx
  on accounts (org_id, created_at desc);
create index if not exists accounts_org_status_idx
  on accounts (org_id, status);
create index if not exists accounts_source_deal_idx
  on accounts (source_deal_id)
  where source_deal_id is not null;

drop trigger if exists accounts_updated_at on accounts;
create trigger accounts_updated_at
  before update on accounts
  for each row execute function set_updated_at();

alter table accounts enable row level security;

drop policy if exists accounts_org_isolation on accounts;
create policy accounts_org_isolation
  on accounts
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
