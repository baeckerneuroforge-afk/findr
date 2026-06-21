-- Persona-Feature (Spec docs/klymeo-personas-feature-spec-2026-06-21.md):
-- additive, nullable Spalten auf study_synthesis. Geschrieben AUSSCHLIESSLICH
-- von der Persona-Stufe (src/lib/synthesis/audience-personas.ts) via additivem
-- Upsert auf (org_id, plan_id) — die Synthese-Spalten werden nie berührt.
-- personas              = angereicherte Persona-Liste (EnrichedAudiencePersona[]):
--                         LLM-Cluster PLUS SERVER-Felder (shareCount-Override,
--                         sharePercent, roleLabel/segmentLabel, sentiment-Verteilung).
-- personas_summary      = SERVER-Kennzahlen (totalInsights/assigned/unassigned/
--                         qualityHint) — Quelle der UI-Coverage (Hausprinzip:
--                         Zahlen nie aus LLM-Text).
-- personas_generated_at = Zeitstempel des letzten Persona-Laufs.
-- RLS: die bestehende org_isolation-Policy von study_synthesis deckt alle
-- Spalten ab — keine neue Policy nötig.
alter table public.study_synthesis
  add column if not exists personas jsonb,
  add column if not exists personas_summary jsonb,
  add column if not exists personas_generated_at timestamptz;

notify pgrst, 'reload schema';
