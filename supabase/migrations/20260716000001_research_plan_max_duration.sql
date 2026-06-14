-- ─────────────────────────────────────────────────────────────────────────────
-- Per-study interview TIME LIMIT (seconds).
--
-- Companion to max_rounds (Paket 1). Voice interviews enforce it HARD (the
-- LiveKit agent says a closing line and disconnects on a timer); text +
-- push-to-talk enforce it SOFTLY (a visible countdown; the session closes on
-- the next answer once the limit has passed — an idle, untouched text session
-- stays open, since there is no live server process to end it).
--
-- NULL = no time limit (today's behavior). Nullable + no backfill keeps every
-- existing and future study byte-identical until an owner sets a value; the
-- read mapper (plans-service coerceNullableInt) maps undefined/null → null.
--
-- The CHECK mirrors the route's Zod bound (180..3600 = 3..60 minutes).
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists max_duration_seconds int;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'research_plans_max_duration_seconds_check'
  ) then
    alter table research_plans
      add constraint research_plans_max_duration_seconds_check
        check (
          max_duration_seconds is null
          or (max_duration_seconds >= 180 and max_duration_seconds <= 3600)
        );
  end if;
end $$;

notify pgrst, 'reload schema';
