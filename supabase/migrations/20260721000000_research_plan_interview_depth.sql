-- ─────────────────────────────────────────────────────────────────────────────
-- Per-study interview DEPTH — laddering layers PER TOPIC (the real depth lever).
--
-- The previous knob, max_rounds, was a flat agent-question UPPER BOUND. It
-- collapsed as a "depth" control: a hard-wired per-topic saturation rule ("at
-- most one follow-up, never a third") capped every topic at ~2 questions, so the
-- ceiling (6 vs 10) was almost never reached — "Standard" and "Tief" produced
-- nearly identical interviews. interview_depth instead drives how many laddering
-- LAYERS the agent goes per topic before a topic counts as exhausted; the total
-- length follows from that (layers × topics). It stays adaptive: deeper layers
-- are only asked when there is substance — an absence signal still closes early.
--
-- Mapping (src/lib/research/interview-duration.ts DEPTH_LAYERS):
--   · 'flach'  → 1 layer  per topic
--   · 'mittel' → 2 layers per topic  (≈ today's per-topic behavior; the default)
--   · 'tief'   → 4 layers per topic
--
-- The effective agent-question ceiling (what flows into the existing max_rounds
-- pipeline: formatRoundCeiling, researchTotalCap, progress, duration) is DERIVED
-- per study from depth × topics at the snapshot/form boundary
-- (resolveEffectiveMaxRounds), hard-capped at 15. An explicit max_rounds (the
-- "Erweitert" expert field) still wins over depth.
--
-- NULL = legacy studies created before this feature: the resolver falls back to
-- the flat default ceiling (6), i.e. today's behavior, BYTE-IDENTICAL. Nullable
-- + no backfill keeps every existing row unchanged until it is re-saved. Before
-- this migration lands select("*") omits the column; the read mapper
-- (plans-service coerceDepth) maps undefined/null → null → legacy behavior, so
-- the code path is byte-identical even pre-migration.
--
-- Stimulus-SET studies are UNAFFECTED: planToAgentContext omits both max_rounds
-- and interview_depth from their deal_context snapshot, so the engine keeps
-- their content-driven stimulusSetCeiling(n) pacing intact.
-- ─────────────────────────────────────────────────────────────────────────────

alter table research_plans
  add column if not exists interview_depth text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'research_plans_interview_depth_check'
  ) then
    alter table research_plans
      add constraint research_plans_interview_depth_check
        check (
          interview_depth is null
          or interview_depth in ('flach', 'mittel', 'tief')
        );
  end if;
end $$;

notify pgrst, 'reload schema';
