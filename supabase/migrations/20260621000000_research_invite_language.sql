-- i18n Etappe 1 (Pilot: Teilnehmer-Interview-Flow) — explizite Sprache pro
-- Research-Invite.
--
-- Hintergrund: Die Research-Invite-Mail (+ 24h-/1h-Reminder + ICS) wird
-- gebaut, BEVOR eine interview_sessions-Zeile existiert — sendResearchInvite
-- lädt nur den research_invites-Datensatz (contact_label, contact_email,
-- scheduled_at, access_token). interview_sessions.language
-- (20260530000000_interview_session_language.sql) steuert die Sprache der
-- LAUFENDEN Konversation, steht aber zum Mail-Zeitpunkt noch nicht zur
-- Verfügung. Diese Spalte trägt die Sprachentscheidung am Invite, sodass die
-- Mail-Builder ihre Copy in der richtigen Sprache rendern und denselben Wert
-- später an die Session weiterreichen können (eine Sprache → Mail + Session
-- + LLM + Chrome).
--
-- DEFAULT 'de': spiegelt die bestehende Default-Annahme im Code
-- (research-orchestration.ts erstellt Sessions mit `language ?? 'de'`; die
-- Mail-Builder in research-invite.ts sind heute durchgehend deutsch).
-- Bestandszeilen bleiben damit byte-identisch zum heutigen Verhalten.
--
-- Additiv & idempotent: `add column if not exists`, keine bestehende Spalte
-- wird angefasst. RLS bleibt unverändert — die Spalte erbt die
-- research_invites_org_isolation-Policy (20260611000000_research_layer.sql);
-- eine spaltenbezogene Policy gibt es bei Postgres-RLS ohnehin nicht. CHECK
-- begrenzt auf das unterstützte Sprachpaar, exakt analog zu
-- interview_sessions.language.

alter table research_invites
  add column if not exists language text not null default 'de'
    check (language in ('de', 'en'));

notify pgrst, 'reload schema';
