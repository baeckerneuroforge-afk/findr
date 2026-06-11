-- ─────────────────────────────────────────────────────────────────────────────
-- Security fix — enable RLS on call_speakers + transcript_segments
--
-- Sprint 3 (20260519000000_calls_pipeline.sql) created these two tables WITHOUT
-- enabling row level security and WITHOUT an org_id column. The header there
-- claimed org-scoping "is preserved via the inherited org_id column" — but no
-- such column exists. Every other tenant table enables RLS with an
-- `org_id = current_org_id()` policy; these two were the only live tables left
-- without one, so a request to the public PostgREST/anon surface
-- (`GET /rest/v1/transcript_segments?select=*`) would return every org's
-- transcript text + speaker PII.
--
-- The app reads these tables exclusively via the service-role client, which
-- bypasses RLS — so enabling RLS does NOT change application behaviour. It only
-- closes the anon/authenticated edge.
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
