-- Sprint 7 — Solution Layer (deal-rescue recommendations), stage 1: persistence.
-- Stores the output of generateSolution() for a deal. ON-DEMAND ONLY: rows are
-- written when a solution is explicitly requested, never automatically as part
-- of risk analysis. Multiple reports per deal are kept (history), like
-- risk_scores — there is intentionally NO unique(deal_id) constraint.

create table if not exists solution_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  status text not null default 'completed' check (
    status in ('completed', 'failed')
  ),
  -- Denormalized from overall.salvageable for easy filtering/reporting.
  salvageable text check (salvageable in ('yes', 'no', 'maybe')),
  -- Full solution result: recommendations[] + the overall verdict object.
  recommendations jsonb not null default '[]'::jsonb,
  overall jsonb not null default '{}'::jsonb,
  -- Model that produced this report (e.g. claude-opus-4-7).
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists solution_reports_org_created_idx
  on solution_reports(org_id, created_at desc);

create index if not exists solution_reports_deal_idx
  on solution_reports(org_id, deal_id, created_at desc);

alter table solution_reports enable row level security;

drop policy if exists solution_reports_org_isolation on solution_reports;
create policy solution_reports_org_isolation
  on solution_reports
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
