# Findr Screening (Phase 4, Baustein 1) — Plan

> Status: **PLAN, kein Code.** Diese Datei ist die einzige, die entsteht.
> Geschrieben ehrlich und abwägend. **🔶 ANNAHME** = gemeinsam zu entscheiden (André + Claude),
> **⚠️ RISIKO** = teuer/heikel/unsicher. Alle Code-Verweise sind am echten Stand von `main`
> (Commit `340db29`) gegroundet; Datei:Zeile-Angaben spiegeln den heutigen Repo-Zustand.

---

## 0. Kontext, Ziel — und zwei Korrekturen vorab, die alles Weitere prägen

**Ziel (aus dem Brief):** Bei Massen-Research mit großer externer Zielgruppe soll **vor** dem
KI-Interview ein kurzer, vom Researcher manuell definierter Qualifizierungs-Fragebogen laufen.
Sofort-Auswertung per **deterministischer Regel-Logik (keine KI)**: passt der Teilnehmer ins
Zielprofil → bestehendes Interview startet wie bisher; passt er nicht → freundliche Abweisung,
**kein** Interview. Aussortierte werden **abgewiesen, nicht aufgenommen** (sauberste Daten).

Beim Grounden im echten Code sind zwei Dinge aufgefallen, die der Brief anders annimmt. Beide
sind keine BlockER, aber sie bestimmen, **wo** Screening sitzt und **wie groß Etappe 4 wirklich ist**.

### Korrektur 1 — „Studien-Link, white-label" existiert heute nur als **Pro-Einladung-Token**, nicht als offener Studien-Link

Der Teilnehmer-Eintritt läuft **ausschließlich per-Invite**: `createResearchInvite()`
(`src/lib/research/research-orchestration.ts:219`) erzeugt pro eingeladener Person ein
unrate­bares `access_token` auf `research_invites`, das per E-Mail als `/interview/[token]`-Link
verschickt wird. Es gibt **keinen** studienweiten „jeder mit dem Link"-Eintritt. Der einzige
„share" im Research-Layer ist `synthesis_shares` (öffentliche **Ergebnis**-Links, read-only) —
für den Teilnehmer-Eintritt irrelevant. Der reservierte mandantenlose Pfad
(`research_plans.org_id = NULL`, im `getPublicSession`-Pfad 3 bewusst fail-closed) ist **nicht
verdrahtet**.

**Konsequenz:** „Massen-Research mit großer externer Zielgruppe" heißt heute praktisch:
Researcher importiert Kontakte (Bulk/CSV), jeder bekommt seinen **eigenen white-label Invite-Link**.
Screening setzt sich sauber **vor genau diesen per-Invite-Eintritt**. Das ist additiv und passt.
Ein wirklich **offener** Studien-Link („Posten in einer Community, beliebig viele anonyme Walk-ins")
ist ein **eigener, vorgelagerter Baustein** (externer Pool, nullable-org-Exposition) — heute nicht
da. ✅ **ENTSCHIEDEN:** Screening (dieser Bau) läuft auf dem **per-Invite-Pfad** (Bulk/CSV deckt
„Masse" ab). Der **offene Studien-Link ist als Baustein 2 entschieden** — ein eigener, fokussierter
Bau direkt **nach** E1–E4, **nicht** in diesem Bau (Details §9).

### Korrektur 2 — Es gibt schon ein „Screening", aber es zeigt in die **Gegenrichtung**

`20260620000000_participant_pool.sql` baut bereits *„deterministisches Screening (Rolle / Segment /
Tags)"* plus `research_plan_quotas`. Das ist **researcher-seitig, pre-invite, push**: der Researcher
filtert seinen eigenen Pool nach Attributen und setzt Quoten, **bevor** er einlädt. Der Header sagt
ausdrücklich *„KEINE KI … Kein Auto-Screening, keine generierten Fragen."*

Das **neue** Phase-4-Screening ist das **Gegenstück**: **inbound, teilnehmer-seitig, pull** — die
Person qualifiziert sich am Link selbst. Beide ergänzen sich, sie duplizieren sich nicht. Der Plan
nutzt **dasselbe Vokabular** (`role`/`segment` wie `participant_pool` / `product_discovery_insights`)
und verdrahtet damit den heute reservierten Wert `respondent_source='screening'` (siehe §2), statt
einen Parallelbegriff zu erfinden.

---

## 1. Bestandsaufnahme — Teilnehmer-Eintritt & Interview-Start (gegroundet)

### 1.1 Der echte Ablauf heute (per-Invite, **lazy** Session-Erzeugung)

| # | Schritt | Datei:Zeile |
|---|---|---|
| 1 | Invite + Token werden bei der Einladung erzeugt (vor jeder Session) | `research-orchestration.ts:219` (`createResearchInvite`) |
| 2 | E-Mail mit `/interview/[token]` rausgeschickt | `invite-orchestration.ts` (Versandpfad) |
| 3 | Teilnehmer klickt → Server-Page lädt Session | `src/app/interview/[token]/page.tsx:86` (`getCachedPublicSession`) |
| 4 | `getPublicSession`: Pfad 1 = bestehende Session per Token; **Pfad 2 = lazy-create** | `src/lib/voice-agent/session-service.ts:377`, Lazy-Zweig `:401-431` |
| 5 | Invite per Token auflösen (1:1, `.maybeSingle`) | `src/lib/research/scheduling.ts:150` (`findInviteByAccessToken`) |
| 6 | `createResearchInterview({orgId, planId, inviteId, language})` aufgerufen | `session-service.ts:424` → `research-orchestration.ts:90` |
| 7 | Plan- + Invite-Validierung (noch **keine** Zeile, **keine** KI) | `research-orchestration.ts:107`, `:120-138` |
| 8 | `createInterviewSession(...)` | `research-orchestration.ts:162` → `session-service.ts:243` |
| 9 | **Eröffnungs-Turn (Opus) feuert** + `interview_sessions`-INSERT (`status='open'`, `conversation=[opening]`) | `session-service.ts:271-291` (KI), `:301-321` (INSERT) |
| 10 | Branding laden, `InterviewChat` rendern | `page.tsx:99` (`getOrgBranding`), `:106-120` (Props) |

Spätere Teilnehmer-Eingaben gehen über `POST /api/interview/[token]`
(`route.ts:45-110`) → `advanceInterview()` (`session-service.ts:566`).

### 1.2 Wo genau das Screening hin muss — und warum die naheliegende Stelle zu spät ist

> **⚠️ RISIKO (das tragende):** Session-Zeile **und** der erste Opus-Turn entstehen in dem Moment,
> in dem der Teilnehmer den Link **öffnet** (Schritt 9, im GET-Pfad), **bevor** er irgendetwas
> eingibt. Ein Screening-Gate am `POST`/`advanceInterview` (`route.ts:81`) wäre **zu spät** — die
> Zeile existiert dann schon und das KI hat bereits begrüßt.

Der **saubere Einhängepunkt** (vom Verify-Agent am Code bestätigt): **vor** dem Aufruf von
`createInterviewSession`, d.h. in `createResearchInterview` **nach** der Invite-Validierung
(`research-orchestration.ts:120-138`) und **vor** `:162` — bzw. äquivalent: den **Lazy-create-Zweig
in `getPublicSession` (`session-service.ts:401-431`) gar nicht erst betreten**, solange Screening
konfiguriert und unbeantwortet ist. An diesem Punkt sind `orgId`, `planId`, `inviteId` und die
Invite-Zeile im Scope, es ist **keine** Zeile geschrieben und **kein** Opus-Turn ausgelöst →
Abweisung kostet null KI und hinterlässt null Daten (= „sauberste Daten", wie gewünscht).

Mechanik (Detail in §4/§7): Ist auf dem Plan ein Screening hinterlegt **und** existiert noch keine
Session, liefert die Page statt Lazy-create eine **„needs_screening"**-Ansicht. Der Teilnehmer
beantwortet, ein **neuer** schlanker Endpunkt wertet **deterministisch** aus:
**qualifiziert →** genau der bestehende `createResearchInterview`-Pfad läuft (Session + Interview wie
heute); **abgewiesen →** Rejection-Screen, **keine** Session.

### 1.3 White-label-Branding (wird wiederverwendet)

`getOrgBranding(orgId)` (`src/lib/settings/org-settings.ts:145`, Service-Role-Read, kein Login)
liefert `{ brandName, accentColor (#RRGGBB), logoUrl }`, Null-Werte → neutraler Fallback. In
`InterviewChat.tsx` wird `accentColor` als CSS-Custom-Property `--brand-accent` (`:186`) gesetzt,
Logo/Name bedingt gerendert. Nur `kind='research'` bekommt white-label, `post_loss`/`checkin` bleiben
Findr-gebrandet (`page.tsx:89`). **Screening-Seite und Rejection-Seite ziehen dasselbe
`getOrgBranding` + dieselben Props** — Branding ist gelöst, nichts Neues nötig.

### 1.4 Was schon da ist vs. neu

| Baustein | Status | Detail |
|---|---|---|
| `respondent_source='screening'` (CHECK-Wert) | **exists** | `product_discovery_insights`, live bestätigt: `CHECK (respondent_source = ANY (ARRAY['ai','screening']))` (`20260616…:58-60`). **Aber:** das ist die **Herkunft** der `respondent_role/_segment` **auf der per-Call-Insight** — **kein** Qualifiziert/Abgewiesen-Speicher. Code schreibt heute **immer** `'ai'`; `'screening'` ist *„reserviert, nicht verdrahtet"*. |
| `participant_pool` role/segment/tags + Quoten | **exists** | Researcher-seitiges Pre-Invite-Screening (Gegenrichtung, §0). Vokabular wiederverwenden. |
| White-label Branding-Pfad | **exists** | `getOrgBranding` + `InterviewChat`-Props + `--brand-accent`. |
| Lazy-Session-Erzeugung am per-Invite-Link | **exists** | `getPublicSession` Pfad 2. Das ist der Hebelpunkt. |
| Guide-Generator liefert `screeningQuestions` | **partial** | `guide-generator.ts:80-83` (optional, max 6 Strings), nur read-only Preview, **nicht persistiert**. = KI-Vorschlag-Keim (nur Ausblick, §8). |
| Screening-**Konfiguration** am Plan | **new** | Keine Spalte/Tabelle. Kein „screen"-Identifier existiert irgendwo im Schema (live-Scan leer). |
| Deterministische Filter-Logik (inbound) | **new** | — |
| Teilnehmer-Screening-Schritt + Rejection-Screen | **new** | `InterviewChat` hat heute nur binär `open`/`completed`, **kein** Mehrschritt-Gate. |
| Screening-**Ergebnis** je Teilnehmer | **new** | Kein Feld/Tabelle. |

---

## 2. Datenmodell

### 2.1 Screening-Fragen (Config) — additive `jsonb`-Spalte auf `research_plans`

Präzedenz: `research_plans.topic_script jsonb NOT NULL DEFAULT '[]'` ist bewusst **weich** (Validierung
im TS/Zod-Layer, nicht in der DB; Header `20260611…:37-38`). Screening ist konzeptionell ein
**eigener** Belang (nicht Interview-Inhalt), deshalb **eigene Spalte** statt Verschachtelung in
`topic_script`:

```
research_plans.screening_questions jsonb NOT NULL DEFAULT '[]'::jsonb
```

**Form (im TS via Zod validiert, DB bleibt weich):** Array von Fragen, jede mit stabiler `id`, `type`,
`prompt`, `required` und typ-spezifischem Zielprofil:

```jsonc
[
  { "id": "q1", "type": "single_choice", "prompt": "Deine Rolle?",
    "options": ["Founder","Head of Sales","SDR","Andere"],
    "accepted": ["Founder","Head of Sales"], "required": true },

  { "id": "q2", "type": "multi_choice", "prompt": "Womit arbeitet ihr?",
    "options": ["CRM","Outreach-Tool","Data-Warehouse"],
    "acceptedAny": ["CRM","Outreach-Tool"], "required": true },

  { "id": "q3", "type": "number_range", "prompt": "Mitarbeiterzahl?",
    "min": 50, "max": 5000, "required": true }
]
```

**Minimal nötige Frage-Typen (v1):**
- `single_choice` — `options[]` + `accepted[]` (Antwort muss in `accepted` liegen).
- `multi_choice` — `options[]` + `acceptedAny[]` (mind. eine gewählte Antwort liegt in `acceptedAny`;
  optional später `acceptedAll`/`forbidden`).
- `number_range` — `min`/`max` (z. B. Firmengröße; Antwort muss im Intervall liegen).

Mehr Typen (Freitext mit Keyword-Match, Datum) bewusst **nicht** in v1 — der Brief nennt genau
Rolle/Größe/Branche, das deckt single/multi/range ab.

### 2.2 Screening-**Ergebnis** je Teilnehmer — nur für **Qualifizierte**, am `interview_session`

Die Festentscheidung lautet: Abgewiesene werden **nicht aufgenommen** (sauberste Daten). Kombiniert
mit der Lazy-Mechanik (§1.2) entsteht für Abgewiesene ohnehin **keine Session-Zeile**. Daraus folgt
der leanste Speicherort:

```
interview_sessions.screening_answers jsonb NULL   -- nur bei Qualifizierten gesetzt
```

- **Qualifiziert:** die gegebenen Antworten werden beim (verzögerten) Session-Anlegen mitgeschrieben.
  Kein neuer Tabellen-Join, additiv, lebt genau dort, wo das Interview lebt.
- **Abgewiesen:** **gar keine Zeile** → kein `screening_answers`, kein Transkript, keine Insight.
- Optional (späteres Polish, §8): beim Synthese-Pfad der qualifizierten Antwort
  `product_discovery_insights.respondent_source='screening'` setzen (statt `'ai'`) und `respondent_role`/
  `_segment` aus den Screening-Antworten füllen — **damit wird der heute reservierte Wert endlich
  verdrahtet**. Das ist ein **Add-on**, kein E1-Muss.

> ✅ **ENTSCHIEDEN:** Ergebnis-Speicher der **Antworten** = `interview_sessions.screening_answers`
> (nur Qualifizierte). Für die **Abgewiesenen-Quote** kommt **zusätzlich** eine schlanke **anonyme**
> Zeile in `research_screening_responses` (§2.3) — beide Verdikte, dort aber ohne Wer/Was. So bleibt
> „sauberste Daten" gewahrt (Abgewiesene = nur eine Zahl, kein Profil, keine Antworten).

### 2.3 Abgewiesenen-Quote — anonyme Tabelle `research_screening_responses` (fester Teil von E4)

Damit der Researcher eine **Abgewiesenen-Quote pro Studie** sieht (wie viel % passte nicht ins
Profil), **ohne** dass für Abgewiesene ein Profil entsteht, schreibt jeder Screening-Abschluss **eine
bewusst anonyme Zeile**:

```
research_screening_responses (id, org_id, plan_id, verdict, created_at)
  verdict ∈ {'qualified','rejected'}   -- KEIN invite_id, KEIN Profil, KEINE Antworten
```

- Trägt **nur** `plan_id` + `verdict` + `created_at` — kein Wer (`invite_id`/Kontakt) und kein Was
  (Antworten). Die Quote ist eine reine **Zahl pro Studie**: `rejected / (qualified + rejected)`.
- **Qualifiziert:** Zeile `verdict='qualified'` **zusätzlich** zu `interview_sessions.screening_answers`
  (die Antworten leben am Interview, die Zähl-Zeile hier).
- **Abgewiesen:** **nur** diese Zeile `verdict='rejected'` — sonst nichts (keine Session, keine
  Antworten, kein Transkript).

So bleibt die Festentscheidung „sauberste Daten" intakt: über Abgewiesene existiert ausschließlich
eine anonyme Zähl-Zeile, niemals ein Profil. (Counting-Nuance: die Tabelle führt bewusst **kein**
`invite_id`, kann Mehrfach-Versuche desselben Abgewiesenen also nicht selbst deduplizieren — das hängt
an der Anti-Gaming-Entscheidung in §8; v1 zählt pro Screening-Abschluss.)

### 2.4 Additive Migration (Skizze — André wendet sie selbst im SQL-Editor an)

Zwei `add column if not exists` **plus eine neue, anonyme Tabelle**. Hausstil (`if not exists`, RLS
`org_isolation` gespiegelt von den Research-Tabellen, `notify pgrst` am Ende), **keine** Änderung an
bestehenden Spalten/CHECKs:

```sql
-- 202607NN000000_screening.sql  (additiv, idempotent)

alter table research_plans
  add column if not exists screening_questions jsonb not null default '[]'::jsonb;
-- Form/Validierung im TS-Layer (Zod), DB bleibt weich — wie topic_script.

alter table interview_sessions
  add column if not exists screening_answers jsonb;
-- Nur bei qualifizierten Teilnehmern gesetzt; abgewiesene erzeugen keine Session-Zeile.

-- Anonyme Quote pro Studie. KEIN Profil, KEINE Antworten — nur die Zahl.
create table if not exists research_screening_responses (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  plan_id    uuid not null references research_plans(id) on delete cascade,
  verdict    text not null check (verdict in ('qualified','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists research_screening_responses_plan_idx
  on research_screening_responses(plan_id, verdict);
alter table research_screening_responses enable row level security;
drop policy if exists research_screening_responses_org_isolation on research_screening_responses;
create policy research_screening_responses_org_isolation
  on research_screening_responses for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

notify pgrst, 'reload schema';
```

`research_plans`/`interview_sessions` haben bereits `org_isolation`; die neue Tabelle bekommt dieselbe
Policy (Sicherheitsnetz für Dashboard-/Anon-Clients). Der öffentliche Token-Pfad schreibt wie heute
über den Service-Role-Client (RLS-Bypass, manuell org-gefiltert). TS-Typen werden bis zur
`database.ts`-Regenerierung **inline-augmentiert** (Muster `bridge_suggestions` /
`src/lib/bridge/sales-to-cs.ts:329-417`).

---

## 3. Filter-Logik — deterministisch, keine KI

**Ort:** neues, reines Modul `src/lib/screening/` (Vorbild für „pure, isomorph, DB-frei,
unit-testbar": `src/lib/accounts/value.ts` Switch + `src/lib/health/aggregate.ts` Fold).

- `src/lib/schemas/screening.ts` — Zod-Schema für `ScreeningQuestion[]` **und** für die eingereichten
  `ScreeningAnswers` (Schema-Verzeichnis-Konvention `src/lib/schemas/{modul}.ts`, vgl. `risk.ts`,
  `synthesis.ts`).
- `src/lib/screening/evaluate.ts` — **eine reine Funktion**:
  `evaluateScreening(questions, answers): { qualified: boolean; perQuestion: Record<id, boolean> }`.

**Semantik v1 — strikt UND:** Der Teilnehmer ist **qualifiziert**, wenn **jede `required`-Frage**
passt:
- `single_choice`: Antwort ∈ `accepted`.
- `multi_choice`: Schnittmenge(gewählt, `acceptedAny`) ≠ ∅.
- `number_range`: `min ≤ Antwort ≤ max`.

Fehlende Pflichtantwort ⇒ nicht qualifiziert (fail-closed). Keine Frage konfiguriert ⇒ qualifiziert
(Screening ist dann ein No-op, Plan verhält sich wie heute).

> 🔶 **ANNAHME:** v1 = UND über alle `required`-Fragen. ODER-/Schwellen-Logik („mind. 3 von 5
> Kriterien") ist später eine reine Erweiterung der `evaluate`-Funktion, kein Schema-Bruch.

**Test (E1):** `src/lib/screening/evaluate.test.ts` (vitest, Vorbild `src/lib/schemas/risk.test.ts`)
gegen Fake-Frage/Antwort-Paare: jeder Typ passt/passt-nicht, Pflichtfeld fehlt, leere Config →
qualifiziert, Grenzwerte (`min`/`max` inklusiv). Komplett ohne DB, ohne KI, ohne Netz.

---

## 4. Teilnehmer-UI — Screening-Schritt + Abweisung (im white-label Pilot-Flow)

**Heute:** `InterviewChat.tsx` ist ein einziger Client-Component, binär gesteuert über
`isOpen = status === 'open'` (`:133`), Ternär `:250` (Eingabe vs. `CompletedPanel`). **Kein**
Mehrschritt-Gate, **kein** Consent-Screen, **keine** Rejection. Das Gespräch startet sofort mit dem
Eröffnungs-Turn.

**Neu (additiv, branding-erbend):**
1. Ein **Schritt-Router** zwischen Page und Interview. Sauberster Schnitt: ein schlanker Wrapper-
   Client-Component (`src/components/interview/`) der je nach Zustand rendert:
   `ScreeningForm` → `RejectionPanel` **oder** `InterviewChat`. Branding-Props (`brandName`,
   `accentColor`, `logoUrl`) werden vom Server (`page.tsx:99-120`) **unverändert durchgereicht** —
   `--brand-accent` gilt damit auch für Screening- und Rejection-Ansicht.
2. `ScreeningForm` — rendert `screening_questions` (single/multi/number) als simples Formular,
   reicht Antworten an den neuen Endpunkt (§7/E4).
3. `RejectionPanel` — freundlicher „Danke, du passt diesmal nicht ins Profil"-Screen, gebrandet,
   **kein** Interview, kein Re-Mount von `InterviewChat`.

**Server-Seite:** `page.tsx` (bzw. `getPublicSession`) liefert, wenn Screening konfiguriert und noch
keine Session existiert, eine **`needs_screening`**-Sicht (Plan-Titel + Fragen, **ohne** Lazy-create).
i18n: neue Namespaces `interview.screening.*` und `interview.rejection.*` in `messages/{de,en}.json`
(Session trägt bereits `language`, `page.tsx:93` → `NextIntlClientProvider`).

> 🔶 **ANNAHME:** Screening als **separater Formular-Schritt vor** dem Chat (nicht als KI-geführte
> Fragen im Gespräch). Das hält die Auswertung deterministisch und das Interview-Engine unberührt.

---

## 5. Researcher-UI — Screening-Fragen pro Studie definieren

**Heute** (Plan-Detailseite `src/app/(dashboard)/dashboard/research-plans/[id]/page.tsx`): Sektionen
Objective/Persona (read-only), Topics (read-only), Teilnehmer, **Quoten** (editierbar via
`PlanQuotaPanel`, ca. `:455-469`), Synthese, Lifecycle. Plan-Anlage über `ResearchPlanForm.tsx` +
`TopicEditor.tsx` (dynamischer Array-Editor: add/remove).

**Save-Muster zum Spiegeln (Quoten):** `PlanQuotaPanel` (lokaler Form-State) → `POST
/api/research/plans/[id]/quotas` mit `{role,target}` (Zod im Route) → `requireOrgIdOrError` +
`getResearchPlan` (Auth/Ownership) → Service `upsertQuota` → `router.refresh()`.

**Neu (eng am bestehenden Muster):**
- **`src/components/dashboard/ScreeningQuestionsPanel.tsx`** — spiegelt `PlanQuotaPanel`-Struktur:
  Liste vorhandener Fragen + Maske „Frage hinzufügen" (Prompt, Typ-Dropdown single/multi/number,
  je nach Typ Optionen + akzeptierte Werte / min-max), Entfernen, Speichern, `router.refresh()`.
  Reuse `TopicEditor`-Muster für die dynamische Optionsliste.
- **`POST /api/research/plans/[id]/screening-questions`** — spiegelt `quotas/route.ts`: Zod-Body
  (`ScreeningQuestion[]` aus `src/lib/schemas/screening.ts`), `requireOrgIdOrError` + `getResearchPlan`,
  Service-Write.
- **`src/lib/research/plans-service.ts`** — `UpdateResearchPlanInput` (`:177-184`) um
  `screeningQuestions?` erweitern; `screening_questions` analog `topic_script` schreiben/lesen
  (sparse update, `coerceTopics`-Analog `coerceScreeningQuestions` mit defensiver Normalisierung
  à la `synthesis.ts:73-99`). `ResearchPlanRow` in `src/lib/research/db.ts:118-128` um
  `screening_questions: Json` ergänzen (inline-augmentiert).
- **Platzierung:** neue Sektion auf der Detailseite **zwischen Teilnehmer und Quoten** („erst
  screenen, dann quotieren").

---

## 6. Was bleibt unangetastet

- **Interview-Engine** (`advanceInterview`, `nextResearchMessage`, Prompt-Bau,
  Turn-Loop in `session-service.ts:566+`) — **nicht angefasst**. Screening sitzt strikt davor;
  qualifiziert → es läuft **wörtlich der heutige** `createResearchInterview`-Pfad.
- **Studien-Synthese** (Stage-1-Classifier, Stage-2-Synthese, `product_discovery_insights`-Schreibpfad)
  — **nicht angefasst** in E1–E4. (Das optionale `respondent_source='screening'`-Stamping in §2.2 ist
  ein bewusst separates, späteres Add-on.)
- **Bestehender Invite-/Pool-/Quoten-Pfad** (`createResearchInvite`, `participant_pool`,
  `research_plan_quotas`, Bulk/CSV) — **nicht angefasst**, nur additiv ergänzt.
- **Ehrliche Abgrenzung:** Etappe 4 fasst **doch** eine Stelle am Rand an — die
  **Eintritts-/Orchestrierungs-Naht** (`getPublicSession` Lazy-Zweig / `createResearchInterview`),
  nämlich *wann* die Session erzeugt wird. Das ist **nicht** die Interview-Engine und **nicht** die
  Synthese — aber es ist mehr als „nur davor ein UI". Diese Naht ist der einzige Eingriff in
  Bestandscode; er ist additiv (No-op, wenn kein Screening konfiguriert ist).

---

## 7. Etappen-Plan (jede einzeln verifizierbar)

> Verifikation generell: **`tsc` + echter `next build`** (NIE `pnpm dev`), plus die je Etappe
> genannten Tests. Migration **additiv**, **André wendet sie selbst im SQL-Editor an** — Etappen, die
> die Spalte brauchen, werden erst nach „Migration steht" voll verifiziert.

### Etappe 1 — Datenmodell + Filter-Logik (gegen Fake-Antworten testbar)
**Bauen:** additive Migration (§2.4: zwei Spalten + anonyme `research_screening_responses`-Tabelle, von André angewandt); `src/lib/schemas/screening.ts` (Zod für
Fragen + Antworten); `src/lib/screening/evaluate.ts` (reine UND-Logik); inline-augmentierte Typen.
**Verifizieren:** `evaluate.test.ts` (vitest) gegen Fake-Paare grün — qualifiziert/abgewiesen je Typ,
Pflichtfeld, Grenzwerte, leere Config → qualifiziert. `tsc` + `build` grün. **Kein** UI, **keine** KI,
**kein** Eintritts-Pfad berührt. *Warum zuerst:* das Herz (deterministische Auswertung) ist isoliert
und ohne jede Infrastruktur beweisbar.

### Etappe 2 — Researcher-UI: Fragen anlegen
**Bauen:** `ScreeningQuestionsPanel.tsx`, `POST …/screening-questions`, `plans-service`-Round-Trip,
Detailseiten-Sektion. **Verifizieren:** Fragen anlegen/bearbeiten/löschen, speichern, Reload zeigt sie;
Round-Trip in DB korrekt; `tsc` + `build` grün. (Persistenz prüfbar per DB-Read, keine KI.)

### Etappe 3 — Teilnehmer-UI: Screening-Seite + Abweisung
**Bauen:** Schritt-Router-Wrapper, `ScreeningForm`, `RejectionPanel`, i18n-Namespaces, `needs_screening`-
Sicht (zunächst gegen einen Plan **mit** Fragen, **ohne** die Auswertung zu verdrahten —
Render-/Branding-Beweis). **Verifizieren:** Seite rendert Fragen white-label korrekt; Rejection-Screen
rendert gebrandet; **es wird keine echte Session erzeugt**; `tsc` + `build` grün.

### Etappe 4 — Verdrahtung in den echten Interview-Start
**Bauen:** Lazy-create **deferren**, wenn Screening konfiguriert & unbeantwortet (Gate vor
`createResearchInterview`→`createInterviewSession`); neuer `POST /api/interview/[token]/screen` →
`evaluateScreening` → **qualifiziert:** bestehender `createResearchInterview`-Pfad (+ `screening_answers`
mitschreiben) → Interview startet wie heute; **abgewiesen:** Rejection, keine Session. **Beide Verdikte
schreiben ZUSÄTZLICH genau eine anonyme `research_screening_responses`-Zeile** (`plan_id`, `verdict`,
`created_at` — kein Profil, keine Antworten) → Abgewiesenen-Quote pro Studie (§2.3). Idempotenz keyed
auf `invite.id` (re-entrant bei Refresh).
**Verifizieren (Fake-Antworten, ende-zu-ende):**
1. Plan **mit** Screening, passende Antworten → Session entsteht, Interview startet (Engine unverändert),
   `screening_answers` gesetzt **+ eine** anonyme Zeile `verdict='qualified'`.
2. Plan **mit** Screening, unpassende Antworten → **keine** `interview_sessions`-Zeile, **kein**
   Opus-Turn, Rejection-Screen, **nur eine** anonyme Zeile `verdict='rejected'` (kein Profil, keine
   Antworten).
3. Plan **ohne** Screening → unverändert wie heute (sofortiger Lazy-create), **keine** Response-Zeile.
4. Abgewiesenen-Quote pro Studie = `rejected / (qualified + rejected)` korrekt aus
   `research_screening_responses` gelesen.
`tsc` + `build` grün. (Ein realer Opus-Eröffnungs-Turn fällt nur im Qualifiziert-Fall an — bewusst
sparsam testen.)

---

## 8. Offene Fragen / Risiken

- ⚠️ **Lazy-create-Timing (tragend, §1.2).** Session + erster KI-Turn entstehen beim **Link-Öffnen**.
  Das Gate **muss** vor `createInterviewSession` sitzen (E4), sonst kostet jede Abweisung einen
  Opus-Turn und hinterlässt eine Zeile. Im Plan gelöst, aber es ist der Punkt, an dem E4 Bestandscode
  berührt.
- ✅ **Offener Studien-Link → ENTSCHIEDEN als Baustein 2 (§9).** Dieser Screening-Bau bleibt
  **per-Invite** (Bulk/CSV deckt „Masse"). Der echte offene Link (anonyme Walk-ins) ist der **nächste
  fokussierte Bau direkt nach E1–E4**, **nicht** in diesem Bau — Details in §9 (inkl. bewusst benanntem
  Datenleck-Risiko beim Öffnen des nullable-org-Pfads).
- 🔶 **Anti-Gaming / Re-Try.** Da Abgewiesene **keine** Zeile erzeugen (sauberste Daten), kann eine
  Person den Link erneut öffnen und mit **anderen** Antworten durchkommen. Blockieren würde heißen,
  Abgewiesene **doch** zu speichern (z. B. Token „verbraucht"/abgelehnt markieren) — widerspricht der
  Festentscheidung. **Trade-off bewusst entscheiden:** Re-Try zulassen (clean, gaming-anfällig) vs.
  minimaler Abweisungs-Marker am Invite (kein Anonym-Profil, aber „dieser Invite wurde abgelehnt").
- 🔶 **Screening-Abbruch.** Teilnehmer schließt den Tab mitten im Formular: keine Session, kein Record
  (clean). Vermutlich gewünscht — bestätigen.
- 🔶 **Pflicht- vs. optionale Fragen.** v1-Vorschlag: alle Fragen `required`, `required:false` möglich
  (optionale fließen nicht in die UND-Bedingung). Reicht das?
- ✅ **Zählung/Analytics → GELÖST durch `research_screening_responses` (§2.3, fester Teil von E4).**
  Weil Screening die Session-Erzeugung blockiert, gilt *Session-existiert ≈ Link-geöffnet* für
  Abgewiesene nicht mehr — genau dafür liefert die anonyme Quote-Tabelle die eigene Kennzahl:
  Abgewiesenen-Quote = `rejected / (qualified + rejected)` pro Studie, ganz ohne Profil. „Gestartete
  Interviews" bleiben wie gehabt aus den qualifizierten `interview_sessions` ableitbar (heute setzt
  nichts `invite.status` auf `in_progress`/`completed` — nur `scheduled`; das bleibt unverändert).
- 🔶 **`respondent_source='screening'` verdrahten?** Optionales Add-on (§2.2): qualifizierte
  Screening-Attribute in `respondent_role/_segment` + `respondent_source='screening'` auf der
  Synthese-Insight stempeln. Wertet die Synthese auf, ist aber **nicht** E1-Pflicht und der einzige
  Punkt, der den Synthese-Schreibpfad streifen würde. Jetzt oder später?
- 📝 **Terminologie-Korrektur:** Es gibt **keine** Spalte `flow_mode`. `interview_sessions` hat zwei
  getrennte Spalten `flow` (`post_loss|checkin|research|null`) und `mode` (`text|voice|video`). Für
  Screening brauchen wir **keine** neuen `flow`/`kind`/`status`-CHECK-Werte (das Gate sitzt **vor** der
  Session, nicht als Session-Status) — additive Spalten genügen, **keine** CHECK-ALTERs.

### Optionaler Ausblick (NICHT in diesem Bau)
Der **KI-Vorschlag** von Screening-Fragen ist bereits halb angelegt: `guide-generator.ts:80-83` emittiert
ein optionales `screeningQuestions`-Array (max 6 Strings), heute nur read-only Preview, **nicht**
persistiert. Ein späterer, eigener Baustein könnte diesen Vorschlag als **Startwert** in den manuellen
Editor (§5) schreiben — der Researcher editiert/bestätigt, die Auswertung bleibt deterministisch. Das
ist ausdrücklich **kein** Teil dieses Plans (kein Eval, kein Guthaben nötig).

---

## 9. Nächster Baustein nach E1–E4 — Baustein 2: Offener Studien-Link

**Entschieden:** direkt nach diesem Screening-Bau folgt ein **eigener, fokussierter Bau** für den
**offenen Studien-Link** — ein studienweiter white-label Link für **anonyme Walk-ins** (Posten in
Communities, Social, QR), ohne pro Person vorab einen Invite anzulegen. **Nicht Teil dieses Baus.**
Was Baustein 2 lösen muss (grob):

- **Nullable-org-Pfad sicher öffnen.** Heute sind `research_plans`/`research_invites` mit
  `org_id = NULL` per RLS bewusst unsichtbar (fail-closed; `getPublicSession`-Pfad 3 bricht ab).
  Baustein 2 exponiert genau diese Zeilen kontrolliert über einen Studien-Token.
  ⚠️ **RISIKO (Datenleck) — der heikle Teil:** ein zu weit geöffneter Pfad legt fremde Studien/
  Teilnehmer offen. Token-scoped, server-seitig, eng getestet; vor Live ein bewusster Sicherheits-Review.
- **Eigener Ergebnis-/Identitäts-Speicher.** Ohne Vorab-Invite gibt es keinen `invite.id` als
  Schlüssel — qualifizierte Walk-ins brauchen einen anderen Anlege-Pfad (anonyme Session bzw.
  on-the-fly Invite/Respondent). Die anonyme Quote-Tabelle (§2.3) trägt bereits; die **Antworten**
  Qualifizierter brauchen einen Walk-in-tauglichen Ort.
- **Anti-Gaming / Rate-Limiting** wird hier schärfer (offener Link = größere Missbrauchsfläche) — die
  in §8 offene Re-Try-Frage wird in Baustein 2 mitentschieden.

Screening (E1–E4) ist so gebaut, dass es **unverändert** auch hinter dem offenen Link greift: die
deterministische Auswertung (§3) und die Config (§2.1) sind eintritts-pfad-agnostisch.

---

## Verifikation des Gesamt-Bausteins (Zusammenfassung)
1. **E1:** `evaluate.test.ts` grün (alle Typen, Pflichtfeld, Grenzwerte, leere Config). `tsc`+`build`.
2. **E2:** Fragen anlegen → DB-Round-Trip korrekt; Reload zeigt sie. `tsc`+`build`.
3. **E3:** Screening- + Rejection-Seite rendern white-label; keine Session erzeugt. `tsc`+`build`.
4. **E4 (ende-zu-ende, Fake-Antworten):** passt → Session+Interview **+ anonyme Quote-Zeile
   (`qualified`)**; passt nicht → **nur** anonyme Quote-Zeile (`rejected`), keine Session/Antworten,
   Rejection; kein Screening → unverändert; Abgewiesenen-Quote pro Studie korrekt. `tsc`+`build`.
Migrationen additiv (André im SQL-Editor); **kein `pnpm dev`**; nicht mergen ohne Freigabe.
