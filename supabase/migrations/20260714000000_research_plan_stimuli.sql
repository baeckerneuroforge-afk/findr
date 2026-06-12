-- Multi-Stimulus E1 (docs/findr-multi-stimulus-plan.md, D1) — Stimulus-SET
-- pro Studie: bis zu 5 Bilder/Videos/Links in fester Forscher-Reihenfolge,
-- die der Interview-Agent sequenziell einblendet (Reveal-Steuerung kommt in
-- E4/E6; diese Migration ist reines Datenfundament).
--
-- Additiv und backfill-frei nach dem Muster der 20260703000005er Single-
-- Stimulus-Migration: die Legacy-Spalten auf research_plans bleiben stehen
-- und gelten weiter — der Service liest DUAL (Zeilen hier gewinnen; keine
-- Zeilen → Legacy-Spalten als 1-Element-Set). Bestandspläne bleiben dadurch
-- byte-identisch, es gibt keinen Backfill und keinen Drop.
--
-- BEWUSST KEIN unique(plan_id, position): Reorder läuft über PostgREST in
-- mehreren Einzel-UPDATEs (keine Transaktion über Statements hinweg) — ein
-- unique-Constraint würde jede Positions-Vertauschung zwangsweise in ein
-- fehleranfälliges Zwei-Phasen-Renumbering zwingen. Stattdessen ist die
-- LESE-Ordnung deterministisch: order by (position, created_at, id).
-- Transient doppelte Positionen (Crash mitten im Reorder) bleiben dadurch
-- harmlos und werden vom nächsten Reorder repariert.
--
-- stimulus_type bleibt freier Text (kein CHECK) — gleiche Begründung wie auf
-- research_plans: neue Asset-Typen ohne DB-Migration.

create table if not exists research_plan_stimuli (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references research_plans(id) on delete cascade,
  -- NULLABLE wie research_plans.org_id (externe/mandantenlose Pläne tragen
  -- NULL; die org_isolation-Policy lässt solche Zeilen implizit fallen —
  -- exakt das research_plans-Verhalten).
  org_id uuid references organizations(id) on delete cascade,
  -- 1-basierte Forscher-Reihenfolge = Regie-Reihenfolge im Interview (O5:
  -- v1 zeigt strikt in dieser Reihenfolge).
  position int not null,
  stimulus_type text not null,
  url text not null,
  -- Bucket-Pfad für Bild/Video (Lösch-Aufräumen + Namespace-Checks);
  -- NULL für Link-Stimuli.
  storage_path text,
  -- Kurz-Label ("Variante A") — erscheint im Agent-Prompt und in der
  -- Auswertung. Längen-Cap im TS-Layer (Zod, E2).
  label text,
  -- Forscher-Beschreibung, Pendant zu research_plans.stimulus_description.
  description text,
  -- Vision-Analyse pro Asset — gleiches Envelope + Status-Vokabular
  -- ('pending' | 'done' | 'failed') wie die Plan-Spalten (stimulus-analysis.ts).
  analysis jsonb,
  analysis_status text,
  created_at timestamptz not null default now()
);

create index if not exists research_plan_stimuli_plan_position_idx
  on research_plan_stimuli(plan_id, position, created_at);

alter table research_plan_stimuli enable row level security;

-- org_isolation: Spiegel der research_plans-Policy. App-Pfade laufen über den
-- service-role-Client (RLS bypassed, org-scoped per .eq im Service) — die
-- Policy ist Defense-in-depth für jeden anon/authenticated-Zugriff.
drop policy if exists research_plan_stimuli_org_isolation on research_plan_stimuli;
create policy research_plan_stimuli_org_isolation
  on research_plan_stimuli
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
