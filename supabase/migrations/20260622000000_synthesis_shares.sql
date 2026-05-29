-- Shareable Synthesis Links — Phase-4-Baustein.
--
-- Ein Forscher teilt eine fertige Studien-Synthese per READ-ONLY-Link mit
-- Stakeholdern, die KEINEN Findr-Account haben — ohne Login, ohne Schreibrechte,
-- nur Ansicht. Das schließt eine Outset-Lücke (DACH B2B, Enterprise).
--
-- MECHANIK (1:1 gespiegelt von interview_sessions.access_token):
-- token ist ein 256-bit-Capability-Credential (randomBytes(32).base64url, in
-- share-service.ts erzeugt), UNIQUE und nicht erratbar. Der PUBLIC-Lesepfad
-- (/shared/synthesis/[token]) läuft NICHT über RLS: er nutzt den service-role-
-- Client und scoped IMMER auf die EINE Zeile zum token — wie der Interview-Pfad.
-- Besitz des Tokens = Lesezugriff auf genau diese eine Synthese, nichts sonst.
-- Wir enumerieren nie, vertrauen nie einem org_id aus dem Request.
--
-- LIVE-SICHT: der Link hängt an plan_id, nicht an einer eingefrorenen Synthese.
-- study_synthesis ist UNIQUE(org_id, plan_id) und wird beim Neuberechnen
-- überschrieben (upsert) — der Link zeigt also stets die AKTUELLE Synthese des
-- Plans. Wird der Plan gelöscht, kaskadiert der Share weg (ON DELETE CASCADE).
--
-- DSGVO: show_quotes ist das bewusste Opt-in für wörtliche Teilnehmer-Zitate
-- (personenbeziehbar). Default false — der Link zeigt standardmäßig nur das
-- aggregierte Narrativ + Themen + Lager, KEINE Zitate, KEINE Quell-IDs (die
-- Filterung passiert zusätzlich app-seitig in share-service.ts an der Quelle).
--
-- RLS: org_id NOT NULL + org_isolation, gespiegelt von participant_pool
-- (20260620000000) / bridge_suggestions (20260619000000). Die Policy schützt
-- die org-INTERNE Verwaltung (Link erstellen / auflisten / widerrufen); der
-- public Lesepfad umgeht sie bewusst über service-role (siehe oben).

create table if not exists synthesis_shares (
  id          uuid primary key default gen_random_uuid(),

  -- 256-bit-Capability-Credential (base64url). UNIQUE wie
  -- interview_sessions.access_token — der zweite gleiche Token wäre ein
  -- (astronomisch unwahrscheinlicher) Insert-Fehler statt einer Kollision.
  token       text not null unique,

  org_id      uuid not null references organizations(id) on delete cascade,
  plan_id     uuid not null references research_plans(id) on delete cascade,

  -- Sprache, die ein account-loser Stakeholder sieht. Es gibt kein Cookie und
  -- keine Org-Locale für ihn — die Sprache lebt deshalb hier an der Zeile,
  -- vom Forscher bei der Link-Erstellung gewählt. Gespiegelt von
  -- research_invites.language / interview_sessions.language (dieselbe „die
  -- teilnehmerseitige Sprache steht an der Zeile"-Konvention).
  language    text not null default 'en' check (language in ('de', 'en')),

  -- DSGVO-Opt-in: wörtliche Zitate nur, wenn der Forscher es bewusst aktiviert.
  -- Default false → Pilot-Default ist „keine personenbeziehbaren Zitate".
  show_quotes boolean not null default false,

  -- Optionaler Ablauf. NULL = läuft nie ab. Der Lesepfad prüft expires_at.
  expires_at  timestamptz,

  -- Soft-Revoke. Der Lesepfad gibt bei revoked=true generisch „nicht verfügbar"
  -- zurück (kein Unterschied zu abgelaufen/unbekannt — kein Enumerations-Signal).
  revoked     boolean not null default false,

  created_at  timestamptz not null default now()
);

-- Liste „Share-Links dieser Org / dieses Plans", neueste zuerst (Dashboard-
-- Verwaltung). Der public token-Lookup ist bereits durch den UNIQUE-Index auf
-- token abgedeckt.
create index if not exists synthesis_shares_org_idx
  on synthesis_shares(org_id, created_at desc);

create index if not exists synthesis_shares_plan_idx
  on synthesis_shares(plan_id);

alter table synthesis_shares enable row level security;

-- Spiegelt participant_pool_org_isolation / bridge_suggestions_org_isolation.
-- Der service-role-Client (public Lesepfad) umgeht die Policy; alle App-seitigen
-- Verwaltungs-Reads/Writes sind zusätzlich explizit org-gefiltert.
drop policy if exists synthesis_shares_org_isolation on synthesis_shares;
create policy synthesis_shares_org_isolation
  on synthesis_shares
  for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
