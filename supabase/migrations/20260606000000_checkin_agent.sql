-- CS Health — Check-in agent (Etappe A): account-scoped satisfaction check-ins.
--
-- Reuses interview_sessions: a session is either a post-loss DEAL interview
-- (kind='post_loss', deal_id set) or an account CHECK-IN (kind='checkin',
-- account_id set). The public token chat page is shared; `kind` disambiguates the
-- agent prompt and the completion behavior:
--   post_loss → loss-reason extraction (unchanged);
--   checkin   → the conversation becomes a transcript fed to
--               analyzeAccountTranscript → one account health-score point.

alter table interview_sessions
  add column if not exists account_id uuid references accounts(id) on delete cascade;

alter table interview_sessions
  add column if not exists kind text not null default 'post_loss'
    check (kind in ('post_loss', 'checkin'));

create index if not exists interview_sessions_account_idx
  on interview_sessions(account_id) where account_id is not null;

-- The product the check-in agent speaks about, in the Findr customer's name.
-- (Org name comes from organizations.name; this adds the product label.)
alter table org_settings
  add column if not exists product_name text;

notify pgrst, 'reload schema';
