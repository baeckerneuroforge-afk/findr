-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 3 — Call Recording Pipeline
--
-- Extends the existing `calls` table with transcript metadata and adds
-- three new tables for speaker identification, segment-level transcripts,
-- and risk-signal traceability back to source quotes.
--
-- Single-tenant for mock demo data; org-scoped RLS on existing `calls`
-- is preserved via the inherited org_id column.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extend calls ────────────────────────────────────────────────────────────
alter table calls add column if not exists transcript_summary text;
alter table calls add column if not exists call_type text default 'discovery';
alter table calls add column if not exists analyzed_at timestamptz;
-- Note: `transcript`, `duration_seconds`, `recorded_at`, `source` already exist
-- on calls from the initial schema. `source` keeps its existing column.


-- ─── New tables ──────────────────────────────────────────────────────────────
create table if not exists call_speakers (
  id                  uuid primary key default gen_random_uuid(),
  call_id             uuid not null references calls(id) on delete cascade,
  name                text not null,
  role                text not null,
  organization        text,
  speaker_type        text not null check (
    speaker_type in ('sales_rep', 'buyer', 'buyer_team', 'champion')
  ),
  talk_time_seconds   int default 0,
  created_at          timestamptz default now()
);

create table if not exists transcript_segments (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null references calls(id) on delete cascade,
  speaker_id      uuid not null references call_speakers(id) on delete cascade,
  start_seconds   int not null,
  end_seconds     int not null,
  text            text not null,
  signals         text[] default '{}',
  created_at      timestamptz default now()
);

create table if not exists risk_signal_sources (
  id              uuid primary key default gen_random_uuid(),
  risk_score_id   uuid not null references risk_scores(id) on delete cascade,
  call_id         uuid not null references calls(id) on delete cascade,
  segment_id      uuid not null references transcript_segments(id) on delete cascade,
  signal_type     text not null,
  confidence      numeric(3,2) not null,
  reasoning       text,
  created_at      timestamptz default now()
);


-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists call_speakers_call_id_idx
  on call_speakers (call_id);

create index if not exists transcript_segments_call_id_idx
  on transcript_segments (call_id);

create index if not exists transcript_segments_speaker_id_idx
  on transcript_segments (speaker_id);

create index if not exists risk_signal_sources_risk_score_idx
  on risk_signal_sources (risk_score_id);
