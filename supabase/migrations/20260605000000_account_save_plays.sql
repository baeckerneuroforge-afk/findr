-- CS Health — Save-Play layer: mirror of the risk Solution layer, for accounts.
--
-- Where the risk side has score → signals → solution (rescue a deal), the health
-- side has health score → churn signals → save-play (retain a customer). Stores
-- the output of generateSavePlay() for an account. ON-DEMAND ONLY: rows are
-- written when a save-play is explicitly requested, never automatically. Multiple
-- per account are kept (history), like solution_reports — NO unique(account_id).
--
-- Mirrors solution_reports exactly, with two account-family conventions:
--   * account_id is TEXT (consistent with account_health_scores.account_id /
--     risk_scores.deal_id — deliberately not an FK there).
--   * source_health_score_id links the play to the health score it acted on
--     (analogous to a solution acting on the latest risk analysis).

create table if not exists account_save_plays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  account_id text not null,
  status text not null default 'completed' check (
    status in ('completed', 'failed')
  ),
  -- Denormalized from overall.salvageable for easy filtering/reporting.
  salvageable text check (salvageable in ('yes', 'no', 'maybe')),
  -- Full save-play result: recommendations[] + the overall verdict object.
  recommendations jsonb not null default '[]'::jsonb,
  overall jsonb not null default '{}'::jsonb,
  -- The health score this play acted on, if still present. SET NULL on delete so
  -- the play stands as a historical record.
  source_health_score_id uuid references account_health_scores(id) on delete set null,
  -- Model that produced this play (e.g. claude-opus-4-7).
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists account_save_plays_org_created_idx
  on account_save_plays(org_id, created_at desc);

create index if not exists account_save_plays_account_idx
  on account_save_plays(org_id, account_id, created_at desc);

alter table account_save_plays enable row level security;

drop policy if exists account_save_plays_org_isolation on account_save_plays;
create policy account_save_plays_org_isolation
  on account_save_plays
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
