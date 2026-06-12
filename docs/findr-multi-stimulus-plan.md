# Findr — Multi-Stimulus-Studien: Analyse & Umsetzungsplan

Stand: 2026-06-12 · Analyse-only, kein Code geändert.
Feature: Eine Studie trägt **mehrere Bilder und/oder Videos** als Produktgrundlage. Der
Interview-Agent (Text **und** Voice) steuert **aktiv und zum passenden Zeitpunkt**, welcher
Stimulus dem Teilnehmer gezeigt/abgespielt wird — inkl. Vergleichsfragen
("Wie findest du im Vergleich dazu Bild 2?").

---

## Teil 1 — Ist-Zustand (Code-Analyse)

### 1.1 Datenmodell: genau EIN Stimulus-Slot pro Plan

`research_plans` trägt den Stimulus als **flache Spalten** (Migration
`20260703000005_research_plan_stimulus.sql`, additiv/nullable):

| Spalte | Inhalt |
|---|---|
| `stimulus_url` | Public-URL (Bucket) oder externer Link |
| `stimulus_type` | `image` \| `video` \| `link` (kein CHECK, bewusst offen) |
| `stimulus_description` | Forscher-Beschreibung (≤3000 Zeichen) |
| `stimulus_analysis` | Vision-Analyse-Envelope (jsonb), `textBlock` ≤3000 Zeichen |
| `stimulus_analysis_status` | `pending` \| `done` \| `failed` \| null |

Bucket `research-stimuli` (Migrationen `…000006` + `…000008`): public, Bilder
png/jpeg/webp ≤5 MB, Videos mp4 ≤100 MB.

**Konsequenz:** Jeder neue Upload **überschreibt** den alten Slot und invalidiert die
Analyse ([stimulus/route.ts:485-498](src/app/api/research/plans/[id]/stimulus/route.ts)).
Es gibt keinerlei Reihenfolge-, Mengen- oder Identitätskonzept.

### 1.2 API-Oberfläche (Single-Slot-Semantik)

- `POST /api/research/plans/[id]/stimulus` — drei Zweige in einer Route:
  - **Bild**: multipart durch die Route, Cap 4 MB (Vercel-Body-Limit 4,5 MB), Magic-Byte-Check, Upload in Bucket, dann **synchrone** Vision-Analyse (Opus, `maxDuration 120`, FAIL-OPEN → Status `failed`).
  - **Video**: Client lädt per **Signed-Upload direkt** in den Bucket (`upload-url`-Route mintet Pfad im `orgId/planId/`-Namespace), Route bekommt nur `storagePath` + client-extrahierte Keyframes (≤16, Gesamt-Base64 ≤3,5 M Zeichen) → Frame-Analyse, Frames werden nie persistiert.
  - **Link**: URL-Validierung, keine Analyse.
- `DELETE …/stimulus` — nullt alle fünf Felder.
- Sicherheitsmuster, die übernommen werden müssen: storagePath-Namespace-Check, MIME/Größen-Defense-in-depth via `storage.info()`, FAIL-OPEN-Analyse.

### 1.3 Vision-Analyse

[stimulus-analysis.ts](src/lib/research/stimulus-analysis.ts): einmalig beim Upload
(nie im Interview-Pfad), produziert ein Envelope mit fertig gerendertem
`textBlock` (`MAX_TEXT_BLOCK_CHARS = 3000`). Nur der `textBlock` wandert in den
Agent-Kontext, nie das Roh-Envelope ([plans-service.ts:286-288](src/lib/research/plans-service.ts:286)).

### 1.4 Engine (Text-Interviews): Stimulus ist STATISCHER Prompt-Kontext

Der zentrale Interviewer lebt — trotz des Lib-Namens — in
[voice-agent/interviewer.ts](src/lib/voice-agent/interviewer.ts) und bedient den
Text-Turn-Pfad (`advanceInterview` → SSE-Route `interview/[token]/stream`):

- `ResearchPlanContext` (Z. 831-851) trägt die **vier Single-Stimulus-Felder**.
- `formatStimulus()` (Z. 1037-1069) rendert einen Block mit der Kopfzeile
  **„Dem Teilnehmer wird gerade gezeigt: …"** — d. h. der Prompt behauptet
  Dauer-Sichtbarkeit; es gibt **keinen Zustand** „was ist gerade sichtbar".
- `buildResearchContext()` (Z. 1078-1096) ist **bewusst byte-stabil über alle
  Turns** (Prompt-Caching, Perf-B4). Volatiles gehört in den Tail
  (`buildResearchTail`, COUNTERS).
- `STIMULUS_USE_CASE_FOCUS` (Z. 952-957): eigene Fokus-Blöcke für
  creative_test/concept_test, aktiviert via `hasResearchStimulus()` (Beschreibung
  ODER Analyse vorhanden).
- **Turn-Contract** ist plain-text-Streaming mit Header-Zeilen: Zeile 1 `DONE`,
  Zeile 2 `WHY: …` (E3), danach die Teilnehmer-Message. Der Parser (Z. ~365-510)
  ist gehärtet (Präfix-Varianten, Stream-Splits), fail-open, und `toPublicView`
  stript die Forscher-Felder. **Das ist die natürliche Andockstelle für ein
  Stimulus-Steuersignal.**
- **Stop-Ceiling**: ab 5 Agent-Fragen abwickeln, ab 6 `done` (Z. 916-919) —
  hart kollidierend mit „3 Stimuli × je 2-3 Fragen + Vergleich" (siehe Risiko R1).

### 1.5 Session-Snapshot

Research-Sessions frieren den Plan bei Erstellung als `deal_context`-Snapshot ein
(`planToAgentContext` [plans-service.ts:268](src/lib/research/plans-service.ts:268),
gelesen von `advanceInterview` UND der Voice-Kontext-Route). Plan-Edits nach
Session-Start wirken bewusst nicht. **Multi-Stimulus-Daten müssen durch diesen
Snapshot reisen** — sonst sieht der Agent sie nicht.

### 1.6 Teilnehmer-UI Text ([InterviewChat.tsx](src/components/interview/InterviewChat.tsx))

- Split-View mit `StimulusPanel` (Z. 406 ff.): **statisch, ab Sekunde 1 sichtbar**,
  genau ein Asset, nur `image` | `link` (**kein Video** im Text-Pfad!).
- Keinerlei Agent-Steuerung. Props `stimulusUrl/Type` kommen aus
  [interview/[token]/page.tsx:167-172](src/app/(app)/interview/[token]/page.tsx:167)
  (live vom Plan, NICHT aus dem Session-Snapshot — Inkonsistenz-Detail, s. R6).

### 1.7 Teilnehmer-UI Voice + Agent (E4-Linie, HEAD `ff041a0`)

- [VoiceInterviewView.tsx](src/components/interview/VoiceInterviewView.tsx):
  Panel startet **verborgen** hinter Platzhalter; Agent-DataPacket
  `{"type":"stimulus","action":"show"|"play"|"pause"}` steuert Reveal und
  Video-Playback; 90-s-Fallback-Reveal; rendert `image` | `link` | `video`.
- Python-Agent (`~/dev/findr-voice-agent/src/agent.py`): `show_stimulus`-Tool
  (hinter Flag) + Prompt-Addendum „rufe show_stimulus genau einmal" — **bereits
  agentengesteuertes Reveal, aber Single-Stimulus ohne Index.**
- `/api/voice/session-context` liefert systemPrompt + Single-`stimulus`-Objekt.

### 1.8 Forscher-UI ([ResearchPlanForm.tsx](src/components/dashboard/ResearchPlanForm.tsx))

Ein Stimulus-Block (Bild-Upload ODER Link, plus Video-Pfad), gated auf
`USE_CASE_META[useCase].needsStimulus` (nur `creative_test`, `concept_test`),
mit Analyse-Status-Badge. Beschreibung reist im normalen Form-Body, Asset über
die Stimulus-Route. Single-Slot-UI durch und durch.

### 1.9 Gap-Zusammenfassung

| # | Gap | Schicht |
|---|---|---|
| G1 | Datenmodell kennt nur 1 Slot, keine Reihenfolge/Identität | DB |
| G2 | Text-Interview hat **null** Agent-Steuerung der Anzeige (Panel statisch) — der Kern des Features fehlt dort komplett | Engine + UI |
| G3 | Prompt behauptet „wird gerade gezeigt" — kein Konzept von „sichtbar/noch verborgen" | Engine |
| G4 | Voice-DataPacket + Tool ohne Stimulus-Index | Voice (2 Repos) |
| G5 | Kein Video im Text-Teilnehmer-Panel | UI |
| G6 | Kein persistierter Anzeige-Zustand → Reload würde Reveals vergessen | Session |
| G7 | Stop-Ceiling (6 Fragen) macht Mehr-Stimulus-Vergleiche unmöglich | Engine |
| G8 | Forscher-UI, API, Analyse, Snapshot: alles Single-Slot | überall |

---

## Teil 2 — Zielbild

### Forscher (Studien-Setup)
Statt eines Slots eine **Stimulus-Galerie** (empfohlen max. 5): Assets in fester
Reihenfolge (Position 1…N), je Asset Typ (Bild/Video/Link), optionales Kurz-Label
(„Variante A"), eigene Beschreibung, eigene Vision-Analyse mit Status-Badge.
Hinzufügen/Entfernen/Umordnen jederzeit in der Draft-Phase.

### Agent (beide Modalitäten)
Der Agent kennt das **nummerierte Stimulus-Set** (Labels + Beschreibungen +
Analysen) und eine **Regie-Anweisung**: Stimuli in Reihenfolge einführen, pro
Stimulus 2-3 Fragen (use-case-abhängig), **erst nach Reveal von Stimulus k+1
vergleichende Fragen zu bereits gezeigten** stellen, nie über einen noch nicht
gezeigten Stimulus reden. Das Zeigen löst der Agent selbst aus:
- **Text**: neue Header-Zeile im Turn-Contract (`SHOW: <n>`, analog `WHY:`).
- **Voice**: `show_stimulus(action, index)`-Tool → DataPacket mit `index`.

### Teilnehmer
- **Text**: Panel startet verborgen (Platzhalter wie Voice-E4), zeigt nach
  Agent-Signal den aktiven Stimulus groß; bereits gezeigte Stimuli bleiben als
  **Thumbnail-Leiste** anklickbar (für ehrliche Vergleichsantworten muss man
  zurückschauen können — methodisch gewollt). Video bekommt `<video controls>`.
- **Voice**: wie E4 heute, plus Index-Wechsel und Thumbnail-Leiste.
- Noch nicht gezeigte Stimuli werden **nie** an den Client geleakt, bevor sie
  dran sind? → Nein, bewusst NICHT so streng: die URLs sind ohnehin public-bucket;
  v1 lädt alle Assets, blendet aber nur Freigegebenes ein (wie Voice-E4 heute).
  Wer DevTools öffnet, sieht Bild 2 früher — akzeptiertes Restrisiko, dokumentieren.

---

## Teil 3 — Architektur-Entscheidungen

### D1 — Datenmodell: eigene Tabelle `research_plan_stimuli` (EMPFOHLEN)
```sql
create table research_plan_stimuli (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  plan_id uuid not null references research_plans(id) on delete cascade,
  position int not null,                  -- 1-basiert, Reihenfolge = Regie
  stimulus_type text not null,            -- 'image' | 'video' | 'link' (kein CHECK, wie gehabt)
  url text not null,
  storage_path text,                      -- null bei 'link'
  label text,                             -- "Variante A" (≤80)
  description text,                       -- ≤3000
  analysis jsonb,
  analysis_status text,
  created_at timestamptz not null default now()
);
```
RLS nach Hausmuster; Index auf `(plan_id, position)`. **Kein**
`unique(plan_id, position)` (Korrektur in E1): Reorder läuft über PostgREST in
mehreren Einzel-UPDATEs ohne Transaktion — ein unique-Constraint erzwänge
Zwei-Phasen-Renumbering. Stattdessen deterministische Lese-Ordnung
`(position, created_at, id)`; transiente Duplikate sind harmlos.
**Gegen** jsonb-Array auf `research_plans`: per-Asset-Analyse-Status und
Reorder-Updates wären Read-Modify-Write-Races; eigene Zeilen sind atomar.

**Dual-Read statt Backfill**: Resolver `resolveStimulusSet(plan)` — hat der Plan
Zeilen in `research_plan_stimuli`, sind die die Wahrheit; sonst werden die
Legacy-Spalten als 1-Element-Set interpretiert. Bestandspläne und -Sessions
bleiben byte-identisch, keine Migrations-Backfill-Risiken. Die Legacy-Spalten
bleiben stehen (Lehre aus „additiv, nullable, backfill-frei" der 0005er-Migration).

### D2 — Steuersignal Text-Pfad: `SHOW:`-Header im Plain-Contract
Zeile zwischen `WHY:` und Leerzeile: `SHOW: 2` (nur wenn der Agent in DIESEM Turn
einen Stimulus einblenden will). Begründung:
- Der Turn-Pfad ist plain-text-Streaming; Structured-Output würde das
  Streaming-Modell brechen.
- Der `WHY:`-Parser (E3) ist das erprobte Muster inkl. Härtung gegen
  Präfix-Leaks und Stream-Splits — gleiche Behandlung, fail-open
  (kein/kaputter Header → kein Wechsel, Interview läuft normal weiter).
- Gestript aus der Teilnehmer-Message; als `shownStimulusPosition` am Turn
  **persistiert** (Spalte/Feld am Turn-Datensatz) → Reload-Restore und
  Forscher-Transkript-Marker gratis.

### D3 — Voice: DataPacket + Tool um `index` erweitern
`{"type":"stimulus","action":"show","index":2}` (Index fehlt → 1, voll
rückwärtskompatibel zum E4-Stand). `play`/`pause` wirken auf den aktiven
Stimulus. `session-context` liefert `stimuli: [...]` zusätzlich zum bestehenden
Single-`stimulus`-Objekt (alter Agent-Code bleibt funktionsfähig).
Python-Repo: `show_stimulus(action, index)`-Signatur + Prompt-Addendum mit
Set-Liste. 90-s-Fallback revealed Stimulus 1.

### D4 — Zustand „aktuell sichtbar": berechnet, nie geschätzt
Quelle der Wahrheit = letzter persistierter `SHOW`-Marker in der Turn-Historie
(bzw. letztes DataPacket bei Voice, dort vom Agenten lokal geführt). In den
volatilen COUNTERS-Tail kommt:
```
- stimuli revealed so far: 2 of 3 (currently shown: #2 "Variante B")
```
Damit bleibt `buildResearchContext` byte-stabil (Caching unangetastet) und der
Agent muss nichts aus der Historie raten — exakt das COUNTERS-Muster.

### D5 — Prompt-Budget
Worst case 5 × 3000 Zeichen Analyse = zu fett. Regel: ab N ≥ 3 wird pro Stimulus
nur ein gekürzter Analyse-Block (~1200 Zeichen, am Satzende geschnitten)
gerendert; die Voll-Analyse bleibt für Forscher-UI/Synthese erhalten.
`MAX_STIMULI = 5` hart in Route + Form.

### D6 — Video im Text-Chat: JA, mit `<video controls>`
Sonst hätte das Feature im Text-Pfad ein Loch („mehrere Bilder ODER Videos").
Teilnehmer steuert Playback selbst (kein Auto-Play im Text-Modus — anders als
Voice, wo der Agent play/pause spricht). Muted-Autoplay-Fragen entfallen damit.

### D7 — Sequenz-Modus v1: feste Reihenfolge (Position), Agent steuert nur das WANN
„Agent wählt frei die Reihenfolge" ist v2-Material — feste Reihenfolge macht
Prompt, Eval und Forscher-Erwartung deterministisch. Vergleiche rückwärts sind
immer erlaubt.

### D8 — Stop-Ceiling skaliert mit N (löst R1)
Heute: ab 5 abwickeln / ab 6 done. Mit Stimulus-Set wird das im Kontext-Block
überschrieben: `Ceiling = min(2 + 3 × N, 14)` Fragen (N=1 → heutiges Verhalten
fast identisch, N=3 → 11). Die Zahlen kommen als berechnete Konstante in den
stabilen Kontext (pro Session fix, Caching ok). Saturation-Regeln pro Stimulus
gelten analog zu Topics („pro Stimulus 2-3 Fragen, dann weiter").

---

## Teil 4 — Etappenplan

> Leitplanke für JEDE Etappe: ohne `research_plan_stimuli`-Zeilen sind Prompt,
> Routen-Responses und Teilnehmer-UI **byte-identisch** zu heute (Paritäts-Tests
> nach dem Hausmuster). Jede Etappe einzeln mergebar, eigener Worktree.

### E1 — Datenfundament (Migration + Service) — ~0,5 Tag
- Migration `research_plan_stimuli` (additiv, RLS, Indizes). **Nicht** in Prod
  anwenden, bevor E2 steht (Hausregel: Migration erst mit konsumierendem Code).
- [plans-service.ts](src/lib/research/plans-service.ts): `listPlanStimuli`,
  `addPlanStimulus`, `removePlanStimulus`, `reorderPlanStimuli`,
  `updatePlanStimulus` (Analyse-Persistenz) + `resolveStimulusSet` (Dual-Read).
- `planToAgentContext`: zusätzlich `stimuli: StimulusContext[]` (Position, Typ,
  URL, Label, Beschreibung, Analyse-textBlock-bei-done) — Legacy-Felder bleiben
  parallel gefüllt (Voice-Agent-Kompat).
- Tests: Dual-Read-Parität (leeres Set → exakt heutiger Kontext).

### E2 — API-Schicht — ~1 Tag
- Neu `POST /api/research/plans/[id]/stimuli` (add: Bild multipart / Video
  storagePath+Frames / Link — Zweig-Logik aus der Bestandsroute extrahieren und
  teilen), `DELETE …/stimuli/[stimulusId]`, `PATCH …/stimuli` (reorder,
  label/description-Edit). Cap `MAX_STIMULI = 5`, Positionen lückenlos halten.
- `upload-url`-Route: um `stimulusId`-Namespace erweitern (Pfadmuster
  `orgId/planId/stimulusId-…`), Namespace-Check wie heute.
- Per-Asset-Vision-Analyse beim Add, FAIL-OPEN, Status je Zeile — Code-Reuse aus
  `runStimulusAnalysis`/`runStimulusVideoAnalysis` (in Helfer umziehen).
- Legacy-Single-Route bleibt unangefasst online (Bestands-UI), wird in E3
  vom neuen Formular abgelöst und erst NACH E3-Merge deprecated.
- Tests nach dem Muster der bestehenden `route.test.ts`.

### E3 — Forscher-UI (Galerie) — ~1-1,5 Tage
- [ResearchPlanForm.tsx](src/components/dashboard/ResearchPlanForm.tsx):
  Stimulus-Block → Galerie-Liste (Karten mit Thumbnail/Typ-Icon, Label-Feld,
  Beschreibung, Analyse-Badge, Entfernen, ↑/↓-Reorder — kein Drag-n-Drop-Dep).
  Gating auf `needsStimulus` unverändert; Draft-first via `ensureDraftPlanId`
  (bestehendes Muster aus Stimulus-E3).
- Bestands-Plan mit Legacy-Single-Stimulus: wird als 1-Element-Galerie angezeigt;
  erstes Hinzufügen eines zweiten Assets migriert den Legacy-Slot lazy in eine
  Tabellen-Zeile (einzige Schreib-Brücke Legacy→neu, im Service gekapselt).
- i18n de+en (Paritäts-Check), tsc/build/eslint.

### E4 — Engine Text-Pfad (das Herzstück) — ~1,5-2 Tage
- `ResearchPlanContext.stimuli` konsumieren: `formatStimulusSet()` ersetzt
  intern `formatStimulus()` bei N ≥ 1 aus dem Set (Legacy-Pfad rendert
  byte-identisch weiter): nummerierte Liste, Regie-Block (Reihenfolge, 2-3
  Fragen pro Stimulus, Vergleichsregel, „NIE über noch nicht gezeigte sprechen,
  NIE Inhalt vorwegnehmen"), D5-Kürzung, D8-Ceiling-Override.
- Turn-Contract: `SHOW:`-Header (Spec + Parser-Härtung analog `WHY:`,
  fail-open, Strip aus Teilnehmer-Text); Validierung `1 ≤ n ≤ N` und
  „nur vorwärts oder bereits gezeigt".
- Persistenz `shownStimulusPosition` am Turn (additives Feld im Turn-JSON des
  Session-Datensatzes — kein Migrationszwang, Turns sind jsonb) +
  Durchreichen in `toPublicView`/SSE (`final`-Session-View trägt je Turn das
  Feld; zusätzlich ein `show`-SSE-Event VOR den Text-Deltas, damit das Panel
  wechselt, bevor die Frage einläuft — Dramaturgie!).
- COUNTERS-Tail: revealed-Zähler + aktueller Stimulus (D4).
- **Pflicht-Präferenzfrage** (beschlossen 12.06., Zulieferung für E7): nachdem
  ALLE Stimuli gezeigt wurden, stellt der Agent genau EINE explizite
  Präferenzfrage („Welche Variante … und was gibt den Ausschlag?") — im
  D8-Ceiling-Budget eingepreist (+1). Nur bei N ≥ 2.
- Evals: neues Szenario im Saturation-/Engine-Eval-Harness (Agent zeigt alle N,
  stellt mindestens eine Vergleichsfrage, leakt nie `SHOW:` in den Text, hält
  Ceiling). Vorbild: WHY-Coverage-Messung im Saturation-Runner.

### E5 — Teilnehmer-UI Text — ~1-1,5 Tage
- [interview/[token]/page.tsx](src/app/(app)/interview/[token]/page.tsx): statt
  `stimulusUrl/Type` das aufgelöste `stimuli[]` (aus dem **Session-Snapshot**,
  nicht live vom Plan — behebt nebenbei R6) an `InterviewChat` geben.
- [InterviewChat.tsx](src/components/interview/InterviewChat.tsx):
  `StimulusPanel` → `StimulusSetPanel`: Platzhalter bis zum ersten `show`
  (Voice-E4-Muster), aktiver Stimulus groß, Thumbnail-Leiste der bereits
  gezeigten (klickbar, lokaler View-Wechsel ohne Agent), `<video controls>`.
- Reveal-Quelle: `show`-SSE-Event live + `shownStimulusPosition` aus der
  Session-View beim Reload (Restore = max. gezeigte Position).
- Single-Stimulus-Bestand (Legacy): rendert exakt das heutige statische Panel
  (kein Reveal-Gate rückwirkend einführen — Verhaltensänderung nur für
  Multi-Set-Studien; vermeidet Überraschung bei laufenden Studien).
- i18n, reduced-motion, Mobile (Sticky-Top wie heute).

### E6 — Voice-Pfad (2 Repos) — ~1 Tag
- findr: `session-context` liefert `stimuli[]`;
  [VoiceInterviewView.tsx](src/components/interview/VoiceInterviewView.tsx)
  Multi-Panel (aktiv + Thumbnails), DataPacket-Handler liest `index`
  (fehlend → 1), Fallback-Reveal → Stimulus 1; `pendingPlay`-Mechanik pro
  aktivem Video beibehalten.
- findr-voice-agent: `show_stimulus(action: str, index: int = 1)`,
  Prompt-Addendum mit nummerierter Set-Liste + Regie (Spiegel von E4),
  pytest-Erweiterung. CAVE: E4-Stimulus-Reveal-Branch (`ff041a0`) trägt das
  Agent-Tool laut Memory noch als OFFEN — E6 setzt darauf auf bzw. schließt es
  mit ab.

### E7 — Auswertung (beschlossen 12.06., nach E4/E5) — ~1 Tag
- Forscher-Transkript: Reveal-Marker („— Stimulus 2 ‚Variante B' eingeblendet —")
  aus `shownStimulusPosition`.
- Synthese: per-Stimulus-Sektion (Mindest-N = 3 **pro Stimulus-Segment**;
  Abbrecher, die Stimulus k nie sahen, zählen dort nicht) + Vergleichs-Sektion.
  **Zählwerte ausschließlich server-seitig aggregiert** aus der
  Pflicht-Präferenzfrage (E4) — nie vom Modell behauptet (Hausprinzip
  „Kennzahlen nie aus LLM-Text", synthesis/service.ts).
- Ausspielung v1: nur Forscher-Dashboard; Share-View/PDF bleibt eigenes
  Folge-Thema (wie bei der E4-Synthese bewusst offen gelassen).
- Turn-Signals bleiben unberührt.

**Reihenfolge/Abhängigkeiten:** E1 → E2 → E3 (Forscher kann befüllen) und
E1 → E4 → E5/E6 (parallelisierbar). E7 zuletzt. Gesamtaufwand grob **6-8 Tage**.

---

## Teil 5 — Risiken & Leitplanken

- **R1 Stop-Ceiling vs. N Stimuli** (kritischster inhaltlicher Punkt): ohne D8
  bricht der Agent nach 6 Fragen ab, bevor Stimulus 2 je gezeigt wurde. Ceiling
  MUSS mit dem Set skalieren und im Eval gemessen werden.
- **R2 Prompt-Cache-Stabilität**: Stimulus-Set gehört in den stabilen Kontext
  (aus dem Snapshot), der Sichtbarkeits-Zustand in den volatilen Tail. Niemals
  Live-Plan-Reads im Turn-Pfad.
- **R3 Header-Leak**: `SHOW:` darf nie im Teilnehmer-Text oder in der
  Voice-TTS landen — Parser-Härtung + Eval-Assertion (Lehre aus E3-WHY:
  echter Opus-Leak wurde dort vom Parser gefangen).
- **R4 Fail-open überall**: vergessener `SHOW`-Header → Interview läuft, Panel
  bleibt halt stehen; Voice-Fallback 90 s zeigt Stimulus 1; kaputter Index wird
  geklemmt, nie geworfen.
- **R5 Asset-Vorab-Leak**: public Bucket + alle URLs im Client = Teilnehmer
  könnte Stimulus 2 via DevTools früher sehen. v1 akzeptiert (wie Voice-E4
  heute); v2-Option: signed URLs erst beim Reveal nachladen.
- **R6 Quelle Plan vs. Snapshot**: Text-UI liest Stimulus heute live vom Plan,
  der Agent aus dem Snapshot — bei Plan-Edits nach Session-Start können UI und
  Agent divergieren. E5 vereinheitlicht auf Snapshot.
- **R7 Kosten**: N Opus-Vision-Analysen pro Studie (einmalig, Draft-Phase) —
  bei Cap 5 unkritisch, aber im Kosten-Panel (Panel-E6) sichtbar machen.
- **R8 Vercel-Limits**: Bilder einzeln ≤4 MB durch die Route (ok), Videos via
  Signed-Upload (ok) — Mehrfach-Upload ist N einzelne Requests, kein neues Limit.
- **R9 Bestands-Parität**: jede Etappe mit Paritäts-Test „leeres Set ⇒
  byte-identisch" absichern (Hausmuster, z. B. Invite-Parität 2079=2079).
- **DSGVO**: keine neuen personenbezogenen Daten; Consent-Texte unberührt.

---

## Teil 6 — Entscheidungen (ALLE beschlossen, André 12.06.2026)

1. **O1 — Max. Stimuli: 5.** Hart in Route + Form.
2. **O2 — Thumbnail-Rückblick: JA.** Bereits gezeigte Stimuli bleiben für den
   Teilnehmer als Thumbnails anklickbar.
3. **O3 — Legacy: kein Verhaltensbruch.** Single-Stimulus-Bestand bleibt im
   Text-Pfad statisch sichtbar; Reveal-Gate nur für Multi-Set-Studien.
4. **O4 — E7 kommt mit**, als letzte Etappe nach E4/E5 (Detail s. E7).
5. **O5 — v1: Forscher bestimmt die feste Reihenfolge** (Position 1…N), der
   Agent steuert nur das WANN. Freie Agent-Reihenfolge = v2.
6. **E7-Detail beschlossen:** Pflicht-Präferenzfrage in E4 (N ≥ 2),
   Vergleichs-Zählwerte nur server-seitig, Mindest-N=3 pro Stimulus-Segment,
   Ausspielung v1 nur Dashboard.
