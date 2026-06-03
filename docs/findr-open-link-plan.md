# Findr Offener Studien-Link (Phase 4, Baustein 2) — Plan

> Status: **PLAN, kein Code.** Diese Datei ist die einzige, die entsteht.
> Geschrieben ehrlich und abwägend. **🔶 ANNAHME** = gemeinsam zu entscheiden (André + Claude),
> **⚠️ RISIKO** = teuer/heikel/unsicher. Alle Code-Verweise sind am echten Stand von `main`
> (Commit `e2be868`, Screening E1–E4 ist **gemerged**) gegroundet; Datei:Zeile-Angaben spiegeln den
> heutigen Repo-Zustand. **Mandantentrennung ist der rote Faden dieses Plans — sie steht im Zentrum,
> nicht am Rand.**

---

## 0. Kontext, Ziel — und drei Korrekturen vorab, die alles Weitere prägen

**Ziel (aus dem Brief):** Heute kommen Teilnehmer **nur** per individuellem Invite-Token rein
(`research_invites.access_token`, 1:1 pro Person). Neu: **EIN** studienweiter Link, über den
**beliebig viele anonyme Walk-ins** teilnehmen können (z. B. in einer Community gepostet). Der
reservierte mandantenlose Pfad (`research_plans.org_id = NULL`) ist heute bewusst **fail-closed** und
soll für diesen Baustein **sicher geöffnet** werden. **Das ist der heikelste Baustein:** ein Fehler
beim Öffnen des mandantenlosen Pfads wäre ein **Mandantentrennung-Leck** (Zugriff auf Daten anderer
orgs).

Beim Grounden im echten Code sind drei Dinge aufgefallen, die das Vorgehen prägen. Eines davon
**dreht die zentrale Sicherheits-Strategie um**.

### Korrektur 1 — „den null-org-Pfad öffnen" ist das gefährlichste, was man tun kann. Wir liefern das Ziel, ohne das Risiko einzugehen.

Die Sperre des mandantenlosen Pfads ist **kein RLS-Mechanismus**, sondern eine **explizite
App-Prüfung** `if (!invite || !invite.org_id) return null` — an drei Stellen: `getPublicSession`
(`session-service.ts:403`), `resolvePublicEntry` (`session-service.ts:501`) und der Screening-Gate
`POST /api/interview/[token]/screen` (`screen/route.ts:61`, 404). Sie ist **load-bearing**, weil der
**gesamte** öffentliche Pfad über den **Service-Role-Client** `createResearchSupabase()`
(`db.ts:581`) läuft, der **RLS umgeht**. Das heißt: auf diesem Pfad ist RLS *nicht* die
Schutzschicht — die manuelle Prüfung ist es.

Den null-org-Pfad „öffnen" hieße also, **diesen Guard zu lockern** — unter einem Client, der RLS
bypassed. Das ist die gefährlichste Einzeländerung, die im ganzen Repo möglich ist: `research_plans`
**und** `research_invites` haben `org_id` **NULLABLE** (`20260611000000_research_layer.sql`), und eine
Service-Role-Query **ohne** org-Filter gegen diese Tabellen liefert **alle orgs + die null-org-Zeilen**
zurück. Genau davor schützt heute der Guard.

> **⚠️ RISIKO (das tragende — Datenleck) → entschärft durch Design:** Statt den null-org-Guard zu
> lockern, modellieren wir den offenen Link als **eigene, dedizierte Tabelle `research_open_links` mit
> `org_id NOT NULL`** (Details §2). So existiert auf dem Walk-in-Pfad **nie eine null-org-Zeile**, der
> Footgun kann gar nicht greifen, und der bestehende `!invite.org_id`-Guard bleibt **byte-identisch
> unangetastet**. Wir liefern das **Ziel** (offener Studien-Link), ohne das **Risiko** (Relaxen des
> null-org-Guards unter Service-Role) einzugehen. Das ist die zentrale These dieses Plans.

### Korrektur 2 — Der „Ergebnis-Speicher für anonyme Walk-ins" ist am Datenlayer fast schon gelöst

Der Brief nimmt an: „Heute hängt alles am `invite_id`-Anker." Im Code stimmt das **nur für die
Eintritts-Naht**, nicht für die Speicherung:

- `interview_sessions.invite_id` ist **NULLABLE, ON DELETE SET NULL, nicht unique**
  (`20260612000000_interview_sessions_flow_mode.sql:54-59`) — eine Session **ohne** Invite ist
  schon schematisch erlaubt.
- `createResearchInterview` hat **schon** einen Ad-hoc-Pfad für `inviteId: null`
  (`research-orchestration.ts:82-84`); `createInterviewSession` defaultet `inviteId ?? null` und
  `accessToken ?? generateToken()` (`session-service.ts:315-336`).
- `evaluateScreening(questions, answers)` (`evaluate.ts:27`) und `recordScreeningResponse(orgId,
  planId, verdict)` (`screening-responses.ts:15`) sind **eintritts-pfad-agnostisch** — kein
  `invite_id`, keine Identität.

**Konsequenz:** Brocken 3 ist **kleiner** als der Brief vermutet. Die eigentliche Arbeit steckt in
Brocken 1 (die **Eintritts-/Resolution-Naht**, die heute hart über `findInviteByAccessToken` läuft)
und Brocken 2 (Anti-Gaming, eine **grüne Wiese**).

### Korrektur 3 — Status-Korrektur: Screening (Baustein 1) ist gemerged

`MEMORY.md` beschreibt Screening E4 noch als „unmerged auf Worktree". Das ist **stale**: E4 ist auf
`main` als HEAD `e2be868` gemerged (Migration `20260628000000_screening.sql` angewandt). Dieser Plan
groundet am gemergten Stand. (Memory-Notiz wird aktualisiert.)

---

## 1. Bestandsaufnahme — Teilnehmer-Eintritt heute & der fail-closed null-org-Pfad (gegroundet)

### 1.1 Der echte per-Invite-Eintritt heute

| # | Schritt | Datei:Zeile |
|---|---|---|
| 1 | Invite + 256-bit-Token bei Einladung erzeugt (`randomBytes(32).toString("base64url")`) | `research-orchestration.ts:246` (`createResearchInvite`) |
| 2 | Teilnehmer öffnet `/interview/[token]` → Server-Page | `src/app/interview/[token]/page.tsx:80-130` |
| 3 | `resolvePublicEntry(token)` (per-render via `React.cache`) → `{mode:"session"}` / `{mode:"needs_screening"}` / `null`→`notFound()` | `session-service.ts:491-522`, `page.tsx:24` |
| 4 | Token-Lookup: erst `loadByToken` (bestehende Session), sonst `findInviteByAccessToken` — **token-only, org-agnostisch** | `session-service.ts:224-245`, `scheduling.ts:150-161` |
| 5 | **NULL-ORG-GUARD:** `if (!invite || !invite.org_id) return null` | `session-service.ts:403` (getPublicSession), `:501` (resolvePublicEntry) |
| 6 | `getResearchPlan(invite.org_id, invite.plan_id)` — **2. strukturelle org-Schranke** (`.eq("org_id").eq("id")`) | `plans-service.ts:103-122` |
| 7 | Screening konfiguriert? → `needs_screening` (keine Session, kein Opus-Turn); sonst Lazy-create | `session-service.ts:410-426`, `:491-516` |
| 8 | Gate: `POST /api/interview/[token]/screen` → re-runs Guard (`:61` → 404) → `evaluateScreening` (deterministisch) | `screen/route.ts:42-114` |
| 9 | **qualifiziert:** `createResearchInterview({orgId, planId, inviteId, screeningAnswers})` → `createInterviewSession` INSERT (`org_id` **NOT NULL**) + 1 anonyme `qualified`-Quote | `research-orchestration.ts:91-204`, `session-service.ts:252-344`, `screen/route.ts:78-101` |
| 10 | **abgewiesen:** keine Session, nur 1 anonyme `rejected`-Quote (`org_id, plan_id, verdict`) | `screening-responses.ts:15-27` |

Der Chat danach läuft über `GET/POST /api/interview/[token]` → `getPublicSession` → `advanceInterview`
(`route.ts:24-110`).

### 1.2 Wo genau der null-org-Pfad gesperrt ist — und was sich ändern müsste

Drei identische Guards (§1.1 Schritt 5/8) blockieren `org_id = NULL`. Der Code benennt es wörtlich:
*„OR the invite has no org_id (reserved for the future external-research path that hasn't been wired
yet)."* (`session-service.ts:403-408`). Die Migration dokumentiert die Absicht
(`20260611000000:7-18`): null-org-Zeilen fallen unter RLS implizit durch (`NULL = current_org_id()`
→ `NULL` → `FALSE`) — **aber nur für den anon-key-Dashboard-Client**, nicht für den Service-Role-Pfad.

**Was sich ändern müsste, um den null-org-Pfad *direkt* zu öffnen:** den `!invite.org_id`-Guard
relaxen **und** eine alternative org-Auflösung für null-org-Zeilen bauen **und** unter Service-Role
eine neue Isolations-Garantie erfinden (RLS hilft hier nicht). **Das tun wir bewusst NICHT** (§0
Korrektur 1, §2.1). Der Guard bleibt; der offene Link bekommt einen **eigenen, physisch getrennten**
Pfad mit `org_id NOT NULL`.

### 1.3 Der Service-Role-Client & die manuelle Mandantentrennung (wird wiederverwendet)

Drei Isolationsschichten existieren heute (gegroundet):

1. **RLS** (`current_org_id()`, `initial_schema.sql:197-209`) — aktiv **nur** für den anon-key
   + Clerk-Token-Client (`server.ts:19-31`). Für die Research/Interview/Screening-Fläche **nicht** die
   tragende Schicht.
2. **Manueller `.eq("org_id", orgId)`-Filter** — die **reale** Schranke auf der Research-Fläche, weil
   der Service-Role-Client (`db.ts:581`, `admin.ts:16-34`) **RLS umgeht**. `orgId` stammt **immer
   server-seitig** (Clerk-Session oder `invite.org_id`), **nie** aus dem Request-Body.
   `getResearchPlan` (`plans-service.ts:117`) verlangt `orgId` als **Pflicht-Argument** — kein Overload
   lässt es weg.
3. **Capability-Token** — öffentliche Reads (`loadByToken`, `findInviteByAccessToken`) filtern **nicht**
   nach org (die Seite kennt die org nicht), matchen aber **genau eine** Zeile per unrate­barem
   256-bit-Token via `.maybeSingle()`; nie enumerieren, nie eine Request-org_id vertrauen. Die
   interne org-UUID wird **vor jeder public JSON** gestrippt (`route.ts:41,89`).

**Der offene Link erbt alle drei Muster unverändert** — er erfindet kein neues Vertrauensmodell.

### 1.4 Was schon da ist vs. neu

| Baustein | Status | Detail |
|---|---|---|
| `evaluateScreening` (rein, no-AI, identitätsfrei) | **exists** | `evaluate.ts:27-73`; nimmt nur (Fragen + Antworten). Verbatim wiederverwendbar. |
| `recordScreeningResponse(orgId, planId, verdict)` | **exists** | `screening-responses.ts:15-27`; **kein** `invite_id`. Verbatim wiederverwendbar. |
| `createResearchInterview` mit `inviteId: null` (Ad-hoc) | **exists** | `research-orchestration.ts:82-84`; Engine akzeptiert invite-lose Sessions schon. |
| `interview_sessions` invite-los (invite_id/plan_id NULLABLE) | **exists** | `20260612000000:54-59`; `org_id` **NOT NULL** (`20260529000000:13`). |
| Service-Role + manuelle org-Filter + Token-Capability-Muster | **exists** | §1.3. Wird geerbt. |
| White-label-Branding (`getOrgBranding` + `--brand-accent`) | **exists** | über server-seitige `org_id`; zieht für die Open-Link-Seite genauso. |
| Studienweiter offener Token (`research_open_links`) | **new** | Keine Tabelle/Spalte. **Kern dieses Baus** (§2). |
| Open-Link-Resolver (`findOpenLinkByAccessToken`) + Eintritts-Route | **new** | `findInviteByAccessToken` ist heute der einzige Resolver. |
| Walk-in-Session-Attribution (`interview_sessions.open_link_id`) | **new** | Additive nullable FK (§2.3). |
| Anti-Abuse (Rate-Limit/IP/Captcha/WAF/Cooldown) | **new** | **Nichts** existiert (grüne Wiese, §3). `proxy.ts` = bare `clerkMiddleware`, `vercel.json` = nur Crons. |
| Researcher-UI „Link erzeugen/widerrufen" | **new** | Spiegelt `PlanQuotaPanel`/`ScreeningQuestionsPanel` (§5). |

---

## 2. Brocken 1 — Mandantenlosen Pfad SICHER bedienen (Datenmodell + Isolation) — der wichtigste Teil

### 2.1 Die zentrale Sicherheits-Entscheidung: KEINE null-org-Zeile, dedizierte NOT-NULL-org-Tabelle

Aus drei unabhängigen Design-Vorschlägen ist die Wahl eindeutig (Begründung unten):

- **NICHT** den reservierten `research_invites.org_id = NULL`-Pfad öffnen (Footgun unter Service-Role,
  §0/§1.2).
- **NICHT** `research_invites` mit einem `is_open`-Flag überladen + pro Walk-in Kind-Zeilen
  materialisieren (verworfener Vorschlag): das überlädt die Invite-Semantik, zwingt zum Audit **aller**
  `research_invites`-Leser (u. a. der Reminder-Cron `listInvitesDueForReminder` und die
  Teilnehmerliste `listInvitesForPlan`, `scheduling.ts:174`), und sein Fehlermodus ist
  **cross-participant-Datenleck innerhalb derselben org**, falls der geteilte Template-Token je zum
  Session-Token würde. Verstößt gegen „additiv, Bestandspfade nicht anfassen".
- **JA:** eine **dedizierte Tabelle `research_open_links` mit `org_id NOT NULL`** und ein **physisch
  getrennter** Eintritts-Pfad. `org_id NOT NULL` verschiebt die „ist die org da?"-Frage von einer
  **Laufzeit-Prüfung** (wie beim nullable Invite) zu einer **Schema-Constraint beim Schreiben** —
  strukturell schwerer zu umgehen.

> 🔶 **ANNAHME (Architektur-Kern, zur Bestätigung):** dedizierte `research_open_links`-Tabelle
> (`org_id NOT NULL`) + getrennter Eintritts-Pfad. Dies ist die **empfohlene** Variante; alle weiteren
> §-Verweise bauen darauf. (Die zwei Alternativen oben sind bewusst abgelehnt.)

### 2.2 `research_open_links` (Schema)

```
research_open_links (
  id           uuid PK,
  org_id       uuid NOT NULL  → organizations(id) on delete cascade,   -- die ganze Sicherheits-Aussage
  plan_id      uuid NOT NULL  → research_plans(id) on delete cascade,  -- die EINE Studie
  access_token text NOT NULL,                                          -- 256-bit base64url, sparse-unique
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),  -- Kill-Switch
  max_sessions int,            -- NULL = open-ended; strukturelle Anti-Abuse-Bremse (§3)
  valid_until  timestamptz,    -- NULL = kein Ablauf (additiv, optional — 🔶 ANNAHME §8)
  label        text,           -- nur Dashboard-Kosmetik
  created_at   timestamptz NOT NULL DEFAULT now()
)
```

- `org_id`/`plan_id` werden bei Link-Erzeugung **server-seitig aus dem Plan kopiert** (denormalisiert),
  **nie** vom Caller akzeptiert. Token-Form identisch zu überall: `randomBytes(32).toString("base64url")`
  (`research-orchestration.ts:246`, `session-service.ts:139`).
- `status='disabled'` = harter Widerruf (ein offener Link ist ein **öffentliches** Credential — anders
  als ein one-shot-Invite widerruft er sich nicht von selbst).
- **Defense-in-Depth gegen Denorm-Drift:** selbst wenn `research_open_links.org_id` je falsch zum Plan
  stünde, macht `getResearchPlan(link.org_id, link.plan_id)` (`.eq("org_id").eq("id")`) jede Drift
  **fail-closed** → `plan_not_found`, keine Session.

### 2.3 Walk-in-Session-Attribution: additive `open_link_id`-Spalte

```
interview_sessions.open_link_id uuid NULL  → research_open_links(id) on delete set null
```

Spiegelt exakt das `invite_id`-Muster (`20260612000000:57-59`, nullable, SET NULL, partial index). Gibt
jeder Walk-in-Session einen sauberen, org-scoped Rückbezug auf ihren Link (und über dessen
**NOT-NULL** `org_id`/`plan_id` auf die Studie), **ohne** Personen-Identität. Besser als reine
`(org_id, plan_id)`-Zuordnung, weil der Researcher Walk-ins von per-Invite-Sessions unterscheiden kann.

### 2.4 Additive Migration (Skizze — André wendet sie selbst im SQL-Editor an)

Eine neue Tabelle + eine additive nullable Spalte. Hausstil (`if not exists`, RLS `org_isolation`
gespiegelt von `research_screening_responses` `20260628000000:47-57`, `notify pgrst`), **keine**
Änderung an Bestand:

```sql
-- 202607NN000000_open_link.sql  (additiv, idempotent)
-- Phase 4 Baustein 2 — offener Studien-Link. KEINE null-org-Zeile, NOT-NULL-org by design.

create table if not exists research_open_links (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  plan_id      uuid not null references research_plans(id) on delete cascade,
  access_token text not null,
  status       text not null default 'active' check (status in ('active','disabled')),
  max_sessions int,
  valid_until  timestamptz,
  label        text,
  created_at   timestamptz not null default now()
);

-- ein Token ⇒ eine Zeile (sparse-unique wie research_invites_access_token_idx, 20260615000000)
create unique index if not exists research_open_links_access_token_idx
  on research_open_links (access_token) where access_token is not null;
-- höchstens ein aktiver Link pro Studie (Service-Layer upserted; partial unique hält es hart)
create unique index if not exists research_open_links_plan_active_idx
  on research_open_links (plan_id) where status = 'active';

alter table research_open_links enable row level security;
drop policy if exists research_open_links_org_isolation on research_open_links;
create policy research_open_links_org_isolation
  on research_open_links for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Walk-in-Session-Attribution ohne invite_id (nullable, SET NULL — spiegelt invite_id).
alter table interview_sessions
  add column if not exists open_link_id uuid references research_open_links(id) on delete set null;
create index if not exists interview_sessions_open_link_idx
  on interview_sessions(open_link_id) where open_link_id is not null;

-- research_screening_responses (org_id, plan_id, verdict) wird VERBATIM wiederverwendet — KEINE Änderung.
notify pgrst, 'reload schema';
```

TS-Typen: die hand-gepflegte `DatabaseWithResearch` (`db.ts:579-581`, bis `supabase gen types` läuft)
bekommt `research_open_links` Row/Insert + `interview_sessions.open_link_id` inline-augmentiert —
gleiches Muster wie `screening_answers`/`screening_questions`.

### 2.5 Die Mandantentrennungs-Garantie (Schicht für Schicht) — das Herz des Plans

**Behauptung:** Ein Open-Link-Token für Studie X (org A) kann **ausschließlich** Studie X von org A
erreichen; Studie Y einer anderen org B zu erreichen ist **strukturell unmöglich** — nicht nur
gefiltert.

1. **Keine null-org-Zeile auf diesem Pfad.** `research_open_links.org_id` ist **NOT NULL**. Der
   gefährliche „Service-Role-Query ohne org-Filter liefert cross-tenant + null-org" (§0/§1.2) kann
   **nicht** greifen: es gibt keine null-org-Zeile zum Hineinfallen, und die einzige Query gegen die
   Tabelle ist der Single-Row-Token-Match. Der `!invite.org_id`-Guard auf dem **Invite-Pfad** bleibt
   **byte-identisch** (`session-service.ts:403/:501`, `screen/route.ts:61`).
2. **Token → genau eine Zeile.** `findOpenLinkByAccessToken` macht `.eq("access_token",
   token).maybeSingle()` auf `access_token` (sparse-unique), 256-bit unrate­bar, `status='active'`
   verlangt — identische Posture zu `findInviteByAccessToken` (`scheduling.ts:150`) und `loadByToken`.
   Nie enumerieren. Kein client-gelieferter `org_id` irgendwo auf dem Pfad.
3. **Diese eine Zeile trägt `org_id` + `plan_id`, beide server-gebunden.** Beide werden von der
   Token-Zeile gelesen, **nie** aus dem Request. Der Walk-in kontrolliert nur URL-Token + Screening-
   Antworten (Zod `ScreeningAnswersSchema` — kein org/plan-Feld).
4. **Zweite strukturelle Schranke, geerbt unverändert.** `getResearchPlan(link.org_id, link.plan_id)`
   filtert `.eq("org_id", orgId).eq("id", planId)` (`plans-service.ts:117`). Die **Signatur erzwingt
   `orgId`** — man kann den Filter nicht „vergessen". Ein Plan einer anderen org (oder null-org) → `null`
   → kein `needs_screening`, `createResearchInterview` → `plan_not_found`
   (`research-orchestration.ts:111-118`). Eine Session entsteht **nur**, wenn ein Plan mit **exakt**
   `(org_id = link.org_id AND id = link.plan_id)` existiert.
5. **Die Session wird mit genau diesem `org_id` gestempelt** (`interview_sessions.org_id` **NOT NULL**,
   `session-service.ts:318`). Sie kann nie eine andere org tragen.
6. **Warum „vergessener Filter" nicht lecken kann.** Der **einzige** org-agnostische Read ist der
   Single-Row-Token-Match — er kann nicht enumerieren, es gibt **nichts zu filtern**. Jeder andere
   Read/Write nimmt `orgId` als **Pflicht-Argument** aus der Token-Zeile. Der Service-Role bypassed RLS,
   aber RLS ist hier nicht die tragende Schicht — die Token→Zeile→org-Bindung ist es. (RLS auf
   `research_open_links` bleibt als Defense-in-Depth für den Dashboard-Client.)
7. **Strukturell unmöglich (nicht nur gefiltert):** um org B zu erreichen bräuchte man (a) einen
   256-bit-Token, der org Bs Zeile trifft = man **besitzt schon** org Bs Capability, oder (b) `org_id`/
   `plan_id` in den Request injizieren = es gibt **kein** solches Feld. Die org-UUID wird vor jeder
   public JSON gestrippt (`route.ts:41,89`).

**Kontrast, der den Unterschied macht:** `research_invites.org_id` ist NULLABLE → der `!invite.org_id`-
Guard ist die *Laufzeit*-Kompensation. `research_open_links.org_id` ist NOT NULL → die Kompensation
liegt in der *Schema-Constraint beim Schreiben*. Strikt sicherer.

---

## 3. Brocken 2 — Anti-Gaming bei anonymen Walk-ins (ehrlich abgewogen)

**Bedrohung (ehrlich benannt):** ohne per-Person-Token ist der Link öffentlich teilbar →
(a) **unbounded Anthropic-Spend** (jede qualifizierte Walk-in-Session feuert einen Opus-Eröffnungs-
Turn), (b) **Brute-Force der Screening-Antworten** (Re-Try nach Abweisung ist erlaubt,
`screen/route.ts:35-36`), (c) **Quote-Inflation** (Abgewiesenen-Quote zählt Versuche, nicht Personen).
**Die Mandantentrennung (Brocken 1) ist davon NICHT betroffen** — das ist ein **Volumen-/Kosten**-
Risiko, kein Isolations-Risiko. Wichtig, das sauber zu trennen.

**Bestand (gegroundet): NICHTS.** Kein Rate-Limit, keine IP-/User-Agent-Erfassung, kein Captcha, keine
WAF-Regel im Repo. `proxy.ts` = bare `clerkMiddleware()`; `vercel.json` = nur zwei Crons; `package.json`
hat **keine** upstash/redis/kv/arcjet/captcha-deps. Grüne Wiese.

**v1 — realistisch, ohne neue npm-Dependency:**
- **Screening als primäre Soft-Schranke.** Deterministisch + fail-closed (`evaluate.ts`); erhöht den
  Aufwand pro Walk-in. → 🔶 ANNAHME (§8): offenen Link Screening **voraussetzen**?
- **`max_sessions`-Cap pro Link** (§2.2): reine DB-COUNT auf `open_link_id`, **kein Store nötig**. Über
  Cap → freundliche „Studie ist voll"-Ansicht, keine neue Session. Strukturelle Bremse gegen
  Spend-Explosion.
- **Pflicht-Landing/Start-Step** (ein Klick + Consent, §5): natürlicher Choke-Point gegen versehentliche
  Mehrfach-Erzeugung **und** DSGVO-Hinweis.
- **`status='disabled'` Kill-Switch** (§2.2): sofortiger Widerruf.
- **Vercel WAF Rate-Limit-Rule** scoped auf `/interview/open/*` + `/api/interview/open/*` und **Vercel
  BotID** auf den Submit. Platform-Level, **keine** npm-dep (Dashboard/`vercel.json`). Vercels
  Auto-DDoS-Schutz ist schon an, tut aber nichts app-spezifisches.

**Später — braucht Store/dep/Schema (bewusst nicht v1):**
- per-IP / per-Fingerprint **Cooldown** → braucht Store (Upstash Redis / Vercel KV — **heute keine
  dep**). ⚠️ vor Einbau **STOP + Report** (Stack-Abgleich), nicht raten.
- **Captcha/Turnstile** auf dem Submit (neue dep + DSGVO).
- **IP/UA-Erfassung** für Forensik/Dedup (Schema + DSGVO-Entscheidung; die Quote speichert heute
  bewusst nichts davon).

> **⚠️ RISIKO (Betrieb/Kosten — nicht Isolation):** Dies ist der einzige Brocken mit einem „später".
> Vor Live **MUSS** v1 stehen (WAF-Rule + `max_sessions`-Cap + empfohlen Screening). Sonst ist ein
> geleakter/geteilter Link ein offenes Spend-Tor.

---

## 4. Brocken 3 — Ergebnis-Speicher für anonyme Teilnehmer (Screening verbatim wiederverwendet)

Weil `evaluateScreening`, `recordScreeningResponse` und `createResearchInterview(inviteId:null)` schon
**eintritts-pfad-agnostisch** sind (§0 Korrektur 2), ist das fast reine Wiederverwendung:

- **Qualifizierter Walk-in:** eine `interview_sessions`-Zeile über den **unveränderten**
  `createResearchInterview`→`createInterviewSession`-Pfad mit `invite_id = NULL`, `open_link_id =
  link.id` (additiv), `org_id = link.org_id` (**NOT NULL**), `plan_id = link.plan_id`, **frischem**
  `access_token` (`generateToken()`), `screening_answers` gesetzt. **Einziger Engine-Eingriff:** ein
  additiver, optionaler `openLinkId`-Parameter, durch `createResearchInterview` →
  `createInterviewSession`-INSERT gefädelt (eine nullable-Spalten-Schreibung). Alles andere unberührt.
- **Abgewiesener Walk-in:** **keine** Session, **kein** Opus-Turn, **keine** Antworten — nur **eine**
  anonyme `research_screening_responses`-Zeile (`org_id, plan_id, verdict`, kein `invite_id`, kein
  Profil). `recordScreeningResponse` verbatim.
- **Attribution ohne `invite_id`:** zwei org-scoped Schichten — (a) `interview_sessions.open_link_id`
  (per-Session), (b) anonyme Quote (`org_id, plan_id, verdict`). Beide über die **NOT-NULL**-org der
  Link-Zeile mit der Studie verknüpft, ohne Personen-Identität.
- **Idempotenz/Zählung:** pro Walk-in **frischer** Session-Token → refresh auf dem **Session**-Token
  dedupliziert via `loadByToken` (UNIQUE `access_token`); refresh auf dem **Open-Link**-Token erzeugt
  bewusst eine neue Session (viele Walk-ins = viele Sessions) — der Start-Step-Choke (§3/§5) begrenzt
  versehentliche Mehrfach-Erzeugung. Qualified-Quote wird nur bei `status==='created'` geschrieben
  (`screen/route.ts:97-108`).

> 🔶 **ANNAHME (DSGVO, voll-anonyme Teilnehmer):** ohne Invite gibt es **keine vorab bekannte
> Identität**. Das Transkript kann vom Teilnehmer **freiwillig PII** enthalten → der Landing-Step
> (§5) braucht einen **sichtbaren Datenschutz-/Consent-Hinweis** und eine Rechtsgrundlage. Die anonyme
> Quote speichert by design **kein** PII. `screening_answers` ist heute **write-only** (kein Reader,
> gegroundet) — privacy-favorable; bei Skalierung Retention/Reader klären (§8).

---

## 5. Eintritts-Naht & Routing (die neue, physisch getrennte Naht) + Researcher-UI

### 5.1 Routing — physische Trennung als Sicherheits-Argument

> 🔶 **ANNAHME (empfohlen):** **eigene Route-Familie** `/interview/open/[token]` (Page) +
> `POST /api/interview/open/[token]/screen` (+ ggf. `/start` für screening-lose Links) — **getrennt**
> vom Invite-Pfad. Begründung: die zwei Capabilities bleiben **physisch distinkt**. `findInvite
> ByAccessToken` wird auf dem Open-Pfad **nie** aufgerufen, `findOpenLinkByAccessToken` auf dem
> Invite-Pfad nie. Der `!invite.org_id`-Guard bleibt **byte-identisch**, und es gibt **keinen
> geteilten Branch**, der je auf den null-org-Pfad zurückfallen könnte. (Alternative: einen Open-Branch
> in die bestehenden Resolver einhängen — spart Code, schafft aber eine geteilte Naht. Für den
> heikelsten Baustein ist Trennung den Duplikat-Code wert.)

**Reuse trotz Trennung:** dieselben React-Komponenten (`ScreeningGate`, `RejectionPanel`,
`InterviewChat`), `getOrgBranding`, `evaluateScreening`, `createResearchInterview` werden geteilt — nur
ein **Resolver** (`findOpenLinkByAccessToken` + `resolvePublicOpenEntry`, Klone von
`scheduling.ts:150` / `session-service.ts:491`) und eine dünne **Route-Shell** sind neu. **Nach**
Session-Erzeugung läuft der Walk-in auf dem **bestehenden** `/interview/[sessionToken]`-Pfad
(`getPublicSession`→`loadByToken`, unverändert) — der Open-Link-spezifische Code ist nur der **Eintritt**.

**Hand-off (frischer Session-Token):** qualifiziert → die screen-Route gibt den frischen Session-Token
zurück → Client **redirect** zu `/interview/[sessionToken]`. (Per-Invite reused den Invite-Token, hier
nicht — der Open-Link-Token ist geteilt.)

> **⚠️ RISIKO (cross-participant):** der Open-Link-Token darf **NIE** zum Session-Token werden — sonst
> kollidieren alle Walk-ins auf einer Session (single-seat + Fremd-Daten-Exposition innerhalb der org).
> `resolvePublicOpenEntry`/die create-Route minten **immer** einen frischen Session-Token; ein Test
> assertet, dass kein `interview_sessions.access_token` je einem Open-Link-Token gleicht (§7 E4).

### 5.2 Researcher-UI — offenen Link erzeugen / teilen / widerrufen

Spiegelt das bestehende Muster (`PlanQuotaPanel`, `ScreeningQuestionsPanel`):
- **`src/components/dashboard/OpenLinkPanel.tsx`** — auf der Plan-Detailseite: „Offenen Link erzeugen"
  (mintet Token, kopiert `org_id` **server-seitig** aus dem Plan), shareable URL anzeigen/kopieren,
  `status`-Toggle (active/disabled), optional `max_sessions`/`valid_until`. White-label-Vorschau.
- **`POST /api/research/plans/[id]/open-link`** — spiegelt `quotas`/`screening-questions`-Routes:
  `requireOrgIdOrError` + `getResearchPlan` (Auth/Ownership) → Service-Write. `org_id` **nie** aus dem
  Body — immer aus der Clerk-Session/dem Plan.
- **Platzierung:** neue Sektion auf der Detailseite (z. B. unter „Teilnehmer"/„Screening").

---

## 6. Was bleibt unangetastet

- **Interview-Engine** (`advanceInterview`, `nextResearchMessage`, Turn-Loop, `session-service.ts:566+`)
  — **nicht angefasst**. Qualifizierte Walk-ins laufen **wörtlich** den heutigen
  `createResearchInterview`-Pfad.
- **Studien-Synthese** (`product_discovery_insights`, Stage-1/2) — **nicht angefasst**.
- **Der per-Invite-Pfad** (`createResearchInvite`, `findInviteByAccessToken`, der `!invite.org_id`-
  fail-closed-Guard an `session-service.ts:403/:501` und `screen/route.ts:61`) — **BYTE-IDENTISCH,
  nicht angefasst**. Der offene Link ist ein **zweiter, physisch getrennter** Eintritt, **kein** Umbau.
- **Die Screening-Logik** (`evaluateScreening`, `src/lib/schemas/screening.ts`,
  `recordScreeningResponse`) — **nicht angefasst**, verbatim wiederverwendet (eintritts-pfad-agnostisch).
- **Der reservierte null-org-Pfad** (`research_plans`/`research_invites` mit `org_id = NULL`) bleibt
  **dunkel und unverändert gesperrt** — dieser Bau öffnet ihn bewusst **nicht** (§9).
- **Ehrliche Abgrenzung:** der **einzige** Eingriff in Bestandscode ist die additive, optionale
  `open_link_id`-Schreibung in `createInterviewSession` (+ ein durchgereichter optionaler
  `openLinkId`-Parameter in `createResearchInterview`). Beides ist **no-op**, wenn nicht gesetzt — jeder
  bestehende Aufruf übergibt es nicht und verhält sich unverändert. Es gibt **keinen** geteilten
  Resolver/Route mit dem Invite-Pfad.

---

## 7. Etappen-Plan (jede einzeln verifizierbar)

> Verifikation generell: **`tsc` + echter `next build`** (NIE `pnpm dev`), plus die je Etappe
> genannten Tests. Migration **additiv**, **André wendet sie selbst im SQL-Editor an** — Etappen, die
> die Tabelle/Spalte brauchen, werden erst nach „Migration steht" voll verifiziert. **E1 trägt den
> verpflichtenden Mandantentrennungs-Test.**

### Etappe 1 — Datenmodell + Open-Link-Resolver + Mandantentrennungs-Beweis
**Bauen:** additive Migration (§2.4: `research_open_links` + `interview_sessions.open_link_id`, von
André angewandt); inline-augmentierte Typen; `findOpenLinkByAccessToken(token)` (Klon von
`findInviteByAccessToken`, `status='active'` verlangt); `resolvePublicOpenEntry(token)` (Skelett ohne
UI: `null` / `{mode:"needs_screening"}` / Session-Create-Vorbereitung); Zod-Reuse der bestehenden
Screening-Schemas.
**Verifizieren — der explizite Mandantentrennungs-Test (Beweis: Pfad X sieht nur Studie X):** Live-DB-
Smoke (nach „Migration steht", Vorbild `pnpm voice:smoke`): org A mit Plan X + aktivem
`research_open_links`-Token `T_A`; org B mit Plan Y.
1. `findOpenLinkByAccessToken(T_A)` → Zeile mit `org_id=A, plan_id=X` **only**.
2. `getResearchPlan(A, X)` → X; `getResearchPlan(A, Y)` → **null** (Y gehört B).
3. `resolvePublicOpenEntry(T_A)` referenziert **nie** org B oder Plan Y; es gibt **keinen** Token, der
   `T_A` auf org B abbildet.
4. `status='disabled'`/unbekannter Token → `null` (fail-closed).
5. **Regressions-Guard:** ein `research_invites`-Row mit `org_id = NULL` → `getPublicSession`/
   `resolvePublicEntry`/`POST /screen` liefern **weiterhin** `null`/404 (der Invite-Guard ist
   unangetastet).
`tsc` + `build` grün. *Warum zuerst:* die Isolation ist das Herz — sie wird isoliert und früh bewiesen,
**bevor** UI/Verdrahtung existiert.

### Etappe 2 — Researcher-UI: offenen Link erzeugen/teilen/widerrufen
**Bauen:** `OpenLinkPanel.tsx`; `POST /api/research/plans/[id]/open-link` (`requireOrgIdOrError` +
`getResearchPlan`-Ownership; `org_id` server-seitig aus dem Plan kopiert); Service-Round-Trip; Sektion
auf der Detailseite. **Verifizieren:** Link erzeugen/disablen, URL anzeigen, Reload zeigt Status;
DB-Round-Trip korrekt (`org_id` == Plan-org, nie aus Body); `tsc` + `build` grün.

### Etappe 3 — Teilnehmer-Eintritt (render-only): `/interview/open/[token]` + Consent + Screening-Reuse
**Bauen:** Route-Shell `/interview/open/[token]/page.tsx`; `resolvePublicOpenEntry` an die Page
verdrahten; **Pflicht-Landing/Consent-Step**; Reuse `ScreeningGate`/`RejectionPanel`/`getOrgBranding`;
**ohne** die Session-Erzeugung zu verdrahten (Render-/Branding-Beweis). **Verifizieren:** Seite rendert
white-label für aktiven Link (mit/ohne Screening); `disabled`/unbekannt → `notFound()`; Consent sichtbar;
**keine** Session erzeugt; `tsc` + `build` grün.

### Etappe 4 — Verdrahtung: create-on-qualify + Session-Hand-off
**Bauen:** `POST /api/interview/open/[token]/screen` (+ `/start` für screening-lose Links) →
`findOpenLinkByAccessToken` → `evaluateScreening`; **qualifiziert:** `createResearchInterview({orgId:
link.org_id, planId: link.plan_id, inviteId: null, openLinkId: link.id, screeningAnswers})` →
frischen Session-Token zurückgeben → Client-Redirect zu `/interview/[sessionToken]`; **abgewiesen:**
`recordScreeningResponse(..., "rejected")` + Rejection-Screen. Additiver `openLinkId`-Parameter durch
`createResearchInterview`→`createInterviewSession`-INSERT fädeln.
**Verifizieren (Live-DB, Fake-Antworten, ende-zu-ende):**
1. Qualifizierter Walk-in → **eine** `interview_sessions`-Zeile (`org_id=A`, `plan_id=X`,
   `invite_id=NULL`, `open_link_id=link.id`, `screening_answers` gesetzt, frischer `access_token` ≠
   `T_A`) + **eine** anonyme `qualified`-Quote `(A, X)`. **Assert:** kein `access_token` gleicht je
   `T_A` (Open-Link-Token wird nie Session-Token).
2. Abgewiesener Walk-in → **keine** Session, **kein** Opus-Turn, **nur eine** `rejected`-Quote `(A, X)`.
3. N Walk-ins auf `T_A` → N **distinkte** Sessions, alle `org_id=A`/`plan_id=X`; refresh auf einem
   **Session**-Token → **keine** Dup-Session/Quote.
4. **Mandantentrennung end-to-end:** `T_B` (org B) erzeugt **nur** org-B-Sessions; kein Body-Feld kann
   org A/Plan Y benennen (Body = nur `answers`); null-org-Invite-Pfad liefert **weiterhin** 404.
`tsc` + `build` grün. (Realer Opus-Turn nur im Qualifiziert-Fall — bewusst sparsam testen.)

### Etappe 5 — Anti-Abuse v1 (Platform + strukturelle Bremse)
**Bauen:** `max_sessions`-Enforcement (COUNT auf `open_link_id`, über Cap → „Studie voll", keine
Session); Vercel WAF Rate-Limit-Rule scoped auf `/interview/open/*` + `/api/interview/open/*`; Vercel
BotID auf den Submit (Dashboard/`vercel.json`, **keine** npm-dep). **Verifizieren:** Cap weist über N ab;
WAF/BotID-Config vorhanden; `tsc` + `build` grün. Store-basierter per-IP-Cooldown + Captcha bleiben
**deferred** (§3/§8 — dep-Entscheidung nötig).

---

## 8. Offene Fragen / Risiken

- ⚠️ **RISIKO (Volumen/Kosten — der tragende, NICHT Isolation):** offener Link = unbounded Anthropic-
  Spend + Quote-Inflation, und Anti-Abuse ist eine grüne Wiese (§3). v1 (WAF + `max_sessions`-Cap +
  empfohlen Screening) **muss vor Live stehen**. Isolation ist sicher; Volumen ist es nicht.
- ⚠️ **RISIKO (cross-participant — Hand-off):** der Open-Link-Token darf nie Session-Token werden
  (§5.1). Im Plan gelöst (frischer Token + Redirect + Test-Assert E4), aber der heikle Implementierungs-
  Punkt.
- 🔶 **ANNAHME (Architektur-Kern):** dedizierte `research_open_links`-Tabelle (`org_id NOT NULL`) +
  getrennte Route-Familie (§2.1/§5.1). Empfohlen; die zwei Alternativen (null-org öffnen / Invite
  überladen) sind bewusst abgelehnt.
- 🔶 **ANNAHME (Screening voraussetzen?):** offenen Link **Screening voraussetzen** (Anti-Gaming-
  Argument, Vorschlag) vs. optional? Empfehlung: für offene Links voraussetzen oder zumindest stark
  defaulten, weil es die einzige deterministische Soft-Schranke ist.
- 🔶 **ANNAHME (`max_sessions`-Default):** Default-Cap (sicherer bei null Anti-Abuse-Infra) vs.
  open-ended? Empfehlung: ein konservativer Default-Cap, vom Researcher überschreibbar.
- 🔶 **ANNAHME (`valid_until`/Ablauf):** additive Spalte **jetzt** mitnehmen (billig, optional, `NULL`
  = kein Ablauf) vs. später? Empfehlung: jetzt mitnehmen.
- 🔶 **ANNAHME (Landing/Consent-Step):** Pflicht-Start-Step mit Datenschutz-Hinweis (DSGVO + Choke-
  Point, §3/§4). Empfehlung: Pflicht.
- 🔶 **ANNAHME (Abgewiesenen-Quote):** attempt-based zählen (Re-Try/Refresh kann inflationieren, wie
  beim Invite-Pfad) akzeptieren — oder dedup/rate-limit (braucht Store/Schema, §3-„später")?
- 🔶 **ANNAHME (`screening_answers`-Retention):** Walk-in-Antworten speichern (heute **write-only**,
  kein Reader) wie beim Invite-Pfad — oder bei Skalierung nicht persistieren? DSGVO-Retention klären.
- 📝 **Status-Korrektur:** Screening E4 ist auf `main` gemerged (HEAD `e2be868`), nicht „unmerged auf
  Worktree" — `MEMORY.md` ist stale und wird aktualisiert. Status-Blockquote groundet an `e2be868`.

### Optionaler Ausblick (NICHT in diesem Bau)
Store-basierter per-IP/Fingerprint-Cooldown (Upstash/Vercel KV — neue dep, STOP+Report vor Einbau),
Captcha/Turnstile, IP/UA-Forensik & Dedup-Signal (Schema + DSGVO), und ein **Reader** für
`screening_answers` (heute write-only). Alles bewusst außerhalb dieses Baus.

---

## 9. Nächster Baustein — der echte mandantenlose Pool (`org_id = NULL`)

**Dieser Bau öffnet den reservierten null-org-Pfad bewusst NICHT.** Der offene Studien-Link ist
**org-scoped** (jeder Link gehört genau einer org, `research_open_links.org_id NOT NULL`) — das ist der
ganze Sicherheits-Gewinn. Ein **wirklich mandantenloser, org-übergreifender externer Teilnehmer-Pool**
(der reservierte `research_plans`/`research_invites` `org_id = NULL`-Pfad, `20260611000000`-Header) bleibt
**dunkel** und wäre ein **eigener** Bau mit **eigenem Sicherheits-Review**. Dort öffnet sich der
null-org-Pfad endlich — und braucht dann:
- die in den Migrations-Headern versprochene **zweite RLS-Policy** (bisher in keiner Migration vorhanden),
- ein **Teilnehmer-Token-RLS-Modell** statt der reinen App-Guards (weil der Service-Role-Bypass bedeutet,
  dass RLS dort ebenfalls nicht von allein schützt),
- und eine bewusste Mandantentrennungs-Prüfung über org-Grenzen hinweg.

Der hier gebaute offene Link ist so additiv, dass er diesen späteren Bau **nicht** präjudiziert.

---

## Verifikation des Gesamt-Bausteins (Zusammenfassung)
1. **E1:** Mandantentrennungs-Smoke grün — `T_A` sieht **nur** Studie X/org A, `getResearchPlan(A,Y)`=null,
   disabled/unbekannt→null, null-org-Invite-Pfad **weiterhin** 404. `tsc`+`build`.
2. **E2:** Link erzeugen/disablen → DB-Round-Trip korrekt (`org_id`==Plan-org, nie aus Body). `tsc`+`build`.
3. **E3:** `/interview/open/[token]` rendert white-label + Consent; disabled/unbekannt→notFound; keine
   Session erzeugt. `tsc`+`build`.
4. **E4 (ende-zu-ende, Fake-Antworten):** qualifiziert → Session (`invite_id`=NULL, `open_link_id` gesetzt,
   org A) + `qualified`-Quote; abgewiesen → **nur** `rejected`-Quote; viele Walk-ins → N distinkte
   Sessions; Open-Link-Token wird **nie** Session-Token; `T_B` erzeugt **nur** org-B-Sessions. `tsc`+`build`.
5. **E5:** `max_sessions`-Cap weist über N ab; WAF/BotID-Config steht. `tsc`+`build`.
Migrationen additiv (André im SQL-Editor); **kein `pnpm dev`**; nicht mergen ohne Freigabe. **Vor Live:
Mandantentrennungs-Test grün UND Anti-Abuse-v1 steht.**
