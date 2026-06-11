-- ─────────────────────────────────────────────────────────────────────────────
-- DSGVO G5 — per-org configurable retention for participant interview data.
--
-- interview_retention_days: NULL = OFF (default, no auto-deletion). A positive
-- value N means the daily retention cron (/api/cron/retention) deletes
-- interview_sessions older than N days for that org. Scope is intentionally
-- interview_sessions ONLY (the participant PII/transcript core); Sales/Risk is
-- no longer an offered module.
-- ─────────────────────────────────────────────────────────────────────────────

alter table org_settings
  add column if not exists interview_retention_days integer;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'org_settings_retention_positive'
  ) then
    alter table org_settings
      add constraint org_settings_retention_positive
      check (interview_retention_days is null or interview_retention_days >= 1);
  end if;
end $$;
