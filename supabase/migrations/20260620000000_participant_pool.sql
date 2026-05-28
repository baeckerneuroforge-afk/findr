-- Teilnehmer-Pool — org-weiter, wiederverwendbarer Personen-Stamm für
-- Research-Studien, plus deterministisches Screening (Rolle / Segment / Tags)
-- und manuelle Quoten pro Studie.
--
-- WARUM ADDITIV (keine Änderung an research_invites / research_plans)?
-- Heute ist ein Teilnehmer 1:1 an einen research_plan gekoppelt: eine
-- research_invites-Zeile pro eingeladener Person pro Plan (20260611000000_
-- research_layer.sql). Der Pool sitzt EINE Ebene darüber: eine Person lebt
-- einmal in participant_pool und kann in beliebig viele Studien eingeladen
-- werden. Die Einladung selbst erzeugt WEITERHIN eine normale
-- research_invites-Zeile über den bestehenden Pfad (createResearchInvite) —
-- es gibt KEINEN parallelen Invite-Datenpfad. participant_pool_invites ist
-- nur die Brücke ("diese Pool-Person wurde via dieser invite in diese
-- Studie eingeladen"), damit Dedup + Quoten ohne Duplikate funktionieren.
--
-- KEINE KI: Screening = strukturierte Attribute + manuelle Quoten. Kein
-- Auto-Screening, keine generierten Fragen. respondent_source='screening'
-- (product_discovery_insights, 20260616000000) ist der reservierte Anknüpf-
-- punkt für die spätere Studien-Synthese; diese Migration verdrahtet ihn
-- bewusst NICHT — das wäre eine eigene LLM-Surface.
--
-- RLS: org_id NOT NULL + org_isolation gespiegelt von bridge_suggestions
-- (20260619000000). Der Pool ist immer org-gebunden — der mandantenlose
-- externe Pool (nullable org_id, siehe research_layer-Header) ist eine
-- separate, spätere Schicht und NICHT dieser org-interne Pool.

-- ─── participant_pool ────────────────────────────────────────────────────────
-- Eine Person im org-weiten Pool. contact_label/contact_email spiegeln die
-- research_invites-Felder (Label = Anzeige, Email separat + nullable). role/
-- segment/tags sind die deterministischen Screening-Attribute; role/segment
-- benennen wir wie product_discovery_insights.respondent_role/_segment, damit
-- der Vokabular über die Module konsistent bleibt.

create table if not exists participant_pool (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,

  -- Anzeige-Label ("Jane Doe, Acme Inc."). Wie research_invites.contact_label.
  contact_label text not null,

  -- Nullable wie research_invites.contact_email (20260618000000) — Personen
  -- ohne hinterlegte Email sind erlaubt (Link-Kopieren statt Mailversand).
  contact_email text,

  -- Screening-Attribute, alle optional. Frei-Text statt enum (loser Vertrag),
  -- damit Orgs ihr eigenes Vokabular nutzen ("Founder", "Head of Sales", …)
  -- ohne Migration. role korrespondiert mit den Quoten unten.
  role          text,
  segment       text,
  tags          text[] not null default '{}',

  -- Frei-Text-Notiz (Recruiting-Kontext, Quelle, etc.). Rein informativ.
  notes         text,

  created_at    timestamptz not null default now()
);

-- Liste "Pool dieser Org", neueste zuerst.
create index if not exists participant_pool_org_idx
  on participant_pool(org_id, created_at desc);

-- Dedup: Email case-insensitive UNIQUE pro Org. Partial — Zeilen ohne Email
-- (nur Label) sind per Definition nicht eindeutig und werden NICHT dedupliziert
-- (dieselbe Regel wie der bestehende Invite-Bulk-Pfad für label-only Einträge).
create unique index if not exists participant_pool_org_email_lower_idx
  on participant_pool(org_id, lower(contact_email))
  where contact_email is not null;

-- GIN-Index für Tag-Filter (tags && '{…}') — der Pool-Filter sucht nach
-- überlappenden Tags. Klein, da tags meist kurz.
create index if not exists participant_pool_tags_idx
  on participant_pool using gin(tags);

alter table participant_pool enable row level security;

-- Spiegelt bridge_suggestions_org_isolation (NOT-NULL-org_id-Variante). Der
-- service-role-Client umgeht die Policy; alle App-Reads/Writes sind explizit
-- org-gefiltert.
drop policy if exists participant_pool_org_isolation on participant_pool;
create policy participant_pool_org_isolation
  on participant_pool
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ─── participant_pool_invites ────────────────────────────────────────────────
-- Brücke Pool-Person ↔ konkrete research_invites-Zeile. Existiert NUR, um
-- "aus Pool in Studie eingeladen" abzubilden ohne Duplikat. Die invite selbst
-- ist eine gewöhnliche research_invites-Zeile (über createResearchInvite
-- erzeugt) — diese Tabelle trägt KEINE Kontaktdaten, sie verknüpft nur.

create table if not exists participant_pool_invites (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,

  pool_member_id uuid not null references participant_pool(id) on delete cascade,
  plan_id        uuid not null references research_plans(id) on delete cascade,

  -- Die erzeugte research_invites-Zeile. ON DELETE CASCADE: wird der Invite
  -- über den bestehenden DELETE-/participants-Pfad gelöscht, verschwindet die
  -- Verknüpfung automatisch — kein dangling link, und der DELETE-Pfad muss
  -- NICHT angefasst werden (rein additiv).
  invite_id      uuid not null references research_invites(id) on delete cascade,

  created_at     timestamptz not null default now(),

  -- Jede invite gehört zu höchstens einer Pool-Person.
  unique (invite_id),

  -- Pool-Dedup: dieselbe Pool-Person wird pro Plan höchstens einmal
  -- eingeladen. Verhindert Doppel-Invites über den Pool-Pfad und legt
  -- gleichzeitig den Index für die Quoten-Abfrage (plan_id → member) an.
  unique (plan_id, pool_member_id)
);

-- FK-Index für den pool_member_id-CASCADE + "in welchen Studien ist diese
-- Person?". (plan_id-seitig deckt der unique(plan_id, pool_member_id) ab.)
create index if not exists participant_pool_invites_member_idx
  on participant_pool_invites(pool_member_id);

alter table participant_pool_invites enable row level security;

drop policy if exists participant_pool_invites_org_isolation on participant_pool_invites;
create policy participant_pool_invites_org_isolation
  on participant_pool_invites
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ─── research_plan_quotas ────────────────────────────────────────────────────
-- Manuelle Screening-Quoten pro Studie: "Ziel: N Personen mit Rolle X".
-- Deterministisch — der Nutzer setzt das Ziel von Hand; der Fortschritt
-- (eingeladen / Ziel) wird aus participant_pool_invites ⋈ participant_pool.role
-- berechnet. v1 quotiert NUR nach role (das Beispiel "5 von 10 Sales-Rollen").
-- Segment-Quoten könnten später über eine `dimension`-Spalte ergänzt werden;
-- für v1 bewusst role-only gehalten.
--
-- Quoten-Fortschritt zählt NUR Pool-Einladungen: manuell/CSV angelegte Invites
-- tragen keine role (role lebt nur an der Pool-Person), sind also "ungescreent"
-- und fließen nicht in die Quote ein. Das ist die gewollte v1-Semantik.

create table if not exists research_plan_quotas (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  plan_id    uuid not null references research_plans(id) on delete cascade,

  -- Quoten-Dimension: ein role-Wert, der mit participant_pool.role abgeglichen
  -- wird (case-sensitive exakt — der Nutzer wählt aus den im Pool vorhandenen
  -- Rollen).
  role       text not null,

  -- Zielanzahl Einladungen für diese Rolle in dieser Studie.
  target     int not null check (target >= 0),

  created_at timestamptz not null default now(),

  -- Eine Quote pro (Studie, Rolle) — Upsert statt Historie.
  unique (plan_id, role)
);

create index if not exists research_plan_quotas_org_plan_idx
  on research_plan_quotas(org_id, plan_id);

alter table research_plan_quotas enable row level security;

drop policy if exists research_plan_quotas_org_isolation on research_plan_quotas;
create policy research_plan_quotas_org_isolation
  on research_plan_quotas
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
