-- Synthesis "Ausführlich"-Stufe — optionaler Detailgrad + Executive-Narrative.
--
-- ADDITIV + opt-in: die Kern-Synthese (emit_study_synthesis) bleibt unberührt.
-- Die ausführliche Erzählung wird von einer SEPARATEN Stufe
-- (src/lib/synthesis/narrative.ts) erzeugt und hier persistiert — genau wie E4/E7
-- ihre Zusatzfelder als best-effort Zweit-UPDATE schreiben. Bestehende Synthesen
-- bleiben byte-identisch: detail_level defaultet auf 'standard', executive_narrative
-- bleibt NULL, bis der User bewusst „ausführlich" wählt.

alter table study_synthesis
  add column if not exists detail_level text not null default 'standard',
  add column if not exists executive_narrative text;

notify pgrst, 'reload schema';
