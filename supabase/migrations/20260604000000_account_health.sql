-- CS Health — Etappe 2: manual transcript → health score (same engine, post-sale phase).
--
-- A call belongs to exactly one phase: a sales deal (deal_id → risk) OR a
-- customer account (account_id → health). The attach point decides which scoring
-- runs — there is NO phase auto-detection. We add a nullable account_id to calls
-- plus a check that a call is never attached to BOTH at once.
--
-- account_health_scores mirrors risk_scores (same signal/score shape) but stores
-- the inverse "health" framing (high score = healthy). account_id is TEXT for
-- consistency with risk_scores.deal_id (deliberately not an FK there).
-- analysis_method preserves honest provenance (ai vs heuristic fallback), exactly
-- like risk_scores.

-- ── calls: post-sale attach point ───────────────────────────────────────────
alter table calls
  add column if not exists account_id uuid references accounts(id) on delete cascade;

-- A call attaches to a deal OR an account, never both. Existing rows have
-- account_id = null, so this stays satisfiable.
alter table calls drop constraint if exists calls_single_parent_chk;
alter table calls
  add constraint calls_single_parent_chk
  check (account_id is null or deal_id is null);

create index if not exists calls_org_account_idx on calls (org_id, account_id);

-- ── account_health_scores: mirrors risk_scores, inverse framing ─────────────
create table if not exists account_health_scores (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  account_id         text not null,
  health_score       int  not null check (health_score between 0 and 100),
  health_level       text not null
    check (health_level in ('healthy', 'at_risk', 'critical')),
  overall_reasoning  text not null,
  recommendations    text[] default '{}',
  signals            jsonb not null,
  -- The transcript (call) whose analysis produced this score. SET NULL if the
  -- call is later removed; the score still stands as a historical data point.
  source_call_id     uuid references calls(id) on delete set null,
  analysis_method    text not null default 'ai'
    check (analysis_method in ('ai', 'heuristic')),
  analyzed_at        timestamptz default now(),
  created_at         timestamptz default now()
);

create index if not exists account_health_scores_account_idx
  on account_health_scores (org_id, account_id, analyzed_at desc);
create index if not exists account_health_scores_analyzed_at_idx
  on account_health_scores (analyzed_at desc);

alter table account_health_scores enable row level security;

drop policy if exists account_health_scores_org_isolation on account_health_scores;
create policy account_health_scores_org_isolation
  on account_health_scores
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
