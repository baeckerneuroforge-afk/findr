-- ─────────────────────────────────────────────────────────────────────────────
-- Konsoul P5 — PERSISTED THREADS + ORG-SIDE TELEMETRY (Roadmap P5 „Politur").
--
-- ENTWURF — NICHT ANWENDEN OHNE ANDRÉS MIGRATIONS-FREIGABE. Wird im Worktree
-- GESCHRIEBEN, aber bewusst NICHT per apply_migration angewandt. Additiv +
-- fail-closed; das Mergen ändert NICHTS am Verhalten, bis André die Migration
-- anwendet UND das Modul-Flag (NEXT_PUBLIC_KONSOUL_P5_ENABLED) setzt.
--
-- ZWEI additive LEAF-Tabellen (Schablone: konsoul_action_log 20260724000000 /
-- research_session_events 20260723000003). Beide: org_id FK ON DELETE CASCADE,
-- KEIN inbound FK → Org-Hard-Delete (delete_organization_data) erfasst sie
-- AUTOMATISCH über den org_id-Loop; Org-Export (export_organization_data) nimmt
-- sie AUTOMATISCH auf. created_at/updated_at/occurred_at = SERVER-Clock = die
-- autoritative Retention-Uhr (Cron-Sweep, Code-Konstanten in
-- src/lib/settings/konsoul-retention.ts). Client-Zeit wird NIE vertraut.
--
-- ─── konsoul_threads — org-seitiger Konversations-Speicher ────────────────────
-- Speichert den „Frag Konsoul"-Gesprächsverlauf, damit er einen Reload überlebt.
-- `turns` ist ein jsonb-Array aus {role, content} — der NUTZER-Frage + der
-- KONSOUL-Antwort. Das ist org-seitiger Text DERSELBEN KLASSE wie study_synthesis
-- (Übersichten/Themen sind ebenfalls Freitext und werden längst exportiert):
--   • Konsoul-Antworten sind in der org-seitigen SYNTHESE geerdet (Zitate sind
--     verbatim aus Synthese-Text, NICHT aus Roh-Interview-Transkripten — die
--     Anker-Prüfung garantiert das), also KEINE Teilnehmer-Roh-PII.
--   • org-scoped (RLS + .eq('org_id')), nur an den Org-Admin exportiert (Art. 15),
--     mit der Org gelöscht (CASCADE), retention-begrenzt (Cron auf updated_at).
-- BEWUSSTE ABWEICHUNG vom konsoul_action_log-Freitext-Verbot: jenes ist eine
-- METADATEN-/Audit-Tabelle (Modell-Prosa hätte dort nichts zu suchen); DIESE
-- Tabelle IST der Konversations-Inhalt (org-eigener Text). Trotzdem gilt: NIE
-- Roh-Interview-Transkript, NIE Affekt-/Emotions-/Pro-Person-Label.
create table if not exists konsoul_threads (
  id          uuid primary key default gen_random_uuid(),

  -- org-autoritativ (aus der Session, NIE aus Modell/Client). RLS + Hard-Delete
  -- + Export hängen einzig hieran.
  org_id      uuid not null references organizations(id) on delete cascade,

  -- aus der ERSTEN Nutzer-Frage server-seitig abgeleitet + gekappt (App-Schicht),
  -- nur zur Listen-Beschriftung. Nullable.
  title       text,

  -- Geordnetes Array aus {role:'user'|'assistant', content:string}. NUR Text —
  -- KEINE Zitate/citations, KEIN result-Envelope, KEINE Zahlen-Blöcke: Zahlen
  -- werden beim Weiterführen frisch + deterministisch neu berechnet (Honesty-
  -- Vertrag, kein Zitat-Cache). Die App-Schicht validiert/kappt vor jedem Write
  -- (max. Turns, max. content-Länge, role-Enum). Default leeres Array.
  turns       jsonb not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  -- bei jedem neuen Turn gebumpt — die Retention-Uhr (zuletzt aktiv).
  updated_at  timestamptz not null default now()
);

create index if not exists konsoul_threads_org_updated_idx
  on konsoul_threads (org_id, updated_at desc);

alter table konsoul_threads enable row level security;
drop policy if exists konsoul_threads_org_isolation on konsoul_threads;
create policy konsoul_threads_org_isolation
  on konsoul_threads
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ─── konsoul_metrics — org-seitige Erfolgs-Telemetrie (NUR Metadaten) ─────────
-- HARTE LEITPLANKE wie konsoul_action_log: ABSOLUT KEIN Freitext. Nur ein
-- Event-Closed-Set + ein eng-whitelisteter counts-jsonb (NUR Zahlen-Keys). NIE
-- Frage-/Antwort-Text, NIE Affekt-/Pro-Person-Label. So zählt ein Dashboard
-- „N ⌘K-Fragen, davon X geerdet" ohne je Inhalt zu speichern.
create table if not exists konsoul_metrics (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,

  -- Closed-Set per CHECK (Muster action_type). Reine org-seitige Nutzungs-Events.
  event       text not null check (event in
                ('inline_question_asked','inline_answer_shown',
                 'thread_saved','thread_resumed')),

  -- Datensparsam: NUR Zahlen (z. B. {grounded:1} / {turn_count:3}). Die App-
  -- Schicht whitelistet die Keys (src/lib/konsoul/metrics.ts). MUST NOT carry
  -- Text/PII/Prosa. Default leeres Objekt.
  counts      jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now()
);

create index if not exists konsoul_metrics_org_occurred_idx
  on konsoul_metrics (org_id, occurred_at desc);

alter table konsoul_metrics enable row level security;
drop policy if exists konsoul_metrics_org_isolation on konsoul_metrics;
create policy konsoul_metrics_org_isolation
  on konsoul_metrics
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
