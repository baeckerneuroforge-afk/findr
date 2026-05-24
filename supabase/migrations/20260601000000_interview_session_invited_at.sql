-- Sprint: deal → interview, part 3 (email invite via Resend).
--
-- Track when an invitation email was sent for a session, so the deal page can
-- show "invited" (with the timestamp) instead of re-offering the send button.
-- Sending itself runs server-side through the invite route; this column is just
-- the record of it.

alter table interview_sessions
  add column if not exists invited_at timestamptz;

notify pgrst, 'reload schema';
