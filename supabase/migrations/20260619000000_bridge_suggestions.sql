-- Cross-Modul-Brücke — bridge_suggestions: erkanntes CS-/Discovery-Muster, das
-- der Nutzer per Klick in eine Research-Studie verwandeln kann.
--
-- Posture: Suggestions werden NICHT automatisch ausgeführt. Der Detector
-- (src/lib/bridge/cs-to-research.ts) schreibt status='pending' in diese
-- Tabelle; ein User entscheidet via /api/bridge/suggestions/[id]/approve|
-- dismiss. Approval feeds in den existierenden Pfad
-- createResearchPlan → generateInterviewGuide.
--
-- Erweiterbar nach v1: `source_module` + `kind` sind absichtlich text statt
-- enum (loser Vertrag), so können spätere Brücken (z.B. product-discovery
-- → research, save-plays → research) dieselbe Tabelle nutzen ohne
-- Migration.
--
-- RLS spiegelt das research_plans-Pattern: nur Mitglieder der eigenen Org
-- sehen Suggestions ihrer Org. Server-side Reads/Writes laufen über den
-- Service-Role-Client (RLS-bypassing) und sind explizit org-gefiltert.

create table if not exists bridge_suggestions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,

  -- Welches Modul hat das Signal entdeckt? "cs_health" für die erste
  -- Brücke; spätere Sources tragen z.B. "product_discovery", "save_play".
  source_module   text not null,

  -- Strukturierte Referenzen aufs Quell-Modul. Shape ist source_module-
  -- spezifisch — für cs_health enthält das Objekt heute typisch:
  --   { "kind": "churn_cluster",
  --     "signalType": "<RISK_SIGNAL_TYPE>",
  --     "accountIds": ["<uuid>", ...],
  --     "windowDays": 90 }
  -- Die App liest dieses Objekt; die DB validiert es bewusst NICHT (jsonb
  -- bleibt weich, damit Brücken neue Felder hinzufügen können ohne
  -- Migration).
  source_refs     jsonb not null default '{}'::jsonb,

  -- Klassifikation des Vorschlags. Heute nur 'churn_cluster' für die
  -- cs-to-research Brücke. Spätere Brücken: 'discovery_gap',
  -- 'save_play_pattern', etc. Bleibt text statt enum aus demselben
  -- Erweiterbarkeits-Grund wie source_module.
  kind            text not null,

  -- Von der Derivation-LLM erzeugtes Research-Goal. Kann NULL sein, wenn
  -- die Derivation ehrlich kein Goal liefern konnte (zu dünner / zu
  -- gemischter Cluster). Solche Suggestions können trotzdem persistiert
  -- werden, damit der User sie sieht und mit eigenem Goal anpassen kann.
  derived_goal    text,

  -- Optional: Segment-Hinweis (Persona-Bucket) für den späteren
  -- generateInterviewGuide-Call. Bleibt nullable — die Derivation darf
  -- nichts erfinden, was nicht aus dem Cluster ableitbar ist.
  segment         text,

  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'dismissed')),

  -- Wenn approved: die research_plan-Zeile, die daraus entstanden ist.
  -- ON DELETE SET NULL, weil der erzeugte Plan unabhängig vom Vorschlag
  -- weiterleben soll (er wird editiert, gelöscht, etc.).
  approved_plan_id uuid references research_plans(id) on delete set null,

  -- Wann wurde der Vorschlag angenommen oder verworfen? Bleibt NULL für
  -- 'pending'-Zeilen. Audit-Footprint.
  decided_at      timestamptz,

  created_at      timestamptz not null default now()
);

-- "Pending Suggestions dieser Org für die Anzeige" — der Index der die
-- Research-Plans-Index-Seite trägt. Datum desc damit die neuesten oben
-- stehen.
create index if not exists bridge_suggestions_org_status_idx
  on bridge_suggestions(org_id, status, created_at desc);

-- "Gibt es schon einen pending/approved Vorschlag für DIESES Muster?"
-- Vom Detector benutzt um Doppel-Suggestions zu vermeiden, wenn das
-- Cluster-Muster über mehrere Detector-Runs hinweg stabil bleibt.
create index if not exists bridge_suggestions_org_kind_status_idx
  on bridge_suggestions(org_id, kind, status);

alter table bridge_suggestions enable row level security;

-- Spiegelt research_plans_org_isolation. Der service-role-Client umgeht
-- die Policy für die Cron-/Detector-Pfade; UI-Reads über die anonyme
-- Rolle (falls je nötig) wären durch die Policy abgedeckt.
drop policy if exists bridge_suggestions_org_isolation on bridge_suggestions;
create policy bridge_suggestions_org_isolation
  on bridge_suggestions
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
