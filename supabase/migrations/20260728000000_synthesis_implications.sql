-- Synthesis „Beratung"-Schicht (Runde 2) — die interpretativen Implikationen.
--
-- ADDITIV + opt-in, an den „Ausführlich"-Modus gekoppelt (wie executive_narrative):
-- die Implikationen werden von der eval-abgenommenen Beratungs-Stufe
-- (src/lib/synthesis/advisory.ts: generate → refine → deterministischer GATE)
-- erzeugt und hier persistiert. Bestehende Synthesen bleiben unberührt: default
-- '[]', befüllt nur, wenn der User bewusst „ausführlich" wählt.
--
-- Shape je Element: { "basis": "<verbatim Befund>", "hypothesis": "<Hypothese>" }.
-- Klar als „Beratung, nicht belegt" gekennzeichnet — nie als Fakt.

alter table study_synthesis
  add column if not exists implications jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
