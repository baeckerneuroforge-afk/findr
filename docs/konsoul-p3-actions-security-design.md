# Konsoul P3 — Sicheres Aktions-Design

**ENTWURF zur Freigabe — KEIN Bau-Auftrag.**
Stand: 25.06.2026 · Autor: Design-Synthese aus 4 Recon-Briefs · Status: **Nur Analyse/Entwurf. In dieser Phase wird NICHTS gebaut** — keine Migration, kein Endpunkt, keine Aktion, kein UI-Code. Dieses Dokument beschreibt, *was* P3 tun würde, *warum es sicher ist*, und *in welcher Reihenfolge* es baubar wäre. Es ersetzt keine Migrations-Freigabe und keinen Rechts-Track. Jede SQL-Skizze ist **bewusst nicht anwendbar**.

---

---

## Sicherheits-/Compliance-Review (Vorab-Gate) — GO-MIT-AUFLAGEN

> Adversariales Review (6-Agent-Workflow, read-only). Jede tragende Behauptung dieses Entwurfs wurde gegen den echten Code im Worktree verifiziert. **Ergebnis: GO-MIT-AUFLAGEN** — keine harte Leitplanke verletzt, aber drei MEDIUM-Auflagen MÜSSEN vor dem Schreibpfad/der Aktivierung erfüllt sein.

**Verifiziert (keine Leitplanke verletzt):**
- **Keine Autonomie:** `propose_action` ist terminal wie `emit_guidance`/`delegate_cross_study` — die Engine baut den Vorschlag, das Modell liefert nur Argumente. Ausführung lebt ausschließlich im Frontend-Confirm-Klick gegen **bestehende** org-autoritative Routen, nie über `/api/konsoul-agent`.
- **orgId server-autoritativ:** alle vier Zielrouten ziehen `orgId` via `requireOrgIdOrError()` aus der Session + `getResearchPlan(orgId, planId)`; kein Modell-/Client-Pfad.
- **Keine verbotene Aktion:** Prolific-Publish/Invite/Invite-from-Pool/Open-Link stehen auf der harten Verbotsliste und existieren als Tool nicht. Die vier erlaubten Aktionen sind org-/portfolio-seitig, AI-Act Art.22-unkritisch.
- **Merge-sicher:** die additive Leaf-Tabelle wird von `delete_organization_data` UND `export_organization_data` automatisch erfasst (information_schema-Loop über `org_id`) — Hard-Delete + Export bleiben vollständig ohne Hand-Verdrahtung.

**Verbindliche Auflagen VOR dem Schreibpfad (3× MEDIUM):**
1. **Audit-Schema OHNE jedes Freitext-/`rationale`-/`answer`-Feld** + `counts`-jsonb auf erlaubte Zahlen-Keys whitelisten. Grund: `export_organization_data` dumpt JEDE Spalte an Org-Admins → ungerahmter Modell-Output dürfte nie in die Zeile driften (PII-Leak). + Test, der die Zeile gegen eine Freitext-Heuristik prüft.
2. **PII-Negativtest erweitern:** Aktions-Tool-Allowlist exakt auf `{create_study_draft, run_synthesis, run_personas, run_guide}` festnageln (`toEqual`) + Verbots-Substrings um `publish/invite/invite-from-pool/open-link/pool/send/screening/quota/stimulus/share/participant` ergänzen (Name UND input_schema). Heute fängt der Test diese Verben nicht.
3. **Retention-Frist + realer Sweep:** der bestehende Cron kappt NUR `interview_sessions`, nicht die Audit-Tabelle → sonst unbefristetes Wachstum (DSGVO-Speicherbegrenzung). Konkrete Frist (André/Anwalt) + eigener Cron-Zweig. Bis dahin höchstens P3.0 (Tabelle) bauen, Schreibpfad erst mit erfüllter Retention scharf schalten.

**LOW (beim Bau abhaken):** `current_org_id()`-RLS-Helper-Verfügbarkeit im Ziel-Branch prüfen; Audit-Schreibfehler in Sentry/App-Logs erfassen (fail-open lässt sonst stille Audit-Lücken); `proposed`-Schreibung VOR der Ausführung bevorzugen; Confirm sendet nie `status`/`orgId` mit.

**Bleibt Andrés/Anwalts Entscheidung:** Migrations-Freigabe; Rechts-Track für jede recruiting-/personen-nahe Empfehlung (nie als CTA).


## 0. Kontext und Leitidee

P1 (deterministische `SignalEngine`) und P2 (read-only Orchestrator mit `orgId`-Closure, Sonnet-Routing / Opus-Emit, `kind`-Diskriminator `grounded`/`interpretation`/`guidance`/`refusal`) liegen bereits im Worktree und sind **strikt read-only**. P3 ist **nicht grünes Feld**: Die Architektur kennt schon ein terminales, deterministisch gemapptes Tool (`delegate_cross_study`, Short-Circuit) und einen `kind`-Diskriminator als einzigen Render-Schalter im Panel.

**Eine Leitidee trägt das gesamte Design:**

> Konsoul **schlägt vor** — der Mensch **entscheidet** per Klick. Das Aktions-Tool produziert nur Text/Struktur (einen Vorschlag), genau wie `emit_guidance`. Es führt **nichts** aus. Die Ausführung lebt ausschließlich im Frontend-Confirm-Klick, der einen *bestehenden* org-scoped Endpunkt ruft. Das Modell sieht diesen Endpunkt nie, kennt die `orgId` nie, und kann ihn nie auslösen.

P3 ist damit eine **fünfte Tür** (neben `grounded`/`interpretation`/`guidance`/`refusal`): ein eigenes terminales Tool, ein fünfter `kind:'proposal'`, ein additiver Panel-Block, eine additive Audit-Tabelle. Alles fail-closed, alles per Allowlist.

---

## 1. Aktions-Katalog

### 1.1 Erlaubte Aktionen (Allowlist — fail-closed)

Genau **vier** Aktionstypen. Jeder andere Endpunkt ist per Default verboten (Whitelist statt Blacklist). Das Modell schlägt nur einen dieser vier Typen + optional eine `planId`/Studienfelder vor; die Ausführung ist ein server-seitiger Confirm-Handler gegen den **bestehenden** org-scoped Endpunkt.

| # | Aktion | Ziel-Endpunkt (bestehend, unverändert) | Überschreibt? | Idempotenz | Kosten | Confirm-Stärke |
|---|---|---|---|---|---|---|
| 1 | **Studie-Entwurf anlegen** | `POST /api/research/plans` | **Nein** — reiner INSERT, Status=`draft` per DB-Default | Nicht-idempotent im strengen Sinn (jeder Klick = neue Entwurfs-Zeile), aber **additiv & nicht-destruktiv** | Kein LLM | **Leicht** |
| 2 | **Leitfaden generieren** | `POST /api/research/plans/[id]/guide` | **JA — überschreibt `topic_script` wholesale** (Titel + Objective bleiben unberührt) | Im Ergebnis idempotent (jeder Lauf = frischer Leitfaden), aber **datenüberschreibend auf bestehenden Themen** | 1 Opus-Lauf (`maxDuration` lang) | **Mittel** (Warnung nur wenn `topic_script` schon befüllt) |
| 3 | **Synthese auslösen** | `POST /api/research/plans/[id]/synthesis` | **JA — `upsert` auf `study_synthesis`, `onConflict: org_id,plan_id`** → zweiter Lauf ersetzt die Synthese vollständig | Idempotent in der Zeile (genau 1 Synthese-Datensatz pro Plan), aber **destruktiv gegenüber der alten Synthese** | 1 langer Opus-Lauf (teuerste der vier) | **Stark** (Re-Run-Warnung „ersetzt bestehende Synthese") |
| 4 | **Personas erzeugen** | `POST /api/research/plans/[id]/personas` | **JA — `upsert` auf `study_synthesis` (`personas`-Felder), `onConflict: org_id,plan_id`** → Re-Run ersetzt Personas | Idempotent in der Zeile, aber **überschreibt vorhandene Personas** | 1 Opus-Lauf (nur `market_research`) | **Stark** (Re-Run-Warnung „ersetzt bestehende Personas") |

**Belege für das Überschreiben** (im Code verifiziert):
- `src/lib/synthesis/engine.ts:744-760` — Synthese-`upsert` `onConflict: org_id,plan_id`
- `src/lib/synthesis/audience-personas.ts:473-481` — Personas-`upsert` gleiches `onConflict`
- `src/lib/research/guide-generator.ts:338-373` — `topic_script` wholesale overwrite, mit explizitem Code-Kommentar: „Caller's responsibility to confirm the user wants to replace existing topics"

**Drei „Überschreibt"-Klassen** steuern die Confirm-Stärke:
- **Leicht** (neue Zeile, nicht-destruktiv): `create_study_draft`.
- **Mittel** (ersetzt Plan-Themen): `generate_guide` — Warnung nur, wenn `topic_script` bereits befüllt ist.
- **Stark** (ersetzt bestehende Synthese/Personas via `upsert onConflict`): `run_synthesis`, `generate_personas`. Konsoul muss „erstmalig erzeugen" von „Re-Run" am Vorhandensein des Datensatzes unterscheiden (Quelle: `getStudySynthesis` liefert `synthesized_at` + `based_on_count`).

**Kosten-Flag:** 3 der 4 Aktionen sind Opus-Läufe (`guide`, `synthesis`, `personas`). Nur `create_study_draft` ist LLM-frei. Die Confirm-UI kennzeichnet Opus-Aktionen als kostenverursachend (verhindert versehentliche teure Re-Runs).

### 1.2 Explizite Verbotsliste (rote Linien — hart, fail-closed)

Diese Endpunkte existieren als Tools **nicht** und werden **nie** von Konsoul aufgerufen — auch nicht nach Confirm. Der konstruktive Schutz: das Tool existiert schlicht nicht (wie die heute verbotenen PII-Reads).

| Verbotener Endpunkt | Wirkung | Warum verboten |
|---|---|---|
| `POST …/[id]/panel/publish` | Schaltet Prolific-Draft **live**, finanziert aus Workspace-Guthaben | **Geld-nah + Außenwirkung** |
| `POST …/[id]/invites` | Erzeugt Einladungen **mit `accessToken`** (Capability-Credential), versand-nah | **Teilnehmer-seitig**, scharfe Zugangs-Tokens |
| `POST …/[id]/invite-from-pool` | Lädt reale Pool-**Personen** in die Studie ein | **Personenbezogen** → Art. 22-Risiko |
| `POST …/[id]/open-link` (`create` / `set_status:active`) | Münzt/aktiviert öffentlichen Teilnahme-Link | **Open-Link scharf schalten** öffnet Studie für externe Teilnehmer |

**Weitere rote Linien im selben Baum** (gehören ebenfalls auf die Verbotsliste): `panel/sync`, `panel/test-study` (Prolific-Provider-Mutationen), `screening-questions`/`quotas` (formen scharfen Teilnehmer-Einlass), `participants/[id]` DELETE, `stimuli`/`stimulus` (Material-Mutation), `share` (externer Share-Link), `chat`/`agent` (LLM-Pfade ohne idempotenten org-Effekt).

**Default fail-closed:** Alles, was nicht auf der 4er-Whitelist steht, ist für Konsoul verboten. Eine vom Modell halluzinierte Aktion außerhalb der Allowlist führt zu `is_error` + Nudge, nie zu einem Vorschlag.

---

## 2. Confirm-Flow

### 2.1 Trennung Vorschlag ↔ Ausführung (konstruktiv)

Das Aktions-Tool ist ein **Emit-Tool, kein Read-Tool** — spiegelbildlich zu `EMIT_GUIDANCE_TOOL` und zur Short-Circuit-Mechanik von `delegate_cross_study`. **Die Engine baut den Vorschlag, nicht das Modell.** Das Modell liefert nur:
- die *Aktions-Auswahl* (`actionType` aus dem Enum),
- die *Ziel-`studyId`* (bei Re-Runs) bzw. *Studienfelder* (bei Create),
- die *menschenlesbare Begründung* (`rationale`-Prosa um übergebene Zahlen/Entitäten).

Die Engine **validiert deterministisch**:
- `studyId` gegen den bereits geladenen `PortfolioFacts`-Block (`acc.data`). Eine halluzinierte/fremde `studyId` → `is_error` + Nudge, **nie** ein Vorschlag (erster Org-Grenzschutz schon vor dem Klick).
- hängt die deterministische Vorbedingung an (z. B. `based_on_count` für Synthese/Personas, `hasSynthesis`-Flag für die Überschreib-Warnung) aus `acc.data`, nicht aus Modell-Prosa.

### 2.2 Sequenz (in Worten)

1. **Auslöser.** Entweder (A) proaktiv über ein deterministisches `SignalEngine`-Signal auf „Heute" (kein LLM), oder (B) dialogisch über eine Nutzerfrage im Panel („leg mir einen Entwurf an" / „starte die Synthese").
2. **Modell-Lauf (nur bei B).** Der Orchestrator läuft (Sonnet-Routing / Opus-Emit). Das Modell ruft das terminale `propose_action`-Tool mit `actionType` (+ ggf. `studyId`/Studienfelder + `rationale`).
3. **Engine baut Vorschlag.** Die Engine validiert `actionType` gegen die statische Allowlist, validiert `studyId` gegen den org-gefilterten `PortfolioFacts`, hängt die deterministische `precondition` (z. B. `based_on_count`, `destructive:true` falls `hasSynthesis`) an und baut **deterministisch** den `kind:'proposal'`-Envelope. **Der Loop endet terminal — kein zweiter Modell-Turn, keine Ausführung.**
4. **Audit-Schreibung #1.** Server-seitig wird `outcome:'proposed'` ins Audit-Log geschrieben (org_id aus Closure, nur Metadaten).
5. **Client zeigt Confirm-Karte.** Das Panel rendert nach `result.kind`: ein `ProposalBlock` als erster Zweig (vor `guidance`). Neutrale Karte mit Begründung + primärem „Bestätigen"-Button + unauffälligem „Verwerfen". Bei `destructive:true` (Synthese/Personas-Re-Run, oder Guide auf befülltem `topic_script`): **stärkere Warnung** + zweiter, bewusster Bestätigungsschritt (analog 2-stufiges Lösch-Gate).
6. **Nutzer-Klick.** Der Klick-Handler ruft **direkt den bestehenden org-scoped Endpunkt** (`POST /api/research/plans` bzw. `…/[id]/synthesis|personas|guide`) — **nicht** `/api/konsoul-agent`, **nicht** das Modell. Das Modell ist zu diesem Zeitpunkt schon terminal aus dem Spiel.
7. **Client-Body trägt nur `planId` + `actionType`** (bei Create: die Studienfelder). **Niemals `orgId`.**
8. **Server re-autorisiert.** Der Ziel-Endpunkt ruft selbst `requireOrgIdOrError()` (orgId frisch aus der NextAuth/Zitadel-Session), verifiziert Plan-Eigentum via `getResearchPlan(orgId, planId)` (→ 404 ohne Cross-Org-Leak), und delegiert erst dann an die Engine mit `(orgId, planId)`.
9. **Audit-Schreibung #2.** `outcome:'accepted'` (+ `resolved_at` Server-Clock). Verwerfen/Ignorieren → `outcome:'ignored'` analog.
10. **Erfolg/Fehler.** Bei Erfolg wechselt die Karte in einen ruhigen „erledigt"-Zustand mit Link auf das Ziel (wiederverwendet `hrefForSignal`). Bei Fehler: derselbe `danger-700`-Footer-Kanal wie heute.

### 2.3 Wo die „überschreibt"-Warnung greift und wie sie aufgebaut ist

Der einzige nicht-idempotente, destruktive P3-Fall ist der **Synthese-/Personas-Re-Run** (`upsert onConflict` → keine Historie). Vorbild ist das **2-stufige Lösch-Gate** (`deleteResearchPlan`): das *Wann* (Policy-Gate) ist Sache der Route/UI, das *Wie* (Mechanik) Sache des Service.

- **Daten für die Warnung** kommen aus `getStudySynthesis` (`src/lib/synthesis/service.ts:91`): `synthesized_at` + `based_on_count` existieren bereits → der Vorschlag sagt ehrlich: „Es gibt schon eine Synthese vom <Datum> auf Basis von N Interviews; ein erneuter Lauf ersetzt sie." **Reine Metadaten, kein Synthese-Inhalt** verlässt den Vorschlag (deckungsgleich mit der Konsoul-Regel: nur Flags/Counts, nie Prosa).
- **Stufung:** Anders als beim Lösch-Gate (das Roh-PII vernichtet) genügt hier **eine** bewusste Bestätigungs-Stufe, weil Rohdaten (Interviews) unberührt bleiben — nur das abgeleitete Artefakt wird ersetzt. Die UI rendert für `destructive:true` die stärkere Karte, für Entwurf-anlegen/Erst-Synthese/Erst-Personas die leichte Karte.

---

## 3. Audit-Tabelle — Migrations-Shape (SQL-Skizze, NICHT anwenden)

**Eine einzige additive Leaf-Tabelle.** Shape gespiegelt von `research_session_events` (die beste vorhandene Schablone: Leaf, `org_id`-FK `ON DELETE CASCADE`, kein inbound FK, Server-Clock = Retention-Uhr, Closed-Set-CHECK statt DB-Enum, RLS als Defense-in-depth). Speichert **nur org-seitige Metadaten**.

> **Diese SQL-Skizze ist bewusst NICHT anwendbar. Sie dient nur dem Review. Andrés Migrations-Freigabe ist erforderlich, bevor irgendetwas angewandt wird.**

```sql
-- ENTWURF — NICHT ANWENDEN. Migrations-Freigabe durch André erforderlich.
-- Eine additive Leaf-Tabelle, EU-Region (Supabase Frankfurt, dieselbe Instanz wie research_*).

create table if not exists konsoul_action_log (
  id            uuid primary key default gen_random_uuid(),

  -- org-autoritativ (aus Session-Closure, NIE aus Modell/Client).
  -- Einzige Verdrahtung, die für RLS + Org-Hard-Delete + Export nötig ist:
  org_id        uuid not null references organizations(id) on delete cascade,

  -- nullable, ON DELETE SET NULL: ein gelöschter Plan reißt das Audit-Metadatum
  -- nicht mit (analog product_discovery_insights.plan_id / bridge_suggestions).
  plan_id       uuid references research_plans(id) on delete set null,

  -- Closed-Set per CHECK (Muster event_type) — nie Prolific/Versand/Invite/Open-Link:
  action_type   text not null check (action_type in
                  ('create_study_draft','run_synthesis','run_personas','run_guide')),

  -- Transparenz/Reproduzierbarkeit: welches Modell erzeugte den Vorschlag:
  model         text,           -- z. B. 'claude-opus-4-8' / Sonnet-Routing-Modell
  model_version text,           -- bzw. Prompt-/Korpus-Version
  source        text check (source in ('heuristic','model','guidance')), -- SignalEngine vs. Modell-gerahmt

  -- datensparsam: NUR Zahlen, die das Signal trugen (z. B. based_on_count,
  -- Anzahl betroffener Studien). MUST NOT carry raw input/PII/Prosa/Affekt.
  counts        jsonb not null default '{}'::jsonb,

  -- akzeptiert/ignoriert-Status (server-gestempelt, nie aus Client):
  outcome       text not null default 'proposed'
                  check (outcome in ('proposed','accepted','ignored')),

  -- Server-Clock = autoritative Retention-Uhr (Muster created_at, NICHT untrusted ts_ms):
  proposed_at   timestamptz not null default now(),
  resolved_at   timestamptz
);

-- Defense-in-depth (service-role-Pfad umgeht RLS, app-seitig immer .eq("org_id", orgId)):
alter table konsoul_action_log enable row level security;
create policy org_isolation on konsoul_action_log
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Hinweis: Org-Hard-Delete (delete_organization_data) erfasst diese Tabelle AUTOMATISCH,
-- weil sie eine org_id-Spalte trägt (die Funktion scannt alle org_id-tragenden Tabellen).
-- Im Review verifizieren, dass sie dort UND im Org-Export mit-erfasst wird.
```

**Streng verboten in dieser Tabelle** (Plan §6 / DSGVO / Art. 22, deckungsgleich mit der L8-„kein-Affekt"-Regel und der Konsoul-PII-Negativregel): kein Teilnehmer-Text, kein Roh-Transkript, kein Affekt-/Emotions-/Verhaltens-Label, keine personenbezogene Empfehlung, keine Quote, keine Synthese-/Persona-Prosa, kein ungerahmter Modell-Output. Nur org-/portfolio-seitige Metadaten + Counts + Plan-IDs + Aktionstyp + Modell/Version + Zeit + accepted/ignored.

**Merge-Sicherheit:** `create table if not exists` + RLS + ein `Row/Insert/Update`-Triple in `src/lib/research/db.ts` (chirurgische Typ-Augmentation, Muster `research_session_events`). Keine Änderung an bestehenden Tabellen, kein Backfill, byte-identische Altpfade. Pre-migration-fail-safe: fehlende Tabelle → der Audit-Insert/Update schlägt fehl, wird geloggt, **der Hauptpfad bleibt unberührt** (Muster E4-Zweit-UPDATE).

**Schreibpfad:** ein `logKonsoulAction`-Helfer (neu, z. B. `src/lib/konsoul/audit.ts`), der `createResearchSupabase()` nutzt und immer mit der per Closure gebundenen `orgId` schreibt (Muster `ingestSessionEvents`). Zwei Schreibmomente: beim Vorschlag (`proposed`) und beim Confirm/Dismiss (`accepted`/`ignored` + `resolved_at`).

**EU-Region:** dieselbe Supabase-Instanz (Frankfurt) wie alle `research_*`-Tabellen — keine neue Infrastruktur, kein neuer Vendor, kein Kapitel-V-Transfer.

**Retention-Uhr:** `proposed_at`/`resolved_at` (Server-`now()`) sind die autoritative Uhr. **Offen (Andrés/Anwalts-Entscheidung, nicht im Code lösbar):** die konkrete Aufbewahrungsfrist + ob ein Retention-Cron sie kappt. Empfehlung: **eigene, getrennte Retention** (Muster wie `event_retention_days` getrennt von `interview_retention_days`), default kurz, `ignored` früher kappen. Die Tabelle ist dafür vorbereitet; die Frist selbst ist eine Policy-Entscheidung. Hinweis: Org-Metadaten sind **nicht** Teilnehmer-PII, fallen also nicht automatisch unter `interview_retention_days`.

---

## 4. Konsoul-Zustände `suggest`/`act` + Confirm-UX (additiv zu P2)

**Klarstellung:** Die Plan-Begriffe `suggest`/`act` sind **konzeptuelle Phasen** („Konsoul schlägt vor" → „Nutzer handelt"), nicht die heutigen Gesichts-SVG-Zustände. Sie docken an zwei Oberflächen an, die sich **ein gemeinsames Confirm-Primitiv** teilen (genau eine Stelle ruft den echten Endpunkt, genau ein Überschreib-Gate):

- **`suggest` proaktiv (Surface A — `KonsoulSuggestions.tsx`, „Heute"):** Ein deterministisches `SignalEngine`-Signal, das einer sicheren Aktion entspricht (z. B. `persona_gate`/`persona_quality` → Personas erzeugen), bekommt neben dem bestehenden „Studie öffnen"-Link einen **inline Confirm-Button**, der denselben org-scoped Endpunkt ruft. **Rein deterministisch, kein LLM** — der ehrlichste Pfad, sollte zuerst kommen.
- **`suggest` dialogisch (Surface B — `CrossStudyAgentPanel.tsx`):** Eine `kind:'proposal'`-Antwort auf eine Nutzerfrage. Durchläuft das Modell (vierte Tür), endet identisch in derselben Confirm-Karte.

`suggest` erzeugt **nie** Seiteneffekte; `act` ist **immer** ein expliziter, sichtbarer Klick. Es gibt **keinen** Zustand, in dem `suggest` automatisch in `act` übergeht.

**Neuer Response-`kind` (additiv zur `discriminatedUnion`, bestehende vier Zweige byte-gleich):**

```
kind: 'proposal'
answered: true
answer: string                  // Modell-Prosa: warum diese Aktion jetzt sinnvoll ist
proposal: {
  actionType: 'create_study_draft' | 'run_synthesis' | 'run_personas' | 'run_guide'
  targetStudyId?: string        // engine-validiert gegen PortfolioFacts; fehlt bei create
  targetTitle?: string          // nur create_study_draft
  label: string                 // i18n-Key, nicht freier Text
  precondition?: {...}          // deterministisch aus acc.data (based_on_count etc.)
  destructive?: boolean         // true bei run_synthesis/run_personas wenn vorhanden; guide wenn topic_script befüllt
}
data?: PortfolioFacts           // belegter Kontext für die Karte (wie bei guidance)
```

**Gesichts-Zustand:** `KonsoulState` bekommt einen `propose`-Zustand (fragend-aufmerksam, **neutraler Pip `?`**), abgeleitet aus `lastResult.kind`. **Kein grüner Pip für den Vorschlag selbst** — er ist nicht belegt, sondern eine Handlungs-Einladung. Grün bleibt konstruktiv nur über `grounded`. Ein bestätigter/abgeschlossener Vorschlag kann auf `answer` (grün) gehen. Alle Zustände reduced-motion-tauglich.

**Confirm-Karte:** visuell eigenständig (wie Interpretation-/Guidance-Block je ein eigenes Gewand). Primärer „Bestätigen"-Button + unauffälliges „Verwerfen". Bei `destructive:true` die stärkere 2-Schritt-Bestätigung mit „überschreibt deine bestehende Synthese/Personas"-Warnung. Opus-Aktionen tragen ein Kosten-Hinweis-Label.

**Laufzeit-Sicherheit:** `assertKonsoulResult` validiert den neuen Envelope mit. Bricht ein Builder den Proposal-Vertrag → `KonsoulAgentUnavailableError` → 500, **nie** ein ungültiger Vorschlag. Halluzinierte `studyId` → kein Vorschlag (Nudge). Unbekannter `actionType` → `is_error`. Budget erschöpft → bestehender `forceFinalGuidance`-Pfad (Vorschläge sind nie der erzwungene Final-Emit).

---

## 5. Compliance-Mapping (AI Act Art. 22 + DSGVO-Retention)

**Trennkriterium** (aus Plan §6 + Code-Präzedenz `task-success-judge.ts:43` „Art. 22 firebreak"): Eine Aktion ist Art.-22-**unkritisch**, wenn sie org-/portfolio-seitig, idempotent-genug, reversibel/folgenlos für Personen ist und **nichts über einen Menschen entscheidet**. Sobald eine Empfehlung eine **Person** betrifft (Recruiting, Einladung, Pool-Selektion, Versand), ist sie raus aus P3 → Rechts-Track.

| Aktion / Empfehlung | Art. 22 | DSGVO/Retention | Einstufung |
|---|---|---|---|
| Studie-**Entwurf** anlegen | unkritisch (Status `draft`, kein Teilnehmer-Kontakt, forscher-prüfbar) | nur Plan-Metadaten im Audit | ✅ **unkritisch** |
| **Synthese** auslösen | unkritisch (portfolio-seitig, kein Personen-Output) | Audit: nur `based_on_count` etc.; Re-Run überschreibt Artefakt, nicht Rohdaten | ✅ **unkritisch** — stärkere Überschreib-Warnung |
| **Personas** erzeugen | unkritisch — **Personas = Segment-/Cluster-Beschreibung, KEINE benannten Individuen**, kein Pro-Teilnehmer-Profiling | Audit: nur Counts | ✅ **unkritisch** (Profiling-Vermeidung wahren) |
| **Leitfaden** generieren | unkritisch (reines Studien-Artefakt) | Audit: nur Plan-ID | ✅ **unkritisch** |
| `navigate →` (Deep-Link) | unkritisch — **Client** klickt; Agent navigiert nie selbst | — | ✅ **unkritisch** |
| Recruiting-Empfehlung („Pool dünn in Segment X") | berührt Entscheidung über/für Personen | — | 🔴 **Rechts-Track** (Consent/AI-Act-Review **vor** P3; nie ungeprüft als CTA) |
| Prolific-Publish · Invite-Versand · Open-Link scharf · invite-from-pool | automatisierte personen-/geld-nahe Wirkung | scharfe Tokens / Außenwirkung | 🔴 **verboten in P3** (nicht mal nach Confirm) |

**Design-Anker (Art. 22 firebreak):** Wie bei `task-success-judge.ts` (LLM advisory, deterministischer/menschlicher Wert bleibt autoritativ) gilt: **Konsoul schlägt vor — der Mensch entscheidet.** Das Modell ist nie der entscheidende Akteur über eine Person. Empfehlungen bleiben strukturell org-seitig (Konsoul liest nur `makeKonsoulReadTools(orgId)`).

**Rote Linie AI Act (dauerhaft):** Keine Affekt-/Emotions-/Verhaltensbiometrie-Labels über Personen — weder in Empfehlung noch im Audit (RECHTSANKER `turn-signals.ts:32`, KI-VO Art. 5(1)(f)/Annex III 1(c)). Kein Pro-Teilnehmer-Profiling (Plan §3.1.1: Profiling killt die Art.-6(3)-Ausnahme).

**KI-Offenlegung/Transparenz:** Art. 50(1) richtet sich an Teilnehmer (bereits erfüllt); Konsoul P3 richtet sich an den **Forscher** → interne Transparenz ist Pflicht. UI macht `suggest` (neutraler Pip + „?", nie grünes ✓) und `act` (Trace mit Verb-Zeile) sichtbar; `grounded`/`interpretation`/`guidance` bleiben getrennt (`kind` setzt die **Engine**, nicht das Modell); jede Empfehlung zeigt Evidenz inline; Modell+Version werden auditiert.

**Was den Rechts-Track braucht (markiert, NICHT gebaut):**
1. Recruiting-/Pool-/Segment-Empfehlungen über Personen → Consent + AI-Act-Review zuerst.
2. Konkrete Audit-Retention-Frist + Cron-Kappung → Andrés/Anwalts-Entscheidung.
3. Verifikation, dass die neue Tabelle in `delete_organization_data` **und** `export_organization_data` mit-erfasst wird.

---

## 6. Phasierung / Risiko

**Reihenfolge (sicher → weniger sicher, ehrlichster Pfad zuerst):**

| Phase | Inhalt | Risiko | Warum diese Reihenfolge |
|---|---|---|---|
| **P3.0** | Audit-Tabelle (additiv) + `logKonsoulAction`-Helfer + Verifikation Org-Delete/Export-Erfassung | Sehr niedrig (additiv, fail-closed, kein Verhaltens-Change) | Fundament; muss **vor** jeder Aktion stehen, damit jeder Vorschlag von Anfang an auditiert ist. **Migration erst nach Andrés Freigabe.** |
| **P3.1** | **Deterministische `act`-Phase** in `KonsoulSuggestions` (Surface A): inline Confirm-Button an bestehenden Signal-Karten → ruft bestehenden Endpunkt. **Kein LLM.** Zuerst die **leichten/additiven** Aktionen: `create_study_draft`, Erst-Synthese, Erst-Personas, Leitfaden. | Niedrig (kein Modell im Pfad, nur deterministische Signale + bestehende org-scoped Endpunkte) | Ehrlichster Pfad — keine Halluzinations-Fläche. Liefert sofort Wert. |
| **P3.2** | **Dialogische `proposal`-Tür** (Surface B): neues terminales `propose_action`-Tool (Enum, eine Validierungsstelle), `kind:'proposal'`, `ProposalBlock` im Panel, `propose`-Gesicht. Vierte Prompt-Tür + Negativliste. | Mittel (Modell im Vorschlags-Pfad, aber terminal + engine-validiert + nie ausführend) | Baut auf dem bewährten Confirm-Primitiv aus P3.1 auf. |
| **P3.3** | **Stärkere Überschreib-Gates** für `run_synthesis`/`run_personas`-Re-Run (`destructive:true`, 2-stufige Bestätigung) + `generate_guide`-Warnung bei befülltem `topic_script`. | Mittel (destruktiv gegenüber Artefakt, nicht Rohdaten) | Erst aktivieren, wenn das leichte Confirm-Primitiv steht und getestet ist. |

**Bewusst DRAUSSEN (in P3 nicht baubar):**
- **Alles Teilnehmer-/Geld-/destruktiv-nahe:** Prolific-Publish, Invite-Versand, invite-from-pool, Open-Link scharf schalten, Screening/Quotas, Material-/Share-Mutationen, Participant-DELETE. Hart, fail-closed, kein Tool existiert.
- **Recruiting-/Personen-Empfehlungen** jeder Art → Rechts-Track zuerst.
- **Autonome Navigation/Ausführung** durch den Agenten — der Mensch klickt immer.
- **Konkrete Retention-Frist + Cron** — Policy-Entscheidung, nicht im Code lösbar.

**Tests, die jede Phase festnageln muss:**
1. Proposal-**Allowlist** — kein Versand-/Publish-/Invite-/Open-Link-Tool existiert (Negativtest auf die Tool-Defs, analog zum heutigen PII-Read-Negativtest).
2. `studyId`-Validierung gegen `PortfolioFacts` (fremde/halluzinierte ID → kein Vorschlag).
3. `orgId` **nie** im Confirm-Body; Ziel-Endpunkt zieht sie frisch aus der Session.
4. `assertKonsoulResult` akzeptiert den neuen Envelope; gebrochener Vertrag → 500, nie ungültiger Vorschlag.
5. Audit schreibt nur Metadaten (kein PII/Prosa/Affekt-Feld).

---

## 7. Offene Punkte für die Freigabe-Entscheidung

1. **Migrations-Freigabe (André):** Die Audit-Tabelle ist nur als SQL-Skizze entworfen — nicht angewandt.
2. **Retention-Frist + Cron (André/Anwalt):** konkrete Tage, getrennte Uhr, `ignored`-Frühkappung.
3. **Rechts-Track (Anwalt):** Recruiting-/Personen-Empfehlungen, falls sie je in Konsoul sollen.
4. **Design-Detail:** ein `propose_action`-Tool mit Enum (empfohlen, eine Validierungsstelle) vs. vier Einzel-Tools.
5. **i18n:** neuer `crossStudyAgent`-Namespace-Block (`proposalLabel`, `confirm`, Überschreib-Warnung, DE+EN) — analog zum bestehenden guidance/interpretation-Set.

---

## Anhang — Relevante Dateien (alle absolut)

**Sichere Ziel-Endpunkte (unverändert, org-autoritativ):**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/guide/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/synthesis/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/personas/route.ts`

**Überschreib-Belege:**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/synthesis/engine.ts:744-760`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/synthesis/audience-personas.ts:473-481`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/guide-generator.ts:338-373`
- Warnungs-Metadaten: `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/synthesis/service.ts:91`

**Rote Linien (verboten):**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/panel/publish/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/invites/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/invite-from-pool/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/research/plans/[id]/open-link/route.ts`

**Auth / orgId server-autoritativ:**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/auth/org.ts` (`requireOrgId`/`requireOrgIdOrError`, Z. 88-120)

**Audit-/Tabellen-Vorbilder + Org-Delete/Export:**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/supabase/migrations/20260723000003_research_session_events.sql`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/event-store.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/db.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/capture-consent.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/settings/delete-org.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/cron/retention/route.ts` + `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/settings/org-settings.ts`

**Lösch-Gate-Vorbild + Plan-Service:**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/plans-service.ts` (`deleteResearchPlan` Z. 1159-1199; `createResearchPlan` Z. 903; `getResearchPlan` Z. 367)

**Konsoul-Agent (P3-Aufsetzpunkt) + Compliance-Anker:**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/konsoul/agent/engine.ts` (Z. 63 Modell-Split; terminaler Zweig + Tool-Liste)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/konsoul/agent/tools.ts` (Z. 28/276 orgId-Closure; Tool-Defs + Allowlist)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/schemas/konsoul-agent.ts` (neuer `kind:'proposal'`-Zweig)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/konsoul/agent/prompts.ts` (vierte Tür + Negativliste)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/app/api/konsoul-agent/route.ts`
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/components/dashboard/CrossStudyAgentPanel.tsx` (ProposalBlock + Confirm-Klick)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/components/dashboard/KonsoulSuggestions.tsx` (deterministische `act`-Phase)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/components/dashboard/Konsoul.tsx` (neuer `propose`-Gesichtszustand)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/task-success-judge.ts:43` (Art. 22 firebreak-Präzedenz)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/src/lib/research/turn-signals.ts:32` (RECHTSANKER no-affect)

**Plan-Dokumente:**
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/docs/konsoul-orchestrator-plan.md` (§4C, §5, §6)
- `/Users/andrebacker/dev/findr/.claude/worktrees/elegant-sinoussi-94050d/docs/klymeo-ux-research-dsgvo-ai-act-plan-2026-06-22.md` (§3.1.1/3.1.2, §3.2, §6)