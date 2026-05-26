-- CS Health v2 — replace the legacy 3-level inversion (health = 100 - risk)
-- with the dedicated health classifier in src/lib/health/.
--
-- The new classifier emits 5 levels: thriving / healthy / lukewarm / at_risk /
-- critical. The old CHECK only admits 3 (healthy / at_risk / critical), so any
-- insert with "thriving" or "lukewarm" would fail at write time. We widen the
-- CHECK to the new 5-value set.
--
-- The other columns absorb the new shape WITHOUT schema changes:
--   * signals (jsonb)            — acute-signal objects are mapped to the
--                                  legacy RiskSignal shape in code so existing
--                                  dashboard + save-play readers keep working.
--                                  Native `severity` is preserved as a
--                                  jsonb-sidecar field.
--   * overall_reasoning (text)   — now stores the classifier's `summary`.
--   * recommendations (text[])   — empty for new rows; the save-play layer
--                                  generates retention actions in its own
--                                  flow.
--   * analysis_method (text)     — always 'ai' for new rows since the health
--                                  classifier has no heuristic fallback.
--
-- The CHECK on analysis_method ('ai' | 'heuristic') is unchanged — old rows
-- written under the legacy flow may still have 'heuristic' and stay valid.

alter table account_health_scores
  drop constraint if exists account_health_scores_health_level_check;

alter table account_health_scores
  add constraint account_health_scores_health_level_check
  check (health_level in ('thriving', 'healthy', 'lukewarm', 'at_risk', 'critical'));

notify pgrst, 'reload schema';
