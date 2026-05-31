-- Findr Voice — Etappe 1: Ingest-Ledger / Posteingang (voice_inbox) +
-- Desktop-API-Tokens (voice_api_tokens).
--
-- ADDITIV: legt NUR zwei neue Tabellen an. KEINE Änderung an `calls`,
-- `deals`, `accounts`, `research_plans` o.ä. — der Voice-Ingest schreibt
-- über die BESTEHENDEN Engine-Eintritte in die bestehenden Tabellen; die
-- Provenienz ("findr_voice" + external_meeting_id) lebt in der frei-formigen
-- calls.participants-JSONB-Spalte, daher braucht `calls` keine neue Spalte.
--
-- RLS + current_org_id() spiegeln das bridge_suggestions-Muster
-- (20260619000000): Org-Isolation per Policy; Server-Reads/Writes laufen
-- über den Service-Role-Client (RLS-bypass) und sind explizit org-gefiltert.

-- ── voice_inbox ─────────────────────────────────────────────────────────────
-- Doppelrolle: (1) Idempotenz-Ledger JEDES Ingests (UNIQUE org+external_id),
-- (2) Posteingang = die Teilmenge status='pending' ("später zuordnen").
create table if not exists voice_inbox (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,

  -- Idempotenz-Schlüssel des aufzeichnenden Clients (Desktop-App /
  -- Recall-Meeting-ID). UNIQUE pro Org → ein Webhook-Retry mit derselben ID
  -- trifft den Constraint statt eine zweite Analyse auszulösen.
  external_meeting_id text not null,

  -- Lebenszyklus:
  --   'pending'   — "später zuordnen": liegt im Posteingang, noch keine Engine
  --   'routed'    — bei Ingest sofort zugeordnet, Engine lief direkt
  --   'assigned'  — war pending, dann vom Nutzer zugeordnet, Engine lief
  --   'dismissed' — verworfen
  status              text not null default 'pending'
                      check (status in ('pending', 'routed', 'assigned', 'dismissed')),

  -- Welche Engine lief (nach Routing): 'health' | 'risk' | 'discovery' | null.
  engine              text check (engine in ('health', 'risk', 'discovery')),

  -- Ergebnis-Referenz (callId / scoreId / insightId), rein für Audit/Anzeige.
  result_ref          text,

  -- Ingest-Payload. Bei 'pending' enthält es das Transkript + Metadaten (noch
  -- keine calls-Row existiert); bei 'routed'/'assigned' nur noch Metadaten
  -- (das Transkript lebt dann in der calls-Row). jsonb bleibt bewusst weich.
  payload             jsonb not null default '{}'::jsonb,

  decided_at          timestamptz,
  created_at          timestamptz not null default now(),

  -- Idempotenz-Backstop: ein wiederholter externalMeetingId derselben Org
  -- kann keine zweite Zeile (und damit keinen zweiten Engine-Lauf) erzeugen.
  unique (org_id, external_meeting_id)
);

-- "Posteingang dieser Org" + Audit-Liste — neueste oben.
create index if not exists voice_inbox_org_status_idx
  on voice_inbox(org_id, status, created_at desc);

alter table voice_inbox enable row level security;
drop policy if exists voice_inbox_org_isolation on voice_inbox;
create policy voice_inbox_org_isolation
  on voice_inbox
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ── voice_api_tokens ──────────────────────────────────────────────────────
-- Statische, org-gescopte Bearer-Tokens für die Desktop-App (Etappe 1). Der
-- Klartext-Token wird NIE gespeichert — nur sha256(token) hex. Lookup beim
-- Ingest: Token hashen, Zeile per token_hash finden, org_id lesen. (Etappe 2
-- erweitert denselben Auth-Helper additiv um Clerk-OAuth-JWTs.)
create table if not exists voice_api_tokens (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,

  token_hash    text not null unique,
  name          text not null default 'Findr Voice token',

  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  -- Soft-Revoke: gesetzt = Token ungültig (der Lookup filtert revoked Zeilen).
  revoked_at    timestamptz
);

create index if not exists voice_api_tokens_org_idx on voice_api_tokens(org_id);

alter table voice_api_tokens enable row level security;
-- Defensiv (Server liest/schreibt ausschließlich service-role / RLS-bypass):
drop policy if exists voice_api_tokens_org_isolation on voice_api_tokens;
create policy voice_api_tokens_org_isolation
  on voice_api_tokens
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
