-- E7 Multi-Stimulus-Auswertung: additive, nullable Spalten auf study_synthesis.
-- stimulus_summary  = SERVER-berechnete Zahlen (Gesehen-Zähler je Stimulus,
--                     Voll-Reveal-Zahl, Präferenz-Stimmen) — einzige Quelle
--                     der UI-Kennzahlen (Hausprinzip: Zahlen nie aus LLM-Text).
-- stimulus_sections = geharte LLM-Sektionen je Stimulus (Mindest-N-Positionen,
--                     anker-geprüfte Quotes).
-- stimulus_comparison = LLM-Vergleichsprosa, nur mit Server-Präferenz-Zahlen.
-- Geschrieben ausschließlich vom best-effort Zweit-UPDATE in synthesizeStudy
-- (Muster methodology/signals_summary, 20260704000003) — pre-migration-safe.
alter table public.study_synthesis
  add column if not exists stimulus_summary jsonb,
  add column if not exists stimulus_sections jsonb,
  add column if not exists stimulus_comparison text;

notify pgrst, 'reload schema';
