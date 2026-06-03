# Bauplan: Shareable Links für Studien-Synthesen (Phase-4-Baustein)

> **Status:** Nur Inventur + Plan. KEIN Code, KEINE Migration, KEIN Commit in diesem Schritt.
> **Worktree:** `../findr-share` (Branch `sharelinks-plan`, von `main` @ `ff2e195`).
> **Ziel:** Ein Forscher teilt eine fertige Studien-Synthese per **read-only, login-freiem Link**
> mit Stakeholdern ohne Findr-Account. DACH B2B-SaaS / Enterprise — eine Outset-Lücke, die Findr
> schließen will.

---

## 0. Kernbefund (TL;DR)

- **Empfohlene Mechanik:** Token-basierter Public-Pfad **exakt analog `/interview/[token]`** —
  neue Route `/shared/synthesis/[token]`, die über den **Service-Role-Supabase-Client** (RLS-Bypass,
  kein Clerk) eine read-only Synthese rendert. Das Muster existiert bereits 1:1 produktiv und ist die
  bewährte Blaupause.
- **Was der Link zeigt (DSGVO):** fertiges Narrativ (`overview`), `emergent_themes` (Titel, Summary,
  Frequency), `tensions` (Lager A/B mit Labels). **Wörtliche Zitate: standardmäßig AUS** (sie sind
  personenbeziehbar) — opt-in pro Share-Link. **Roh-Transkripte: NEIN** (existieren in der Synthese
  ohnehin nicht). **Quell-IDs (`sourceInsightIds`): NEIN** im Public-View. Interne Account-/Deal-Daten: NEIN.
- **Etappe-5-Kollision:** Etappe 5 (`../findr-i18n5`, Branch `feat/i18n-etappe5`) hat **uncommittete**
  Änderungen an **genau den** Synthese-Dateien, die ein Share-Bau wiederverwenden würde
  (`synthesis/page.tsx`, `SynthesisThemeCard.tsx`, Export-Buttons, `UpdateSynthesisButton`). →
  **Der „Link erstellen"-Button und jede Wiederverwendung der Synthese-Komponenten sind erst nach
  Etappe-5-Merge baubar.** Die token-/datenseitigen Teile (Migration, Token-Service, Public-Route,
  Read-Only-Render) sind **disjunkt** und sofort baubar.

---

## 1. Inventur (am echten Code verifiziert)

### 1.1 Die Synthese-Ansicht heute

| Aspekt | Befund |
|---|---|
| **Route** | `/dashboard/research-plans/[id]/synthesis` — **nicht** `/research-plans/[id]/synthesis`. Datei: `src/app/(dashboard)/dashboard/research-plans/[id]/synthesis/page.tsx` (Server Component). |
| **Daten-Quelle** | `getStudySynthesis(orgId, planId)` in `src/lib/synthesis/service.ts:52` — liest aus Tabelle **`study_synthesis`** (persistiert, **nicht** on-demand beim Seitenaufruf). On-demand-Erzeugung läuft separat über `synthesizeStudy()` (`src/lib/synthesis/engine.ts:479`), getriggert per `POST /api/research/plans/[id]/synthesis`. |
| **Render-Komponenten** | `SynthesisThemeCard` (`src/components/dashboard/SynthesisThemeCard.tsx`, expandierbare Theme-Karte mit Zitaten + Quell-IDs); `TensionSidePanel` (inline in `page.tsx:305`); dazu interaktive Panels: `UpdateSynthesisButton`, `ExportSynthesisPdfButton`, `ExportSynthesisPptxButton`, `ChatWithDataPanel`, `HighlightReelPanel`. |
| **Daten-Shape** (`StudySynthesisRecord`) | `id`, `org_id`, `plan_id`, `overview: string\|null`, `emergent_themes: EmergentTheme[]`, `tensions: Tension[]`, `based_on_count: number`, `synthesized_at: string\|null`, `model: string\|null`. |
| `EmergentTheme` | `{ title, summary, frequency, sourceInsightIds: string[], quotes: string[] }` |
| `Tension` | `{ description, side_a: {label, sourceInsightIds, quotes}, side_b: {…} }` |
| **PII-Lage** | **Keine Roh-Transkripte, keine Namen/E-Mails** in `study_synthesis` (Engine-Cost-Guardrail `engine.ts:472` schließt Transkripte aus). **ABER:** `quotes[]` enthält **wörtliche Teilnehmer-Zitate** (max. 8/Theme, verbatim aus Evidence), und `sourceInsightIds[]` enthält `source_call_id`-Werte (opake IDs, keine Namen — aber Re-Identifikations-Risiko in kleinen Samples). |
| **Auth heute** | Server Component ruft `requireOrgId()` (`src/lib/auth/org.ts:74`) → Clerk `auth()` + Org-Auflösung. Bei `no_auth` → `/sign-in`, bei `no_org` → `/onboarding/create-org`. Daten org-scoped via `getResearchPlan(orgId, planId)` + RLS-Policy `study_synthesis_org_isolation` (`org_id = current_org_id()`). |

### 1.2 Unauthentifizierter Zugriff heute: `/interview/[token]` (die Blaupause)

Das Projekt hat **bereits einen produktiven public, token-basierten Pfad** — er ist die direkte Vorlage.

- **Route:** `src/app/interview/[token]/page.tsx` (Page) + `src/app/api/interview/[token]/route.ts` (API).
- **Kein Clerk-Zwang:** Middleware liegt in **`src/proxy.ts`** (nicht `middleware.ts`!) — `clerkMiddleware()`
  **ohne** `publicRoutes`-Config. Die Seite ruft **nie** `auth()`/`currentUser()`, also greift Clerk faktisch
  nicht ein. Schutz passiert auf Datenebene über den unguessable Token, nicht auf HTTP-Ebene.
- **Token-Generierung:** `randomBytes(32).toString("base64url")` (256-bit, URL-safe) —
  `src/lib/voice-agent/session-service.ts:129` (`generateToken()`) bzw. analog in
  `src/lib/research/research-orchestration.ts`.
- **Token-Lookup:** `getPublicSession(token)` (`session-service.ts:372`) → `loadByToken()` via
  **Service-Role-Client** `createResearchSupabase()` (`src/lib/research/db.ts:482`, nutzt
  `SUPABASE_SERVICE_ROLE_KEY`, **bypassed RLS**). Query: `.eq("access_token", token).maybeSingle()`.
  **Kein `org_id` im WHERE** — Besitz des Tokens = Zugriff (Capability-URL-Modell). Keine Enumeration.
- **Service-Role-Client allgemein:** `createAdminSupabaseClient()` in `src/lib/supabase/admin.ts:16`
  (`"server-only"`, kein Clerk-Import) ist der kanonische Pfad für RLS-Bypass im App-Code.
- **i18n ohne Account/Cookie:** Locale kommt aus `interview_sessions.language` (`"de"|"en"`), **nicht**
  aus Cookie. `page.tsx:92` setzt `const locale = session.language` und wrappt **explizit** einen
  `NextIntlClientProvider` mit **nur dem `interview`-Namespace**:
  `messages={{ interview: MESSAGES[locale].interview }}`. Capability-Links sind `robots: {index:false}`.
- **Token-Speicher:** `interview_sessions.access_token text not null unique`
  (`supabase/migrations/20260529000000_interview_sessions.sql:18`); zusätzlich
  `research_invites.access_token` (sparse-unique, `20260615000000_research_invite_access_token.sql`).
- **Kein Expiry/Revoke heute:** Weder `interview_sessions` noch `research_invites` haben
  `expires_at`/`revoked` — Tokens leben unbegrenzt (bewusst, weil 256-bit-Capability).

### 1.3 Infrastruktur-Fakten

- **Auth-Provider:** Clerk (`@clerk/nextjs@^7.3.5`), Middleware in `src/proxy.ts`.
- **Supabase-Clients:** (a) Browser-anon (`src/lib/supabase/client.ts`, Clerk-JWT, RLS), (b) Server-anon
  (`src/lib/supabase/server.ts`, Clerk-JWT, RLS), (c) **Service-Role** (`src/lib/supabase/admin.ts`,
  RLS-Bypass) bzw. `createResearchSupabase()` in `src/lib/research/db.ts`.
- **Bestehende Token-Tabellen, an die angedockt werden könnte:** `interview_sessions.access_token`,
  `research_invites.access_token`. **Keine** generische `share_tokens`/`slug`-Tabelle vorhanden.
- **Relevante Tabellen:** `research_plans` (org_id **nullable**, RLS org-isolation),
  `study_synthesis` (org_id **not null**, `unique(org_id, plan_id)`, RLS org-isolation),
  `research_invites`, `interview_sessions`. Migrations in `supabase/migrations/`
  (u.a. `20260611…_research_layer.sql`, `20260617…_study_synthesis.sql`).
- **i18n:** `next-intl@4.13.0`, Plugin → `src/i18n/request.ts` (Cookie `findr.locale`, Default `"en"`,
  Locales `["de","en"]`, **kein** `[locale]`-URL-Segment). `MESSAGES` aus `messages/de.json` / `messages/en.json`.
  `translate()` (`src/i18n/messages.ts`) für Kontexte außerhalb des Request-Scopes (Mails, `generateMetadata`).

---

## 2. Mechanik-Vorschlag (empfohlen)

**Public Read-Only Pfad analog `/interview/[token]`:**

```
GET /shared/synthesis/[token]
  → Server Component
  → getSharedSynthesis(token)              // NEU: Token-Service, Service-Role, kein Clerk
       1. createAdminSupabaseClient()       // RLS-Bypass (bestehender Pfad)
       2. SELECT * FROM synthesis_shares WHERE token = :token  (maybeSingle)
       3. Guards: row? / revoked? / expired?   → sonst notFound()
       4. SELECT … FROM study_synthesis WHERE id = share.synthesis_id (oder org_id+plan_id)
       5. Map → PublicSynthesisView (gefiltertes DTO, s. §4)
  → NextIntlClientProvider locale={share.language} messages={{ shared: MESSAGES[locale].shared }}
  → <SharedSynthesisView …/>             // read-only, KEINE interaktiven Elemente
  robots: { index:false, follow:false }
```

**Bewusst weggelassen** (DSGVO + Read-Only-Charakter): kein `ChatWithDataPanel`, kein
`UpdateSynthesisButton`, kein `HighlightReelPanel`, keine Export-Buttons mit Account-Bezug,
keine `sourceInsightIds`, keine Roh-Transkripte, keine Account-/Deal-Navigation.

**Warum Service-Role statt anon+RLS:** Identisch zur Interview-Begründung — ohne eingeloggten User
gibt es keinen `current_org_id()`-Kontext, RLS würde alles blocken. Der Token IST die Berechtigung;
der Lookup ist immer auf die **eine** Zeile zum Token gescoped, nie enumerierbar.

---

## 3. Datenmodell

### 3.1 Neue Tabelle `synthesis_shares` (Migration nur SKIZZIERT — NICHT geschrieben)

```sql
-- SKIZZE, nicht ausführen:
create table synthesis_shares (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,              -- randomBytes(32).base64url
  org_id        uuid not null references organizations(id) on delete cascade,
  plan_id       uuid not null references research_plans(id) on delete cascade,
  synthesis_id  uuid references study_synthesis(id) on delete set null,  -- s. §5 „neu-generiert"
  language      text not null default 'en' check (language in ('de','en')),
  show_quotes   boolean not null default false,    -- DSGVO-Opt-in für Zitate (§4)
  created_by    text,                              -- Clerk userId (Audit)
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,                       -- optional, Phase 2
  revoked_at    timestamptz                        -- optional, Phase 2
);
create index on synthesis_shares (org_id);
create index on synthesis_shares (plan_id);
-- RLS: org-isolation für das Erstellen/Verwalten im Dashboard …
alter table synthesis_shares enable row level security;
create policy synthesis_shares_org_isolation on synthesis_shares
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
-- … der PUBLIC-Pfad liest NICHT über RLS, sondern via Service-Role nach token (wie Interview).
```

**Designentscheidung — eigene Tabelle statt Spalte auf `study_synthesis`:**
- Erlaubt **mehrere** Links pro Synthese (verschiedene Stakeholder, unterschiedliche `show_quotes`/Ablauf).
- Erlaubt **Revoke** ohne die Synthese selbst zu berühren.
- Überlebt Re-Synthese (FK auf `plan_id` bleibt stabil; `synthesis_id` optional, s. §5).
- Bleibt **additiv** (keine Änderung an bestehenden Tabellen) → keine Kollision mit anderen Etappen.

**Zugriffsmodell:** Public-Read über Service-Role nach `token` (RLS-Bypass, exakt wie Interview);
Dashboard-Verwaltung (Liste/Erstellen/Revoke) über den normalen RLS-Server-Client.

---

## 4. Was der Share-Link zeigt vs. NICHT zeigt (DSGVO-kritisch)

| Feld | Public-Link? | Begründung |
|---|---|---|
| `overview` (Narrativ) | ✅ **JA** | Verdichtete Synthese, kein Personenbezug. Kern des Mehrwerts. |
| `emergent_themes[].title` / `.summary` | ✅ **JA** | Aggregiert, anonym. |
| `emergent_themes[].frequency` | ✅ **JA** | Reine Zahl. ⚠️ Bei sehr kleinem Sample im UI ggf. „n<X" maskieren. |
| `tensions[].description` / `side.label` | ✅ **JA** | Aggregierte Lager-Beschreibung. |
| `based_on_count` | ✅ **JA** | „Basierend auf N Interviews" — anonym. |
| `quotes[]` (wörtliche Zitate) | ⚠️ **OPT-IN** (`show_quotes`, Default AUS) | **Personenbeziehbar** (Sprache, Rolle, Detail → Re-Identifikation möglich, gerade in B2B-Enterprise mit kleinen Samples). Default raus; pro Link bewusst freischaltbar. |
| `sourceInsightIds[]` (`source_call_id`) | ❌ **NEIN** | Interner Identifikator, kein Stakeholder-Mehrwert, Re-ID-Vektor. |
| Roh-Transkripte | ❌ **NEIN** | In `study_synthesis` ohnehin nicht vorhanden — bleibt so. |
| Account-/Deal-Daten, Org-Name intern | ❌ **NEIN** | Out of scope, Datenleck-Risiko. |
| `model`, `synthesized_at` (intern) | ❌ **NEIN** | Optional als „Stand: <Datum>" anonymisiert, sonst raus. |

**Klarer Vorschlag:** Pilot zeigt **nur** Narrativ + Themen + Tensions + `based_on_count`.
Zitate sind ein **bewusstes Opt-in pro Link** (`show_quotes`), nie Default — die DSGVO-Default-to-privacy-Linie.
Wenn Zitate an sind: im UI klarer Hinweis „anonymisierte Zitate, keine Zuordnung zu Personen" und
**keine** `sourceInsightIds`.

---

## 5. Genaue Datei-Liste (Bau ANFASSEN / ANLEGEN)

### Neu anlegen (disjunkt — sofort baubar, KEINE Etappe-5-Kollision)
| Datei | Zweck |
|---|---|
| `supabase/migrations/<ts>_synthesis_shares.sql` | Tabelle aus §3 (Migration). |
| `src/lib/synthesis/share-service.ts` | `createSynthesisShare()`, `getSharedSynthesis(token)`, `revokeSynthesisShare()`, `listSharesForPlan()`. Token-Gen via `randomBytes(32).base64url`. Service-Role-Lookup analog `getPublicSession`. |
| `src/app/shared/synthesis/[token]/page.tsx` | Public Server Component (kein Clerk), `NextIntlClientProvider` mit `shared`-Namespace, `robots:{index:false}`. Vorbild: `src/app/interview/[token]/page.tsx`. |
| `src/components/shared/SharedSynthesisView.tsx` | **Read-only** Render (Narrativ/Themen/Lager). Abgespeckte Variante — siehe Wiederverwendungs-Hinweis unten. |
| `messages/de.json` / `messages/en.json` (Ergänzung `shared`-Namespace) | i18n-Strings für Public-View. ⚠️ **Diese Dateien ändert Etappe 5 ebenfalls → Merge-Konflikt-Risiko.** |

### Bestehend anfassen (⚠️ KOLLIDIERT mit Etappe 5 → erst NACH deren Merge)
| Datei | Was | Etappe-5-Status |
|---|---|---|
| `src/app/(dashboard)/dashboard/research-plans/[id]/synthesis/page.tsx` | „Link teilen"-Button einhängen | **🔴 Etappe 5 ändert diese Datei (uncommitted)** |
| `src/components/dashboard/SynthesisThemeCard.tsx` | ggf. Read-Only-Variante ableiten/wiederverwenden | **🔴 Etappe 5 ändert diese Datei** |
| `src/components/dashboard/ExportSynthesisPdfButton.tsx` u.a. | Muster für neuen „Share-Link erstellen"-Button | **🔴 Etappe 5 ändert diese Buttons** |
| ggf. `SynthesisThemeCard` → neue `SharedSynthesisThemeCard` (Fork ohne IDs/Interaktion) | Wiederverwendung der Render-Logik | **🔴 Quelle wird gerade umgebaut** |

### Neu anlegen (Dashboard-seitig, leichte Kollision über gemeinsame `page.tsx`)
| Datei | Zweck |
|---|---|
| `src/components/dashboard/CreateShareLinkButton.tsx` | „Link erstellen"-Button (Client), POST auf neue API. Vorbild bestehender `*Button.tsx`. |
| `src/app/api/research/plans/[id]/share/route.ts` | Authentifizierte API (Clerk + `requireOrgIdOrError`) zum Erstellen/Listen/Revoke von Shares. |

> **Etappe-5-Kollisions-Fazit:** Etappe 5 (`../findr-i18n5`, Branch `feat/i18n-etappe5`) hat
> **uncommittete** Änderungen an `synthesis/page.tsx`, `SynthesisThemeCard.tsx`, allen Synthese-Buttons
> sowie an `messages/{de,en}.json`. Jeder Bauteil, der diese Dateien anfasst oder wiederverwendet, ist
> **erst nach Etappe-5-Merge** sauber baubar. **Disjunkt und sofort baubar** sind: Migration,
> `share-service.ts`, die Public-Route `/shared/synthesis/[token]`, und ein **eigenständiger**
> `SharedSynthesisView` (nicht aus `SynthesisThemeCard` abgeleitet) — sowie die Share-API-Route.

---

## 6. Knackpunkte

1. **i18n ohne Account/Cookie:** Stakeholder hat kein `findr.locale`-Cookie und keine Org-Locale.
   → Sprache **im `synthesis_shares.language`** persistieren (Forscher wählt bei Link-Erstellung) und
   wie bei `/interview` einen **expliziten `NextIntlClientProvider`-Subtree** mit nur dem `shared`-Namespace
   setzen — **nicht** auf `request.ts`/Cookie verlassen.
2. **Sicherheit:** Token = 256-bit `randomBytes(32).base64url` (nicht erratbar), `unique`, kein Enumerate,
   Lookup immer Single-Row nach Token. `robots:{index:false}`. **Revoke** über `revoked_at`-Guard,
   **optionaler Ablauf** über `expires_at`-Guard im Service. Service-Role-Client **nur** server-seitig,
   nie an den Client.
3. **Kein Org-übergreifendes Leck:** Public-Pfad liest exakt eine Zeile via Token; der zugehörige
   `study_synthesis`-Record wird über `share.synthesis_id`/`share.org_id+plan_id` gezogen — kein
   Cross-Org-Join, keine Liste.
4. **Gelöschte / neu-generierte Synthese:** `study_synthesis` ist `unique(org_id, plan_id)` und wird per
   **Upsert** überschrieben (Re-Synthese ändert Inhalt, ggf. `id`). → Share an **`plan_id`** binden
   (stabil) und beim Lesen die **aktuelle** Synthese zum Plan ziehen; `synthesis_id` nur als Audit/Snapshot.
   Falls keine Synthese (mehr) existiert (`synthesized_at IS NULL` oder Plan gelöscht) → freundliche
   „nicht (mehr) verfügbar"-Seite statt 500. **Entscheidung offen:** Live-Sicht (immer aktuell) vs.
   eingefrorener Snapshot — Pilot empfiehlt **Live-Sicht an `plan_id`** (einfacher, kein Snapshot-Storage).
5. **Zitate-DSGVO:** Default `show_quotes = false` (s. §4); Opt-in muss im Erstell-Flow bewusst gesetzt
   werden, mit Hinweistext.
6. **`messages/*.json`-Konflikt:** Sowohl Etappe 5 als auch dieser Bau erweitern die Message-Dateien →
   nach Etappe-5-Merge den `shared`-Namespace additiv ergänzen.

---

## 7. Etappierung

**Pilot (sofort baubar, disjunkt zu Etappe 5):**
1. Migration `synthesis_shares` (token, plan_id, org_id, synthesis_id, language, show_quotes,
   created_at, + Felder für späteres expires/revoke).
2. `share-service.ts` (Token-Gen, Service-Role-Lookup, Guards).
3. Public-Route `/shared/synthesis/[token]` + **eigenständiger** `SharedSynthesisView` (Narrativ + Themen +
   Tensions; Zitate nur wenn `show_quotes`; keine IDs/Interaktion). `NextIntlClientProvider`-Subtree.

**Danach (erst NACH Etappe-5-Merge — Synthese-UI-Kollision):**
4. „Link erstellen"-Button in `synthesis/page.tsx` + `CreateShareLinkButton.tsx` + Share-API-Route.
5. `shared`-Namespace in `messages/{de,en}.json` (additiv, nach Merge).

**Phase 2 (Ausbau):**
6. Ablauf (`expires_at`) + Revoke-UI (Link-Liste pro Plan).
7. Optionaler Passwortschutz.
8. Branding / White-Label des Public-Views — **Overlap mit White-Label-Plan** (`../findr-wl`):
   Findr-Branding entfernen / Org-Logo. Mit White-Label-Plan abstimmen, **nicht** doppelt bauen
   (das `brandless`-Pattern aus `InterviewChat` ist hier Vorlage).

---

## 8. Meldung (Zusammenfassung)

- **Empfohlene Mechanik:** Token-Public-Pfad `/shared/synthesis/[token]` 1:1 analog `/interview/[token]`
  (Service-Role-Client, kein Clerk, `NextIntlClientProvider`-Subtree, Token = 256-bit `randomBytes`).
  Eigene additive Tabelle `synthesis_shares` (Link an `plan_id`, Live-Sicht auf aktuelle Synthese).
- **Zeigt:** Narrativ (`overview`), Themen (Titel/Summary/Frequency), Tensions (Lager A/B), `based_on_count`.
  **Zeigt NICHT:** Roh-Transkripte (gibt's nicht), `sourceInsightIds`, Account-/Deal-Daten. **Zitate nur
  als bewusstes Opt-in pro Link** (`show_quotes`, Default AUS — DSGVO/personenbeziehbar).
- **Kollidiert mit Etappe 5** (`feat/i18n-etappe5`, uncommitted): `synthesis/page.tsx`,
  `SynthesisThemeCard.tsx`, alle Synthese-Buttons, `messages/{de,en}.json`. → „Link erstellen"-Button,
  Komponenten-Wiederverwendung und Message-Strings **erst nach Etappe-5-Merge**. Token-Tabelle,
  Token-Service, Public-Route und eigenständiger Read-Only-View sind **sofort** baubar.
