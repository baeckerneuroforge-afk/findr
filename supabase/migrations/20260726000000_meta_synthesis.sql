-- Meta-Synthesis — cross-study "synthesis of syntheses".
--
-- Where study_synthesis (20260617000000) holds ONE aggregated synthesis per
-- study, meta_synthesis holds ONE comparative artifact over MANY studies'
-- finished syntheses. Unlike study_synthesis (UNIQUE org_id+plan_id, upserted),
-- a meta-synthesis is a FIRST-CLASS, HISTORISED artifact: the same study set can
-- be meta-synthesized again later (different focus, or after a study re-run), and
-- each run is its own row. So NO unique constraint — each POST inserts a new row
-- the user can list, re-open, re-export, and (E5) share.
--
-- Read/write path mirrors study_synthesis: JSONB result written by the engine
-- AFTER the per-study anchor filter (src/lib/meta-synthesis/engine.ts →
-- applyMetaSynthesisAnchorFilter), org-scoped RLS, service-role admin writes with
-- an explicit org_id filter. The result column is the validated MetaSynthesisResult
-- (overview / convergent_themes / divergences / study_contributions / interpretation).
--
-- ADDITIVE: touches no existing table. study_synthesis / research_plans are read
-- via the existing loadOrgSyntheses path; nothing here modifies them.

create table if not exists meta_synthesis (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  -- Human title for the artifact (auto-generated from the study set when the
  -- user doesn't name it). Shown in the list + as the artifact/export heading.
  title text not null,

  -- The studies compared — plan_id strings (the cross-study attribution handle,
  -- the same id every citation carries). JSONB array of strings, e.g.
  --   ["<plan_uuid>", "<plan_uuid>", …]
  -- NOT a FK array: a source study may later be deleted, and the artifact (a
  -- point-in-time read-out) must survive that — based_on below snapshots the
  -- labels so the view/export never depends on the study still existing.
  source_study_ids jsonb not null default '[]'::jsonb,

  -- Optional focus/emphasis the user gave (e.g. the Cross-Study chat question
  -- that triggered this). Steered the emphasis only; not evidence.
  focus text,

  -- The validated, anchor-filtered MetaSynthesisResult. Recommended shape:
  --   { "overview": "<german prose>",
  --     "convergent_themes": [ { "title", "summary", "study_frequency",
  --                              "citations": [ { "studyId", "quote" } ] } ],
  --     "divergences": [ { "description",
  --                        "positions": [ { "label", "studyIds": [...],
  --                                         "citations": [ { "studyId", "quote" } ] } ] } ],
  --     "study_contributions": [ { "studyId", "summary",
  --                                "citations": [ { "studyId", "quote" } ] } ],
  --     "interpretation": "<usually empty>" }
  result jsonb not null default '{}'::jsonb,

  -- Point-in-time snapshot of the studies used, so the view + PDF/PPTX export can
  -- label each cited studyId with its title / interview-count WITHOUT re-loading
  -- (and even after a source study is renamed or deleted). Shape:
  --   [ { "studyId", "studyTitle", "basedOnCount", "studyType" }, … ]
  based_on jsonb not null default '[]'::jsonb,

  -- Which LLM produced this artifact. Null only for legacy/partial rows.
  model text,

  created_at timestamptz not null default now()
);

create index if not exists meta_synthesis_org_idx
  on meta_synthesis (org_id, created_at desc);

alter table meta_synthesis enable row level security;

-- org_isolation: identical to study_synthesis / synthesis_shares. org_id is NOT
-- NULL, so a single all-actions policy scoped to current_org_id() suffices.
drop policy if exists meta_synthesis_org_isolation on meta_synthesis;
create policy meta_synthesis_org_isolation
  on meta_synthesis
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
