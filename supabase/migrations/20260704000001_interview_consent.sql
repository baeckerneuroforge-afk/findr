-- E0 Recht & Offenlegung — DSGVO-Art.-7(1)-Nachweis der Teilnehmer-Einwilligung.
--
-- Vor dieser Migration war der Consent ein reines UI-Gate (Open-Link-Pfad) bzw.
-- gar nicht vorhanden (Invite-Pfad): nirgends persistiert, also nicht nachweisbar.
-- Beide Spalten sind ADDITIV + NULLABLE:
--   * Bestands-Sessions bleiben byte-identisch (null = Session vor Einführung
--     des Gates; KEIN Backfill — alte Sessions liefen unter dem alten Text).
--   * Der Code liest defensiv (select("*") + Soft-Default undefined→null) und
--     schreibt best-effort — er funktioniert auch VOR Anwendung dieser Migration.
--
-- Schreibpfad (einziger): markSessionConsentByToken (session-service.ts) —
-- server-gestempelt, idempotent (WHERE consent_accepted_at IS NULL), niemals
-- client-gelieferte Zeit. Aufrufer: POST /api/interview/[token]/consent
-- (Invite-Session-Gate) sowie die beiden screen-Routen bei Session-Creation
-- (Open-Link- und needs_screening-Pfad, consentAccepted-Flag des Gates).

alter table interview_sessions
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_version text;

comment on column interview_sessions.consent_accepted_at is
  'E0: Zeitpunkt der Teilnehmer-Einwilligung (Consent-Gate). Server-gestempelt, einmalig (nie überschrieben). Null = Bestands-Session vor Gate-Einführung oder Einwilligung (noch) nicht erteilt.';
comment on column interview_sessions.consent_version is
  'E0: Version der Consent-/Offenlegungstexte zum Einwilligungszeitpunkt (CONSENT_TEXT_VERSION, referenziert den git-historisierten i18n-Stand).';
