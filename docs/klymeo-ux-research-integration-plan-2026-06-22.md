# Klymeo · Konkreter Integrationsplan: UX Research / Usability-Testing

**Status:** Bau-Bauplan (geparkt bis zahlender Kunde). **Stand:** 22. Juni 2026.
**Baut auf:** [docs/klymeo-ux-research-dsgvo-ai-act-plan-2026-06-22.md](docs/klymeo-ux-research-dsgvo-ai-act-plan-2026-06-22.md) (Bestandsaufnahme + Recht) und der ursprünglichen Roadmap.
**Zweck:** Das *Wie* — eine einzige, in sich stimmige, additive Integration in die bestehende Struktur, so dass UX Research so gut und so konform wie möglich umgesetzt werden kann. **Nur Plan. Kein Code geändert.**

> Dieser Plan ist das Ergebnis einer gegroundeten Design-Fan-out (7 Facetten gegen den echten Code verifiziert) plus zwei adversarialer Kritiker (Compliance + Architektur). Die Kritiker haben echte Konflikte und drei Irrtümer über den Ist-Code gefunden; alle sind hier **schon aufgelöst** (siehe §9). Wo die Kritiker Code-Annahmen widerlegt haben, steht die Korrektur direkt im Plan.

---

## 0. Leitentscheidungen (was zuerst feststehen muss)

Diese acht Entscheidungen lösen die Widersprüche zwischen den Bausteinen auf. Sie sind die Grundlage des ganzen Plans:

| # | Entscheidung | Warum |
|---|---|---|
| **L1** | Usability ist ein **`use_case`** (`'usability_test'`) innerhalb `study_type='market_research'`, **kein** neuer `study_type`, **kein** Master-Flag. | `study_type` ist der immutable Synthese-/Listen-Diskriminator; ein dritter Typ würde `getMarketResearchPlanIds`, beide Listen-Seiten und den Synthese-Router forken. `use_case` nutzt exakt das vorhandene `needsStimulus`-Gating + Preset-Maschinerie → **ein** Create-Pfad. |
| **L2** | **`use_case` braucht KEINE Migration.** Anders als `study_type` hat `use_case` **keine CHECK-Constraint** (Validierung liegt in `coerceUseCase` + Zod). `'usability_test'` nur in der TS-Union, `coerceUseCase` und dem Zod-Enum ergänzen. | Vom Architektur-Kritiker gegen den Code verifiziert ([20260703000004_research_plan_use_case.sql](supabase/migrations/20260703000004_research_plan_use_case.sql) = `add column … text`, kein CHECK). Eine „CHECK-swap"-Migration würde fehlschlagen oder ein neues Constraint einführen (Verhaltensänderung). |
| **L3** | **Drei granulare Tier-Flags** auf `research_plans` (alle `boolean NOT NULL DEFAULT false`): `event_tracking_enabled` (Interaktions-Events), `replay_capture_enabled` (Session-Replay), `visual_capture_enabled` (Screen-Sampling, **existiert schon**). | Kanonische Namen (von 4/6 Facetten genutzt). Spiegelt `visual_capture_enabled`/`signals_enabled` byte-genau. Drei unabhängige Schalter = granulare Einwilligung. |
| **L4** | **Consent: drei eigene Spalten** auf `interview_sessions` — `events_consent_at`, `replay_consent_at`, `screen_consent_at` (timestamptz, nullable) + `instrumentation_consent_version` (text). **Nicht** eine JSONB-Spalte. | Spiegelt das **bewährte** `consent_accepted_at` + `markSessionConsentByToken` `WHERE … IS NULL`-Idempotenz-Muster **verbatim**. JSONB bräuchte ein neues Merge-Idempotenz-Idiom (Korrektheitsrisiko auf einem rechtlich tragenden Fail-Closed-Pfad). Spalten reisen ebenso automatisch in Export/Delete mit (Whole-Row `to_jsonb`). *(Alternative JSONB `consent_purposes` möglich — atomarer Multi-Write, aber neues Idiom; für v1 nicht empfohlen.)* |
| **L5** | **Events = eigene Leaf-Tabelle** `research_session_events` (FK rein, kein FK raus), **nicht** sealed-JSONB auf der Session. Eigentümer: Event-Store-Facette. Zeitspalte einheitlich `ts_ms`. | Skaliert für Volumen, eigener Retention-Sweep, saubere RLS + ON DELETE CASCADE. Leaf = Org-Hard-Delete bleibt sauber. |
| **L6** | **Server rechnet die Zahlen.** `task_result` (pro Session) und der Synthese-Block werden **serverseitig** aus den Events berechnet — nie vom Client, nie vom LLM. Exaktes E4/E7-Muster (`signals.ts` „ZAHLEN RECHNET DER SERVER, NIE DAS MODELL"). | Verhindert erfundene Metriken; die bestehenden Anti-Halluzinations-Gates bleiben intakt. |
| **L7** | **Ein gemeinsamer `assertCaptureConsent(session, tier)`-Helper** ist die *einzige* Stelle, an der jede Capture-/Ingest-/Upload-Route fail-closed gegen den gespeicherten Consent-Stempel prüft. | Der Compliance-Kritiker fand: die bestehende `/visual-capture`-Route prüft **nur** das Studien-Flag, **keinen** Consent-Stempel (heute fail-**open**). Ein zentraler Helper schließt diese Lücke an genau einem Ort + Regressionstest. |
| **L8** | **Rote Linie strukturell, nicht nur im Prompt.** Kein Affekt-Feld in irgendeinem Metrik-Schema (`.strict()` Zod), `event_type` als geschlossenes CHECK-Enum ohne Voice/Face/Webcam-Kanal, `RECHTSANKER`-Kommentar + harter Eval-Gate (exitCode=1). | Der Compliance-Kritiker fand: ein Affekt-Labeling-System (`AFFECT_STATES`) existiert **schon** in `turn-signals.ts`/`signals.ts`, das die Synthese-Facette klont — ein Entwickler könnte das `affects`-Feld versehentlich durchschleifen. |

---

## 1. Verortung in der bestehenden Struktur (eine Landkarte)

Jedes neue Teil dockt an einem vorhandenen Seam an — nichts wird parallel neu gebaut:

```
SETUP            research_plans  ─ use_case='usability_test' (L1/L2)
                                 ├ + task_definition jsonb            (Aufgabe + Erfolgskriterium)
                                 ├ + event_tracking_enabled  (L3)     ┐ drei Tier-
                                 ├ + replay_capture_enabled  (L3)     │ Schalter,
                                 └   visual_capture_enabled (existiert)┘ default OFF
   Form: ResearchPlanForm.tsx → exakt das needsStimulus-Gating (neuer needsTask-Zweig)

CONSENT          interview_sessions ─ consent_accepted_at (Basis, existiert, unverändert)
   (3 Schichten)                    ├ + events_consent_at   (L4)  ┐ je timestamptz,
                                    ├ + replay_consent_at   (L4)  │ server-gestempelt,
                                    ├ + screen_consent_at   (L4)  │ idempotent WHERE IS NULL
                                    └ + instrumentation_consent_version
   Gate-UI: ConsentPurposeToggles in InviteConsentGate UND OpenLinkEntry.ConsentStep
   Stempel: markSessionConsentByToken(token, version, purposes?)  ← erweitert, kein neuer Pfad
   Choke-Point: assertCaptureConsent(session, tier)  (L7) in JEDER Capture-Route

PROTOTYP &       Teilnehmer-Flow (interview/[token]/page.tsx, InterviewChat.tsx)
INSTRUMENT.        ├ PrototypeSurface.tsx  (First-Party-iFrame, neben dem Chat wie der Stimulus)
                   ├ collector.ts          (rrweb, allow-list-Masking, lädt erst NACH Consent)
                   └ getDisplayMedia        (Screen-Sampling, existiert, default OFF, tab-only)

EVENT-STORE      research_session_events  (NEU, Leaf, ts_ms, org_id NOT NULL, RLS)  (L5)
                 interview_sessions ─ + task_result jsonb (server-berechnet, L6)
                                    └ + replay_ref text (Pointer in EU-Bucket)
   Route: POST /api/interview/[token]/events  ← klont /visual-capture gate-before-spend
   Server: event-store.ts computeTaskResult()  ← berechnet success/time/clicks/friction

REPLAY           research_session_replays (NEU, Leaf, org_id NOT NULL!, private EU-Bucket)
                 Bucket: research-session-replays (public=false, signed URLs only)
   Viewer: ReplayViewerPanel.tsx (rrweb-player, org-gated, kurzlebige signed download URLs)

SYNTHESE (E8)    study_synthesis ─ + interaction_summary jsonb (Server-Fakten, einzige UI-Quelle)
                                  └ + interaction_observations jsonb (LLM-Prosa, gegroundet)
   interaction.ts loadSynthesisInteractionInputs()  ← klont signals.ts/stimuli.ts exakt
   engine.ts: sealSynthesisExtras(..., hadInteraction=false)  ← letztes Arg, default

LÖSCHEN/         withdrawSessionByToken  → CASCADE Events + Bucket-Objekt-Wipe (erweitert)
RETENTION        /api/cron/retention     → + event/replay-Sweep (event_/replay_retention_days)
                 delete_organization_data → DB-Rows automatisch; ABER Storage-Wipe ist NEU (§9 C-B)
```

---

## 2. Datenmodell (kanonisch, eine monotone Migrations-Serie)

Eine einzige, durchnummerierte Serie (keine Sechsfach-Kollision auf `20260723000000`). Reihenfolge = Bauphasen (§8). **Regel: Schreib-Pfad-Migration landet IN PROD, bevor der schreibende Code merged** (die `started_at`-Lehre).

| Migration | Inhalt | Additiv? |
|---|---|---|
| *(keine)* | `use_case='usability_test'` → nur TS-Union + `coerceUseCase` + Zod (L2) | — |
| `…000_research_plan_task_definition.sql` | `research_plans.task_definition jsonb NULL` (soft shape, kein DB-Enum) | ✅ |
| `…001_research_plan_capture_flags.sql` | `event_tracking_enabled` + `replay_capture_enabled` `bool NOT NULL DEFAULT false` (`visual_capture_enabled` existiert) | ✅ |
| `…002_interview_session_consent_tiers.sql` | `events_consent_at`, `replay_consent_at`, `screen_consent_at timestamptz NULL` + `instrumentation_consent_version text NULL` (L4) | ✅ |
| `…003_research_session_events.sql` | Leaf-Tabelle (L5); `event_type` **CHECK-Enum** (`click/scroll/dwell/input_focus/input_blur/nav/task_start/task_complete/task_abandon`); `ts_ms bigint`; `org_id NOT NULL → organizations ON DELETE CASCADE`; RLS `org_id = current_org_id()`; idx `(session_id, ts_ms)`, `(org_id, created_at)` | ✅ |
| `…004_interview_session_task_result.sql` | `interview_sessions.task_result jsonb NULL` + `replay_ref text NULL` | ✅ |
| `…005_org_event_retention.sql` | `org_settings.event_retention_days int NULL` CHECK `>=1` | ✅ |
| `…006_research_session_replays.sql` | Leaf-Tabelle; **`org_id NOT NULL → organizations ON DELETE CASCADE`** (nicht nullable! §9 Arch-7); `session_id ON DELETE CASCADE`; `replay_kind`, `storage_path`, `chunk_index`, `size_bytes`, `masking_profile`, `expires_at NOT NULL`; RLS org-isolation | ✅ |
| `…007_research_session_replays_bucket.sql` | **privater** Bucket `research-session-replays` (`public=false`), EU, 25 MB/Objekt, MIME `application/octet-stream`/`json` (+ optional `image/jpeg`), **kein** Audio-MIME | ✅ |
| `…008_org_replay_retention.sql` | `org_settings.replay_retention_days int NULL` CHECK `1..90` | ✅ |
| `…009_study_synthesis_interaction.sql` | `study_synthesis.interaction_summary jsonb NULL` + `interaction_observations jsonb NULL` (Form von [20260704000003](supabase/migrations) / E7) | ✅ |

**Retention-Präzedenz (eindeutig):** Events werden gelöscht nach `event_retention_days ?? interview_retention_days`; Replays nach `replay_retention_days ?? event_retention_days ?? interview_retention_days`. Sonst CASCADE mit der Session.

**Soft-Shapes (TS-Layer, kein DB-Enum):**
```ts
task_definition = { instruction: string, successCriterion: string|null, targetUrl: string|null,
                    prototypeHosting: 'first_party_iframe' | 'external_url' | 'screen_share' }  // 'figma_embed' siehe §9 C-E
task_result     = { version: 1, taskId?: string, success: boolean, timeOnTaskSeconds: number,
                    clickCount: number, frictionEvents: { type: string }[] }   // KEIN Affekt-Feld (L8)
interaction_summary = { version: 1, totalSessions, instrumentedSessions, successRatePercent|null,
                    meanTimeOnTaskSeconds|null, medianTimeOnTaskSeconds|null, meanClickCount|null,
                    medianClickCount|null, frictionSessions, frictionEventTotals: {…}, tasks: TaskMetric[] }
```

---

## 3. Die Drei-Schichten-Consent-Architektur (konkret)

Das ist das Herzstück der Konformität. Mapping der drei Rechtsschichten auf Code:

**Schicht ① §25 TDDDG (Geräte-Zugriff) — vorherige, fail-closed Einwilligung:**
- Drei Spalten `*_consent_at` (L4), server-gestempelt via `markSessionConsentByToken(token, version, purposes?)` — **erweitert** um ein optionales `purposes`-Argument, idempotent per Tier (`WHERE <tier>_consent_at IS NULL`). Kein neuer Stempel-Pfad.
- **Route-Fix (§9 Arch-6):** Die bestehende `/consent`-Route stempelt heute nur, wenn `status==='open' && consentAcceptedAt===null`. Für einen **zweiten** Tier-Grant nach der Basis würde sie ohne Stempel 204 zurückgeben. → Beim Erweitern: den Per-Purpose-Stempel **immer** laufen lassen, wenn `purposes` vorhanden ist, unabhängig von `consentAcceptedAt` (weiter idempotent pro Tier). Basis-Pfad (leerer Body) bleibt byte-identisch.
- **Choke-Point `assertCaptureConsent(session, tier)` (L7):** Jede Route, die Geräte-Daten annimmt (`/events`, `/replay/upload-url`, und **`/visual-capture`**), ruft diesen Helper und gibt 403 zurück, wenn der Stempel fehlt. **Wichtig:** `/visual-capture` prüft das heute **nicht** (fail-open, §9 C-A) — das Schließen dieser Lücke ist eine **harte Liefereinheit**, kein „ist schon da".
- **Skript-Defer:** `collector.ts` (rrweb) und `getDisplayMedia` werden erst **nach** der aufgelösten Consent-Antwort dynamisch importiert/aufgerufen — nie beim Laden (der klassische DSK-Rz.36-Fehler). Server-Re-Check in der Route ist der autoritative Choke-Point (ein gefälschter Client kann nichts persistieren).

**Schicht ② DSGVO (Verarbeitung):**
- Einwilligung als Grundlage (Art. 6(1)(a)); **gebündelter Text** der §25-Gerätezugriff **und** die DSGVO-Zwecke nennt (inkl. „fließt in die KI-Synthese") — sonst fehlt die DSGVO-Grundlage (DSK Rz. 29). `instrumentation_consent_version` pinnt den gezeigten Text (Art. 7(1)).
- `CONSENT_TEXT_VERSION`-Bump (`'2026-06-11'` → neu) = **Release-Gate**: kein Tier-Toggle in Prod, bevor anwaltlich geprüfter DE/EN-Text steht. Test: laufende Session (`started_at` gesetzt) wird durch den Bump **nicht** neu gegated.
- Allow-list-Masking, Minimierung, Retention, Betroffenenrechte — siehe §4–§7.

**Schicht ③ EU AI Act:**
- Art. 50(1): bestehende KI-Offenlegung (`InviteConsentGate`/`OpenLinkEntry`) bleibt unverändert vor jeder KI-Interaktion. **Offen (§9 Miss):** der **Art.-13/Art.-50-Disclosure-Text für die neuen Tiers** (Event-Capture/Replay/Screen) muss in die Gate-Copy — keine Facette besitzt ihn bisher.
- Rote Linie strukturell (L8).

**Granulare Gate-UI:** `ConsentPurposeToggles.tsx` (neu, geteilt) rendert drei unabhängige Opt-ins, jedes nur sichtbar, wenn sein Studien-Flag an ist. Eingebaut **in beide** `InviteConsentGate` **und** `OpenLinkEntry.ConsentStep` (kein neuer Entry-Pfad). Basis-Teilnahme bleibt Pflicht; die drei Tiers sind unabhängig optional — **Teilnahme erfordert nie den invasivsten Tier.** Persistenter In-Session-„Aufnahme stoppen / widerrufen"-Button (Art. 7(3), DSK Rz. 61–62).

**Fail-closed-Testmatrix (exitCode=1-Gate):** alle 8 Kombinationen aus (Studien-Flag an/aus) × (Tier-Consent da/fehlt) × (Master) — Capture feuert **nur** in der All-True-Zelle. Über **alle** Capture-Routen, nicht nur eine.

---

## 4. Cross-Origin-Prototyp & Client-Instrumentierung

**Hosting-Leiter (rechtlich wie technisch):**
1. **First-Party-iFrame / Klymeo-gehosteter Prototyp** (primär) — Klymeo kontrolliert das DOM → kann rrweb-Masking **erzwingen**, kleiner Akteur-Kreis, EU-only. `PrototypeSurface.tsx` mountet neben dem Chat (wie das Stimulus-Split-View).
2. **`external_url`** (Teilnehmer öffnet echte Seite) — nur Screen-Sampling-Tier möglich (kein DOM-Zugriff).
3. **Figma-Embed** — **aus v1 ausgenommen oder hart gegated** (§9 C-E): Dritt-Akteur (eigene Cookies/Storage = §25-Akteur + Kapitel-V-Transfer). Wenn überhaupt: hinter Feature-Flag, nur wenn Figma-Sub-Prozessor + Transfer dokumentiert sind und der Consent-Text Figma als Empfänger nennt.

**Instrumentierung (`collector.ts`, dünner rrweb-Wrapper):**
- **Allow-list-Masking:** `maskAllInputs` + alle Texte maskieren, Passwort/Zahlung hart blocken, `.rr-ignore` auf Sensibles, **nur** das `[data-klymeo-prototype]`-Subtree unmaskieren. rrweb-Bug #1609 (versteckte Inputs werden bei `maskAllInputs` nicht maskiert) → **niemals** auf Deny-List verlassen, explizite Allow-List `maskInputOptions`.
- **Defer:** dynamischer Import erst nach Consent; interner Guard wirft, wenn Flag fehlt; `record()` beim Unmount sauber stoppen (der bestehende Sampling-Loop leakt heute einen `setInterval`-Ref bei Hard-Navigation — nicht wiederholen).
- **Event-Batching** an `POST /events` (Flush bei N Events oder T Sekunden).

**Screen-Sampling-Tier (`getDisplayMedia`, existiert, default OFF):**
- **Maskierung unmöglich** (roher Pixelstream) → strikt letzter Ausweg. Fixes (§9 C-F): **Tab-only** bevorzugen (`preferCurrentTab`/`surfaceSwitching:'exclude'`), Consent-Text warnt „nur den Prototyp-Tab teilen, nie den ganzen Bildschirm", Desktop-/Secure-Context-Gate bleibt.
- **Kapitel-V-Hinweis:** Screen-Frames gehen an Anthropics Vision-Modell — das ist ein **Transfer** möglicher Art.-9-Daten (Storage ist EU, die Inferenz nicht). In der DPIA dokumentieren + Anthropic-EU-Routing/AVV für Bildinhalte bestätigen (§9 Miss).

---

## 5. Event-Store & server-berechnete Metriken

- **Route `POST /api/interview/[token]/events`** — klont `/visual-capture` gate-before-spend **verbatim**: Token-Capability-Auth (kein Login, kein Voice-Bearer) → Session auflösen (404/403) → `plan.event_tracking_enabled` (403) → `assertCaptureConsent(session, 'events')` (403) → **erst dann** schreiben. `org_id` serverseitig aus der Session, nie vom Client. Zod: `event_type`-Enum, `ts_ms` 0–14,4 Mio (4 h), `target_selector` ≤512, Batch ≤500, Gesamt ≤~256 KB. Kein roher `err.message` im Body.
- **`event-store.ts`:** `resolveResearchEventSession` (Klon von `resolveVisualCaptureSession`), `ingestSessionEvents`, **`computeTaskResult(events)`** — server-deterministisch: `success` (aus `task_complete` vs `task_abandon`), `timeOnTaskSeconds` (letzter − erster `task_start` ts), `clickCount`, `frictionEvents` (rein verhaltensbasiert: schnelle Re-Klicks, Scroll-Reversals, Dwell-vor-Klick). Schreibt `interview_sessions.task_result`. **Nie eine LLM-Zahl.**
- **`ts_ms` ist client-geliefert** → `created_at` (Server-Uhr) ist die autoritative Retention-/Sortier-Uhr; `computeTaskResult` clamped Ausreißer (§9 C-I).
- **Input-Werte nie serialisieren** für `input_focus`/`input_blur` (nur maskierter Selektor + Timing); Server lehnt Events mit `value`/`text`-Key ab (§9 C-I).
- **Event-Vokabular an einem Ort pinnen (§9 Miss):** der Producer (`collector.ts`) und die Consumer (`computeTaskResult`, Aggregator) müssen sich auf dieselbe `event_type`-Liste + `payload`-Form einigen — sonst stille Leer-Metriken. Eine geteilte Konstante/Typdatei.
- **`RECHTSANKER`-Block** an der Friction-Funktion (Stil von `turn-signals.ts`): „Reibung NUR aus Verhalten, NIEMALS Stimme/Gesicht/Webcam, KEINE Affekt-Labels."

---

## 6. Synthese-Integration (E8 — exakter E4/E7-Klon)

- **`interaction.ts`** (neu, spiegelt `signals.ts`/`stimuli.ts`): `MIN_INTERACTION_AGGREGATE_SESSIONS=3`; pure `aggregateInteractionSessions(rows)` (rechnet alle Zahlen; `block:null` unter Min-N, behält `summary` für ein ehrliches „noch zu wenige Sessions"-Badge); fail-open `loadSynthesisInteractionInputs(orgId, planId)` (prüft zuerst `event_tracking_enabled` → false ⇒ `{block:null}` ⇒ byte-identische Synthese); lenient `normalizeInteractionSummary`. **Kein LLM-Call** — rein deterministisch.
- **`prompts.ts`:** `formatInteractionBlock` (Server-Fakten + Regel „Zahlen verbatim kopieren, nie nachrechnen/extrapolieren" + die **Friction-nicht-Affekt-Regel**), angehängt in `buildSynthesisUserPrompt` genau wie `formatSignalsBlock` (null ⇒ byte-identischer Prompt).
- **`engine.ts`:** `loadSynthesisInteractionInputs` im `synthesizeStudy` (fail-open), die zwei neuen Spalten in das **bestehende** Best-Effort-Zweit-`UPDATE` (kein neuer DB-Roundtrip). `sealSynthesisExtras(result, hadSignals, hadRationales, hadStimuli=false, hadPreference=false, **hadInteraction=false**)` — als **letztes** Arg mit Default angehängt (§9 Arch-10), erzwingt `interaction_observations=[]` ohne Block. `buildAnchorSet`/`applyAnchoredFilter` **unverändert** (die Prosa trägt keine Quotes/`sourceInsightIds`, reitet auf der Seal-Garantie wie `signal_observations`).
- **Rote Linie strukturell (L8 / §9 C-C):** `interaction_summary`-Schema **ohne** Affekt-Feld, `.strict()` (lehnt unbekannte Keys ab → ein `affects`-Feld kann nicht durchrutschen); `RECHTSANKER` verbietet Import von `AffectState` in Usability-Module; **`eval:usability-friction` als harter exitCode=1-Gate** (Grounding + No-Affekt-/No-Biometrie-Deny-List) — der Synthese-Eval muss ein *Gate* sein, nicht nur ein WARN-Scan.
- **UI liest Zahlen NUR aus `interaction_summary`** (server-berechnet), nie aus dem LLM-Text.

---

## 7. Replay-Speicher & Viewer (schwerster Tier, separater Consent)

- **Privater EU-Bucket** `research-session-replays` (`public=false`, signed URLs only, **nie** `getPublicUrl`), Namespace `${orgId}/${planId}/${sessionId}/…`, Upload nur via server-gemintete Single-Use-Signed-URL **nach** `assertCaptureConsent(session, 'replay')`.
- **Leaf-Tabelle `research_session_replays`** mit **`org_id NOT NULL`** (§9 Arch-7 — nullable würde RLS + Export/Delete-Loops umgehen ⇒ un-löschbarer PII-Orphan), `session_id ON DELETE CASCADE`, `expires_at NOT NULL` (per-Row-TTL).
- **rrweb-Event-Streams** (kompakt, bevorzugt) statt Video; optional maskierte Frames. `masking_profile` als Provenienz-Marker.
- **`ReplayViewerPanel.tsx`** (lazy, `ssr:false`, rrweb-player), org-gated GET-Route mintet kurzlebige (≈300 s) Signed-Download-URLs; Triple-Filter (`id`+`plan_id`+`org_id`), 404 bei Cross-Org-Probe.
- **Retention:** per-Row `expires_at` (Default Tage–Wochen, Cap 90 via `replay_retention_days`); der `/cron/retention`-Sweep löscht abgelaufene Rows **und Bucket-Objekte** (org-cap-Pass schließt nachträgliche TTL-Senkung). Fail-on-Error (non-2xx, DSGVO-Vertrag).
- **Kosten (grob):** rrweb ~1–5 MB / 10-min-Session; 1000 Sessions × ~3 MB ≈ 3 GB ≈ Cents/Monat bei Supabase; der Hebel ist die kurze TTL. Frame-Tier strenger deckeln (24 Frames/960px/JPEG62, wie heute).

---

## 8. Phasenplan (default OFF, Schreib-Pfad-vor-Writer, Eval-Gates)

| Phase | Inhalt | Gates |
|---|---|---|
| **0 · Recht zuerst** (kein Capture-Code) | DPIA-Erweiterung (eigenständige Bewertung, kein „kleines Delta" — §9 Miss); gebündelter §25+DSGVO-Consent-Text DE/EN (anwaltlich) + `CONSENT_TEXT_VERSION`-Bump; AVV-Addendum + Sub-Prozessor-Liste (inkl. Anthropic-Vision für Screen-Tier); Art.-13/50-Disclosure-Text der Tiers. | Anwaltliche Freigabe **bevor** ein Flag in Prod aktivierbar ist. |
| **1 · Task + First-Party-Prototyp** (kein Capture) | `task_definition`-Migration + Form-Block (`needsTask`); `PrototypeSurface` (First-Party); `use_case='usability_test'` (L2). Nur Aufgabe + Art.-50-Offenlegung live; Instrumentierung inert. | Byte-identische Discovery-/Market-Creates verifizieren (Base-Build-Diff). |
| **2 · Echte Events + Store** | Consent-Migrationen + `markSessionConsentByToken`-Erweiterung + `ConsentPurposeToggles` (beide Gates) + `assertCaptureConsent`-Helper (**inkl. `/visual-capture`-Fix**); `research_session_events` + `task_result`/`replay_ref`-Migrationen **in Prod, verifiziert, VOR** dem schreibenden Code; `collector.ts` (rrweb, fail-closed, allow-list); `POST /events`; `event-store.ts` + `computeTaskResult` (+ Unit-Test wie `signals.test.ts`); Retention-/Withdraw-/Delete-Erweiterungen **inkl. Storage-Wipe (§9 C-B)**. | Fail-closed-Testmatrix (exitCode=1); Flags default OFF; Dogfood an **einer** internen Test-Studie mit echtem Consent. |
| **3 · Synthese + Replay** | `interaction.ts` + `study_synthesis.interaction_*`; privater Replay-Bucket + `research_session_replays` + `ReplayViewerPanel`; `eval:usability-friction` (exitCode=1). | Eval **grün** vor jeder echten Studie; André-Hands-on. |

**Disziplin durchgängig (aus MEMORY):** ein Worktree pro Phase (`../findr-usability-pN`), 3-Linsen-Review vor jedem Merge, fetch-first + Überlappungs-Check vor `main`-Merge, Migrationen via MCP angewandt + im Prod-Schema verifiziert, `tsc`/`eslint`/voller Vitest + relevanter Eval grün auf dem gemergten Stand. Worktree-Build via `pnpm install --frozen-lockfile --offline` (sonst Turbopack-Panic). **Kein** Prod-Flag, bevor sein Eval-/Consent-Matrix-Gate grün ist.

---

## 9. Adversariale Befunde & wie der Plan sie auflöst

Die zwei Kritiker fanden echte Konflikte und Code-Irrtümer. Alle sind oben eingearbeitet:

**Architektur (Komposition & Korrektheit):**
| # | Befund | Auflösung |
|---|---|---|
| Arch-2 | `use_case` hat **kein** CHECK (anders als `study_type`) → die vorgeschlagene CHECK-Swap-Migration wäre falsch | **L2**: keine Migration, nur TS-Union + `coerceUseCase` + Zod |
| Arch-1 | Flag-Namen divergierten (`events_enabled` vs `event_tracking_enabled` vs `interaction_events_enabled`) → Gate und Synthese-Reader auf verschiedenen Spalten | **L3**: `event_tracking_enabled` kanonisch, end-to-end eine Spalte |
| Arch-3 | Drei inkompatible Consent-Modelle (1×JSONB vs 3×Spalten) | **L4**: ein Modell — drei Spalten (bewährte `WHERE IS NULL`-Idempotenz) |
| Arch-4 | `research_session_events` von 3 Facetten unterschiedlich definiert (`ts_ms` vs `timestamp_ms`) | **L5**: Event-Store ist alleiniger Eigentümer, `ts_ms` |
| Arch-5 | Sechsfach-Migrations-Namenskollision auf `20260723000000` | §2: eine monotone Serie, einmal vergeben |
| Arch-6 | `/consent`-Route short-circuit stempelt 2.-Tier-Grant nicht | §3: Per-Purpose-Stempel läuft, wenn `purposes` da ist, unabhängig von `consentAcceptedAt` |
| Arch-7 | `research_session_replays.org_id` nullable ⇒ un-löschbarer Orphan | §7: `org_id NOT NULL → organizations ON DELETE CASCADE` |
| Arch-10 | `sealSynthesisExtras`-Arity | §6: `hadInteraction` als **letztes** Arg mit Default |

**Compliance & Datenschutz:**
| # | Befund | Auflösung |
|---|---|---|
| **C-A** | **Bestehende `/visual-capture`-Route prüft nur das Studien-Flag, KEINEN Consent-Stempel (heute fail-open!)** | **L7**: `assertCaptureConsent`-Helper in jeder Capture-Route — inkl. nachträglich `/visual-capture`; Screen-Sampling bleibt aus, bis verdrahtet |
| **C-B** | **`delete_organization_data` ist DB-Rows-only — löscht KEINE Bucket-Objekte** ⇒ Replay-Blobs verwaisen bei Art.-17-Org-Löschung | §3/§7: expliziter Storage-Prefix-Wipe (`${orgId}/`) im Delete-Org-Pfad **vor** `delete_organization_data` + Cron-Sweep (net-new Code, fail-on-error) |
| **C-C** | Affekt-System (`AFFECT_STATES`) existiert schon in `turn-signals.ts`/`signals.ts`, das die Synthese klont → Durchschleif-Gefahr | **L8**: `.strict()` ohne Affekt-Feld, `RECHTSANKER` gegen `AffectState`-Import, harter Eval-Gate; **+ anwaltliche Freigabe, dass Friction + Text-Affekt zusammen nicht in Annex III kippen** |
| C-D | `export_organization_data` dumpt Whole-Rows → rohe Event-Zeilen + `replay_ref` leaken (Minimierung) | Kuratierte Override für `research_session_events` (aggregierte Counts statt Rohzeilen) + `replay_ref`/`storage_path` aus Export strippen |
| C-E | Figma-Embed = US-Dritt-Akteur, aus dem Form wählbar | §4: aus v1 raus **oder** hart gegated (Sub-Prozessor + Transfer + Consent-Nennung) |
| C-F | Screen-Sampling: roher Frame-Stream an Anthropic-Vision = ungemaskte Art.-9 + Kapitel-V | §4: tab-only, Warn-Text, DPIA + Anthropic-EU-Routing |
| C-G | Fail-open-Consent-Write vs fail-closed-Capture | §3: Collector mountet erst nach aufgelöster Antwort; Route-Re-Check ist autoritativ; Testmatrix exitCode=1 |
| C-I | `ts_ms` client-geliefert; Input-Text-Capture | §5: `created_at` autoritativ; keine Input-Werte serialisieren; Server lehnt `value`/`text`-Events ab |

---

## 10. Offene Punkte (Recht / André) — was VOR dem Bau geklärt sein muss

**Anwaltlich (Phase-0-Gate):**
1. **Gebündelter §25+DSGVO-Consent-Text** (DE/EN), der alle Zwecke nennt (DSK Rz. 29) → `CONSENT_TEXT_VERSION`-Bump.
2. **DPIA-Erweiterung** als **eigenständige** Bewertung für systematische Verhaltensaufzeichnung + Replay (nicht „kleines Delta").
3. **Art.-13/50-Disclosure-Text** für die neuen Tiers (Event-/Replay-/Screen-Capture).
4. **AVV-Addendum + Sub-Prozessor-Liste**, inkl. **Anthropic als Empfänger von Screen-Frames** (Kapitel-V-Transfer für den Screen-Tier) — EU-Routing bestätigen.
5. **Annex-III-Freigabe:** dass die **Fusion** von Verhaltens-Friction mit dem **bestehenden Text-Affekt** (`turn-signals`) das Kombiprodukt nicht in Hochrisiko kippt (C-C).
6. Figma-Embed: ja/nein für v1; wenn ja, Sub-Prozessor + Transfer klären (C-E).

**Technisch / André-Entscheidung:**
7. **Cross-Repo (Voice-Agent, Hetzner):** dessen `select('*')`-Reader auf `interview_sessions` muss die neuen Spalten (`*_consent_at`, `task_result`, `replay_ref`) tolerieren (§9 Miss) — Python-Deserialisierung prüfen.
8. **Rate-Limiting** für `/events` + `/replay/upload-url` (25-MB-Chunks → eigenes Quota); das Rate-Limiting-Feature selbst ist noch UNCOMMITTED (siehe `project_rate-limiting`).
9. **Consent-Modell** final: drei Spalten (empfohlen, L4) vs JSONB.
10. **v1-Scope:** Event-Tier zuerst (minimierungs-/DPIA-freundlicher); Replay + Screen-Sampling als spätere, separat eingewilligte Tiers.

**Bestehende latente Lücken (unabhängig vom neuen Modul, beim Bau mitnehmen):**
- `/visual-capture` server-seitig fail-open (C-A) — sollte einen Consent-Stempel prüfen, auch wenn das Feature off-by-default ist und der Client einen Consent-Panel zeigt.
- `delete_organization_data` löscht keine Storage-Objekte (C-B) — betrifft heute schon den `research-stimuli`-Bucket.

---

## 11. Anhang — betroffene Dateien (nach Phase)

- **Setup (P1):** [ResearchPlanForm.tsx](src/components/dashboard/ResearchPlanForm.tsx), [plans-service.ts](src/lib/research/plans-service.ts), [plans/route.ts](src/app/api/research/plans/route.ts), [plans/[id]/route.ts](src/app/api/research/plans/[id]/route.ts), [db.ts](src/lib/research/db.ts), [interviewer.ts](src/lib/voice-agent/interviewer.ts) (`planToAgentContext`-Task-Block)
- **Consent (P2):** `ConsentPurposeToggles.tsx` (neu), [InviteConsentGate.tsx](src/components/interview/InviteConsentGate.tsx), [OpenLinkEntry.tsx](src/components/interview/OpenLinkEntry.tsx), [session-service.ts](src/lib/voice-agent/session-service.ts) (`markSessionConsentByToken`, `assertCaptureConsent`, `withdrawSessionByToken`), [consent/route.ts](src/app/api/interview/[token]/consent/route.ts), [screen-Routen](src/app/api/interview/[token]/screen/route.ts) + open-link-Pendant
- **Instrumentierung & Events (P2):** `PrototypeSurface.tsx`, `lib/instrumentation/collector.ts`, `lib/research/event-store.ts`, `events/route.ts` (neu); [InterviewChat.tsx](src/components/interview/InterviewChat.tsx) (Screen-Sampling-Tier), [visual-capture/route.ts](src/app/api/interview/[token]/visual-capture/route.ts) (`assertCaptureConsent`-Fix), [cron/retention/route.ts](src/app/api/cron/retention/route.ts)
- **Synthese (P3):** `lib/synthesis/interaction.ts` (neu), [synthesis/prompts.ts](src/lib/synthesis/prompts.ts), [synthesis/engine.ts](src/lib/synthesis/engine.ts), [schemas/synthesis.ts](src/lib/schemas/synthesis.ts), `evals-usability-friction/` (neu), [package.json](package.json)
- **Replay (P3):** `ReplayViewerPanel.tsx`, `lib/research/replay-service.ts`, `replay/upload-url/route.ts`, `sessions/[sessionId]/replay/route.ts` (neu)
- **Org-Löschung (P2, C-B):** Delete-Org-Pfad + Storage-Prefix-Wipe; ggf. [export_organization_data](supabase/migrations/20260708000000_export_organization_data_fn.sql) kuratierte Override (C-D)
- **Migrationen:** eine monotone Serie unter `supabase/migrations/` (§2)

> *Vollständige Facetten-Designs + adversariale Kritiken liegen im Workflow-Output dieser Session.*
