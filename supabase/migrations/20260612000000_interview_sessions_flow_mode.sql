-- Phase 3 proactive — interview_sessions extension: flow, mode, plan/invite
-- links, recording metadata. Plus Phase 1 of the expand-contract rename
-- kind → flow (kind STAYS authoritative during this migration — finaler
-- Cleanup folgt in zwei späteren Migrationen).
--
-- EXPAND-CONTRACT-PLAN für kind → flow (insgesamt 3 Phasen):
--
--   Phase 1 — DIESE MIGRATION:
--     · ADD COLUMN flow text  (nullable, check constraint inkl. 'research')
--     · Backfill: flow := kind für alle existing rows
--     · Code unverändert: schreibt + liest weiterhin `kind`. `flow` ist da,
--       aber NOCH NICHT authoritativ.
--
--   Phase 2 — eine spätere Migration + Code-Update (NICHT JETZT):
--     · Service-Schreibpfade um `flow` ergänzen (PARALLEL WRITE zu kind);
--       beide Spalten bleiben für jede neue Zeile konsistent.
--     · Reader-Stellen sukzessive auf `flow` umstellen
--       (Type-Definition, advanceInterview-branch, getDealInterview,
--        getAccountCheckin).
--
--   Phase 3 — finaler Cleanup (NICHT JETZT, nach allen Deploys):
--     · ALTER COLUMN flow SET NOT NULL
--     · ALTER TABLE … DROP CONSTRAINT auf kind
--     · ALTER TABLE … DROP COLUMN kind
--
-- Während Phase 1 + 2 bleibt der laufende Code (post_loss + checkin)
-- ungebrochen — kein hartes Rename, kein Stillstand bei Deploys.

-- ── flow ────────────────────────────────────────────────────────────────────

alter table interview_sessions
  add column if not exists flow text
    check (flow is null or flow in ('post_loss', 'checkin', 'research'));

-- Backfill existing rows. Idempotent: nur Zeilen ohne flow werden gesetzt,
-- die Migration kann ohne Schaden zweimal laufen.
update interview_sessions
   set flow = kind
 where flow is null;

-- ── mode ────────────────────────────────────────────────────────────────────

-- Alle bisherigen Sessions sind text → default 'text' deckt Backfill und
-- Neuanlagen ab.
alter table interview_sessions
  add column if not exists mode text not null default 'text'
    check (mode in ('text', 'voice', 'video'));

-- ── plan / invite links ────────────────────────────────────────────────────

-- Nur bei flow = 'research' gesetzt. ON DELETE SET NULL, weil das Löschen
-- eines Plans NICHT die vergangenen Gespräche cascaden soll — das
-- Transkript bleibt erhalten, nur der Plan-Pointer verfällt.
alter table interview_sessions
  add column if not exists plan_id uuid
    references research_plans(id) on delete set null;
alter table interview_sessions
  add column if not exists invite_id uuid
    references research_invites(id) on delete set null;

-- ── recording metadata ─────────────────────────────────────────────────────

-- recording_url bleibt null für text mode (kein Audio). transcript_source
-- dokumentiert, wie conversation[] entstanden ist:
--   'typed'           - Tastatur (text mode)
--   'stt'             - Speech-to-Text in unserer Pipeline (voice/video)
--   'provider_native' - der Voice-Provider lieferte sein eigenes Transkript
-- Spalte heute `text`, damit kein voreiliges Enum festgeklopft ist; die
-- Voice-Migration verschärft das auf einen check constraint, sobald der
-- Provider-Stack steht.
alter table interview_sessions
  add column if not exists recording_url text;
alter table interview_sessions
  add column if not exists transcript_source text;

-- ── Indexe für die neuen Query-Shapes ──────────────────────────────────────

-- "Alle Sessions zu diesem Plan" (Research-Dashboard).
create index if not exists interview_sessions_plan_idx
  on interview_sessions(plan_id) where plan_id is not null;

-- "Session zu diesem Invite" — pro Invite gibt's in der Praxis höchstens
-- eine Session, der FK ist aber nicht unique. Partial index hält die
-- Lookup-Kosten niedrig, ohne uniqueness zu erzwingen.
create index if not exists interview_sessions_invite_idx
  on interview_sessions(invite_id) where invite_id is not null;

notify pgrst, 'reload schema';
