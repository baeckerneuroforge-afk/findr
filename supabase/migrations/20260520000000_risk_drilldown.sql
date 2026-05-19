-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 — Risk-Signal Drilldown
--
-- Recreates the `risk_scores` table with the Sprint 4 schema:
-- structured signal breakdown, per-signal confidence + quotes,
-- overall_reasoning + recommendations from the Claude classifier.
--
-- The original `risk_scores` table from the initial schema was never
-- populated (analysis was live-only), and `risk_signal_sources` from
-- Sprint 3 was never written to. Safe to recreate.
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists risk_signal_sources cascade;
drop table if exists risk_scores cascade;

create table risk_scores (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  deal_id            text not null,
  risk_score         int  not null check (risk_score between 0 and 100),
  risk_level         text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  overall_reasoning  text not null,
  recommendations    text[] default '{}',
  signals            jsonb not null,
  analyzed_at        timestamptz default now(),
  created_at         timestamptz default now()
);

create index risk_scores_deal_id_idx     on risk_scores (deal_id);
create index risk_scores_analyzed_at_idx on risk_scores (analyzed_at desc);

notify pgrst, 'reload schema';
