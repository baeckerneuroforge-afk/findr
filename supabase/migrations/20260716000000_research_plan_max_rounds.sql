-- ─────────────────────────────────────────────────────────────────────────────
-- Per-study interview length — configurable agent-question UPPER BOUND.
--
-- max_rounds is the ceiling on AGENT QUESTIONS for a study's interviews. It is
-- an UPPER bound only: the saturation engine may still close earlier when the
-- plan's topics are exhausted — the interview stays adaptive (product core).
--
-- NULL = system default, i.e. today's behavior:
--   · non-stimulus research / post_loss / checkin → 6 agent questions
--   · stimulus-SET studies → the content-driven stimulusSetCeiling(n) (5/9/12/
--     14); these are deliberately UNAFFECTED by max_rounds (planToAgentContext
--     omits the column from their deal_context snapshot, so the engine reads
--     null → default), keeping their finely tuned multi-stimulus pacing intact.
--
-- Nullable + no backfill keeps every existing and future plan byte-identical
-- until a study owner sets a value: the read mapper (plans-service
-- coerceNullableInt) maps undefined/null → null → default behavior, so the code
-- path is byte-identical even before this migration lands.
--
-- The CHECK mirrors the route's Zod bound (2..15). The hard safety-net total
-- turn cap is DERIVED from this (session-service researchTotalCap = 2·n + 4, so
-- the default 6 → 16, exactly today's MAX_RESEARCH_TOTAL_TURNS).
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists max_rounds int;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'research_plans_max_rounds_check'
  ) then
    alter table research_plans
      add constraint research_plans_max_rounds_check
        check (max_rounds is null or (max_rounds >= 2 and max_rounds <= 15));
  end if;
end $$;

notify pgrst, 'reload schema';
