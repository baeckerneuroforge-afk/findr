# findr — AI-Antwort-Streaming (Funde 6.1 / 6.2): Machbarkeits- & Risiko-Analyse

> **Status:** Reines Planungs-/Analyse-Dokument. **Kein Code geschrieben, nichts gebaut, nichts geändert** außer dieser Datei. Geschützte Pfade nur gelesen.
> **Branch:** `perf/6-1-6-2-plan` (Worktree `../findr-perf-stream`, frisch von `main`).
> **Methodik:** Echter Code gelesen (Herz-Pfad `structured.ts`, die drei Chat-Engines, die drei Route-Handler, die drei Client-Komponenten, der Interview-Pfad) + die **echten** Next-16.2.6-Docs unter `node_modules/next/dist/docs/` + die installierten `@anthropic-ai/sdk@0.96.0`-Typen. Befunde zusätzlich durch einen 5-Agenten-Read-only-Recon-Workflow gegengeprüft (Routes / Clients / Interview-Schema / Stack-Capability / Caching-Blast-Radius).

---

## TL;DR — die eine entscheidende Frage, ehrlich beantwortet

**Frage:** Lassen sich (A) Frei-Text-Antworten an den Nutzer und (B) strukturierte Extraktion (Forced-Tool-Use, Anker-Integrität) **sauber trennen**, sodass man nur A streamt und B garantiert unberührt lässt?

**Antwort: NEIN — und zwar tiefer als „verwoben".** Ein reiner **Frei-Text-Kanal (A) existiert in findr gar nicht.** Die drei Flächen, die nach „Chat" aussehen — Live-Interview (6.1), Chat-with-Data (6.2), Mission-Control (6.2) — sind **selbst strukturierte Forced-Tool-Use-Ausgaben** und laufen alle durch **dieselbe Funktion** `callClaudeStructured` (`tool_choice:{type:"tool"}`), die auch jede Extraktion (Risk, Synthesis, Loss, PD, Market-Research, Health, …) nutzt. Zwei der drei Chats hängen zusätzlich an einem **Post-Parse-Anker-Filter**, der eine `answered=true`-Antwort nachträglich zu einer Absage **zurückzieht**.

- **Transport ist NICHT das Problem.** Next 16.2.6-Route-Handler können streamen (`new Response(ReadableStream)`, dokumentiert), das SDK 0.96 kann `stream:true`, und Prompt-Caching (6.3) kollidiert **nicht** mit Streaming. Das ist alles machbar.
- **Das Problem ist die bewusste Architektur.** Echtes Wort-für-Wort-Prosa-Streaming verlangt, die drei vertrauenskritischen Chat-Engines **von Forced-Tool-Use auf einen neuen Frei-Text-Kanal umzubauen** und Zitate/`done` separat neu abzuleiten. Genau dort sitzt der aufwendig verifizierte Halluzinations-Schutz (Anker-Integrität) — das, was laut Auftrag NICHT brechen darf.

**Empfehlung: JETZT NICHT bauen.** Der gefühlte-Latenz-Gewinn ist gering (die Antworten sind bewusst kurz; 6.3/6.4 haben die *echte* Latenz schon gesenkt), der Aufwand ist **L (strukturell)**, und das Risiko landet auf der am stärksten verifizierten Invariante des Codebase. Wenn überhaupt etwas getan wird, dann der **billigere, andere Hebel** aus dem Audit: Modell-Tier per Env (`VOICE_MODEL` / `CHAT_WITH_DATA_MODEL` / `MISSION_CONTROL_MODEL`) auf Sonnet/Haiku — **0 Code, senkt echte Latenz** — aber erst nach einem Eval (Opus war die Anker-Integritäts-Entscheidung). Das ist *kein* Streaming und löst 6.1/6.2 nicht; es ist die ehrlichere Investition.

---

## 1) IST-Zustand: Wie kommen Antworten heute zum Client?

**Heute wird NIRGENDS gestreamt.** `grep` über `src` nach `ReadableStream` / `stream: true` / `text/event-stream` / `TransformStream` / `content_block_delta` / `input_json_delta` / `EventSource` → **0 Treffer**. Jeder AI-Aufruf ist Request → volle Antwort → ein `NextResponse.json(...)`.

Die drei betroffenen Nutzer-Flächen, jeweils end-to-end:

### 6.1 — Live-Interview (höchster Traffic, 🔴 high)
```
InterviewChat.tsx (Client)
  └─ fetch POST /api/interview/[token]            InterviewChat.tsx:149-160
       └─ advanceInterview(token, message)        session-service.ts:660
            └─ nextInterviewMessage(...)          interviewer.ts:279  →  callJson  →  callClaudeStructured
                 └─ client.messages.create({ tool_choice:{type:"tool"} })   structured.ts:174-182  (NICHT streaming)
       └─ DB-Write (status/conversation) + return WHOLE session            session-service.ts:839-858
  └─ const data = await res.json(); setMessages(data.session.conversation)  InterviewChat.tsx:158-160
```
- Der Route-Handler gibt **die ganze Session** zurück (`{ session: publicSession }`, `route.ts:90`), nicht nur die neue Nachricht. Der Client **ersetzt die komplette Konversation** mit dem Server-Stand nach dem Turn.
- Während des Wartens: `<TypingBubble/>` (animierte Punkte), `InterviewChat.tsx:240`.

### 6.2 — Chat-with-Data
```
ChatWithDataPanel.tsx → fetch POST /api/research/plans/[id]/chat/route.ts
  → chatWithData(...)  chat-with-data.ts:630 → chatWithDataFromInputs:413
      → callClaudeStructured({ cacheSystemPrompt:true })  :430-444   (Forced-Tool-Use)
      → applyChatAnchoredFilter(raw, anchors)  :355-396   (Anker-Filter, kann downgraden)
  → NextResponse.json({ success:true, result })  route.ts:94
ChatWithDataPanel.tsx: await res.json(); append 1 Assistant-Turn aus result.answer/.citations
```
- Wartezustand: statischer Italic-Text `t('chatSearching')` (kein Spinner-Animation), Panel L241-252.

### 6.2 — Mission-Control (Cross-Study)
```
MissionControlPanel.tsx → fetch POST /api/mission-control/route.ts
  → missionControlChat(orgId, q, history)  engine.ts:402 → runMissionControlDiagnostics:182
      → callClaudeStructured({ cacheSystemPrompt:true })  :218-232   (Forced-Tool-Use)
      → applyMissionControlAnchorFilter(raw, anchors)  :145-161   (Per-Study-Anker, kann downgraden)
  → NextResponse.json({ success:true, result })  route.ts:78
MissionControlPanel.tsx: await res.json(); append 1 Assistant-Turn (answer + Study-Link-Citations)
```
- Wartezustand: statischer Italic-Text `t('thinking')`, Panel L232-243.

**Wo würde Streaming ansetzen?** An genau diesen drei Route-Handlern (sie sind **Route-Handler**, keine Server-Actions — die einzige `'use server'`-Datei in `src` ist `i18n/locale-actions.ts`, unbeteiligt). Man würde dort statt `NextResponse.json(...)` ein `new Response(readableStream)` zurückgeben, gespeist aus `client.messages.stream(...)`. Der Client würde statt `await res.json()` einen `res.body!.getReader()`-Loop fahren. **Beides ist vom Stack her möglich** — siehe §4. Der Bruch liegt nicht hier, sondern eine Ebene tiefer (§2).

---

## 2) Die Trennungs-Analyse (A vs B) — die Kernfrage

### 2.1 Der Befund: A und B teilen *eine* Funktion

`callClaudeStructured` (`src/lib/anthropic/structured.ts`) ist **das Herz**. Es ist ausschließlich Forced-Tool-Use:

```ts
// structured.ts:174-184
const response = await client.messages.create({
  model, max_tokens: maxTokens,
  system: systemParam,                 // optional cache_control (6.3), :171
  messages,
  tools: [tool],
  tool_choice: { type: "tool", name: toolName },   // ← B's Halluzinations-Schutz
}, { timeout: timeoutMs, maxRetries });
const toolUse = response.content.find(b => b.type === "tool_use");
const parsed = schema.safeParse(toolUse.input);     // ← Zod, fail-closed
```

**17 von 18 AI-Call-Sites laufen durch diese eine Funktion** — sowohl die scheinbaren „A"-Flächen als auch die „B"-Extraktoren:

| Kategorie | Module (alle via `callClaudeStructured`) |
|---|---|
| **„A" — nutzer-sichtbarer Text** | `chat-with-data.ts`, `mission-control/engine.ts`, `voice-agent/interviewer.ts` (Interview-Turn) |
| **„B" — reine Extraktion** | `synthesis/engine`, `health/classifier`, `loss/llm-extractor`, `product-discovery/classifier`, `market-research/classifier`, `solution/extractor`, `accounts/save-play-extractor`, `research/highlight-reels`, `research/guide-generator`, `bridge/research-to-sales`, `bridge/cs-to-research` |
| **Sonderfall** | `synthetic/persona.ts` (Test-Persona, nie nutzer-sichtbar) |

Die **einzigen** Nicht-`callClaudeStructured`-Aufrufe bestätigen die Regel statt sie zu brechen:
- `risk/llm-classifier.ts:52` — **bewusst** Text-JSON, *kein* Tool-Use (Forced-Tool-Use verschob die Opus-Risk-Kalibrierung nach oben; dokumentiert). Kein nutzer-sichtbarer Prosa-Stream.
- `research-agent/engine.ts`, `cross-study-agent/engine.ts` — hand-gerollte **agentische Loops** (`tool_choice` `any`→`auto`). Eine Loop-Stufe zu streamen ist sinnlos; nur das finale `emit` erzeugt eine Antwort, und die ist Tool-Input.

**→ Die Chat-Flächen sitzen NICHT auf einem separaten Primitiv von den Extraktoren. Es ist dasselbe Primitiv.**

### 2.2 Der tiefere Befund: „A" ist gar kein Frei-Text

Die Annahme im Auftrag — „A = Frei-Text, das könnte streamen" — trifft auf findr **nicht** zu. Die drei Chat-Flächen sind selbst strukturiert:

- **Chat-with-Data** emittiert `{ answered, answer, citations[] }` (`ChatResultSchema`, chat-with-data.ts:56-62). Danach läuft `applyChatAnchoredFilter` (:355-396): jede Zitat-`quote` muss verbatim (typografie-gefaltet) im Studien-Haystack vorkommen, sonst wird sie verworfen — und **wenn dadurch alle Zitate wegfallen, wird `answered=true` → `answered=false`** mit Standard-Absage „Dazu liegt … keine eindeutige Evidenz vor" (:372-378).
- **Mission-Control** emittiert `{ answered, answer, citations:[{studyId,quote}] }` mit **per-Study-**Anker (`applyMissionControlAnchorFilter`, :145-161) — gleiche Downgrade-Regel (:154-156). Das ist die Cross-Study-Garantie (keine halluzinierte/falsch-zugeordnete/gemischte Quelle).
- **Interview-Turn** emittiert `{ done:boolean, message:string }` (`NextMessageSchema`, interviewer.ts:82-86). `message` *ist* Prosa — aber `done` (Kontrolle: Interview beenden?) reitet im **selben** Tool-Blob.

### 2.3 Warum das Streaming blockiert (drei harte Gründe)

1. **Forced-Tool-Use streamt JSON, keine Prosa.** Ein gestreamter Forced-Tool-Call liefert `input_json_delta`-Fragmente (`messages.d.ts:590-592`) — also `{"answered":true,"answer":"Die meisten N…` Stück für Stück. Das ist partielles JSON, kein sauberer Wort-Strom. Es gibt **keinen** nutzer-sichtbaren Text-Delta unter `tool_choice:{type:"tool"}` (Text-Delta-Streaming liefert dort nichts). Um Prosa zu streamen, müsste man Forced-Tool-Use für diese Pfade **aufgeben** und auf einen Frei-Text-Kanal wechseln — und damit genau die crash-sichere „bereits-geparstes-Objekt"-Garantie verlieren, für die `callClaudeStructured` gebaut wurde (structured.ts:9-31).

2. **Der Anker-Filter macht progressives Anzeigen unmöglich.** Selbst mit funktionierendem Stream darf die Antwort dem Nutzer erst gezeigt werden, **nachdem** der Filter auf dem **vollständigen** Objekt gelaufen ist. Streamt man die Prosa zuerst und validiert Zitate danach, kann man eine selbstbewusste Antwort streamen und sie dann zu „keine Evidenz" **zurückziehen** — schlechter als ein Spinner und ein direkter Angriff auf den Zweck des Schutzes (der Nutzer soll nie eine unbelegte Behauptung sehen).

3. **Interview: Prosa steht teils erst nach dem Kontrollfeld fest.** Im Research-Branch überschreibt `forceCapClose` die Modell-`message` durch `RESEARCH_CAP_CLOSING_MESSAGE`, wenn das Turn-Limit greift (`session-service.ts:703-705`) — die *angezeigte* Prosa wird also aus `done` + History-Länge abgeleitet, **nachdem** der Turn fertig ist. Und der Route-Handler gibt die **ganze Session nach einem DB-Write** zurück (:839-858); Streaming der Nachricht hieße, Nachrichten-Generierung von Session-Persistenz zu entkoppeln — ein Umbau des Route-↔-Client-Vertrags.

> **Fazit §2:** A und B sind **nicht** sauber getrennt. Sie teilen ein Primitiv; und „A" ist selbst strukturiert + anker-validiert. Streaming-nur-für-A ist **nicht** ein Transport-Schalter, sondern ein Re-Design der drei vertrauenskritischen Engines.

---

## 3) Scope & Blast-Radius

### 3.1 Was JETZT garantiert byte-identisch bleiben MUSS (und es bei korrektem Vorgehen auch bliebe)

- **`src/lib/anthropic/structured.ts` — NICHT anfassen.** Streaming **nicht** in `callClaudeStructured` einbauen. Begründung: (a) falsche Form (Forced-Tool-Use → `input_json_delta`, man müsste partielles JSON selbst puffern + `JSON.parse`en und damit exakt die Crash-Klasse zurückholen, die das Primitiv beseitigt hat); (b) **alle 17 Call-Sites** erwarten `Promise<T>` mit fertig-validiertem `T` — ein Signatur-/Modus-Wechsel beträfe auch die 11+ Extraktoren, die von Streaming **null** haben (sie persistieren einen Blob im Hintergrund).
- **Alle reinen Extraktions-Pfade** (Risk, Synthesis, Loss, PD, Market-Research, Health, Solution, Save-Play, Highlight-Reels, Guide, beide Bridges) — bleiben unberührt, **solange** `callClaudeStructured` unberührt bleibt. Das ist die zentrale Schutz-Bedingung.
- **`risk/llm-classifier.ts`** — bewusst Text-JSON, kalibrierungs-sensibel; auf keinen Fall in eine Streaming-Umstellung ziehen.

### 3.2 Was ein echter Streaming-Bau anfassen MÜSSTE (falls man es doch täte)

Der einzige saubere Weg (vom Recon bestätigt) ist ein **separates Streaming-Primitiv**, nur für die Chats, ohne `callClaudeStructured` zu berühren:

| Datei | Art des Eingriffs |
|---|---|
| **NEU** `src/lib/anthropic/structured-stream.ts` (o.ä.) | Neues Primitiv: Frei-Text-Stream **ODER** `messages.stream()` + `input_json_delta`-Akkumulation. Muss `cacheSystemPrompt`-Verhalten 1:1 nachbilden (6.3 darf nicht verloren gehen). |
| `src/lib/research/chat-with-data.ts` | Engine auf den Stream-Kanal umbauen; Zitat-Anker-Logik **nach** dem Stream neu anhängen; Downgrade-Semantik bewahren. |
| `src/lib/mission-control/engine.ts` | dito, mit per-Study-Anker. |
| `src/lib/voice-agent/interviewer.ts` + `session-service.ts` | Interview-Turn-Prosa von `done`/`forceCapClose`/DB-Write entkoppeln (der schwierigste Teil; siehe §2.3 #3). |
| 3× `route.ts` (interview, chat, mission-control) | `NextResponse.json` → `new Response(ReadableStream)`; Auth/Ownership/Zod **vor** dem ersten Chunk (Status committed bei Chunk 1, siehe §4). |
| 3× Client (`InterviewChat`, `ChatWithDataPanel`, `MissionControlPanel`) | `await res.json()` → `getReader()`-Loop; Zwischen-Render der Teil-Prosa; finalen Zustand (Zitate / Absage-Downgrade) **getrennt** vom Prosa-Stream behandeln. |
| Evals | `evals-*` für chat-with-data + mission-control **neu/erweitert** auf dem neuen Kanal (heute kein grünes Eval für einen Nicht-Forced-Tool-Pfad). |

**Blast-Radius-Einschätzung: BREIT.** Selbst im „sauberen" Variante (neues Primitiv) fasst man 3 Engines + 3 Routes + 3 Clients + die Eval-Suite an, und die schwierigsten Teile (Anker-nach-Stream, Interview-Entkopplung) sind genau die vertrauenskritischen.

---

## 4) Technische Stolpersteine — konkret

### 4.1 Streaming durch Next 16.2.6 zum Client — **geht** (verifiziert an echten Docs)
- Route-Handler streamen via Web-API: `return new Response(stream, { headers })`, `stream = new ReadableStream({ async start(controller){ controller.enqueue(encoder.encode(...)); … controller.close() } })`. Belegt in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Abschnitt „### Streaming", Z. 367-481) **und** `…/02-guides/streaming.md` („Streaming in Route Handlers", Z. 485-573) — letzteres nennt explizit SSE/LLM-Token-Streaming.
- Runtime: `nodejs` (Default) reicht; `export const runtime` ist heute auf keinem der drei Handler gesetzt.
- **HTTP-Vertrag** (streaming.md Z. 608-618): Sobald der erste Chunk raus ist, ist der **Status auf 200 committed**. Also **alles** Gating (401/403 `requireOrgIdOrError`, 404 Ownership, 400 Zod) **vor** dem Stream-Start — was die heutigen Handler ohnehin so tun.
- **Clerk/Dynamic ist kein Blocker:** `auth()` (auth/org.ts:76) macht den Handler dynamisch (Request-Zeit) — Streaming läuft sowieso zur Request-Zeit. `proxy.ts` (`clerkMiddleware()`) läuft davor und stört das Response-Streaming nicht.
- **Buffering-Fallstricke** (streaming.md Z. 680-722): Reverse-Proxies (`X-Accel-Buffering: no`), CDNs, gzip/brotli können den ersten Chunk puffern; Safari puffert die ersten 1024 Bytes; AWS-Lambda braucht Response-Streaming-Mode (Vercel nativ). Real, aber lösbar.

### 4.2 SDK kann streamen — **aber liefert hier JSON, nicht Prosa**
`@anthropic-ai/sdk@0.96.0` (verifiziert in `resources/messages/messages.d.ts` + `lib/MessageStream.d.ts`):
- `messages.create({stream:true})` → `Stream<RawMessageStreamEvent>`; `messages.stream(body)` → `MessageStream` mit `finalMessage()`, `toReadableStream()`, `inputJson(partial, snapshot)`.
- **Der Haken:** Unter Forced-Tool-Use kommt der Output als `input_json_delta` (`partial_json`) auf einem `tool_use`-Content-Block — **kein** Text-Block. Token-für-Token-Text gibt es nur, wenn ein Pfad Forced-Tool-Use **fallen lässt**. (Genau das Caveat aus dem Audit, hier am SDK belegt.)

### 4.3 Kollision mit Prompt-Caching (6.3)? — **Nein, koexistiert sauber**
- `cache_control:{type:'ephemeral'}` (structured.ts:171) und `stream:true` sind orthogonale Messages-API-Features. Caching steuert *was* re-gesendet vs. aus Cache gelesen wird; Streaming steuert *wie* geliefert wird.
- **Einziger Unterschied — wo Cache-Usage berichtet wird:** Gepuffert steht alles in `response.usage` (`cache_read_input_tokens` etc.). Gestreamt sind die Cache-Felder bereits im **ersten** `message_start`-Event gefüllt, `output_tokens` laufen über `message_delta`. Mit `messages.stream().finalMessage()` setzt das SDK ein vollständiges `Message.usage` wieder zusammen → Cache-Nachweis (wie in 6.3) bleibt erhalten. **Kein Ausschluss.**

### 4.4 Fehler/Abbruch mitten im Stream — **neue Fehlerklasse**
- Heute: ein Fehler → sauberer `500/502`-JSON, Client rollt den optimistischen Turn zurück (InterviewChat.tsx:163-168). Klar.
- Gestreamt: Bricht der Anthropic-Call **nach** Chunk 1 ab, ist der Status schon 200 — man kann nicht mehr auf 502 wechseln. Man braucht ein In-Band-Fehler-Protokoll (z.B. ein `{type:'error'}`-Sentinel im Stream) + Client-Logik, die einen halb-gestreamten Turn verwirft. `AbortController`/Client-Disconnect muss den Anthropic-Stream serverseitig canceln, sonst Token-Verschwendung. Alles machbar, aber **neue** Komplexität, die es heute nicht gibt.

### 4.5 Markdown/Rendering — **heute kein Risiko, aber auch kein Vorteil**
- **Keine Markdown-Lib im gesamten Projekt** (grep über `src` + `package.json` sauber). Alle drei Clients rendern **Klartext** in `<p>/<div>` mit `whitespace-pre-wrap` (InterviewChat.tsx:57; Panels analog). Zitate sind hand-gerollte JSX (Mission-Control verlinkt sogar auf die Synthese).
- **Implikation:** Teil-Text-Streaming in dieselben Klartext-`<p>`s flackert **nicht** (kein Re-Parse pro Chunk). Gut — aber das eliminiert nur ein *Nebenrisiko*; die Blocker aus §2 bleiben. Ein Flacker-Risiko entstünde erst, wenn jemand *zusätzlich* einen Markdown-Renderer einführt und pro Chunk neu parst.

---

## 5) Risiko-Einschätzung — ehrlich

**Größe: L (strukturell).** Übereinstimmend mit der Audit-Einstufung von 6.1/6.2.

**Wo könnte etwas Verifiziertes brechen?**
1. **Anker-Integrität (höchstes Risiko).** Der Halluzinations-Schutz ist die am stärksten verifizierte Invariante (siehe die Mission-Control-/Cross-Study-/Chat-Evals im Repo). Streaming-vor-Validierung bedeutet entweder (a) Antwort zeigen und ggf. zurückziehen — untergräbt den Schutz aktiv — oder (b) bis zur Vollständigkeit puffern — dann **null** UX-Gewinn. Beides verfehlt das Ziel.
2. **Crash-Sicherheit.** Verlässt man für die Chats `callClaudeStructured`, verliert man die „bereits-geparstes-Objekt"-Garantie und holt die JSON-`parse`-Crash-Klasse zurück, gegen die das ganze Primitiv gebaut wurde.
3. **Modell-Qualität bei Tier-Wechsel.** Falls man (als „billigen" Teilschritt) auf Sonnet/Haiku geht: chat-with-data + mission-control haben **kein grünes Sonnet-Eval**; Opus war explizit die Anker-Integritäts-Entscheidung. Ungetestet flippen = Kalibrierungs-/Treue-Risiko.
4. **Interview-Vertrag.** Entkopplung von Prosa, `done`/`forceCapClose` und DB-Write kann das Beenden-/Cap-Verhalten subtil verändern (falsches „done", doppelte/fehlende Closing-Message).

**Verifikations-Last:** hoch. Neues/erweitertes Eval für 2 trust-kritische Engines auf einem neuen Kanal; e2e-Tests für Stream-Abbruch/Abort; Interview-Smoke (Cap-Close, Post-Loss-`after()` bleibt intakt); manuelle Latenz-Messung, ob der gefühlte Gewinn real eintritt. Das ist die typische „aufwändig verifiziert"-Last, die der Auftrag schützen will.

---

## 6) Aufwand grob + klare Empfehlung

### Aufwand (grobe Spannen, nur zur Größenordnung)
| Variante | Aufwand | Risiko |
|---|---|---|
| **Voll: 6.1+6.2 echtes Prosa-Streaming** (neues Primitiv + 3 Engines + 3 Routes + 3 Clients + Evals + Abbruch-Protokoll) | **~3–6 Tage** | **L / hoch** (Anker-Integrität) |
| **Teil A: nur Interview (6.1) streamen** (kein Anker-Filter, aber `done`/`forceCapClose`/Session-Return-Umbau) | ~1.5–3 Tage | M–L (Interview-Vertrag) |
| **Teil B (eigentlich kein Streaming): Modell-Tier per Env auf Sonnet/Haiku** | **~0 Code**, aber **+1 Eval-Zyklus** je Pfad | M (Tier-Qualität), **0** Architektur |
| **Status quo lassen** | 0 | 0 |

### Empfehlung: **6.1/6.2-Streaming JETZT NICHT bauen.**

Begründung, nüchtern:
- **Der Gewinn ist gefühlte Latenz auf kurzen Antworten.** Chat-Antworten sind per Prompt 1–4 Sätze; der Interview-Turn ist *eine* Nachricht. Wort-für-Wort-Streaming spart bei so kurzen Ausgaben wenig wahrgenommene Zeit.
- **Die echte Latenz ist schon adressiert.** 6.3 (Prompt-Caching, gemerged) und 6.4 (Post-Loss-Extraktion via `after()` entkoppelt, gemerged) haben die *tatsächliche* Wartezeit bereits gesenkt — der Status quo ist nicht mehr der „nackte Blocking-Pfad" von vor dem Sprint.
- **Das Risiko/Aufwand-Verhältnis ist schlecht.** L-Aufwand + hohe Verifikations-Last, mit dem Risiko exakt auf der verifizierten Anker-Integrität — für einen moderaten gefühlten-Latenz-Gewinn. Das ist kein guter Tausch, solange Latenz nicht nachweislich ein konkreter Nutzer-Schmerz bleibt.

### Falls Latenz doch als realer Schmerz bestätigt wird — die ehrliche Reihenfolge:
1. **Zuerst der billige, andere Hebel:** `VOICE_MODEL` (Interview) / `CHAT_WITH_DATA_MODEL` / `MISSION_CONTROL_MODEL` auf Sonnet/Haiku. **0 Code**, senkt **echte** Latenz statt nur gefühlter. **Bedingung:** vorher ein Eval-Zyklus (die beiden Daten-Chats haben kein grünes Sonnet-Eval; Opus war die Anker-Wahl). Das Interview ist der sicherste Erstversuch (kein Anker-Filter, `VOICE_MODEL` existiert bereits). — *Das ist kein Streaming und schließt 6.1/6.2 nicht ab, ist aber die risiko-ärmere Investition mit echtem Effekt.*
2. **Erst danach, und nur falls dann noch Bedarf:** ein **eng begrenztes** Streaming — **nur der Interview-Turn** (6.1), die least-coupled Fläche (keine Zitate), über ein **separates** Streaming-Primitiv, das `callClaudeStructured` und alle Extraktoren **garantiert nicht** berührt. Chat-with-Data + Mission-Control (mit Anker-Downgrade) würde ich **nicht** streamen — dort ist der Konflikt mit dem Halluzinations-Schutz fundamental.

> **Kurz:** Bauen? **Nein, nicht jetzt.** Teil davon? **Ja — aber der lohnende Teil ist der Modell-Tier-Hebel (kein Streaming), nicht das Streaming.** Streaming der strukturierten, anker-gefilterten Chats ist zu viel Risiko am Halluzinations-Schutz für zu wenig gefühlten Gewinn, zumal 6.3/6.4 die echte Latenz bereits gedrückt haben.

---

### Anhang — die wichtigsten Belege (Datei:Zeile)
- Forced-Tool-Use (B's Schutz): `structured.ts:182` (`tool_choice:{type:"tool"}`), `:174` (`messages.create`, nicht-streaming), `:191` (`schema.safeParse`).
- Prompt-Caching (6.3): `structured.ts:171` (`cache_control`); Caller `chat-with-data.ts:443`, `mission-control/engine.ts:231`.
- Chat-with-Data ist strukturiert + anker-gefiltert: `chat-with-data.ts:56-62` (Schema), `:430-444` (Call), `:355-396` (Filter), `:372-378` (Downgrade).
- Mission-Control dito: `engine.ts:218-232` (Call), `:145-161` (per-Study-Filter, Downgrade `:154-156`).
- Interview-Turn = `{done,message}` im selben Blob: `interviewer.ts:82-86`; Prosa-Überschreibung nach Kontrollfeld: `session-service.ts:703-705`; Session-Return nach DB-Write: `:839-858`.
- Heute kein Streaming: grep `src` nach `ReadableStream/stream:true/SSE/input_json_delta` = 0.
- Stack kann streamen: Next-Docs `route.md`§367-481, `streaming.md`§485-573/608-618; SDK `messages.d.ts:590-592` (`input_json_delta`), `messages.stream()`.
- Default-Modelle: `client.ts:18` (Sonnet global), `chat-with-data.ts:42` / `mission-control/engine.ts:48` / `interviewer.ts:29` (alle **Opus** = Anker-Wahl).
- Kein Markdown: grep `src`+`package.json` sauber; Klartext-Render `InterviewChat.tsx:57` (`whitespace-pre-wrap`).
