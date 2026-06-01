-- Synthetische Test-Teilnehmer (Trockenlauf) für Market Research — Stufe 1.
--
-- ZWECK: Bevor eine echte Markt-Studie startet, kann der Nutzer einen
-- TROCKENLAUF machen — die KI spielt N synthetische Teilnehmer-Personas, die das
-- Interview durchlaufen, damit man sieht ob der Interview-Guide funktioniert
-- (hängt der Agent? sind Fragen klar? greift das Screening? kommt brauchbare
-- Synthese raus?). KEINE echten Menschen, KEIN externer Anbieter.
--
-- STRIKTE TRENNUNG (der Grund für EIGENE Tabellen statt eines Flags auf
-- interview_sessions): synthetische Läufe dürfen NIEMALS in echte Daten mischen.
-- Diese zwei Tabellen sind die EINZIGE Heimat synthetischer Sessions/Synthesen.
-- Sie werden von KEINEM echten Lese-/Zählpfad gelesen — weder von
-- countCompletedSessionsForPlan ("47 von 200"), noch von synthesizeStudy /
-- loadOrgSyntheses (Cross-Study) / getAllInsightsForOrg (Insights). Weil die
-- synthetischen Zeilen physisch NICHT in interview_sessions / calls /
-- product_discovery_insights / study_synthesis liegen, sind sie für jeden
-- bestehenden Read strukturell unsichtbar — ohne einen einzigen WHERE-Filter.
--
-- ADDITIV: zwei neue Tabellen, KEINE Änderung an bestehenden Objekten. RLS
-- spiegelt accounts / participant_pool (NOT-NULL org_id + org_isolation via
-- current_org_id()). Der service-role-Client umgeht RLS; alle App-Reads/Writes
-- sind explizit org-gefiltert.

-- ─── synthetic_test_runs ─────────────────────────────────────────────────────
-- Ein Trockenlauf: bündelt N synthetische Teilnehmer (Sessions, Kind-Tabelle)
-- gegen EINEN bestehenden research_plan (study_type='market_research'). Der Plan
-- wird nur GELESEN, um den Agenten zu steuern — es wird KEINE research_plans-
-- Zeile angelegt (sonst würde die Studie in loadOrgSyntheses/listResearchPlans
-- sichtbar). Das Synthese-Ergebnis des Laufs landet HIER in `synthesis`, NICHT
-- in study_synthesis.
create table if not exists synthetic_test_runs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  plan_id          uuid not null references research_plans(id) on delete cascade,
  status           text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  -- Anzahl angeforderter synthetischer Teilnehmer (= Anzahl Sessions).
  requested_count  int not null check (requested_count >= 0),
  -- Buyer-facing Sprache der simulierten Interviews (de/en), wie bei echten
  -- Sessions. Steuert Agent- UND Persona-Ausgabe.
  language         text not null default 'de' check (language in ('de', 'en')),
  -- Test-Synthese (StudySynthesisResult) — gefüllt, wenn alle Sessions fertig
  -- sind. NIE in study_synthesis gespiegelt.
  synthesis        jsonb,
  synthesis_model  text,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists synthetic_test_runs_org_created_idx
  on synthetic_test_runs(org_id, created_at desc);
create index if not exists synthetic_test_runs_plan_idx
  on synthetic_test_runs(plan_id);

drop trigger if exists synthetic_test_runs_updated_at on synthetic_test_runs;
create trigger synthetic_test_runs_updated_at
  before update on synthetic_test_runs
  for each row execute function set_updated_at();

alter table synthetic_test_runs enable row level security;

drop policy if exists synthetic_test_runs_org_isolation on synthetic_test_runs;
create policy synthetic_test_runs_org_isolation
  on synthetic_test_runs
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ─── synthetic_test_sessions ─────────────────────────────────────────────────
-- Ein synthetisches Interview innerhalb eines Laufs: die gespielte Persona, der
-- vollständige Gesprächsverlauf (Agent ↔ Persona) und das pro-Session
-- extrahierte Stage-1-Insight (für die Test-Synthese). org_id ist denormalisiert
-- (NOT NULL, eigene FK), damit die org_isolation-Policy ohne Join greift — wie
-- participant_pool_invites. run_id CASCADE: ein gelöschter Lauf nimmt seine
-- Sessions mit.
create table if not exists synthetic_test_sessions (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references synthetic_test_runs(id) on delete cascade,
  org_id          uuid not null references organizations(id) on delete cascade,
  persona_label   text not null,
  persona_prompt  text not null,
  status          text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  -- Gesprächsverlauf: [{ "role": "agent" | "customer", "text": "…" }]
  conversation    jsonb not null default '[]'::jsonb,
  transcript      text,
  -- Pro-Session Stage-1 Extraktion (ProductDiscoveryResult-Form), NUR Input für
  -- die Test-Synthese des Laufs. NIE in product_discovery_insights geschrieben.
  insight         jsonb,
  error           text,
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists synthetic_test_sessions_run_idx
  on synthetic_test_sessions(run_id, position);
create index if not exists synthetic_test_sessions_org_created_idx
  on synthetic_test_sessions(org_id, created_at desc);

alter table synthetic_test_sessions enable row level security;

drop policy if exists synthetic_test_sessions_org_isolation on synthetic_test_sessions;
create policy synthetic_test_sessions_org_isolation
  on synthetic_test_sessions
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
