-- Phase 3 proactive — research layer (modus-agnostisches Fundament für das
-- Research-Interview-Produkt). Zwei Tabellen: research_plans (eine Studie —
-- Topic-Skript, Persona, Sample-Ziel, Status) und research_invites (ein
-- eingeladener Teilnehmer pro Studie — Kontaktdaten, Modus-Wunsch, Termin,
-- Status).
--
-- WICHTIG — NULLABLE org_id auf beiden Tabellen:
--   Heute werden NUR Zeilen mit gesetztem org_id beschrieben (eigene Kunden,
--   Research auf Findr-Customer-Seite). Zeilen mit org_id = NULL sind für
--   die spätere externe Markt-Recherche reserviert (mandantenloser Pool
--   von Research-Teilnehmern). Die aktuelle org_isolation-Policy lässt
--   org_id = NULL IMPLIZIT FALLEN: in PostgreSQL ergibt `NULL = current_
--   org_id()` den Wert NULL, was im RLS-Filter wie FALSE behandelt wird.
--   Externe Zeilen sind in dieser Phase über die Dashboard-Wege also
--   UNSICHTBAR — gewollt, bis die externe Ein-/Auslieferungs-Schicht
--   gebaut ist. Eine dedizierte Migration wird später eine zweite Policy
--   (Service-Role oder Participant-Token) ergänzen, die genau diese
--   nullable-org_id-Zeilen exponiert.
--
-- NICHT enthalten: research_slots (konkrete Verfügbarkeits-Zeitschlitze).
-- Der Termin steht direkt am Invite (scheduled_at). Slot-Verwaltung mit
-- Round-Robin / Researcher-Availability kommt in Etappe 2 (Scheduling).

create table if not exists research_plans (
  id uuid primary key default gen_random_uuid(),
  -- NULLABLE — siehe Header-Kommentar.
  org_id uuid references organizations(id) on delete cascade,
  title text not null,
  -- Ein-Satz / Absatz: was wollen wir herausfinden?
  objective text not null,
  -- Topic-Skript statt starrer Frageliste — der Agent formuliert pro
  -- Topic on-the-fly. Empfohlene (NICHT erzwungene) Struktur:
  --   [{ "topic":      "<short label>",
  --      "intent":     "<what we want to learn>",
  --      "hypotheses": ["…"]  // optional
  --    }, …]
  -- Validierung passiert im TS-Layer (Zod im Prompt-Builder), nicht in
  -- der DB. So bleibt das Schema weich für UI-Iteration.
  topic_script jsonb not null default '[]'::jsonb,
  -- Freitext: Rolle, Branche, Reifegrad der Ziel-Persona.
  persona text,
  -- Anzahl angestrebter abgeschlossener Interviews; null = open-ended.
  sample_target int,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'completed', 'archived')
  ),
  created_at timestamptz not null default now()
);

create index if not exists research_plans_org_status_idx
  on research_plans(org_id, status, created_at desc);

alter table research_plans enable row level security;

-- org_isolation: spiegelt das interview_sessions-Pattern. Zeilen mit
-- org_id IS NULL sind hier ABSICHTLICH unsichtbar (NULL-Vergleich
-- liefert NULL → RLS filtert weg). Die externe Migration wird eine
-- ZWEITE Policy (auf service-role-Rolle bzw. participant-Token-claim)
-- ergänzen, die diese Zeilen kontrolliert exponiert.
drop policy if exists research_plans_org_isolation on research_plans;
create policy research_plans_org_isolation
  on research_plans
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create table if not exists research_invites (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references research_plans(id) on delete cascade,
  -- NULLABLE aus demselben Grund wie research_plans.org_id (extern später).
  -- Invites unter einem externen Plan tragen praktisch org_id = NULL.
  org_id uuid references organizations(id) on delete cascade,
  -- Anzeige-Label fürs Dashboard ("Jane Doe, Acme Inc."). Email und
  -- Name separat, damit die Email indexier-/maskierbar bleibt.
  contact_label text not null,
  contact_email text,
  -- Kanal-Wunsch des Teilnehmers. Heute: nur 'text' wird tatsächlich
  -- verdrahtet; 'voice' und 'video' sind reservierte Werte für die
  -- nächsten Etappen.
  mode_preference text not null default 'text' check (
    mode_preference in ('text', 'voice', 'video')
  ),
  status text not null default 'pending' check (
    status in (
      'pending',      -- angelegt, noch nicht eingeladen
      'scheduled',    -- bestätigter scheduled_at
      'in_progress',  -- Session wurde gestartet
      'completed',    -- Session erfolgreich beendet
      'cancelled',    -- vom Einladenden abgesagt
      'no_show'       -- Termin verstrichen ohne Teilnahme
    )
  ),
  -- Gesetzt, sobald ein Slot fix steht; null während offener Einladung.
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists research_invites_plan_status_idx
  on research_invites(plan_id, status);
create index if not exists research_invites_org_idx
  on research_invites(org_id) where org_id is not null;

alter table research_invites enable row level security;

drop policy if exists research_invites_org_isolation on research_invites;
create policy research_invites_org_isolation
  on research_invites
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
