-- ─────────────────────────────────────────────────────────────────────────────
-- Konsoul „im Kalender" — erweitert die action_type-Allowlist von
-- konsoul_action_log um die fünfte propose-confirm-Aktion 'schedule_activation'.
--
-- ENTWURF — NICHT ANWENDEN OHNE ANDRÉS MIGRATIONS-FREIGABE. Wird im Worktree
-- GESCHRIEBEN, aber bewusst NICHT per apply_migration angewandt. Additiv + inert:
-- das Mergen ändert NICHTS, bis André die Migration anwendet UND beide Flags
-- (NEXT_PUBLIC_KONSOUL_CALENDAR_ENABLED + NEXT_PUBLIC_KONSOUL_ACTIONS_ENABLED) setzt.
--
-- konsoul_action_log ist bereits LIVE (Migration 20260724000000 angewandt). Die
-- inline-CHECK-Constraint heißt automatisch konsoul_action_log_action_type_check.
-- Wir tauschen sie gegen die 5er-Allowlist. schedule_activation ist org-seitige
-- Terminierung (Confirm öffnet den Picker, /schedule schreibt nur ein Datum) —
-- NIE Versand/Aktivierung (/activate bleibt für Konsoul verboten, kein Enum-Wert).
-- Bis diese Migration angewandt ist, fällt ein logProposed('schedule_activation')
-- fail-open (CHECK-Verstoß → auditId:null), der Vorschlag selbst läuft trotzdem.

alter table konsoul_action_log
  drop constraint if exists konsoul_action_log_action_type_check;

alter table konsoul_action_log
  add constraint konsoul_action_log_action_type_check
  check (action_type in
    ('create_study_draft','run_synthesis','run_personas','run_guide',
     'schedule_activation'));

notify pgrst, 'reload schema';
