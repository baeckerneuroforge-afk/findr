-- Phase 3 proactive + scheduling merge: close the access_token gap on
-- research_invites.
--
-- Background: the proactive branch built the research_invites table without
-- an access_token column (the original assumption: a token is generated
-- when an interview SESSION starts). The scheduling branch builds against
-- the opposite assumption: the access_token is created when the INVITE is
-- created, so the participant link can be put into the invitation mail
-- BEFORE the session exists. The scheduling assumption is the correct one
-- — without an early token, sendResearchInvite has nothing to put in the
-- ICS calendar URL.
--
-- Resolution: add access_token + invited_at as additive columns. The
-- create-side (createResearchInterview) is updated in the same merge to
-- generate the token at invite-create time and to mirror it into the
-- interview_sessions row when the session lazy-starts (or eagerly starts,
-- depending on the path).
--
-- Idempotent — `add column if not exists` so the file can be re-applied
-- without effect. NULL on existing rows is fine: the cron + invite-orch
-- both treat NULL access_token as "invite not yet sendable" and the
-- existing two reminder columns (20260614000000_research_invite_reminders.sql)
-- already use the same "NULL means not yet" semantics.
--
-- The access_token column gets a uniqueness index because it is the
-- capability credential for /interview/[token]; duplicate tokens across
-- invites would be a (theoretical) security regression and the index is
-- cheap. WHERE access_token IS NOT NULL keeps the index sparse — invites
-- without a token simply don't contribute to it.

alter table research_invites
  add column if not exists access_token text;

alter table research_invites
  add column if not exists invited_at timestamptz;

create unique index if not exists research_invites_access_token_idx
  on research_invites (access_token)
  where access_token is not null;

notify pgrst, 'reload schema';
