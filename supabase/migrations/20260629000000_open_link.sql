-- Phase 4 — Baustein 2 (Offener Studien-Link), Etappe 1: NUR Schema + Resolver.
--
-- EIN studienweiter, öffentlich teilbarer Link, über den beliebig viele ANONYME
-- Walk-ins an EINER Studie teilnehmen (z. B. in einer Community gepostet). Der
-- reservierte mandantenlose Pfad (research_plans / research_invites mit
-- org_id = NULL) bleibt BEWUSST gesperrt und UNVERÄNDERT — diese Migration
-- öffnet ihn NICHT (das wäre ein eigener Bau mit eigenem Sicherheits-Review).
--
-- ── ZENTRALE SICHERHEITS-ENTSCHEIDUNG (Mandantentrennung ist der rote Faden) ──
-- research_open_links.org_id ist NOT NULL. Damit existiert auf dem Walk-in-Pfad
-- NIE eine null-org-Zeile — der gefährliche Footgun „Service-Role-Query ohne
-- org-Filter liefert cross-tenant + null-org-Zeilen" (research_plans/_invites
-- haben org_id NULLABLE) kann hier STRUKTURELL nicht greifen. Die Frage „ist die
-- org da?" wird von einer LAUFZEIT-Prüfung (der !invite.org_id-Guard beim
-- nullable Invite) zu einer SCHEMA-CONSTRAINT BEIM SCHREIBEN verschoben. Der
-- bestehende !invite.org_id-Guard (session-service / screen-route) bleibt
-- byte-identisch unangetastet; der offene Link ist ein zweiter, physisch
-- getrennter Eintritt, kein Umbau.
--
-- ADDITIV: eine neue Tabelle + EINE additive nullable Spalte. KEINE Änderung an
-- bestehenden Spalten/CHECKs, KEINE Änderung am null-org-Guard. Idempotent
-- (`if not exists` / `drop policy if exists`). Befüllt/verdrahtet wird in
-- späteren Etappen (E2 Researcher-UI, E3 Teilnehmer-Eintritt, E4 Session-
-- Verdrahtung, E5 Anti-Abuse).

-- ─── research_open_links ─────────────────────────────────────────────────────
-- org_id + plan_id werden bei Link-Erzeugung (E2) SERVER-SEITIG aus dem Plan
-- kopiert (denormalisiert), NIE vom Caller akzeptiert. access_token ist ein
-- 256-bit-Capability-Credential (randomBytes(32).base64url) — dieselbe Mechanik
-- wie interview_sessions.access_token / synthesis_shares.token. status='disabled'
-- = harter Kill-Switch: ein offener Link ist ein ÖFFENTLICHES Credential und
-- widerruft sich — anders als ein one-shot-Invite — nicht von selbst.
create table if not exists research_open_links (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  plan_id      uuid not null references research_plans(id) on delete cascade,
  access_token text not null,
  status       text not null default 'active' check (status in ('active', 'disabled')),
  -- NULL = open-ended; ein konservativer Cap ist die strukturelle Anti-Abuse-
  -- Bremse (E5: COUNT auf interview_sessions.open_link_id, keine neue Session
  -- über dem Cap). Kein Isolations-, sondern ein Volumen-/Kosten-Mechanismus.
  max_sessions int,
  -- NULL = kein Ablauf. Additiv JETZT mitgenommen (billig); der Eintritts-Pfad
  -- prüft es in einer späteren Etappe — der E1-Resolver verlangt nur
  -- status='active'.
  valid_until  timestamptz,
  -- Nur Dashboard-Kosmetik (welcher Link ist das?).
  label        text,
  created_at   timestamptz not null default now()
);

-- Ein Token ⇒ höchstens eine Zeile (UNIQUE). Die WHERE-Klausel spiegelt
-- research_invites_access_token_idx (20260615000000); DORT ist access_token
-- NULLABLE und die Klausel hält token-lose Invites aus dem Unique-Set. HIER ist
-- access_token NOT NULL — das Prädikat ist also stets wahr und der Index damit
-- äquivalent zu einem vollen UNIQUE; bewusst symmetrisch gehalten (gleicher
-- Index-Name/-Form über beide Token-Tabellen, robust falls die Spalte je
-- nullable würde). Der Token-Lookup (findOpenLinkByAccessToken) ist ein
-- primary-key-class read.
create unique index if not exists research_open_links_access_token_idx
  on research_open_links (access_token)
  where access_token is not null;

-- Höchstens EIN aktiver Link pro Studie. Partial-unique über status='active' —
-- disabled-Zeilen (Widerruf-Historie) zählen nicht und kollidieren nicht. Hält
-- die „ein aktiver Link je Studie"-Invariante hart in der DB (E2 upserted).
create unique index if not exists research_open_links_plan_active_idx
  on research_open_links (plan_id)
  where status = 'active';

alter table research_open_links enable row level security;

-- Spiegelt research_screening_responses_org_isolation (20260628000000) /
-- synthesis_shares_org_isolation (NOT-NULL-org_id-Variante). Der service-role-
-- Client (öffentlicher Eintritts-Pfad) umgeht die Policy BEWUSST und scoped
-- IMMER auf die EINE Token-Zeile; alle App-seitigen Verwaltungs-Reads/Writes
-- (Dashboard, E2) sind zusätzlich explizit org-gefiltert. Die Policy schützt die
-- org-interne Verwaltung über den anon-key-/Clerk-Client (Defense-in-Depth).
drop policy if exists research_open_links_org_isolation on research_open_links;
create policy research_open_links_org_isolation
  on research_open_links
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ─── interview_sessions.open_link_id ─────────────────────────────────────────
-- Walk-in-Session-Attribution OHNE invite_id. Spiegelt EXAKT das invite_id-
-- Muster (20260612000000): nullable, ON DELETE SET NULL (das Löschen eines
-- Links cascadet NICHT die vergangenen Gespräche — das Transkript bleibt, nur
-- der Link-Pointer verfällt), partial index. NULL für jede per-Invite-/
-- post_loss-/checkin-Session — die Spalte ist ein No-op, solange sie nicht
-- gesetzt wird (Verdrahtung erst E4; jeder bestehende INSERT übergibt sie nicht
-- und verhält sich byte-identisch).
alter table interview_sessions
  add column if not exists open_link_id uuid
    references research_open_links(id) on delete set null;

-- „Session zu diesem offenen Link" (Research-Dashboard + E5-max_sessions-COUNT).
-- Partial wie interview_sessions_invite_idx — hält die Lookup-Kosten niedrig,
-- ohne uniqueness zu erzwingen (viele Walk-ins ⇒ viele Sessions pro Link).
create index if not exists interview_sessions_open_link_idx
  on interview_sessions(open_link_id) where open_link_id is not null;

notify pgrst, 'reload schema';
