-- Visual Intelligence E1 / Block 1 — Stage-1 visual capture metadata.
--
-- Additive only:
--   capture_source text  — nullable provenance marker, intentionally no CHECK
--                          yet (same posture as transcript_source).
--   visual_capture jsonb — nullable payload with sampled-frame observation
--                          text ("## Visuelle Beobachtungen") plus metadata.
--
-- No existing columns, RLS policies, FKs, or constraints are changed.

alter table interview_sessions
  add column if not exists capture_source text;

alter table interview_sessions
  add column if not exists visual_capture jsonb;

notify pgrst, 'reload schema';
