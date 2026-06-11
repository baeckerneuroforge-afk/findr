-- E4 Synthese-Integration (Plan: ../findr-turn-signals/docs/findr-turn-signals-plan.md §4.7)
--
-- Zwei additive, nullable JSONB-Spalten auf study_synthesis:
--
--   1. methodology — der LLM-verfasste Abschnitt „Methodik: Warum wurde was
--      gefragt?": die echten WHY-Begründungen (E3) thematisch aggregiert,
--      plus ehrliche Coverage-Note (Sessions ohne Rationale: Bestand,
--      Voice-v1). Form: MethodologySchema (schemas/synthesis.ts). NULL =
--      Synthese ohne Rationale-Input (oder vor dieser Migration).
--
--   2. signals_summary — SERVER-berechnete, deterministische Signal-Zahlen
--      (Turn-Signale E1): Sessions mit Signalen, Antwort-Zählungen je
--      Direktheits-Stufe, Affekt-Zählungen. NIE vom LLM — das LLM bekommt
--      diese Zahlen als Fakten und darf nur daraus formulieren
--      (signal_observations im Ergebnis-JSONB der bestehenden Spalten).
--      Form: SignalsSummary v1 (lib/synthesis/signals.ts). NULL = unter
--      Mindest-N (3 Sessions mit Signalen) oder Toggle aus.
--
-- Code-Verhalten VOR Anwendung: der Kern-Upsert (overview/themes/tensions)
-- bleibt unverändert funktional; die neuen Felder schreibt ein best-effort
-- Zweit-UPDATE (geloggt, nie pfad-blockierend) — Muster consent-Stempel E0.

alter table study_synthesis
  add column if not exists methodology jsonb,
  add column if not exists signals_summary jsonb,
  add column if not exists signal_observations jsonb;

comment on column study_synthesis.methodology is
  'E4: „Warum wurde was gefragt?" — WHY-Rationales (E3) thematisch aggregiert + Coverage-Note. Null = ohne Rationale-Input synthetisiert.';
comment on column study_synthesis.signals_summary is
  'E4: deterministische Turn-Signal-Aggregation (server-berechnet, SignalsSummary v1). Null = unter Mindest-N oder Signale aus.';
comment on column study_synthesis.signal_observations is
  'E4: max. 3 LLM-formulierte Signal-Beobachtungen, ausschließlich aus signals_summary-Fakten (Hinweis-Sprache). Leeres Array/Null ohne Signal-Input.';

notify pgrst, 'reload schema';
