-- Honest risk fallback: mark each risk_scores row as AI or heuristic.
-- The risk path falls back to deterministic rule-based detectors when the LLM is
-- unavailable (missing key or call failure); the scheduled re-analysis cron is
-- heuristic by design. Until now those were indistinguishable from a real Claude
-- analysis. Mirrors loss_reasons.extraction_method.
--
-- Existing rows are backfilled to 'ai' (the common case for the manual Analyze
-- path); the UI only flags rows explicitly marked 'heuristic'.

alter table risk_scores
  add column if not exists analysis_method text not null default 'ai'
  check (analysis_method in ('ai', 'heuristic'));

comment on column risk_scores.analysis_method is
  'How this score was produced: ai = Claude (Opus) classifier, heuristic = rule-based fallback/cron.';

notify pgrst, 'reload schema';
