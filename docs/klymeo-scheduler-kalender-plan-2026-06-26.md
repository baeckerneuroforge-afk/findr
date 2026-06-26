# Implementierungsplan: Kalender & Scheduler mit Deferred Activation für Klymeo

**Status:** Planungsdokument (read-only Recherche abgeschlossen, gegen echten Code verifiziert)
**Datum:** 2026-06-26
**Branch:** `claude/fervent-curie-b917d4`
**Verifikationsstand:** Alle zentralen Annahmen am echten Code geprüft. Wo Agent-Befunde falsch waren, ist das unten markiert (⚠️ KORREKTUR).

> **Wichtige Korrekturen vorweg (Agents lagen teils daneben):**
> - **Auth ist Zitadel + next-auth v5**, NICHT Clerk. `auth().user.orgId` (Zitadel-Resource-Owner-Claim) → `organizations.zitadel_org_id`. Mehrere Agents schrieben „Clerk" / „clerk_user_id" — das ist veraltet (`src/lib/auth/org.ts:31,89,91,108`). Audit-User-IDs sind **Zitadel-Subjects**, keine Clerk-IDs.
> - Es gibt **88 Migrationen**, nicht 23.
> - `research_invites.status` enthält **bereits** `'scheduled'` (`20260611000000_research_layer.sql:84-90`). `research_plans.status` enthält es **nicht** (`:45` → nur `draft|active|completed|archived`).
> - Vercel-Cron hat **exakt 3 Jobs** (`reanalyze` 06:00, `account-checkins` 07:00, `retention` 04:00 UTC). `research-reminders` ist real geparkt (`src/app/api/cron/research-reminders/route.ts:8`).
> - `updateResearchPlan` ist bereits org-scoped per `.eq("org_id", orgId).eq("id", planId)` und baut ein sparses Update (`plans-service.ts:1019-1107`) — neue Felder reihen sich dort 1:1 ein.

> **Beschlossene Entscheidungen (Stand 26.06., André):**
> - **O-1 Cron-Tier → MVP erst manuell.** Phase 1 ohne Cron: Überblick + „Jetzt aktivieren"-Button. Auto-Aktivierung + Reminder sind Phase 2 und erst nach separater Cron-Tier-Entscheidung.
> - **O-6 Scope → nur `market_research`.** `product_discovery` bleibt vorerst außen vor (kann später additiv dazu, dieselbe `research_plans`-Tabelle).
> - **O-3 Aktivierung = Freischaltung → JA.** „Jetzt aktivieren" flippt Status live UND versendet die vorbereiteten Pool-Einladungen in einem Schritt. → braucht Migration 3 (`send_state`) bereits in Phase 1. Partielle Versand-Fehler werden **synchron** behandelt (Ergebnis-Summary „23/25 versendet" + „Fehlgeschlagene erneut senden"-Button) statt per Cron-Recovery — passt zum manuellen MVP.
> - **O-4 Prolific → bleibt manuell.** Aktivierung fasst Prolific nie an; Publish (= Guthaben) ist und bleibt ein bewusster Extra-Klick mit Kosten-Check.
> - **O-9 Audit-Log → ab Phase 1.** `scheduler_events` (Migration 2) von Anfang an.
> - **O-10 Kalender-Route → schon in Phase 1.** Die volle `/dashboard/kalender`-Agenda (wie im Mockup) ist Teil des MVP, nicht erst Phase 2.
> - **Provisorisch (meine Empfehlung, bei Widerspruch anpassen):** O-2 Reminder-Empfänger = handelnder User, E-Mail beim Terminieren aus Zitadel-Session mitspeichern (Detail zu Phase 2); O-5 In-App-Glocke erst Phase 3; O-7 MVP browser-lokale Zeit (kein org-TZ); O-8 Umplanen/Stornieren jederzeit solange `draft`.
> - **Nächster Schritt → Plan verfeinert, KEIN Code** bis André „los" sagt.

---

## 1. Vision & Ziel

Klymeo bekommt einen plattform-nativen **Studien-Zeitplaner**, der drei Dinge auf einen Blick löst: (1) Welche Studien laufen, welche sind geplant, was steht als Nächstes an — sichtbar im „Heute"-Dashboard und in einer eigenen `/dashboard/kalender`-Route als fließende Agenda/Timeline (Attio/Notion-Sprache, dark-mode-nativ, kein statisches Monatsraster). (2) **Deferred Activation**: Eine Studie kann vollständig vorbereitet werden (Entwurf + vorbereiteter Teilnehmer-Pool + vorbereiteter Prolific-Draft), geht aber erst zum geplanten Zeitpunkt live — manuell per „Jetzt aktivieren" oder automatisch durch einen Cron-getriebenen Aktivierungs-Job. (3) **Proaktive Erinnerungen** an die Forschenden (Aktivierung in 24 h / 1 h, „läuft jetzt"), per E-Mail (Resend, bestehend) und optional als In-App-Notification-Center. Das Feature ist additiv, org-scoped, fail-closed und baut maximal auf bestehender Research-Layer-Infrastruktur auf.

---

## 2. Nutzer-Flows

### Flow A — Überblick anstehender Studien (Heute-Widget + Kalender)
1. Forscher öffnet `/dashboard` (Heute). Neben den bestehenden Karten erscheint ein neues Widget **„Anstehende Studien"** (Card-Komponente).
2. Das Widget listet bis zu 5 Einträge, sortiert nach Aktivierungs-/Termin-Zeitpunkt: Studientitel, Status-Badge (`Geplant für Mo 14:00`, `Läuft seit …`), Teilnehmer-Zähler, „in X Std/Tagen".
3. `AutoRefresh` (`src/components/dashboard/AutoRefresh.tsx`, 30 s, tab-visible) hält die Liste aktuell, sobald ein Teammitglied etwas terminiert.
4. Klick auf einen Eintrag → Studien-Detailseite. Klick auf „Alle ansehen" → `/dashboard/kalender`.
5. `/dashboard/kalender` zeigt die Agenda über alle Org-Studien (Tages-/Wochen-Sektionen, Status-Punkte), mit Einklick-Drilldown.

### Flow B — Studie terminieren
1. Forscher öffnet eine **Entwurfs-Studie** (`status='draft'`) im Detail (`/dashboard/market-research/[id]`).
2. Im neuen Abschnitt **„Aktivierung planen"** (eigene Komponente `ScheduleActivationPanel`, getrennt vom Anlege-Flow) wählt er: „Jetzt aktivieren" oder „Für später planen".
3. Bei „Für später": `<input type="datetime-local">` (Browser-lokal). Beim Speichern → `new Date(local).toISOString()` (UTC) → `POST /api/research/plans/[id]/schedule`.
4. Status-Badge der Studie wird zu **„Geplant für <Datum, Zeit, TZ-Label>"**. Toast-Bestätigung (`useToast`).
5. Optional: Vorlauf-Erinnerungen aktivieren (24 h / 1 h vor Aktivierung).

### Flow C — Vorläufig anlegen + später freischalten (Deferred Activation)
1. Studie wird wie heute angelegt → landet auf `status='draft'` (DB-Default, `plans-service.ts:903`).
2. Forscher bereitet den **Teilnehmer-Pool** vor: `InviteFromPoolForm` erzeugt `research_invites` mit `status='pending'`, `invited_at=null` — **es wird nichts versendet** (`createResearchInvite`, `research-orchestration.ts:260-321`; Versand ist eigener Schritt).
3. Optional: **Prolific-Draft** vorbereiten via `ProlificDraftPanel` → `panel_studies`-Zeile mit `status='UNPUBLISHED'`. **Nicht** publishen (das ist die Geld-Aktion).
4. Forscher setzt `scheduled_activation_at` (Flow B) und Aktivierungsmodus `auto` oder `manual`.
5. **Automatisch:** Cron `/api/cron/research-activation` prüft fällige Pläne, flippt `draft→active` via Compare-and-Set, versendet vorbereitete Invites, benachrichtigt. **Manuell:** „Jetzt aktivieren" macht denselben Pfad sofort serverseitig.
6. Prolific-Publish bleibt bewusst **eine separate, explizite Nutzeraktion** (Geld) — siehe §7.

### Flow D — Proaktiv erinnert werden
1. Forscher hat eine Aktivierung terminiert (Flow B/C).
2. Cron-Tick erkennt „Aktivierung in ~24 h" (bzw. ~1 h) → sendet Reminder-E-Mail via Resend (`research-invite.ts`-Builder-Muster) und stempelt `activation_reminder_24h_sent_at` (Idempotenz, analog `reminder_24h_sent_at`).
3. Optional In-App: Eintrag in neue `notifications`-Tabelle → Glocke im `DashboardHeader` mit Unread-Badge.
4. Beim Aktivierungs-Tick: „Studie X ist jetzt live (25 Invites versendet)".

---

## 3. Informationsarchitektur

**Heute-Dashboard** (`src/app/(app)/(dashboard)/dashboard/page.tsx`): Neues `<UpcomingStudiesWidget>` als Card nach KPI-Reihe / „Nächste Schritte". Lädt server-seitig org-scoped via neue Query (siehe §5). i18n-Namespace `kalender`/`scheduler` via `getTranslations` + `getLocale`. Fail-open wie Bestand (degradierte Zahlen bei Lesefehler).

**Eigene Route** `/dashboard/kalender` (`src/app/(app)/(dashboard)/dashboard/kalender/page.tsx`): Server Component im `(dashboard)`-Layout-Group → erbt `ThemeShell` (dark), `DashboardSidebar`, `DashboardHeader`, `max-w-[1120px]`. `requireOrgId()` Pflicht (`layout.tsx`). **Keine `[locale]`-Segmente** (next-intl „i18n without routing", `src/i18n/request.ts`) — die URL ist `/dashboard/kalender` für beide Locales (Cookie `klymeo.locale`).

**Navigation** (`src/components/dashboard/DashboardSidebar.tsx`): Neuer Nav-Eintrag, vorzugsweise in einer **eigenen Gruppe „Planung"** oder unter `marketResearch`. `labelKey: "nav.item.kalender"`, `href: "/dashboard/kalender"`. Gliding-Pill-Animation wird automatisch geerbt. Route zusätzlich in `src/lib/search/nav-routes.ts` registrieren (⌘K-Palette + Suche).

**Studien-Detail** (`/dashboard/market-research/[id]`): Neuer Abschnitt „Aktivierung planen" (zwischen Übersicht und `PlanStatusControl`). Status-Badge in `market-research/page.tsx` (Liste) um „Geplant für …" erweitern.

---

## 4. Datenmodell

**Designentscheidung (verifiziert):** `research_plans.status` bleibt **unverändert** `('draft','active','completed','archived')`. Wir führen **keinen 5. Enum-Wert** in `status` ein (würde 88 bestehende Status-Auswertungen brechen). Stattdessen: separates internes Feld `activation_state` + Zeitstempel. Eine geplante Studie ist logisch `status='draft'` **mit** `activation_state='scheduled'`. Das vermeidet Schema-Drift in der bestehenden Lifecycle-Logik (`setResearchPlanStatus`, `updateResearchPlan`).

### Migration 1 — `research_plans` erweitern
`supabase/migrations/20260727000000_research_plan_deferred_activation.sql` (additiv, idempotent, `if not exists`):

```sql
alter table research_plans
  add column if not exists scheduled_activation_at timestamptz,
  add column if not exists activation_mode text default 'manual'
    check (activation_mode in ('manual', 'auto')),
  add column if not exists activation_state text default 'none'
    check (activation_state in ('none','scheduled','activating','activated','failed')),
  add column if not exists activated_at timestamptz,
  add column if not exists activation_error jsonb,
  add column if not exists activation_reminder_24h_sent_at timestamptz,
  add column if not exists activation_reminder_1h_sent_at timestamptz,
  add column if not exists scheduled_by_user_id text;  -- Zitadel subject, NICHT Clerk

-- Cron-Scan: nur geplante, fällige, im Auto-Modus
create index if not exists research_plans_due_activation_idx
  on research_plans (scheduled_activation_at)
  where activation_state = 'scheduled' and activation_mode = 'auto';
```

Begründung Spalten: `activation_state` ist das **Compare-and-Set-Flag** für Idempotenz (§6). `activation_error` (JSONB `{code,message,details}`) für fehlgeschlagene Aktivierungen. `scheduled_by_user_id` = Zitadel-Subject aus `session.user` für Audit (KEINE Clerk-ID — Agent-Befunde hier korrigiert). Bestandszeilen erhalten Defaults `activation_mode='manual'`, `activation_state='none'` → Cron ignoriert sie (fail-safe).

### Migration 2 — Audit-Log (optional, empfohlen)
`supabase/migrations/20260727000001_scheduler_events.sql`:

```sql
create table if not exists scheduler_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references research_plans(id) on delete cascade,
  event_type text not null check (event_type in
    ('schedule_created','schedule_updated','schedule_cancelled',
     'auto_activated','manual_activated','activation_failed','reminder_sent')),
  triggered_by text not null check (triggered_by in ('manual','cron')),
  triggered_by_user_id text,        -- Zitadel subject, null bei cron
  scheduled_for timestamptz,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scheduler_events_org_idx on scheduler_events(org_id, created_at desc);
create index if not exists scheduler_events_plan_idx on scheduler_events(plan_id, created_at desc);
```
RLS: `org_isolation`-Policy analog `research_plans` (Muster aus `20260611000000_research_layer.sql`, `20260723000003_research_session_events.sql`). Anwendung über Supabase-MCP `apply_migration` (Memory-Lehre: nie pbcopy/Umlaute).

### Migration 3 — `research_invites` für deferred Versand (nur falls Auto-Versand bei Aktivierung gewünscht)
```sql
alter table research_invites
  add column if not exists send_state text default 'manual'
    check (send_state in ('manual','deferred','sent','failed')),
  add column if not exists send_scheduled_at timestamptz;
```
`'deferred'`-Invites werden vom Aktivierungs-Cron nach dem `draft→active`-Flip versendet. `research_invites.status` (mit `'scheduled'`) bleibt unangetastet — es bildet den **Interview-Termin** des Teilnehmers ab, nicht den Studien-Start.

**TypeScript-Augmentation:** `ResearchPlanRecord` (`plans-service.ts:58-133`) um `scheduledActivationAt: string|null`, `activationMode`, `activationState` erweitern + defensiver Read-Mapper (`coerceNullableString`-Muster, `:309 toRecord`). `ResearchPlanRow`/`ResearchPlanInsert` in `src/lib/research/db.ts` ergänzen. **`status`-Type bleibt der 4er-Union.**

---

## 5. Backend: API-Routen / Server-Actions

Alle Mutations folgen exakt dem Bestandsmuster (`src/app/api/research/plans/[id]/route.ts`): `requireOrgIdOrError()` → Zod-Parse → org-scoped Service-Call → JSON.

**`POST /api/research/plans/[id]/schedule`** — terminieren/umplanen.
Body (Zod): `{ scheduledActivationAt: string().datetime() | null, mode: enum(['manual','auto']).default('manual'), reminders?: {h24:boolean,h1:boolean} }`. Logik: `getResearchPlan(orgId,id)` (404 wenn null) → Plan muss `status='draft'` sein (sonst 409) → Termin nicht in Vergangenheit → `updateResearchPlan(orgId,id,{...})` setzt `scheduled_activation_at`, `activation_mode`, `activation_state='scheduled'`, `scheduled_by_user_id=session.user.id`. `scheduledActivationAt=null` storniert (→ `activation_state='none'`). `scheduler_events`-Insert. **`activation_state` darf NIE aus dem Request-Body kommen** (Cron-only/Server-only).

**`POST /api/research/plans/[id]/activate`** — sofort manuell aktivieren.
Kein Body. Ruft denselben internen `activatePlan(orgId, planId, {by:'manual', userId})` wie der Cron (Single Source of Truth, §6). Pre-Checks (§7) → `draft→active`. 409 wenn nicht `draft`.

**`GET /api/calendar/upcoming`** (optional, für Live-Polling) — `requireOrgIdOrError()` → JSON der nächsten N Termine.

**Service-Erweiterungen** (`plans-service.ts`, alle `createResearchSupabase()` + `.eq("org_id", orgId)`):
- `listUpcomingScheduledPlans(orgId, daysAhead=14)` — `from('research_plans').eq('org_id',orgId).eq('activation_state','scheduled').gte('scheduled_activation_at',now).order(...).limit()`.
- `schedulePlanActivation(orgId, planId, at, mode, userId)`.
- `activatePlan(orgId, planId, {by, userId})` — enthält die Compare-and-Set-Mechanik (§6).

**Scheduling-Service** (`scheduling.ts`): `listInvitesDueForReminder`-Muster wiederverwenden; bei Aktivierung Pool-Invites laden und versenden.

**Cron-Endpunkt** `GET /api/cron/research-activation` — `isAuthorizedCron(request)` (Bearer `CRON_SECRET`, fail-closed, `src/lib/auth/cron.ts:19-29`). `?dryRun=true`-Support + `localDryRun`-Bypass (Off-Vercel-Test, Muster `account-checkins/route.ts`). `MAX_ACTIVATIONS_PER_RUN` Cap. Fehler-Policy via `cronIsTotalFailure` (`src/lib/cron/status.ts`).

**Rate-Limit:** ⚠️ **KORREKTUR** — es gibt kein produktiv aktives globales Limiter-System (das `feat/rate-limiting`/Upstash aus dem Memory ist uncommitted und nicht in `main`). Scheduler-Mutations sind manuell, niedrig-Volumen, hinter `requireOrgIdOrError` + (Cron) `CRON_SECRET` gegated → kein eigenes Limit für MVP nötig. Falls Upstash später live geht, fiele Scheduling unter die `mutation`-Klasse.

---

## 6. Scheduler-/Aktivierungs-Mechanik (Deferred Release)

**Zustandsmaschine** (`activation_state`, getrennt von `status`):
`none` → `scheduled` (User terminiert) → `activating` (Cron/Manual greift atomar) → `activated` (Erfolg, parallel `status='active'`, `activated_at=now`) — oder → `failed` (Vorbedingung verletzt, retry-bar).

**Idempotenz / Doppel-Aktivierung verhindern (Compare-and-Set in Postgres, nicht in App):**
Das bewährte CAS-Muster aus `src/lib/voice-interview/bridge-service.ts` (`UPDATE … .eq('status','open')`) wird gespiegelt:

```sql
update research_plans
   set activation_state = 'activating'
 where id = $planId and org_id = $orgId
   and activation_state = 'scheduled';   -- nur EIN Caller gewinnt
-- via supabase-js: .update(...).eq(...).eq('activation_state','scheduled').select().maybeSingle()
```
0 zurückgegebene Zeilen → ein anderer Tick/Klick war schneller → No-op (at-most-once). Nur der Gewinner führt Pre-Checks aus, flippt dann `status='active'` + `activation_state='activated'`, oder bei Verletzung `activation_state='failed'` + `activation_error`.

**Manuell vs. automatisch:** Beide rufen `activatePlan()`. Cron findet via `research_plans_due_activation_idx` nur `activation_state='scheduled' AND activation_mode='auto' AND scheduled_activation_at <= now()`. Manuell („Jetzt aktivieren") arbeitet unabhängig vom Modus, sofort.

**Vorbedingungen fehlen zum Termin:** Cron setzt `activation_state='failed'` mit Code (`open_link_disabled`, `credentials_missing`, `quota_not_met`) → Plan bleibt `draft`. **Kein Endlos-Loop** (Cron überspringt `failed`). Nutzer sieht ⚠ + Retry-Button (setzt `failed→scheduled` zurück). Nach 3 Fehlversuchen optional E-Mail an Org-Owner (Phase 2).

**Zeitzonen:** `scheduled_activation_at` immer **timestamptz/UTC**. UI: `<input type="datetime-local">` ist browser-lokal → `toISOString()` beim Speichern; Anzeige via `Intl.DateTimeFormat(toBcp47(locale))`. Cron vergleicht reine UTC. MVP: UTC-Default mit sichtbarem TZ-Label im UI; org-weite `preferred_timezone` als Phase-2-Option.

**Cron-Granularität vs. minutengenau:** ⚠️ Reale Hürde — `research-reminders` ist geparkt, weil sub-tägliche Crons den damaligen Plan blockierten (`route.ts:8`). Optionen, priorisiert: **(a) MVP:** primär **manuelle** Aktivierung („Jetzt aktivieren"-Button) — funktioniert sofort, ohne Cron. **(b)** Auto-Aktivierung mit **Fenster-Toleranz** bei grobem Intervall (z. B. zusätzlicher Tick um 05:00 UTC neben `reanalyze` → „aktiviert ±X" kommuniziert). **(c) Voll:** Vercel-Pro / externer Trigger (cron-job.org → GET mit `CRON_SECRET`) → 5–15-min-Tick für quasi-minutengenau. André entscheidet Plan-Tier (offene Frage O-1).

---

## 7. Participant-Pool / Prolific: vorbereiten, nicht senden

**Mechanismus existiert bereits** und ist der Kern des Deferred-Release:
- **Pool-Invites vorbereiten:** `inviteFromPool(orgId,planId,memberIds)` → `createResearchInvite` (`research-orchestration.ts:260-321`) legt nur die Zeile an (`status='pending'`, `access_token`, `invited_at=null`). **Klymeo sendet/publiziert NIE automatisch** (`send/route.ts`-Kommentar). Zwei-Stufen-Versand `POST /schedule` → `POST /send`; `invited_at!==null` ist 409-Idempotenz-Gate.
- **Prolific-Draft vorbereiten:** `createProlificDraftForPlan` (`panel/service.ts:218`) → `panel_studies`-Zeile `status='UNPUBLISHED'`. `publishProlificStudyForPlan` (`:450`, **Geld-Aktion**) hat harte Pre-Checks via `requirePublishablePanelStudy` (Credentials connected, persistierter Draft, Open-Link aktiv, beide Completion-URLs, Live-Status-Check gegen Doppel-Publish).

**Aktivierungs-Vorbedingungen (Pre-Check in `activatePlan`):**
1. `plan.status='draft'`. 2. Open-Link existiert & `status='active'` (`open-links.ts`). 3. Falls Prolific konfiguriert: `getPanelCredentialToken` ≠ null. 4. Falls `research_plan_quotas` mit `target>0`: `listQuotaProgress` erfüllt (`participant-pool.ts:582-618`). 5. Falls `isStimulusSet`: alle Positionen haben URL+Typ.

**Deferred-Release-Entscheidung (Empfehlung):** Aktivierung erzeugt/aktiviert die interne Studie + versendet vorbereitete Pool-Invites (`send_state='deferred'`). **Prolific-Publish bleibt explizit manuell** (Geld-Risiko, Memory-Lehre „E7 GELD-NAH"). Auto-Publish wäre ein bewusster Phase-2-Opt-in mit erneutem Cost-Check gegen Workspace-Balance.

---

## 8. Reminder-/Notification-System

**E-Mail (Resend, vorhanden, einsatzbereit):** `src/lib/email/resend.ts` (`INTERVIEW_FROM_EMAIL`, `defaultFrom`), Builder-Muster `src/lib/email/research-invite.ts` (`buildResearchReminder` 24h/1h, `buildIcs` RFC 5545, locale-aware via `appBaseUrl`). Neuer Builder `buildActivationReminder` (analog) + `buildActivationLiveNotice`.

**Trigger (im Aktivierungs-Cron, derselbe Tick):**
- ~24 h vor `scheduled_activation_at` & `activation_reminder_24h_sent_at IS NULL` → Reminder + Stempel.
- ~1 h vorher analog.
- Beim Flip → „läuft jetzt"-Notice.
Idempotenz exakt wie `reminder_24h_sent_at`/`reminder_1h_sent_at` (`20260614000000_research_invite_reminders.sql`), Bucket-Logik `pickBucket` aus `research-reminders/route.ts:54-86`.

**Templates:** i18n über `translate(locale, …)` (`src/i18n/messages.ts`, server-only Mailer-Pfad). DE/EN-Keys: Betreff, „Studie X geht in 24 h online", CTA „Jetzt aktivieren", Zeit locale-formatiert.

**In-App-Center:** ⚠️ existiert NICHT — nur ephemeres Toast (`src/components/ui/Toast.tsx`, kein Backend). Empfehlung: **Phase 2** neue Tabelle `notifications(id, org_id, user_id, type, title, body, action_url, read_at, created_at)` + Glocke im `DashboardHeader` mit Unread-Badge + RLS. MVP: E-Mail + Toast + „Heute"-Widget genügen.

**Vorlauf-Erinnerungen:** an die Forschenden (Org-Owner/Ersteller), nicht an Teilnehmer (Teilnehmer-Reminder ist der separate geparkte `research-reminders`-Pfad). Empfänger-Entscheidung = offene Frage O-2.

---

## 9. Frontend / Visual-Design

**Designsprache:** dark-mode-nativ über `.dark`-Klasse auf `ThemeShell` (`src/components/theme/ThemeShell.tsx`), Tokens aus `src/app/globals.css` (Obsidian-Canvas, Violett-Akzent `--color-primary-600`, Hanken Grotesk + JetBrains Mono für Zahlen, `.st-rise`/`console-rise`-Animation, `cubic-bezier(.22,1,.36,1)`). **Keine Hex-Literale** — nur CSS-Variablen. Referenz-Mockup: `docs/findr-platform-entwurf-fluid.html`, Spec `docs/findr-console-redesign-plan.md`.

**Kalender-Lib vs. Eigenbau — Entscheidung: Eigenbau Agenda/Timeline.** Begründung: Standard-Libs (react-big-calendar, ~20–40 KB) zwingen eigene DOM-Struktur + Light-Mode-Annahmen auf, kollidieren mit Token-System und dem v5-„fluid statt Raster"-Ethos. Aufbau ~300 LOC aus `Card`/`Badge`/`StatCard` + `<time>`-Elementen + Flexbox; Datums-Arithmetik via `date-fns` (im Tree); Motion via `.st-rise`. Kein Monatsraster mit leeren Zellen — vertikale Tages-/Wochen-Sektionen, Status-Punkte, „in X Tagen".

**Wiederverwendbare Komponenten:** `Card`/`CardHeader`/`CardBody`, `Badge` (Status-Varianten → `draft/scheduled/active/completed`), `StatCard` (KPI „3 Studien diese Woche"), `EmptyState` (`src/components/ui/EmptyState.tsx`), `Toast`, `ScheduleInviteAction` (datetime-Picker-Logik extrahieren nach `src/lib/scheduler/datetime-utils.ts`, geteilt mit Invite-Scheduling).

**Empty-States:** „Keine anstehenden Studien" (CTA „Studie anlegen"), „Alle Studien laufen oder sind abgeschlossen". Skeleton via Bestand `Skeleton` mit `.st-rise`-Stagger.

**A11y:** `<article>`/`<section>` statt `div`, Labels an `datetime-local`, `aria-live="polite"` (Toasts), `prefers-reduced-motion` respektiert (in `globals.css` verdrahtet).

**Hairline-Kontrast (dark):** `border-neutral-200` wird im Dark zu gedämpftem Violett — Timeline-Zeilen ggf. mit `bg-neutral-50` (dark = leicht heller) absetzen, keine farbigen Borders.

---

## 10. i18n + Next.js-Fork-Konformität

**Namespace `kalender`** in `messages/de.json` + `messages/en.json`, früh und vollständig: `title, subtitle, emptyTitle, emptyDesc, upcomingIn, scheduledFor, activatesIn, runningSince, scheduleActivation, activateNow, scheduleForLater, reminder24h, reminder1h, cancelSchedule, statusScheduled, statusActivating, statusFailed, retry`. Plus `nav.item.kalender`. **DE/EN-Parität** muss `vitest run` (`messages-parity.test.ts`) bestehen.

**Server-Kontext:** Kalender-Queries `server-only`, i18n via `getTranslations`/`getLocale` in Server Components; Client-Interaktion (Reschedule-Modal) via `'use server'`-Server-Action als Bridge.

**Fork-Konformität (PFLICHT):** Vor Code `node_modules/next/dist/docs/` lesen (AGENTS.md). Relevant: Data-Fetching/`revalidatePath`/`revalidateTag` (Cache-Invalidierung nach Mutation), `cache: 'no-store'`/Dynamic Rendering für stets-frische Listen, Server-Actions-Signatur. **Keine `[locale]`-Segmente** (next-intl ohne Routing). Turbopack-Worktree-Build: `pnpm install --frozen-lockfile --offline` (Memory-Lehre gegen Symlink-Panic).

---

## 11. Berechtigungen / Multi-Tenancy / Edge-Cases

- **Org-Scoping:** Jede Query/Mutation org-gebunden (`updateResearchPlan` hat `.eq("org_id",orgId)` bereits, `:1097`). `requireOrgId()`/`requireOrgIdOrError()` (`src/lib/auth/org.ts`) in jeder Route; RLS `org_isolation` (`org_id = current_org_id()`) auf neuen Tabellen.
- **Zitadel-Auth** (⚠️ nicht Clerk): Audit-User = `session.user.id` (Zitadel-Subject). `scheduled_by_user_id`/`triggered_by_user_id` speichern dieses, keine PII.
- **Cron umgeht RLS** (service-role), filtert aber **explizit** `org_id` in jeder Query; `triggered_by='cron'` nur serverseitig setzbar (nicht spoofbar via API).
- **Idempotenz:** CAS auf `activation_state` (§6); Reminder via `*_sent_at`-Stempel; Invite-Versand via `invited_at`-Gate.
- **Zeitzonen:** UTC-Storage, lokale Anzeige (§6).
- **Edge-Cases:** Archivierung räumt `scheduled_activation_at` (Empfehlung: `activation_state='none'`). Manuelle Aktivierung trotz gesetztem Termin = Override (Termin verworfen). Concurrent Teilnehmer-Eintritt während Flip = unkritisch (Sessions sind plan-FK-gebunden, Status-Snapshot punkt-in-Zeit). Gelöschter Plan → FK-Cascade auf `scheduler_events`.

---

## 12. Hürden + Lösungen (konsolidiert, priorisiert)

| # | Hürde | Schweregrad | Lösung |
|---|-------|-------------|--------|
| H1 | Vercel-Cron: nur 3 tägliche Jobs aktiv; `research-reminders` geparkt — Auto-Aktivierung braucht sub-tägl. Tick | **hoch** | MVP = **manuelle** Aktivierung (kein Cron). Phase 2: täglicher Tick mit Fenster-Toleranz neben `reanalyze`. Phase 3: Vercel-Pro **oder** externer Trigger (cron-job.org → `CRON_SECRET`). André entscheidet (O-1) |
| H2 | Doppel-Aktivierung (paralleler Cron-Tick + Klick) | **hoch** | Postgres-**Compare-and-Set** auf `activation_state='scheduled'` (Muster `bridge-service.ts`); 0 Zeilen = No-op |
| H3 | `research_plans.status` hat kein `'scheduled'` (88 Auswertungen würden brechen) | **hoch** | **Kein** neuer Enum-Wert; separates `activation_state`-Feld; `status` bleibt 4er-Union |
| H4 | Next.js-Fork mit Breaking Changes (Data-Fetching/Cache/Streaming) | **hoch** | `node_modules/next/dist/docs/` vor Code lesen; bestehende Patterns (AutoRefresh, Server-Component-Fetch) wiederverwenden, keine Bleeding-Edge-APIs |
| H5 | Prolific-Publish = Geld; falscher Auto-Publish kostet echtes Guthaben | **hoch** | Publish bleibt **explizit manuell**; Aktivierung berührt nur internen Plan + vorbereitete Invites; harte Pre-Checks bleiben |
| H6 | Fehlende Vorbedingungen zum Termin (Open-Link disabled, Credentials weg) | **mittel** | `activation_state='failed'` + `activation_error`-Code; Cron skippt `failed`; Retry-Button; kein Loop |
| H7 | Zeitzonen-Verwirrung (UTC vs. lokal) | **mittel** | UTC-Storage, `Intl.DateTimeFormat`-Anzeige, sichtbares TZ-Label; org-TZ als Phase 2 |
| H8 | Invite-Level- vs. Plan-Level-Scheduling (mehrere `scheduled_at` je Plan) | **mittel** | Plan-Termin (`scheduled_activation_at`) = Studien-Start; Invite-`scheduled_at` = Teilnehmer-Slot, **orthogonal**; UI trennt klar |
| H9 | In-App-Notification-Center fehlt komplett | **mittel** | MVP: E-Mail + Toast + Heute-Widget; `notifications`-Tabelle + Glocke = Phase 2 |
| H10 | Quoten-Gate „Snapshot zum Aktivierungs-Zeitpunkt" | **mittel** | Quota-Check nur **vor** Aktivierung; nach `active` UI-sperrt Pool-Invite (Bestandsmuster) |
| H11 | Worktree-Build Turbopack-Symlink-Panic | **niedrig** | `pnpm install --frozen-lockfile --offline` (Memory-Lehre) |
| H12 | `1120px`-Content-Breite begrenzt Kalender | **niedrig** | Agenda/Timeline ist vertikal → passt; kein breites Monatsraster nötig |
| H13 | Worktree-Pfade in Migrationen / Umlaute beim Seeding | **niedrig** | `apply_migration` via MCP, nie pbcopy (Memory-Lehre) |

---

## 13. Phasen-Roadmap

**(Aktualisiert nach Andrés Entscheidungen 26.06. — Phase 1 ist jetzt der „große MVP".)**

**Phase 1 — „Überblick + Kalender + manuelle Freischaltung" (~4–5 Tage)**
Abgrenzung: **kein** Cron, **kein** automatischer Reminder, **kein** In-App-Notification-Center. Aktivierung ist manuell, schaltet aber komplett frei (inkl. Pool-Versand).
- **Migrationen 1 + 2 + 3** zusammen: `research_plans`-Spalten (`activation_state` etc.) + `scheduler_events` (Audit) + `research_invites.send_state` (für Freischaltungs-Versand). TS-Augmentation + Read-Mapper (Code deployt vor Migration, coerce-Pattern).
- `POST /…/schedule` (Termin setzen/umplanen/stornieren) + `POST /…/activate` (manuell): Pre-Checks (§7) → **CAS auf `status='draft'`** (deckt auch nicht-terminiertes „sofort aktivieren" ab, Pflichtfix §16.4-3) → `status='active'` + **synchroner Versand der vorbereiteten Pool-Invites** mit Ergebnis-Summary + „Fehlgeschlagene erneut senden"-Pfad.
- **`/dashboard/kalender`** (Agenda/Timeline, Eigenbau, dark-mode-nativ wie Mockup) + Sidebar-Nav + ⌘K-Registry.
- `ScheduleActivationPanel` (Studien-Detail) + `UpcomingStudiesWidget` (Heute) + Status-Badge „Geplant für …".
- i18n-Namespace `kalender` (DE/EN, Parität-Test) + `scheduler_events`-Inserts an allen Übergängen.
- Gates: tsc 0 / eslint 0 / vitest / `next build` grün; Org-Isolations- + CAS-Idempotenz-Tests.
**Ergebnis:** Forscher plant vorläufig an, bereitet Pool/Prolific-Draft vor, sieht alles in Kalender + Heute-Widget, und schaltet per Klick komplett frei (Studie live + Einladungen raus). Prolific-Publish bleibt separater Geld-Klick.

**Phase 2 — Auto-Aktivierung + proaktive Reminder (~3 Tage, nach Cron-Tier-Entscheidung)**
- Cron `/api/cron/research-activation` (nutzt denselben `activatePlan()`, CAS, dryRun, Cap) + **zweiter Pass** für hängende `send_state='deferred'`-Invites (Crash-Recovery, §16.2-2).
- Resend-Builder `buildActivationReminder` (24 h / 1 h) + `buildActivationLiveNotice`; Reminder-Empfänger-Auflösung (O-2, gespeicherte Scheduler-E-Mail).
- Cron-Tier umsetzen (Vercel-Pro **oder** externer Trigger cron-job.org + `CRON_SECRET`). 1 h-Reminder erfordert ≥stündlichen Tick (§16.4-6).

**Phase 3 — Voll (~2–3 Tage)**
- In-App-`notifications`-Tabelle + Glocke + Unread-Badge im `DashboardHeader`.
- Org-`preferred_timezone` + TZ-Picker (serverseitige Default-Zeiten via `Intl.DateTimeFormat`, nicht `setHours`, §16.4-5).
- Optional Prolific-Auto-Publish (mit erneutem Cost-Check), Bulk-Scheduling, iCal-Export.

---

## 14. Test-/Eval-/Verifikations-Strategie

Passend zu bestehenden Gates (tsc 0 / eslint 0 / vitest / `next build`):
- **Unit (vitest):** `schedulePlanActivation` (Org-Scoping, Vergangenheits-Check, Stornierung); `activatePlan` Pre-Check-Matrix (Open-Link disabled / Credentials fehlen / Quota nicht erfüllt → `failed` mit Code); CAS-Idempotenz (zwei parallele Calls, nur einer gewinnt — `vi.setSystemTime`).
- **Route-Tests:** `schedule`/`activate` mit gemocktem `requireOrgIdOrError`, Zod-Reject, Cross-Org-Block (fremde org_id unsichtbar), `activation_state` nicht aus Body setzbar.
- **Cron-Test:** gemocktes `isAuthorizedCron`, `?dryRun=true` mutiert nicht, `MAX_ACTIVATIONS_PER_RUN`, `cronIsTotalFailure`-Pfad.
- **i18n:** `messages-parity.test.ts` DE/EN-Parität für `kalender`.
- **Org-Isolation:** zwei Orgs, jede sieht nur eigene geplante Pläne.
- **Manuell/Hands-on (André):** Studie planen → Pool vorbereiten (Invites `pending`, nichts versendet) → „Jetzt aktivieren" → `status='active'`, Invites versendet, Prolific-Draft **un**publiziert; Dark-Mode-Screenshot Kalender + Widget.
- **Synthetic-Smoke:** `mr:m3:smoke` erweitern — Draft mit `scheduled_activation_at` in naher Zukunft, Cron-Tick simulieren, Flip verifizieren.

---

## 15. Offene Entscheidungen für André

1. ✅ **ENTSCHIEDEN — Cron-Tier:** MVP erst manuell (kein Cron). Auto-Aktivierung/Reminder = Phase 2 nach separater Tier-Entscheidung.
2. 🟡 **PROVISORISCH — Reminder-Empfänger:** handelnder User; E-Mail beim Terminieren aus Zitadel-Session mitspeichern. Detail-Design zu Phase 2. (Bei Widerspruch anpassen.)
3. ✅ **ENTSCHIEDEN — Auto-Versand bei Aktivierung:** JA — Aktivierung versendet die vorbereiteten Pool-Invites mit (Migration 3 in Phase 1, synchrone Fehlerbehandlung).
4. ✅ **ENTSCHIEDEN — Prolific bei Aktivierung:** manuell-only. Kein Auto-Publish.
5. 🟡 **PROVISORISCH — Notification-Center:** In-App-Glocke erst Phase 3; MVP = E-Mail + Toast + Heute-Widget.
6. ✅ **ENTSCHIEDEN — Scope:** Nur `market_research`. `product_discovery` später additiv möglich.
7. 🟡 **PROVISORISCH — Zeitzone:** MVP browser-lokale Eingabe + Anzeige (kein org-TZ). Org-`preferred_timezone` erst Phase 3.
8. 🟡 **PROVISORISCH — Stornieren/Umplanen:** jederzeit änder-/stornierbar, solange `draft`.
9. ✅ **ENTSCHIEDEN — Audit-Log:** `scheduler_events` ab Phase 1.
10. ✅ **ENTSCHIEDEN — Kalender-Route:** volle `/dashboard/kalender`-Agenda bereits in Phase 1.

---

**Verankerte Schlüsseldateien:** `src/lib/research/plans-service.ts` (`updateResearchPlan:1019`, `setResearchPlanStatus:1114`, `ResearchPlanRecord:58`), `src/app/api/research/plans/[id]/route.ts` (`UpdatePlanBodySchema:53`, `requireOrgIdOrError:147`), `src/lib/auth/org.ts` (Zitadel, `:89-119`), `src/lib/auth/cron.ts` (`isAuthorizedCron:19`), `src/lib/voice-interview/bridge-service.ts` (CAS-Muster), `src/app/api/cron/research-reminders/route.ts` (Cron-Muster, geparkt `:8`), `src/lib/email/research-invite.ts` (Reminder/ICS), `src/lib/research/research-orchestration.ts` (`createResearchInvite:260`), `src/lib/panel/service.ts` (`createProlificDraftForPlan:218`, `publishProlificStudyForPlan:450`), `supabase/migrations/20260611000000_research_layer.sql` (`research_plans.status:45`, `research_invites.status:84`), `src/app/(app)/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/DashboardSidebar.tsx`, `src/components/ui/{Card,Badge,StatCard,EmptyState}.tsx`, `src/app/globals.css`, `src/i18n/{messages,locale,request}.ts`, `vercel.json` (3 Crons).

---

## 16. Härtetest: Adversarialer Review (Korrekturen & Lücken)

> Ein 12. Agent hat den Plan oben gegen den echten Code zerlegt. Zwei Faktenfehler sind **bereits inline korrigiert** (`session.user.sub`→`session.user.id` global). Der Rest steht hier als Pflicht-Lektüre **vor** der Umsetzung.

### Gesamturteil
Insgesamt ein ueberdurchschnittlich starker, ehrlich am Code verifizierter Plan — deutlich besser als die Roh-Befunde, die er korrigiert. Die zentralen Architektur-Entscheidungen sind richtig und am echten Code verankert (verifiziert): (1) KEIN 5. status-Enum-Wert, sondern separates activation_state — korrekt, research_plans.status ist tatsaechlich nur draft|active|completed|archived (Migration :44-45); (2) Postgres-CAS gegen Doppel-Aktivierung spiegelt ein REAL existierendes Muster (bridge-service.ts:222-230 .eq('status','open').maybeSingle()); (3) updateResearchPlan ist tatsaechlich org-scoped + sparse (:1019-1107, .eq('org_id').eq('id')); (4) die Auth-Korrektur (Zitadel statt Clerk) ist real und wichtig (org.ts:10-29, auth.ts); (5) Deferred-Release nutzt zu Recht die bestehende Zwei-Stufen-Invite-Logik (createResearchInvite insertet status='pending' ohne Versand — verifiziert :28-40) und die harten Prolific-Publish-Preconditions (service.ts requirePublishablePanelStudy :374-400, live.status='UNPUBLISHED'); (6) Cron-Realitaet korrekt (vercel.json: exakt 3 taegliche Jobs, research-reminders nachweislich geparkt mit dem Hobby-Plan-Kommentar); (7) cronIsTotalFailure/cronHadAnyError und isAuthorizedCron existieren wie zitiert. Die richtige, risikoarme Phasen-Trennung (MVP=manuell, Auto+Cron=Phase 2) entschaerft das groesste Infrastruktur-Risiko vorne. ABER: zwei konkrete, mit hoher Wahrscheinlichkeit zuschlagende Fehler trueben das Bild — der Audit-Feld-Verweis auf session.user.sub (existiert nicht; korrekt ist session.user.id) wuerde stillen Audit-Daten-Verlust erzeugen, und die date-fns-'im-Tree'-Annahme ist faktisch falsch (nicht installiert). Beides sind direkte Implementierungs-Fallen, keine Geschmacksfragen. Dazu kommt eine echte Luecke in der Zustandsmaschine (manuelles 'Jetzt aktivieren' auf nicht-terminiertem draft laeuft nicht durch den dokumentierten 'scheduled'-CAS) und ein nicht adressierter Crash-Recovery-Pfad fuer haengende deferred-Invites. Mit diesen Korrekturen ist der Plan umsetzungsreif; ohne sie produziert eine woertliche Umsetzung zwei Bugs am Tag 1.

### 16.1 Risiken (priorisiert)

| # | Schwere | Risiko | Lösung |
|---|---|---|---|
| 1 | high | Audit-Feld bezieht sich auf ein nicht existierendes Session-Feld. Der Plan schreibt mehrfach (§5 'scheduled_by_user_id=session.user.sub', §11 'Audit-User = session.user.sub'). Im echten Code (src/auth.ts:105) wird der Zitadel-Subject als session.user.id surfaced; session.user.sub EXISTIERT NICHT auf dem Session-Objekt (nur token.sub intern). Code nach diesem Plan wuerde undefined in scheduled_by_user_id schreiben — stiller Daten-Verlust im Audit-Trail. Korrekt waere session.user.id. | In §5/§11 jede Referenz auf session.user.sub durch session.user.id ersetzen (verifiziert gegen src/auth.ts:105 'session.user.id = token.sub'). requireOrgIdOrError liefert ohnehin nur orgId, NICHT die userId — der Plan muss zusaetzlich spezifizieren, dass die Route die userId separat via auth() / session.user.id holt, sonst ist sie gar nicht verfuegbar. |
| 2 | high | date-fns wird als 'im Tree' angenommen, ist aber NICHT installiert (in package.json/node_modules nicht vorhanden — verifiziert). §9 ('Datums-Arithmetik via date-fns (im Tree)') und H-Annahmen bauen darauf. Ein npm-Install fuer eine Datumsbibliothek in einem Next.js-Fork mit Turbopack-Symlink-Empfindlichkeit (eigene Memory-Lehre) ist nicht risikolos und widerspricht dem 'additiv, keine Bleeding-Edge'-Anspruch. | Entweder bewusst date-fns als NEUE Dependency deklarieren (mit pnpm install --frozen-lockfile-Workflow + Lockfile-Commit) ODER auf native Intl.DateTimeFormat + manuelle Date-Arithmetik setzen (wie das bestehende proposeSlots, das EXPLIZIT 'ohne TZ-Lib' arbeitet, src/lib/research/scheduling.ts:104). Den Satz 'im Tree' streichen — er ist faktisch falsch. |
| 3 | medium | Timezone-MVP ('UTC mit Label') erbt einen bestehenden, im Code dokumentierten Bug. proposeSlots (scheduling.ts:103-108) setzt 10:00 via setHours() in SERVER-Lokalzeit und approximiert Europe/Berlin — auf Vercel laeuft der Server in UTC, also ist '10:00' dort 10:00 UTC, nicht Berlin. Der Plan empfiehlt fuer den Kalender denselben Eigenbau-Ansatz, ohne diesen Fallstrick zu nennen. datetime-local + new Date(local).toISOString() ist korrekt fuer BROWSER-lokale Eingabe, aber jede serverseitige Slot-/Default-Berechnung (z.B. 'naechster Werktag 10:00') reproduziert den setHours-Bug. | Klarstellen: Eingabe (Browser, datetime-local) ist korrekt UTC-konvertiert; ABER alle SERVERSEITIGEN Default-/Vorschlags-Zeiten muessen Intl.DateTimeFormat mit timeZone:'Europe/Berlin' nutzen, nicht setHours. Den proposeSlots-Bug als Praezedenz im Plan benennen, damit der Kalender ihn nicht kopiert. |
| 4 | high | Cron-Granularitaet vs. Erwartung: Der ganze 'Auto-Aktivierung'-Wert haengt an Sub-Tages-Cron, der auf Hobby Deploys BLOCKIERT (verifiziert: vercel.json hat genau 3 taegliche Jobs, research-reminders ist deshalb geparkt). Der Plan macht Phase-1-MVP korrekt manuell — aber das KERN-Versprechen des Features ('System erinnert PROAKTIV', 'automatisch durch den Scheduler zum geplanten Zeitpunkt') ist genau das, was ohne Pro/externen Trigger NICHT geht. Risiko: Stakeholder erwartet nach 'Phase 1' das beworbene Auto-Feature, bekommt aber nur einen Button. | O-1 ist als blockierend markiert (gut), aber die Roadmap sollte deutlicher sagen: 'Ohne Cron-Tier-Entscheidung ist das beworbene Kernfeature (proaktive Auto-Aktivierung + Vorlauf-Reminder) NICHT lieferbar — Phase 1 liefert nur manuelle Aktivierung.' Den externen-Trigger-Pfad (cron-job.org GET mit CRON_SECRET) als billigste Loesung konkreter durchplanen, inkl. Risiko, dass ein extern erreichbarer Cron-Endpoint die Angriffsoberflaeche vergroessert (CRON_SECRET-Leak = fremde Aktivierungen). |
| 5 | medium | Reminder-Cron und Aktivierungs-Cron im selben Tick gekoppelt (§8) schafft eine Frequenz-Kopplung: 24h/1h-Vorlauf-Reminder brauchen MINDESTENS stuendliche Ticks, um das 1h-Fenster zu treffen. Bei der vom Plan als MVP-Fallback genannten 'taeglichen' Cron-Frequenz (neben reanalyze 06:00) wird das 1h-Reminder-Fenster systematisch verfehlt — der 1h-Reminder kommt nie oder zufaellig. Der Plan nennt das nicht als Konsequenz der Frequenz-Wahl. | Explizit machen: 1h-Vorlauf-Reminder erfordert >=stuendlichen Cron; bei taeglichem Tick nur 24h-Reminder (mit breitem Bucket) realistisch. Die pickBucket-Logik aus research-reminders uebernehmen UND die Fenster an die tatsaechliche Tick-Frequenz koppeln, sonst stille Reminder-Luecken. |
| 6 | medium | Manuelle Aktivierung umgeht den partiellen Index und potenziell die Pre-Checks-Disziplin. activatePlan() wird von zwei Pfaden gerufen (Cron + manueller Button). Der manuelle Pfad arbeitet 'unabhaengig vom Modus, sofort' (§6). Wenn der manuelle Pfad denselben CAS auf activation_state='scheduled' nutzt, kann ein Plan, der activation_state='none' hat (also gar nicht terminiert, nur 'jetzt aktivieren' geklickt), den CAS NICHT durchlaufen (kein 'scheduled'-Zustand). Die Zustandsmaschine deckt 'none->active per Klick' nicht sauber ab. | Zustandsmaschine um den Direkt-Pfad ergaenzen: manuelles 'Jetzt aktivieren' auf einem nicht-terminierten draft muss entweder zuerst activation_state auf 'scheduled' setzen (dann CAS) ODER einen eigenen CAS auf status='draft' (wie das bridge-service-Muster .eq('status','open')) fahren. §6 muss BEIDE Eintrittspunkte in EINE CAS-Bedingung aufloesen, sonst ist der haeufigste Fall (sofort aktivieren ohne Termin) ungeschuetzt. |
| 7 | low | invited_at-Annahme im Plan leicht ungenau: Plan sagt createResearchInvite erzeugt Invite mit 'invited_at=null'. Im echten Insert (research-orchestration.ts:28-40) wird invited_at GAR NICHT gesetzt — es ist nur DB-default-null. Harmlos fuer die Logik, aber wenn jemand auf Basis des Plans einen Code schreibt, der explizit invited_at:null erwartet/prueft, koennte eine Spalte fehlen. Geringfuegig, aber Teil des Musters 'Plan beschreibt Code minimal anders als Realitaet'. | Formulierung praezisieren: 'invited_at bleibt unbelegt (DB-default null)'. Kein Code-Risiko, nur Genauigkeit. |
| 8 | low | scheduler_events.org_id NOT NULL + ON DELETE CASCADE auf organizations, aber research_plans.org_id ist NULLABLE. Wenn jemals ein Plan mit org_id=null existiert (der Plan erwaehnt 'org_id nullable fuer externe Pools'), kann fuer ihn KEIN scheduler_event geschrieben werden (NOT NULL-Verletzung). Der Aktivierungs-Cron wuerde bei so einem Plan beim Event-Insert crashen. | Entweder scheduler_events.org_id nullable lassen (konsistent mit research_plans) ODER im Cron explizit Plaene mit org_id=null ueberspringen (sie sind ohnehin nicht org-scoped sichtbar). Die NULL-org-Realitaet von research_plans im Datenmodell-Abschnitt benennen. |

### 16.2 Fehlende / zu dünne Abschnitte

1. Rollback / Storno-Semantik unvollstaendig: §11 sagt 'Archivierung raeumt scheduled_activation_at', aber es fehlt eine vollstaendige Zustandsmatrix. Was passiert mit activation_state, wenn ein geplanter Plan manuell aktiviert wird (Override), waehrend der Cron-Tick GLEICHZEITIG laeuft? Der CAS schuetzt nur 'scheduled->activating', aber ein manueller activate() der unabhaengig vom Modus arbeitet (§6 'Manuell arbeitet unabhaengig vom Modus, sofort') kann mit dem Cron-CAS um dieselbe Zeile rennen — beide lesen activation_state='scheduled', beide versuchen den CAS. Das ist zwar at-most-once, aber die Faelle 'manueller Klick verliert gegen Cron' bzw. umgekehrt sind nicht durchgespielt (UX: User klickt 'Jetzt aktivieren', bekommt aber 'No-op' weil Cron 5ms vorher gewann).
2. Konkrete Cron-Recovery bei Crash NACH status-Flip aber VOR Invite-Versand fehlt: Die Befunde (Agent 4, Huerde 'Cron crasht NACH Aktivierung aber VOR Mails') benennen das explizit, der Plan adressiert es NICHT. activation_state='activated' + status='active' ist gesetzt, aber 'send_state=deferred'-Invites sind noch nicht raus. Naechster Tick findet den Plan nicht mehr (activation_state!='scheduled'). Wer versendet die haengenden deferred-Invites? Es braucht einen ZWEITEN, vom Aktivierungs-CAS getrennten Cron-Pass ueber 'send_state=deferred AND plan.status=active'. Das fehlt komplett.
3. Migrationsreihenfolge vs. Read-Mapper-Deploy-Ordering fehlt: Der Plan fuegt Spalten additiv hinzu (gut), aber sagt nicht, ob die TS-Read-Mapper VOR oder NACH der Migration deployen muessen. Bei coerce-Pattern (undefined->null) ist Code-vor-Migration sicher; das sollte explizit als Reihenfolge-Constraint stehen, sonst kippt ein Vercel-Deploy gegen alte DB.
4. Test fuer den 'failed->scheduled'-Retry-Pfad und die Endlosschleifen-Vermeidung fehlt in §14: Es wird CAS-Idempotenz getestet, aber NICHT, dass der Cron 'failed'-Zeilen wirklich ueberspringt (der partielle Index filtert nur auf activation_state='scheduled' — passt — aber ein Test, der einen 'failed'-Plan einschiebt und beweist, dass er NICHT erneut gegriffen wird, fehlt).
5. RLS-Policy-Definition fuer die neuen Tabellen ist nur als 'analog' referenziert, nicht ausgeschrieben. 'org_isolation analog research_plans' — aber research_plans hat org_id NULLABLE (fuer externe Pools), die Policy filtert NULL weg. Fuer scheduler_events ist org_id NOT NULL geplant; die exakte USING/WITH CHECK-Klausel (current_org_id()) muss ausgeschrieben werden, sonst Copy-Paste-Drift.

### 16.3 Unterspezifizierte Stellen

1. §6 'Manuell arbeitet unabhaengig vom Modus, sofort' — der konkrete CAS-Ausdruck fuer den manuellen Pfad fehlt. Bei einem nicht-terminierten draft (activation_state='none') greift der dokumentierte CAS auf 'scheduled' NICHT. Es ist offen, ob manuell 'jetzt' einen eigenen CAS auf status='draft' fahren soll (analog bridge-service .eq('status','open')) — das ist der haeufigste Pfad und unspezifiziert.
2. Empfaenger der Reminder/Aktivierungs-Mails (§8, O-2): 'Org-Owner/Ersteller' — aber im Datenmodell gibt es kein Feld, das den Ersteller eines research_plans festhaelt (kein created_by). scheduled_by_user_id ist neu und nur gesetzt, wenn jemand terminiert hat (nicht bei jedem Plan). Die Mailer-Adressaufloesung (welche E-Mail? aus welcher Tabelle? Zitadel liefert keine E-Mail an die DB) ist voellig unverankert. INTERVIEW_FROM_EMAIL ist der Absender, nicht der Empfaenger.
3. Die Behauptung '88 Status-Auswertungen wuerden brechen' (§4/H3) ist eine Zahl ohne Beleg — der Plan begruendet die 'kein 5. Enum-Wert'-Entscheidung damit, nennt aber keine Quelle/Grep. Die Designentscheidung (separates activation_state) ist trotzdem richtig, aber die Zahl ist unverankert und sollte als 'viele bestehende status-Vergleiche' formuliert oder per grep belegt werden.
4. Quota-Snapshot (§7 Pre-Check 4, H10): 'listQuotaProgress erfuellt' — unspezifiziert, was 'erfuellt' heisst. Gleichheit invited>=target pro Rolle? Und was passiert mit einer terminierten Auto-Aktivierung, deren Quota zum Termin NICHT erfuellt ist — failed (Plan sagt das) — aber der User wollte vielleicht 'mit dem starten, was da ist'. Die Semantik 'hartes Gate vs. weiche Warnung' ist nicht entschieden.
5. Prolific 'Auto-Versand vorbereiteter Pool-Invites beim Flip' (Phase 2) — die Transaktionsgrenze fehlt. Wird pro Invite einzeln versendet (n Resend-Calls, partial failure moeglich)? Was, wenn Resend bei Invite 7 von 25 fehlschlaegt — bleibt der Plan active mit 6 versendeten + 19 deferred? Der Plan nennt send_state='failed' fuer Invites, aber nicht den Recovery-Pass, der sie erneut greift.
6. 'MAX_ACTIVATIONS_PER_RUN Cap' (§5) ohne Zahl und ohne Aussage, was mit den ueberzaehligen faelligen Plaenen im selben Tick passiert (warten auf naechsten Tick = zusaetzliche Verspaetung oben auf die ohnehin grobe Cron-Granularitaet). Bei taeglichem Tick + Cap koennte ein Plan MEHRERE Tage zu spaet aktivieren.
7. Index-Praedikat 'where activation_state=scheduled and activation_mode=auto' (Migration 1) schliesst den manuellen Cron-Scan korrekt aus — aber der manuelle 'Jetzt aktivieren'-Pfad braucht KEINEN Index (Einzel-Zeile per id). Konsistent, aber der Plan sollte klarstellen, dass nur der Auto-Cron diesen Index nutzt; sonst Verwirrung, warum manual-Plaene 'nicht im Index' sind.

### 16.4 Pflicht-Fixes vor Implementierung (Kurzliste)

1. **`session.user.id`, nicht `session.user.sub`** — bereits inline korrigiert. `requireOrgIdOrError()` liefert nur `orgId`; die `userId` separat via `auth()`/`session.user.id` holen (src/auth.ts:105).
2. **`date-fns` ist NICHT installiert.** Entweder als neue Dependency deklarieren (`pnpm install --frozen-lockfile` + Lockfile-Commit, Turbopack-Symlink-Vorsicht) ODER native `Intl.DateTimeFormat` nutzen — wie das bestehende `proposeSlots` (scheduling.ts:104, bewusst ohne TZ-Lib).
3. **Manueller `Jetzt aktivieren`-Pfad braucht eigenen CAS.** Ein nicht-terminierter `draft` hat `activation_state=none` und läuft NICHT durch den `scheduled`-CAS. Lösung: manueller Pfad fährt CAS auf `status=draft` (analog bridge-service `.eq(status,open)`) — beide Eintrittspunkte (Cron + Button) in EINE CAS-Bedingung auflösen.
4. **Zweiter Cron-Pass für hängende deferred-Invites.** Wenn der Aktivierungs-Tick NACH dem status-Flip, aber VOR dem Invite-Versand crasht, findet ihn kein Folge-Tick mehr (`activation_state!=scheduled`). Separater Pass über `send_state=deferred AND plan.status=active` nötig (Crash-Recovery).
5. **Serverseitige Default-Zeiten via `Intl.DateTimeFormat({timeZone:Europe/Berlin})`**, nicht `setHours()`. `proposeSlots` (scheduling.ts:103-108) hat genau diesen Bug (Server läuft UTC auf Vercel). Browser-`datetime-local` + `toISOString()` ist korrekt; serverseitige Slot-Vorschläge nicht.
6. **1h-Vorlauf-Reminder erfordert ≥stündlichen Cron.** Bei täglichem Tick (Hobby-Plan) systematisch verfehlt — dann nur 24h-Reminder mit breitem Bucket realistisch. Hängt an O-1 (Cron-Tier).
