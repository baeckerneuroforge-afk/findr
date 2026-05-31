-- Phase 4 — Screening (Baustein 1), Etappe 1: NUR Schema (Datenmodell).
--
-- Inbound-Qualifizierung VOR dem KI-Interview: der Researcher hinterlegt pro
-- Studie einen kurzen Fragebogen (deterministische Regel-Logik, KEINE KI); der
-- Teilnehmer qualifiziert sich am white-label per-Invite-Link selbst. Diese
-- Migration legt NUR das Schema an — die Verdrahtung in den Interview-Eintritt
-- (Etappe 4) und die UIs (Etappe 2/3) kommen jeweils separat.
--
-- ADDITIV: zwei `add column if not exists` + eine neue Tabelle. KEINE Änderung
-- an einer bestehenden Spalte, KEINE CHECK-ALTERs an Bestand. Idempotent.

-- ─── research_plans.screening_questions ──────────────────────────────────────
-- Die Screening-Fragen einer Studie. Bewusst WEICH wie topic_script
-- (20260611000000): Form + Validierung leben im TS-Layer (Zod,
-- src/lib/schemas/screening.ts), nicht in der DB — so bleibt das Schema frei für
-- UI-Iteration. Default '[]' = kein Screening konfiguriert ⇒ die Filter-Logik
-- ist ein No-op (qualifiziert), der Plan verhält sich wie heute.
alter table research_plans
  add column if not exists screening_questions jsonb not null default '[]'::jsonb;

-- ─── interview_sessions.screening_answers ────────────────────────────────────
-- Die vom QUALIFIZIERTEN Teilnehmer gegebenen Antworten, mitgeschrieben beim
-- (verzögerten) Session-Anlegen in Etappe 4. NULL für jede Session ohne
-- vorgeschaltetes Screening. Abgewiesene erzeugen per Konstruktion KEINE
-- Session-Zeile, also auch keine Antworten hier.
alter table interview_sessions
  add column if not exists screening_answers jsonb;

-- ─── research_screening_responses (anonyme Quote) ────────────────────────────
-- Abgewiesenen-/Qualifizierten-Quote pro Studie — bewusst ANONYM: nur plan_id +
-- verdict + Zeitpunkt, KEIN invite_id, KEIN Profil, KEINE Antworten. Damit
-- bekommt der Researcher eine reine Zahl (rejected / (qualified + rejected))
-- ohne Profile von Abgewiesenen anzulegen ("sauberste Daten"). Das SCHEMA gehört
-- zu Etappe 1; BEFÜLLT wird die Tabelle erst in Etappe 4.
create table if not exists research_screening_responses (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  plan_id    uuid not null references research_plans(id) on delete cascade,
  verdict    text not null check (verdict in ('qualified', 'rejected')),
  created_at timestamptz not null default now()
);

-- Quote-Abfrage: pro Studie nach Verdikt zählen.
create index if not exists research_screening_responses_plan_idx
  on research_screening_responses(plan_id, verdict);

alter table research_screening_responses enable row level security;

-- Spiegelt participant_pool_org_isolation (NOT-NULL-org_id-Variante). Der
-- service-role-Client umgeht die Policy; alle App-Reads/Writes sind explizit
-- org-gefiltert.
drop policy if exists research_screening_responses_org_isolation on research_screening_responses;
create policy research_screening_responses_org_isolation
  on research_screening_responses
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
