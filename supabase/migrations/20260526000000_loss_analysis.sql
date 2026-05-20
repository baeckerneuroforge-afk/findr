-- Sprint 6 — Loss Auto-Tagging + Reporting
-- Heuristic-first loss reason extraction and cached quarterly report summaries.

create table if not exists loss_reasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  primary_reason text not null check (
    primary_reason in (
      'pricing',
      'compliance',
      'competitor',
      'timing',
      'budget',
      'champion_lost',
      'feature_gap',
      'no_decision',
      'internal_priority',
      'other'
    )
  ),
  secondary_reasons text[] default '{}',
  confidence numeric(3,2) not null default 0.5,
  evidence_quotes jsonb default '[]'::jsonb,
  extraction_method text not null default 'heuristic' check (
    extraction_method in ('heuristic', 'ai', 'manual')
  ),
  extracted_at timestamptz not null default now(),
  manually_corrected boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(deal_id)
);

create index if not exists loss_reasons_org_extracted_idx
  on loss_reasons(org_id, extracted_at desc);

create index if not exists loss_reasons_primary_idx
  on loss_reasons(org_id, primary_reason);

alter table loss_reasons enable row level security;

drop policy if exists loss_reasons_org_isolation on loss_reasons;
create policy loss_reasons_org_isolation
  on loss_reasons
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create table if not exists loss_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_lost_deals integer not null default 0,
  total_lost_value numeric(15,2) not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  pdf_url text,
  created_at timestamptz not null default now()
);

create index if not exists loss_reports_org_period_idx
  on loss_reports(org_id, period_end desc);

alter table loss_reports enable row level security;

drop policy if exists loss_reports_org_isolation on loss_reports;
create policy loss_reports_org_isolation
  on loss_reports
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
