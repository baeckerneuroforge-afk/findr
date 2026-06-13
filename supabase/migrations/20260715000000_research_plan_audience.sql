-- ─────────────────────────────────────────────────────────────────────────────
-- B2C/B2B — per-study audience type.
--
-- Drives the interview Anrede (B2C → "du", B2B → "Sie") and the AI guide-
-- generator's example framing. NOT NULL DEFAULT 'b2b' keeps every existing plan
-- byte-identical (formal "Sie"), so legacy and Product-Discovery studies stay
-- exactly as they were until a study explicitly opts into B2C. The CHECK limits
-- it to the two supported values.
--
-- Read mapper (plans-service coerceAudience) defaults undefined→'b2b', so the
-- code path is byte-identical even before this migration lands.
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists audience_type text not null default 'b2b';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'research_plans_audience_type_check'
  ) then
    alter table research_plans
      add constraint research_plans_audience_type_check
        check (audience_type in ('b2b', 'b2c'));
  end if;
end $$;

notify pgrst, 'reload schema';
