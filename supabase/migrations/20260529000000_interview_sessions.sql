-- Sprint: async post-loss interview — persistence for interview sessions.
--
-- An interview_session is a token-addressed, login-free chat that a buyer runs
-- over a public link. Org members read/create under RLS (org_isolation, like
-- solution_reports). The PUBLIC interview page does NOT use the anon key — it
-- goes through a server-side route that loads/updates the session by its
-- unguessable access_token using the SERVICE ROLE (which bypasses RLS) and only
-- ever touches the single row matching that token. So RLS stays strict, and the
-- token is the capability credential, scoped to one row — never an open policy.

create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- nullable for now: real deal wiring lands in a later sprint; test sessions
  -- are created without a deal.
  deal_id uuid references deals(id) on delete cascade,
  -- long, unguessable random string — the capability token for the public link.
  access_token text not null unique,
  status text not null default 'open' check (
    status in ('open', 'completed', 'abandoned')
  ),
  -- conversation so far: [{ "role": "agent" | "customer", "text": "…" }]
  conversation jsonb not null default '[]'::jsonb,
  -- InterviewInput for the interviewer core (deal context + risk prediction), so
  -- the public page never needs to read the deals/risk tables.
  deal_context jsonb,
  -- result, filled on completion:
  extracted_reason text,
  evidence text,
  matched_risk_prediction text,
  result jsonb,
  model text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists interview_sessions_org_created_idx
  on interview_sessions(org_id, created_at desc);
-- (access_token already has a unique index from the column constraint — that is
--  the lookup path for the public token-based route.)

alter table interview_sessions enable row level security;

-- Org-internal access (logged-in members) mirrors solution_reports. The public
-- token route does NOT rely on this policy — it runs server-side with the
-- service role (RLS-bypassing), scoped to the single row matching access_token.
drop policy if exists interview_sessions_org_isolation on interview_sessions;
create policy interview_sessions_org_isolation
  on interview_sessions
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
