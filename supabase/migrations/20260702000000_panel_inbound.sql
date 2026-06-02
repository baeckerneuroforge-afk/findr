-- Phase 4 — Baustein 3 (Panel-Anbieter), Etappe E1: Inbound-Attribution.
--
-- Externe Panel-Teilnehmer (heute Prolific) treten über den BESTEHENDEN offenen
-- Studien-Link ein (research_open_links / /interview/open/[token]). Die einzige
-- Datenmodell-Lücke ist die Teilnehmer-Attribution: die opake, pseudonyme
-- Anbieter-ID (?PROLIFIC_PID=…) muss auf der erzeugten Session landen, damit
-- (a) Gespräche dem Panel-Recruitment zugeordnet werden, (b) Dedup eine
-- Doppel-Teilnahme/-Kosten verhindert, (c) der Completion-Handshake (E2) weiß,
-- wohin zurückgeleitet wird.
--
-- ── EINE additive nullable Spalte, exakt im Muster der Open-Link-/Screening-
--    Migrationen ───────────────────────────────────────────────────────────────
-- Spiegelt interview_sessions.screening_answers (20260628000000) und
-- .open_link_id (20260629000000): jsonb, NULLABLE, KEIN Default, KEIN NOT NULL.
-- NULL für JEDE Nicht-Panel-Session (per-Invite, post_loss, checkin, direkter
-- Open-Link-Walk-in ohne PID) → die Spalte ist ein No-op, solange sie nicht
-- gesetzt wird; jeder bestehende INSERT übergibt sie nicht und verhält sich
-- byte-identisch. KEINE Änderung an Bestands-Spalten/CHECKs. Idempotent
-- (`if not exists`).
--
-- Inhalt (vom TS-Layer geschrieben, src/lib/research/panel.ts → PanelContext):
--   { "provider": "prolific",
--     "participant_id": "<opake PID>",      -- 24-Hex bei Prolific, validiert
--     "study_id": "<STUDY_ID|null>",
--     "session_id": "<SESSION_ID|null>",
--     "complete_url": "<Snapshot der Complete-Return-URL|null>" }
-- KEINE Panelisten-PII — nur die pseudonyme Anbieter-ID (DSGVO: der Anbieter
-- bleibt Controller der Identität, findr. fasst sie nie an; Plan §4.1).
--
-- Form bewusst WEICH wie screening_answers/topic_script: Validierung lebt im
-- TS-Layer (Zod/Regex), nicht in der DB — so bleibt das Schema frei für die
-- spätere Provider-Abstraktion (E3), ohne erneute Migration.
alter table interview_sessions
  add column if not exists panel_context jsonb;

-- ── Dedup-Garantie auf DB-Ebene: höchstens EINE Session je (offener Link ×
--    externer Teilnehmer-ID) ─────────────────────────────────────────────────
-- Der App-Layer dedupliziert sequenziell (screen-Route ④b: vor Screening/Cap/
-- Opus-Turn nach einer bestehenden Session suchen). Diese partial-unique-
-- Expression-Index schließt zusätzlich das TOCTOU-Fenster bei NEBENLÄUFIGEM
-- Erst-Eintritt derselben PID (Doppelklick / paralleler Retry): da jede Session
-- einen FRISCHEN access_token bekommt, kollidiert der access_token-UNIQUE NICHT —
-- erst dieser Index lässt den zweiten INSERT scheitern, woraufhin die Route auf
-- die Session des Gewinners zurückfällt (kein Doppel-Session, keine doppelte
-- Cap-Belastung). Spiegelt die access_token-UNIQUE-Race-Auflösung des
-- Invite-Lazy-Create-Pfads.
--
-- PARTIAL (where panel_context is not null): betrifft AUSSCHLIESSLICH Panel-
-- Zeilen. JEDE Nicht-Panel-Session (panel_context null) ist vom Index
-- ausgenommen → null Auswirkung auf den Bestand, byte-identisch. Expression über
-- panel_context->>'participant_id' — participant_id ist auf Panel-Zeilen per
-- Konstruktion immer gesetzt. Idempotent (`if not exists`).
create unique index if not exists interview_sessions_open_link_panel_pid_idx
  on interview_sessions (open_link_id, (panel_context ->> 'participant_id'))
  where open_link_id is not null and panel_context is not null;

notify pgrst, 'reload schema';
