-- Phase 4 — Baustein 3 (Panel-Anbieter), Etappe E2: Completion-Handshake-Konfig.
--
-- Am Interview-Ende muss findr. den Panel-Teilnehmer outcome-verzweigt zurück
-- zum Anbieter leiten (Plan §2.2 Lücke B/C, §6 E2):
--   completed          → Complete-Return-URL
--   screening-rejected → Screenout-Return-URL  (evaluateScreening → rejected)
--   cap-full           → QuotaFull-Return-URL   (isOpenLinkAtCapacity)
-- Bei Prolific ist die Complete-URL die „Redirect URL" aus dem Study-Setup +
-- der Completion-Code als Parameter (z. B.
-- https://app.prolific.com/submissions/complete?cc=<CODE>). Das Template kann
-- den Code damit aufnehmen; ein optionaler {PID}-Platzhalter wird vom TS-Layer
-- (src/lib/research/panel.ts → buildPanelRedirectUrl) durch die Teilnehmer-ID
-- ersetzt (für Anbieter, die die ID zurückspiegeln).
--
-- ── EINE additive nullable Spalte am bestehenden Link-Record ──────────────────
-- Genau im Muster, wie research_open_links selbst additive Felder einführt
-- (max_sessions/valid_until, 20260629000000): NULLABLE, KEIN Default, KEIN
-- NOT NULL. NULL = kein Panel-Completion konfiguriert ⇒ die Redirect-Logik ist
-- ein No-op (der Teilnehmer sieht den bestehenden Dank-/Abschluss-Screen, KEIN
-- Redirect). KEINE Änderung an Bestands-Spalten/CHECKs/RLS. Idempotent
-- (`if not exists`).
--
-- Inhalt (vom TS-Layer gelesen, src/lib/research/panel.ts → PanelCompletion):
--   { "complete_url":  "https://app.prolific.com/submissions/complete?cc=<CODE>",
--     "screenout_url": "https://app.prolific.com/submissions/complete?cc=<SCREENOUT_CODE>",
--     "quotafull_url": "https://app.prolific.com/submissions/complete?cc=<QUOTAFULL_CODE>" }
-- Jedes Feld einzeln optional (null) — eine Studie ohne Screenout-Code lässt das
-- Feld leer, der Screenout-Redirect ist dann ein no-op.
--
-- Minimal-Form bewusst: die volle Recruitment-Konfig + Provider-Credentials-
-- Tabelle (Plan §2.2 Lücke C / §6 E3) ist NICHT Teil von E2 — kein API-Key,
-- kein Adapter. Hier liegt NUR die outcome→URL-Abbildung pro Link.
alter table research_open_links
  add column if not exists panel_completion jsonb;

notify pgrst, 'reload schema';
