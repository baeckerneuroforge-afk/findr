-- ─────────────────────────────────────────────────────────────────────────────
-- Security fix — enable RLS on call_speakers + transcript_segments
--
-- Sprint 3 (20260519000000_calls_pipeline.sql) created these two tables WITHOUT
-- a `create policy` and WITHOUT an org_id column, even though every other tenant
-- table ships an `org_id = current_org_id()` policy. This migration adds the
-- missing org-scoped policy so authenticated reads are correctly tenant-scoped
-- via the parent call instead of silently empty.
--
-- On the live Prod DB the picture was milder than the file lineage suggests:
-- its baseline already had RLS ENABLED on both tables (just with NO policy =
-- default-deny), so anon/authenticated already saw nothing — there was no live
-- leak. But a fresh environment built purely from these migration files would
-- have RLS OFF here (no file ever enabled it), and a
-- `GET /rest/v1/transcript_segments?select=*` over the anon key WOULD return
-- every org's transcript + speaker PII. So `enable row level security` below is
-- idempotent (a no-op where already on) and closes that gap for fresh/local DBs
-- while normalizing the policy everywhere. The app reads via the service-role
-- client (bypasses RLS), so behaviour is unchanged either way.
--
-- Neither table has org_id; both reference calls(id), which carries org_id and
-- is already RLS-protected. The policy therefore scopes via an EXISTS join to
-- the parent call, reusing the same current_org_id() helper as every other
-- policy. (risk_signal_sources, the third table from that sprint, was dropped in
-- 20260520000000_risk_drilldown.sql and is intentionally excluded.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── call_speakers ───────────────────────────────────────────────────────────
alter table call_speakers enable row level security;

drop policy if exists call_speakers_org_isolation on call_speakers;
create policy call_speakers_org_isolation
  on call_speakers
  for all
  to authenticated
  using (
    exists (
      select 1
      from calls c
      where c.id = call_speakers.call_id
        and c.org_id = current_org_id()
    )
  )
  with check (
    exists (
      select 1
      from calls c
      where c.id = call_speakers.call_id
        and c.org_id = current_org_id()
    )
  );

-- ─── transcript_segments ─────────────────────────────────────────────────────
alter table transcript_segments enable row level security;

drop policy if exists transcript_segments_org_isolation on transcript_segments;
create policy transcript_segments_org_isolation
  on transcript_segments
  for all
  to authenticated
  using (
    exists (
      select 1
      from calls c
      where c.id = transcript_segments.call_id
        and c.org_id = current_org_id()
    )
  )
  with check (
    exists (
      select 1
      from calls c
      where c.id = transcript_segments.call_id
        and c.org_id = current_org_id()
    )
  );

notify pgrst, 'reload schema';
