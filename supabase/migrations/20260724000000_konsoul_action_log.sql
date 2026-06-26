-- ─────────────────────────────────────────────────────────────────────────────
-- Konsoul P3.0 — ACTION AUDIT LOG (Design-Doc §3, Review-Auflage 1).
--
-- ENTWURF — NICHT ANWENDEN OHNE ANDRÉS MIGRATIONS-FREIGABE. Diese Datei wird im
-- Worktree GESCHRIEBEN, aber bewusst NICHT per apply_migration angewandt. Sie
-- ist additiv und fail-closed; das Mergen ändert NICHTS am Verhalten, bis André
-- die Migration anwendet UND das Modul-Flag setzt.
--
-- Eine einzige additive LEAF-Tabelle (Schablone: research_session_events,
-- 20260723000003). Sie speichert NUR org-/portfolio-seitige METADATEN über die
-- Vorschläge, die Konsoul macht, und ihren Ausgang (proposed / accepted /
-- ignored). Sie ist KEIN Verhaltens-Store — Konsoul führt nie selbst aus; die
-- Ausführung lebt im Frontend-Confirm-Klick gegen die bestehenden org-scoped
-- Endpunkte.
--
-- LEAF by design: FK in (org_id ON DELETE CASCADE; plan_id ON DELETE SET NULL),
-- KEIN inbound FK. Org-Hard-Delete (delete_organization_data) erfasst die Tabelle
-- AUTOMATISCH über ihren org_id-Loop; ein gelöschter Plan reißt das Audit-
-- Metadatum NICHT mit (Muster product_discovery_insights / bridge_suggestions).
--
-- proposed_at / decided_at = SERVER-Clock (now()) = die autoritative Retention-
-- Uhr (Cron-Sweep konsoul_action_log, Default-Frist als Code-Konstante in
-- src/lib/settings/konsoul-retention.ts). Client-Zeit wird NIE vertraut.
--
-- ─── HARTE LEITPLANKE (Design-Doc §3, DSGVO, AI-Act Art. 22 / L8) ─────────────
-- ABSOLUT KEIN Freitext-/rationale-/answer-/Prosa-Feld. export_organization_data
-- dumpt JEDE Spalte einer org_id-tragenden Tabelle an Org-Admins → ungerahmter
-- Modell-Output dürfte NIE in eine Zeile driften (PII-Leak). Erlaubt sind NUR:
-- Aktionstyp (4er-Closed-Set), Plan-ID, Modell/Version, ein eng-whitelisteter
-- counts-jsonb (NUR Zahlen-Keys), Status, Zeitstempel. KEIN Affekt-/Emotions-/
-- Verhaltens-/Pro-Person-Label (RECHTSANKER turn-signals.ts:32, KI-VO Art. 5).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists konsoul_action_log (
  id            uuid primary key default gen_random_uuid(),

  -- org-autoritativ (aus der Session-Closure, NIE aus Modell/Client). Einzige
  -- Verdrahtung, die RLS + Org-Hard-Delete + Org-Export brauchen.
  org_id        uuid not null references organizations(id) on delete cascade,

  -- nullable, ON DELETE SET NULL: ein gelöschter Plan reißt das Audit-Metadatum
  -- nicht mit (Muster product_discovery_insights.plan_id / bridge_suggestions).
  plan_id       uuid references research_plans(id) on delete set null,

  -- Closed-Set per CHECK (Muster event_type) — die genau VIER erlaubten
  -- Aktionen. NIE Prolific/Publish/Invite/Open-Link/Pool/Versand (existieren als
  -- Tool nicht, dürfen darum auch hier nie auftauchen).
  action_type   text not null check (action_type in
                  ('create_study_draft','run_synthesis','run_personas','run_guide')),

  -- Transparenz/Reproduzierbarkeit: welches Modell erzeugte den Vorschlag.
  -- Reine Klartext-Bezeichner (z. B. 'claude-opus-4-8'), KEIN Modell-OUTPUT.
  model         text,
  model_version text,

  -- Datensparsam: NUR Zahlen, die das Signal trugen (based_on_count, Anzahl
  -- betroffener Studien usw.). Die App-Schicht whitelistet die Keys
  -- (src/lib/konsoul/agent/action-audit.ts → COUNTS_KEY_WHITELIST). MUST NOT
  -- carry Roh-Input / PII / Prosa / Affekt. Default leeres Objekt.
  counts        jsonb not null default '{}'::jsonb,

  -- accepted/ignored-Status (server-gestempelt, nie aus dem Client):
  status        text not null default 'proposed'
                  check (status in ('proposed','accepted','ignored')),

  -- Server-Clock = autoritative Retention-Uhr (Muster created_at, NICHT
  -- untrusted ts_ms). proposed_at beim Vorschlag, decided_at beim Confirm/Dismiss.
  proposed_at   timestamptz not null default now(),
  decided_at    timestamptz
);

-- org-scoped Retention-Sweep + Org-Reads brauchen (org_id, proposed_at).
create index if not exists konsoul_action_log_org_proposed_idx
  on konsoul_action_log (org_id, proposed_at);

-- Defense-in-depth: der app-seitige service-role-Pfad umgeht RLS und filtert
-- IMMER selbst per .eq('org_id', orgId); RLS ist das zweite Netz für jeden
-- künftigen authenticated-Pfad (Muster research_session_events).
alter table konsoul_action_log enable row level security;
drop policy if exists konsoul_action_log_org_isolation on konsoul_action_log;
create policy konsoul_action_log_org_isolation
  on konsoul_action_log
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
