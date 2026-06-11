-- E1 Turn-Signale (Plan: ../findr-turn-signals/docs/findr-turn-signals-plan.md §4.1)
--
-- Zwei additive Bausteine, beide backfill-frei BY DECISION (Zweckbindung /
-- Consent-Erwartungshorizont — Bestands-Sessions liefen unter dem alten
-- Consent-Text; der Sidecar hängt ohnehin nur am Completion-Hook NEUER Sessions):
--
--   1. research_plans.signals_enabled — per-Studie-Opt-in, default OFF
--      (exakt das Muster von voice_enabled / tts_enabled / visual_capture_enabled).
--   2. interview_sessions.turn_signals — das Analyse-Ergebnis des nachgelagerten
--      Signal-Sidecars (ein Haiku-Call am Session-Ende), versioniertes JSONB:
--      { version, analyzedAt, model, turns[], session } — Form: TurnSignalsRecord
--      in src/lib/schemas/turn-signals.ts. NULL = nie analysiert (Toggle aus,
--      kein Consent-Stempel, Bestand) — der Forscher-UI-Code (E2) rendert dann
--      byte-identisch ohne Signal-Chips.
--
-- Rechtsanker (KI-VO Art. 3(39)): Der Klassifikator erhält AUSSCHLIESSLICH den
-- Wortlaut des Transkripts — keine Audio-Features, keine Timestamps, keine
-- Latenzmuster. Die Taxonomie ist geschlossen (6 Affekt-Zustände + 4
-- Direktheits-Stufen) und enthält bewusst KEINE Gesundheits-, Persönlichkeits-
-- oder Täuschungslabels (DSGVO Art. 9/15-Hygiene).

alter table research_plans
  add column if not exists signals_enabled boolean not null default false;

alter table interview_sessions
  add column if not exists turn_signals jsonb;

comment on column research_plans.signals_enabled is
  'E1: Per-Studie-Opt-in für Turn-Signale (Affekt/Direktheit aus dem Antwort-Wortlaut). Default OFF; kein Backfill alter Sessions.';
comment on column interview_sessions.turn_signals is
  'E1: Ergebnis des Signal-Sidecars (TurnSignalsRecord, versioniert). Null = nie analysiert. Nur Text-Input (KI-VO Art. 3(39)-Grenze), Taxonomie ohne Gesundheits-/Täuschungslabels.';

notify pgrst, 'reload schema';
