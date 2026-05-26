-- Phase 3 proactive — kind-CHECK auf interview_sessions erweitern.
--
-- Der ursprüngliche kind-CHECK aus 20260606000000_checkin_agent.sql lässt
-- nur ('post_loss', 'checkin') zu. In Phase 1 der expand-contract
-- (20260612000000_interview_sessions_flow_mode.sql) ist kind WEITERHIN
-- authoritativ — Code-Schreibpfade setzen kind beim Insert. Damit eine
-- research-Session überhaupt inserted werden kann, muss der CHECK
-- 'research' kennen. Das ist sub-step 1b des expand-contract:
--
--   Phase 1   (20260612*): ADD COLUMN flow + Backfill flow := kind
--   Phase 1b  (DIESE):     CHECK auf kind um 'research' erweitern
--   Phase 2   (später):    Code schreibt flow + kind parallel; Reader auf flow
--   Phase 3   (später):    DROP COLUMN kind
--
-- Reiner constraint-Swap. Kein Datentransfer, keine Default-Änderung
-- (default 'post_loss' bleibt — neue Research-Inserts setzen kind = 'research'
-- explizit).

alter table interview_sessions
  drop constraint if exists interview_sessions_kind_check;

alter table interview_sessions
  add constraint interview_sessions_kind_check
    check (kind in ('post_loss', 'checkin', 'research'));

notify pgrst, 'reload schema';
