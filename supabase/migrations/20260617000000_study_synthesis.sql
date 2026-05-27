-- Phase 3 — Study-Synthesis-Foundation, Migration 2 of 2.
--
-- Neue Tabelle study_synthesis: die Stage-2-Ausgabe (cross-call). EINE
-- Synthese pro Studie (UNIQUE org_id+plan_id), wird beim Neuberechnen
-- überschrieben (upsert), nicht historisiert. Wenn jemand Verlauf braucht,
-- normalisieren wir später in eine study_synthesis_versions-Tabelle — bis
-- dahin ist „die aktuelle Synthese ist die Wahrheit" das einfache Modell.
--
-- Read-Pfad: die Stage-1-Insights leben weiter in product_discovery_insights
-- mit plan_id (siehe 20260616). Die Synthese liest sie sich beim Berechnen,
-- emittiert emergent_themes + tensions + overview, und persistiert das hier.
-- Die UI liest dann NUR diese Tabelle, nicht die Roh-Insights.

create table if not exists study_synthesis (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references research_plans(id) on delete cascade,

  -- Stage-2-Output, JSONB. Empfohlene (NICHT erzwungene) Strukturen:
  --
  -- emergent_themes — Themen, die ÜBER mehrere Insights hinweg auftreten.
  -- Nicht die per-call Themes aus Stage 1 — das hier ist die Cross-Call-
  -- Verdichtung, die Stage 2 selbst formuliert.
  --   [{ "title":             "<short label>",
  --      "summary":           "<1-3 sentences>",
  --      "frequency":         <int — in how many insights this theme shows>,
  --      "source_insight_ids":["<uuid>", …],
  --      "quotes":            ["…verbatim quote…", …] }, …]
  emergent_themes jsonb not null default '[]'::jsonb,

  -- tensions — Wo sich Respondenten WIDERSPRECHEN. Die spannungsreichen
  -- Stellen, die Outset im "Tensions"-Block exponiert.
  --   [{ "description": "<1-2 sentences>",
  --      "side_a":      { "summary": "...", "source_insight_ids": [...], "quotes": [...] },
  --      "side_b":      { "summary": "...", "source_insight_ids": [...], "quotes": [...] } }, …]
  tensions jsonb not null default '[]'::jsonb,

  -- overview — der freitext-Header der Synthese, das was der Researcher
  -- als Erstes liest. 2-4 Sätze, vom Stage-2-LLM erzeugt.
  overview text,

  -- based_on_count — Anzahl Insights, die in diese Synthese eingegangen
  -- sind. Drives das "based on N interviews"-Label auf der Studien-
  -- Detailseite und ist die deterministische Grundlage für Re-Run-
  -- Entscheidungen ("hat sich die Sample-Größe verändert?").
  based_on_count int not null default 0,

  -- synthesized_at — wann Stage 2 zuletzt erfolgreich durchgelaufen ist.
  -- NULL bedeutet: die Zeile wurde angelegt (z.B. via UPSERT-Slot beim
  -- ersten Plan-Open) aber noch nie befüllt. Drives "outdated"-Hints in
  -- der UI ("synthesized at X, N new insights since").
  synthesized_at timestamptz,

  -- model — welches LLM die aktuelle Synthese geschrieben hat. NULL bis
  -- zur ersten erfolgreichen Berechnung. Erlaubt later-stage A/B-Vergleich
  -- ohne Migration.
  model text,

  created_at timestamptz not null default now(),

  -- EINE Synthese pro (org, plan). Re-Run = upsert auf diesem Constraint.
  unique (org_id, plan_id)
);

create index if not exists study_synthesis_org_idx
  on study_synthesis (org_id);

alter table study_synthesis enable row level security;

-- org_isolation: spiegelt das interview_sessions / research_plans-Pattern.
-- Zeilen mit org_id = NULL gibt es nicht (NOT NULL Constraint); die
-- externe-Research-Erweiterung würde org_id nullable machen und eine
-- zweite Policy ergänzen, wie schon bei research_plans dokumentiert.
drop policy if exists study_synthesis_org_isolation on study_synthesis;
create policy study_synthesis_org_isolation
  on study_synthesis
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
