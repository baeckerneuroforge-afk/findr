/**
 * Konsoul P3.0 — ACTION-LOG retention period (Design-Doc §3 / §5, Review-Auflage
 * 3: DSGVO-Speicherbegrenzung).
 *
 * Der bestehende Retention-Cron kappt NUR `interview_sessions` (Teilnehmer-PII).
 * `konsoul_action_log` trägt org-/portfolio-seitige METADATEN — KEINE Teilnehmer-
 * PII — fällt also NICHT unter `interview_retention_days`. Ohne eigene Kappung
 * würde die Tabelle unbefristet wachsen → Verstoß gegen die Speicherbegrenzung.
 *
 * Darum eine EIGENE, GLOBALE Default-Frist als Code-Konstante (getrennte Uhr,
 * Muster wie `interview_retention_days` vs. `event_retention_days`). Der Cron
 * löscht Zeilen, deren `proposed_at` älter als diese Frist ist.
 *
 * 365 Tage ist eine bewusst konservative Default-Wahl (ein voller Jahres-
 * Audit-Horizont). FINAL ist das eine Policy-/Anwalts-Entscheidung (André) — die
 * Konstante ist der eine Ort, an dem sie geändert wird.
 */
export const KONSOUL_ACTION_LOG_RETENTION_DAYS = 365;
