-- ─────────────────────────────────────────────────────────────────────────────
-- F2 — per-study interview language.
--
-- A study is conducted in ONE language; all its invites, open-links and
-- sessions inherit it. NOT NULL DEFAULT 'de' keeps every existing plan
-- byte-identical (German). The CHECK limits it to the two supported locales.
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists language text not null default 'de';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'research_plans_language_check'
  ) then
    alter table research_plans
      add constraint research_plans_language_check check (language in ('de', 'en'));
  end if;
end $$;
