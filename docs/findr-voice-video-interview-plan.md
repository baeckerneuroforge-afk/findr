# Findr — Voice- & (später) Video-KI-Interviews: Architektur-, Anbieter- & Risiko-Analyse

> **Status:** NUR PLAN. Kein Code geschrieben, nichts gebaut, nichts geändert außer
> diesem Dokument. Ehrliche Analyse, kein Grünes-Licht-Dokument: wo etwas „zu früh /
> zu teuer / zu riskant für jetzt" ist, steht das genau so da. Marker wie im
> `findr-desktop-app-plan.md`: **🔶 ANNAHME** (gemeinsam entscheiden), **⚠️ RISIKO**
> (teuer/schwer/unsicher), **🟢** (tragende Erkenntnis), **„zu verifizieren"**
> (Faktum nicht hart belegt — nicht raten).
>
> **Datum:** 2026-06-02 · **Branch:** `plan/voice-video` · **Autor:** André + Claude
> (Recherche-Workflow: 3 Codebase-Leser + 3 Anbieter-Recherchen, 134 Tool-Calls).

---

## 0. TL;DR (für den eiligen Leser)

- **Was schon da ist (das „Gehirn"):** Der bestehende **Text**-Interview-Agent
  (`src/lib/voice-agent/`, verwirrend benannt) ist eine saubere, wiederverwendbare
  Kern-Funktion: `nextResearchMessage(input, history, language) → {done, message}`.
  Studien-Struktur, offene Links, Screening, Extraktion **und** Synthese sind
  **kanal-agnostisch** und werden 1:1 wiederverwendet. Das Datenmodell **antizipiert
  Voice/Video bereits** (`interview_sessions.mode = 'text'|'voice'|'video'`,
  `transcript_source`, `recording_url`, `research_invites.mode_preference`).
- **Was NEU dazukommt:** ausschließlich die **Echtzeit-Hülle** — WebRTC-Transport,
  Speech-to-Text, Text-to-Speech, Turn-Taking/Barge-in, eine Finish-Route und eine
  bewusste Entscheidung rund um die **Forced-Tool-Use-Latenz** des Agenten.
- **Wichtige Korrektur vorweg:** Das **Voice-Ingest-Backend (E1)** (`voice_inbox`,
  `voice_api_tokens`, `/api/voice/ingest`) ist **NICHT** die Grundlage für
  Echtzeit-Interviews. Es ist ein **asynchroner „fertiges Transkript in einen
  Posteingang werfen"-Pfad** für die geplante Granola-artige **Desktop-App** (B2B-Call-
  Recorder). Es verarbeitet **kein** Audio in Echtzeit. Echtzeit-Voice dockt an den
  **Interview-Agenten** an, nicht an E1. (Details §1.)
- **DSGVO-konformer Anbieter-Stack (empfohlen, strikte „in DE/EU gebaut"-Lesart):**
  **Transport = LiveKit self-hosted**, **STT = self-hosted Whisper large-v3 oder
  Deepgram-on-prem**, **TTS = self-hosted Piper/Thorsten-Voice**. Begründung: bei
  **Audio echter Menschen (sensibles personenbezogenes Datum!)** ist der DSGVO-Filter
  strenger als beim Panel — nur Self-Hosting kollabiert die Schrems-II-/US-Konzern-
  Frage vollständig (kein externer Auftragsverarbeiter im Medienpfad). Managed-EU
  (LiveKit Cloud EU / Gladia / Azure DE) = **Residency, nicht Souveränität** →
  verteidigbar, aber schwächer für den strikten Pitch. **Vapi = K.O.**,
  **Play.ht = tot**, **Coqui XTTS = Lizenz-K.O.** (§3).
- **Die schweren Teile (ehrlich):** (a) **Latenz** — die Forced-Tool-Use-Architektur
  des Agenten gibt das **ganze `{done,message}`-Objekt erst fertig** zurück (kein
  Token-Streaming an die TTS), genau das, worauf jede Sub-1-Sekunden-Pipeline baut;
  (b) **Turn-Taking/Barge-in** — gelöst durch den Transport-Layer (LiveKit Agents /
  Pipecat), nicht selbst zu bauen; (c) **Sprach-Stack-Bruch** — die Voice-Frameworks
  sind oft Python-first, das Gehirn ist TS/`server-only`; (d) **Re-Eval** — der heutige
  Agent ist auf den Text-Pfad eval'd, eine Echtzeit-Variante muss neu eval'd werden.
  (§4.)
- **Video** (Visual Intelligence à la Outset: Gesicht/Affekt, Klickpfade/Screenshare)
  ist eine **deutlich größere, separate, spätere Stufe** — im Plan klar abgegrenzt,
  **nicht** mit Voice vermischt (§4.4, §6 Phase V3+).
- **Ehrliche Empfehlung (§7):** **Jetzt noch nicht als Produkt.** Der Nutzer hat selbst
  gesagt, der Echtzeit-/Desktop-Teil sei „später, wenn Geld da ist" — **der Plan
  bestätigt das.** Voraussetzungen, die VORHER stehen müssen: (1) **Teilnehmer-Quelle**
  (Prolific/Panel-Entscheidung — ein Voice-Interview ohne Interviewte ist sinnlos),
  (2) **der Text-Research-Interview-Pfad muss am Markt ziehen** (zieht das AI-Interview-
  Format in DACH überhaupt?), (3) **Ops- & Rechts-Kapazität** (Self-Host-Infra +
  DACH-Anwalt für Audio-Einwilligung). Ein **kleiner, interner V0-Voice-Spike** zum
  De-Risking (Latenz + deutsche Stimmqualität messen) ist **früher vertretbar** —
  aber als Lern-Spike, nicht als Launch.

---

## 1. IST-Aufnahme — was ist schon da, wo dockt Echtzeit an?

### 1.1 Begriffsklärung: drei verschiedene „Voice"-Dinge

Im Repo kollidieren drei Bedeutungen von „Voice" — die Verwechslung ist die größte
Falle dieses Vorhabens:

| Name im Code | Was es WIRKLICH ist | Bezug zu Echtzeit-Interviews |
|---|---|---|
| **`src/lib/voice/` + `/api/voice/ingest` + `voice_inbox`** (E1) | Async-Ingest für die **Desktop-App** (B2B-Call-Recorder, Granola-Stil): nimmt **fertige Transkripte** entgegen, routet sie an Risk/Health/Discovery | **Kaum.** Verarbeitet kein Echtzeit-Audio. Höchstens das **Idempotenz-/Posteingang-Muster** als Vorbild. |
| **`src/lib/voice-agent/`** (irreführend benannt) | Das **TEXT-Interview-Gehirn**: `nextResearchMessage`/`nextInterviewMessage`/`nextCheckinMessage`, `advanceInterview`, Session-Lifecycle | **Das ist der Andockpunkt.** Genau dieses Gehirn wird wiederverwendet. |
| **NEU: Echtzeit-Voice-Interview** (dieser Plan) | Eine Echtzeit-**Hülle** um das Gehirn (WebRTC + STT + TTS) | Das hier Geplante. |

🟢 **Tragende Erkenntnis:** Das „Voice-Ingest-Backend (E1)" und das „Echtzeit-Voice-
Interview" sind **zwei verschiedene Produkte**, die zufällig „Voice" heißen. Der Plan
baut auf dem **Interview-Agenten** auf, nicht auf E1.

### 1.2 Voice-Ingest E1 — was kann es genau? (kurz, weil es NICHT der Andockpunkt ist)

Migration `supabase/migrations/20260627000000_voice_ingest.sql` legt **zwei** additive
Tabellen an:

- **`voice_inbox`** — Doppelrolle: (1) Idempotenz-Ledger jedes Ingests
  (`unique (org_id, external_meeting_id)`), (2) Posteingang (`status='pending'` =
  „später zuordnen"). Spalten: `status` (`pending`/`routed`/`assigned`/`dismissed`),
  `engine` (`health`/`risk`/`discovery`), `payload` (JSONB; bei `pending` enthält es
  das Transkript), `result_ref`, RLS per `current_org_id()`.
- **`voice_api_tokens`** — statische, org-gescopte Bearer-Tokens für die Desktop-App;
  nur `sha256(token)` gespeichert, Soft-Revoke via `revoked_at`.

**Was `/api/voice/ingest` annimmt** (`src/lib/schemas/voice-ingest.ts`):

```ts
VoiceIngestSchema = {
  transcriptText: string (1..100_000),   // ← FERTIGER TEXT, keine Audio-Bytes, keine URL
  externalMeetingId: string,             // Idempotenz-Schlüssel
  recordedAt?, durationSeconds?, segments?,   // optionale Metadaten
  assignment: { kind: "existing_customer"|"sales_call"|"discovery"|"inbox", ... }
}
```

🟢 **Es nimmt ausschließlich TEXT-Transkripte entgegen.** **Nirgends** wird in diesem
E1-Code Audio dekodiert oder transkribiert — Speech-to-Text passiert **vor** dem POST
(Desktop-App / Recall.ai-SDK). Kein WebRTC, kein Streaming, kein WebSocket, kein
Audio-Codec, keine Live-Schleife. Es ist eine reine **„Call-in"-Architektur** (HTTP
Request/Response). Für ein Echtzeit-Interview ist davon **nichts** im kritischen Pfad
wiederverwendbar außer dem Muster „idempotenter Eingang + Human-Gate".

### 1.3 Der Interview-Agent — das wiederzuverwendende Gehirn (DAS ist der Andockpunkt)

**Heute ein reines Text-Interview** (`interviewer.ts:14` sagt es selbst:
„the post-loss interview (TEXT version)"). Drei Geschmacksrichtungen, **identische
Mechanik**:

- **Post-Loss** (`nextInterviewMessage`), **Check-in** (`nextCheckinMessage`),
  **Research** (`nextResearchMessage`) — alle drei: gleiche Signatur, gleiches Schema
  `{done: boolean, message: string}`, gleiche `callJson`-Plumbing.

**Eine Runde end-to-end** (`session-service.ts:660` `advanceInterview(token, message)`):

1. Session per Token laden, Status prüfen (`open`).
2. `history = [...conversation, {role:"customer", text: message}]`.
3. **EINE** Opus-Call: `nextResearchMessage(input, history, language, model)` →
   `{done, message}` (`session-service.ts:685`).
4. Agent-Turn an History anhängen; Cap-Logik (`MAX_RESEARCH_TOTAL_TURNS = 16`).
5. **Bei Abschluss** (`done` oder Cap): Conversation + `status='completed'` persistieren
   **und** Synthese-Anschluss feuern (`persistResearchTranscriptAndDiscovery`,
   `session-service.ts:717`).
6. Sonst: nur Conversation updaten. Public-View zurück.

**Transport heute** (`src/app/api/interview/[token]/route.ts`): login-frei, Token-only.
`POST {message}` → `advanceInterview` → JSON-Antwort. **Klassisches Request/Response,
eine Opus-Call pro POST, kein Streaming.**

**Modell & Robustheit** (`interviewer.ts`, `anthropic/structured.ts`):

- **Default = Opus** (`DEFAULT_VOICE_MODEL = CLAUDE_MODELS.opus = "claude-opus-4-7"`,
  `interviewer.ts:29`), **überschreibbar via `VOICE_MODEL`-Env oder `model`-Param** →
  Sonnet/Haiku sind ohne Codeänderung wählbar.
- **`callClaudeStructured` = Forced-Tool-Use**: `tool_choice: { type:"tool",
  name:"emit_voice_result" }`, `maxTokens: 1024`, **kein** `stream: true`
  (`structured.ts:181-182`). → **Das ganze `{done,message}`-Objekt kommt erst fertig
  zurück.** (Der Grund für die Latenz-Frage in §4.1.)

🟢 **Die saubere Naht für Wiederverwendung:** `nextResearchMessage(input, history,
language, model)` ist eine **reine** Funktion (kein State, keine DB, kein HTTP). Eine
Echtzeit-Schleife ruft sie pro Runde genau einmal auf und führt History + Persistenz
selbst. Das ist exakt der Punkt, an dem die Hülle andockt.

### 1.4 Studien / offene Links / Screening — wo Voice andocken MUSS

- **`research_plans`** (Titel, Objective, `topic_script`, `screening_questions`,
  `study_type`) — unverändert nutzbar; `study_type` schaltet bereits die Linse
  (Product-Discovery vs. Market-Research).
- **Zwei Eintritts-Pfade** (beide physisch getrennt, beide org-aus-der-Zeile, nie aus
  dem Request): **Invite** (`research_invites`, `findInviteByAccessToken`) und
  **offener Link** (`research_open_links`, `findOpenLinkByAccessToken`, `org_id NOT
  NULL`, `max_sessions`-Cap).
- **Screening-Gate** (`resolvePublicEntry`, `session-service.ts:501`): liefert
  `needs_screening` oder `session`. **`evaluateScreening` ist deterministisch, KI-frei,
  identity-free** und sitzt **vor** der Session-Erzeugung. Bei `qualified` →
  `createResearchInterview(...)` → `createInterviewSession(...)`; bei `rejected` →
  anonyme `research_screening_responses`-Zeile, **keine** Session, **keine** Opus-Call.

🟢 **Das Datenmodell ist auf Voice/Video vorbereitet** (kein Voll-Zufall — jemand hat
mitgedacht):

- `createInterviewSession({ mode?: "text"|"voice"|"video" })`, `transcript_source`
  (`session-service.ts:259-261, 336`): Kommentar wörtlich *„Voice/Video will set this
  when the transport adapters land."*
- `research_invites.mode_preference: "text"|"voice"|"video"` existiert bereits.
- `interview_sessions.recording_url` existiert (heute im Research-Pfad ungenutzt) —
  natürlicher Platz für eine Aufnahme-Referenz.

### 1.5 Extraktion/Synthese — kanal-agnostisch (100 % Wiederverwendung downstream)

Bei Abschluss: `persistResearchTranscriptAndDiscovery({ orgId, planId, inviteId,
transcript: string })` (`transcript-service.ts:47`) → legt eine `calls`-Row an (`source:
"research"`, `transcript`) → `analyzeCallForProductDiscovery(callId, {planId})` →
`product_discovery_insights` → Stage-2-Synthese.

🟢 **Der Anschluss nimmt `transcript: string`.** Sobald ein Voice/Video-Interview fertig
ist, ist es derselbe `InterviewTurn[]` (`{role,text}`) → derselbe Transkript-String →
dieselbe `calls`-Row → derselbe Classifier → dieselbe Synthese. **Null Änderung
downstream.** Der einzige ehrliche Hinweis: das `participants`-JSONB stempelt heute
`hint: "...(text mode)."` — für Voice sollte man `transcript_source: "voice"` setzen und
den Hint anpassen (trivial, additiv).

### 1.6 Was wird wiederverwendet vs. was ist NEU (die zentrale Tabelle)

| Baustein | Datei / Symbol | Voice/Video |
|---|---|---|
| Interview-Gehirn (Runde) | `nextResearchMessage` (`interviewer.ts:607`) | **WIEDERVERWENDET** (ggf. Modell-Swap, ggf. Streaming-Variante → §4.1) |
| Session-Lifecycle | `createInterviewSession`/`advanceInterview` | **WIEDERVERWENDET** (`mode:"voice"`, Finish-Logik) |
| Studien-Struktur | `research_plans`, `study_type` | **WIEDERVERWENDET, unverändert** |
| Eintritt: Invite/Open-Link | `findInvite…`/`findOpenLink…` | **WIEDERVERWENDET, unverändert** |
| Screening-Gate | `evaluateScreening` (deterministisch) | **WIEDERVERWENDET, unverändert** (Form-Vorab-Gate) |
| Extraktion + Synthese | `persistResearchTranscriptAndDiscovery` → `analyzeCallForProductDiscovery` | **WIEDERVERWENDET, unverändert** (nimmt Text) |
| Datenmodell | `interview_sessions.mode/transcript_source/recording_url`, `invites.mode_preference` | **schon vorhanden**, nur zu setzen |
| — | — | — |
| WebRTC-Transport + Turn-Taking/VAD/Barge-in | — | **NEU** (Anbieter, §3.1) |
| Speech-to-Text (de-DE, streaming) | — | **NEU** (Anbieter, §3.2) |
| Text-to-Speech (de-DE, natürlich) | — | **NEU** (Anbieter, §3.3) |
| Echtzeit-Agent-Prozess + Turn-Bridge zum TS-Gehirn | — | **NEU** (Glue, §2 + §4.3) |
| Finish-Route für Voice-Session | — | **NEU** (dünn; ruft die bestehende Finish-Logik) |
| Einwilligungs-/Consent-Flow (Audio!) | — | **NEU** (Recht, §5) |
| Re-Eval der Echtzeit-Agent-Variante | — | **NEU** (§4.4) |

---

## 2. Architektur-Skizze der Echtzeit-Schleife

```
┌─ TEILNEHMER (Browser, login-frei via Token) ──────────────────────────────────┐
│  Mikrofon → WebRTC ↑↓  Lautsprecher                                             │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ WebRTC (Opus-Audio)         ⟵ NEU: Transport-Layer (§3.1)
┌─ ECHTZEIT-HÜLLE (NEU — z.B. LiveKit Agents / Pipecat, in eigener EU-Infra) ────┐
│                                                                                 │
│   (a) STT  Audio→Text (de-DE, streaming)        ⟵ NEU (§3.2)                    │
│   (b) VAD/Turn-Detection: „Mensch fertig?" + Barge-in  ⟵ NEU, vom Transport     │
│   (c) Turn-Bridge: history += {customer, text}                                  │
│         │                                                                        │
│         ▼   EINE Call pro Runde                                                  │
│   ╔══ BESTEHENDES GEHIRN (UNVERÄNDERT*) ══════════════════════════════╗         │
│   ║  nextResearchMessage(input, history, lang) → { done, message }     ║         │
│   ╚════════════════════════════════════════════════════════════════════╝         │
│         │  *„unverändert" gilt für Logik/Prompt; Latenz-Variante → §4.1          │
│         ▼                                                                        │
│   (d) TTS  message→Audio (de-DE, natürlich, streaming)  ⟵ NEU (§3.3)            │
│         │  ggf. Backchannel/Filler während (b)→(d) zur Latenz-Maskierung        │
│         ▼                                                                        │
│   Audio zurück über WebRTC; bei done=true → Session-Abschluss                   │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ Finish (dünne NEUE Route) → bestehende Logik:
┌─ FINDR-BACKEND (BESTAND, unverändert) ─────────────────────────────────────────┐
│   advanceInterview-Finish-Pfad → persistResearchTranscriptAndDiscovery(transcript)│
│   → calls-Row → analyzeCallForProductDiscovery → product_discovery_insights      │
│   → Stage-2-Synthese  (IDENTISCH zum Text-Interview)                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Vorab (unverändert):** Token → `resolvePublicEntry` → **Screening-Form-Gate**
(`evaluateScreening`) → bei `qualified`: Session mit `mode:"voice"`. Erst danach
WebRTC-Verbindung. (Screening bleibt für V0/V1 ein **Formular vor** dem Raum — nicht
verbal; §4-Gaps.)

**Persistenz-Naht — wichtig und ehrlich:** `advanceInterview` ist heute für HTTP
Request/Response gebaut (DB-Load + Opus-Call + DB-Write **pro** Runde = 2 DB-Roundtrips
pro Turn). Für Voice will man die Conversation **im Echtzeit-Prozess im Speicher**
halten und **`nextResearchMessage` direkt** rufen (die reine Funktion), und nur
**out-of-band** persistieren — sonst klebt man die DB-Latenz an jede gesprochene Runde.
Das heißt: man ruft das **Gehirn** wieder, aber die **Orchestrierung** (`advanceInterview`)
wird für Voice **nicht 1:1** übernommen — eine schlanke Voice-Orchestrierung ruft
`nextResearchMessage` + persistiert asynchron + nutzt am Ende die bestehende
Finish-Logik. Das ist NEU, aber klein.

---

## 3. Anbieter-Analyse (der Kern) — DSGVO-Fokus

> **Schärferer Filter als beim Panel.** Beim Panel flossen nur opake IDs. Hier fließt
> **Audio (später Video) echter Menschen = besonderes/sensibles personenbezogenes
> Datum.** Maßstab: Übersteht der Anbieter die Frage eines hartliner DACH-Datenschutz-
> Käufers *„Wo liegen die Daten und wer kann darauf zugreifen?"*. **Kein EU-Hosting +
> kein AVV (oder US-Konzern ohne Self-Host-Ausweg) = K.O. für den „DSGVO-nativ"-Pitch.**
> Alle Preise/Regionen sind **Schätzungen, „zu verifizieren"** — Pricing-Seiten ändern
> sich. Sources stehen je Anbieter.

### 3.1 Echtzeit-Transport / Media (WebRTC + Turn-Taking)

| Anbieter | EU-Hosting | Self-Host | AVV/Schrems-II | Turn-Taking/VAD/Barge-in **out-of-box** | ~Kosten/Teiln.-Min | Latenz |
|---|---|---|---|---|---|---|
| **LiveKit self-hosted** (Apache-2.0) | **Ja — du wählst** (eigene EU/DE-Infra, z.B. Frankfurt) | **JA — der Trumpf** (SFU + Agents als Single-Binary/Docker/K8s) | **Kein Prozessor im Medienpfad** → Schrems-II entfällt (du = Betreiber). LiveKit Inc. = US, DPA nur relevant bei Cloud | **JA** — Silero VAD + semantisches End-of-Turn-Modell (läuft **lokal**) + adaptives Barge-in | **~0 marginal** (nur eigene Server/Bandbreite, „cents/h VM") | Sub-Sekunde (Design-Ziel); Frankfurt = niedrige RTT |
| **LiveKit Cloud (EU-Pinning)** | Partial/Ja — Region „eu" (DE+FR); **aber** Observability/Telemetrie in US (lt. DPA) | n/a (gleiches OSS-SFU → Cloud→Self-Host **ohne Codeänderung**) | DPA (SCCs, DPF-Fallback); US-Mutter → CLOUD Act bleibt | **JA** (identischer Stack) | ~$0.0004/WebRTC-Min + ~$0.01/Agent-Min + Modell-Passthrough | Stark, globales Edge |
| **Daily.co (+ Pipecat)** | Ja (Geo-Pinning eu-central-1 **Frankfurt**) | Partial (Daily managed nein; **Pipecat** OSS self-hostbar) | DPA, DPF, SOC2/ISO; **US-Mutter** → Residency, nicht Souveränität | **JA** — via Pipecat (Silero VAD + **Smart Turn v3**, Open-Weights) | ~$0.001–0.004/Min (zu verifizieren) | Stark, AWS-Edge |
| **Vapi** | **NEIN** native EU; Transfers in US (SCCs) | „on-prem" nur Enterprise, unverifiziert | **DPA nur Enterprise**, NICHT DPF-zertifiziert, US-Mutter | JA (das ist sein Value-Prop) — aber via **US-Orchestrierung** | ~$0.05/Min **Plattform-Fee** + Provider-Kosten | Sub-Sekunde, aber durch US-Provider-Ketten |
| **Twilio (Voice/Video)** | Ja für Voice (Irland); Video EU-Pinning unklar | **NEIN** (geschlossenes CPaaS) | DPA + BCRs + Schrems-II-Programm; US-Mutter | **NEIN** — rohes Medientransport, VAD selbst bauen | Voice ~$0.0085/Min; Video ~$0.004/Teiln.-Min (zu verifizieren) | Realtime, aber kein Agent-Loop |

⚠️ **Programmable Video (Twilio):** EOL angekündigt (2024) → verlängert (2026-12-05) →
reportedly reinstated. **Roadmap-Risiko, vor jedem Bau verifizieren.**

**Empfehlung Transport:** **LiveKit self-hosted** ist der klare Sieger für den strikten
Pitch — **die einzige Option mit einer sauberen Souveränitäts-Aussage** statt einer
Residency/SCC-Aussage: kein Dritt-Prozessor im Audio/Video-Pfad, ganze Schrems-II-Frage
kollabiert. **Und** man verliert keine DX: Turn-Taking/VAD/Barge-in sind **out-of-box**
(muss man nicht selbst bauen — das wäre sonst das härteste Echtzeit-UX-Teil). Preis =
**Ops** (SFU + TURN + Redis-Routing selbst betreiben/skalieren). **Pragmatischer Weg:**
für Speed-to-Market auf **LiveKit Cloud EU** starten, die **Null-Code-Migration zu
Self-Host** als harte Garantie + Pitch-Zentrum behalten. **#2 = Daily + Pipecat**
(echtes Frankfurt-Pinning + self-hostbares Open-Turn-Taking). **Vapi = K.O.** (kein
EU-Server, DPA enterprise-only, US-Ketten — Drittquellen nennen Vapi/Retell/Bland
explizit „a GDPR bomb" für EU). **Twilio** = Residency-aber-nicht-souverän + **kein**
Turn-Taking + Roadmap-Risiko → schwächster technischer Fit.

🔶 **ANNAHME / offene Frage:** Echtes **TCO + Ops** von Self-Host-LiveKit in Frankfurt
(Autoscaling, TURN, On-Call) vs. Cloud-EU — das entscheidet Build-vs-Buy. **Zu
verifizieren:** Lizenz des Turn-Detector-**Modells** für self-hosted-commercial (Framework
ist Apache-2.0; Modell-Gewichte separat prüfen). Bei Cloud-EU: schriftliche Bestätigung,
dass **alle** Medien+Transkripte in EU bleiben und der US-Observability-Pfad pro Projekt
abschaltbar ist.

### 3.2 Speech-to-Text (Deutsch essenziell!)

| Anbieter | EU-Hosting | Self-Host | AVV/Schrems-II | de-DE-Qualität | Streaming-Latenz | ~Kosten/Min |
|---|---|---|---|---|---|---|
| **Self-hosted Whisper** (faster-whisper large-v3) | **Ja, 100 %** (eigene GPU) | **JA — der Trumpf** | **Kein Prozessor** → kein AVV/Schrems-II für den ASR-Schritt | Gut für sauberes Interview-Audio (~8,4 % WER curated; ~19,9 % auf „harten" Prod-Audio) | ⚠️ **Schwachpunkt:** Whisper ist **Batch-nativ**; naive Streaming-Wrapper ~**3,3 s** vs. ~200–300 ms bei Streaming-Engines | ~Infra-only (Bruchteil Cent/Min bei Auslastung) |
| **Gladia (Solaria-1)** | **Ja, EU-by-default** (Frankreich); EU-**gegründet** (Paris) | Nein (Default); dediziert evtl. Enterprise | DPA-forward, „no training on audio" vertraglich; **kein klassischer US-Mutter-Hebel** (NYC-Office prüfen) | **Unbewiesen für de-DE** (Top-Claims nur EN/ES/FR/IT) — **muss vor Commit ge-WER-t werden** | **<103 ms** Partials, TTFB ~270 ms | ~$0.004–0.0125/Min |
| **Azure AI Speech** (Germany West Central) | **Ja — stärkster „Daten bleiben in DE"-Beleg** (In-Region-Garantie, EU Data Boundary) | Partial — **Speech-Container** on-prem (Lizenz; de-DE-Streaming „zu verifizieren") | MS-DPA + **deutscher AVV** + EU Data Boundary; US-Mutter → CLOUD-Act-Einwand bleibt technisch | Reif, breit DACH-erprobt | Low-hundreds-ms | ~$0.0167/Min (~$1/h) |
| **Deepgram (Nova-3 German)** | Ja (EU-Endpoint; physische Region **nicht benannt** — zu verifizieren) | **JA** (on-prem Enterprise, P50 ~198 ms) | DPA + SCCs; US-Mutter → managed-Pfad nicht bulletproof; **Self-Host fixt es** | Beste WER-Zahlen — aber **Deepgrams eigener** Benchmark (vendor-biased) | ~200 ms-Klasse | ~$0.0077/Min; Self-Host = Enterprise |
| **AssemblyAI** | Ja (Irland, AWS eu-west-1) | **NEIN** | DPA/SCCs; US-Mutter | Deutsch unterstützt, **nicht** Top-Sprache | ~300 ms | ~$0.0025–0.0045/Min |

**Empfehlung STT:** Für den strikten Pitch: **(1) Self-hosted Whisper large-v3** = einzige
Option mit **null externem Prozessor** — verkörpert den Pitch wörtlich; gute deutsche
Qualität bei sauberem Interview-Audio. **Einziges echtes Risiko: Echtzeit-Streaming-
Latenz** (Batch-nativ). **(2) Gladia** = bester *managed* Fit fürs Marketing (EU-
gegründet, EU-by-default, beste Latenz) — **Blocker: de-DE-Qualität unbewiesen**, muss
ein deutsches WER-Duell gewinnen. **(3) Azure germanywestcentral** = bester „Daten in
Deutschland"-Beleg + reifes Deutsch, aber US-Mutter. **(4) Deepgram self-hosted** =
falls man **beides** braucht (de-DE-Klasse **und** sub-300 ms im eigenen EU-Stack).

🟢 **Praktische Empfehlung:** **Zwei parallel auf echtem deutschen Interview-Audio
testen** — (a) Self-hosted Whisper large-v3 (DSGVO-Held, Streaming-Latenz messen) und
(b) Gladia (managed EU-native, de-DE-WER messen). Falls Whisper-Streaming zu langsam UND
ein managed Prozessor akzeptabel: Tie-Break Gladia vs. Azure = „EU-gebauter Anbieter" vs.
„Daten physisch in DE". **K.O. für strikten Pitch: AssemblyAI** (US-Mutter + kein
Self-Host + Irland-Residency = schwächste auf allen drei Achsen gleichzeitig).

⚠️ **Wichtigstes unverifiziertes Faktum:** **deutsches WER auf findrs ECHTEM
Interview-Audio** (Mikro-Qualität, evtl. Dialekt/Akzent, evtl. Nebengeräusch) — **alle**
öffentlichen de-DE-Zahlen sind vendor-biased (Deepgram/Gladia) oder abwesend
(AssemblyAI/Gladia). Da Deutsch essenziell ist, ist das die kritischste Vorab-Messung.

### 3.3 Text-to-Speech (natürliche deutsche Stimme)

> Nuance: Die **Agent-Stimme ist synthetisch → kein personenbezogenes Datum**. Trotzdem
> verarbeitet der Dienst den Gesprächs-Text → AVV gilt. „Natürlich genug + 100 % lokal"
> ist hier oft die **stärkere Gesamtaussage** als „maximal natürlich + US-Cloud".

| Anbieter | EU-Hosting | Self-Host | AVV/Schrems-II | de-DE-Natürlichkeit | First-Byte-Latenz | ~Kosten/Min |
|---|---|---|---|---|---|---|
| **Self-Host Piper + Thorsten-Voice** | **Ja, 100 %** lokal | **JA — der Trumpf** (MIT-nah; CPU reicht) | **Kein AVV nötig** (kein Prozessor); keine US-Mutter | „Gut für Self-Host", unter Cloud-Premium (synthetischer); Thorsten = beste freie de-DE | Schnell, lokal, kein Netz-Hop | **~$0** (nur Compute) |
| **Cartesia (Sonic 3.5)** | Partial/„zu verifizieren" (EU-Residency nur Drittquelle, **nicht** in Cartesias eigener Doku belegt) | **JA** (VPC/on-prem/on-device — **einzige kommerzielle Self-Host-Option**) | DPA, SOC2, ZDR optional; **US-Mutter** (Cloud-Pfad Schrems-II) | **„zu verifizieren"** (Deutsch fehlt in Homepage-Beispielen) | **~75–90 ms** (Latenz-König) | ~$0.02–0.03/Min |
| **Azure Neural TTS** (West Europe / DE) | **Ja — klarst dokumentierte EU-Residency** (+ Container on-prem) | Partial (Speech-Container) | MS-DPA + EU Data Boundary; US-Mutter | Solide-bis-gut (Katja/Florian/Seraphina + Neural-HD); unter ElevenLabs | Sehr gut für Cloud (niedrigste de-DE-Phonebot-Latenz lt. 2025-Benchmark) | ~$0.02–0.03/Min |
| **ElevenLabs** (Flash/Turbo v2.5 für Realtime) | Partial — EU-Residency **nur Enterprise** und steuert **nur Storage**; Processing kann außerhalb (ohne ZDR+API) | **NEIN** | DPA/SCCs, DPF; **US-Mutter** | **Beste Natürlichkeit** am Markt — aber Realtime-Modus (Flash/Turbo) **weniger** expressiv als v3 (v3 nicht realtime) | ~75 ms-Klasse (Flash) | ~$0.05–0.12/Min (Schätzung) |
| **Play.ht / PlayAI** | **n/a — PRODUKT TOT** (Meta-Übernahme; API offline 07/2025, Abschaltung 31.12.2025) | — | jetzt Meta/US | gegenstandslos | — | — |
| **Coqui XTTS-v2** | Ja (lokal) | Ja technisch | **Lizenz-K.O.: CPML = nur nicht-kommerziell**, kommerzielle Lizenz nicht mehr erwerbbar (Coqui abgewickelt) | besser als Piper bei Prosodie | GPU-abhängig | ~$0 (aber Lizenz blockiert) |

**Empfehlung TTS (Zwei-Stufen):** **(1) DSGVO-Default = Self-Host Piper + Thorsten-Voice**
in eigener EU-Infra — kein Anbieter, kein AVV, kein Schrems-II, ~0 Kosten, schnell genug,
„gut genug", **unangreifbar im Pitch**. **(2) Premium-Upsell-Stimme**, falls Natürlichkeit
nachweislich verkauft: **Cartesia On-Prem/VPC** (einzige kommerzielle Self-Host-Option,
beste Latenz) **oder Azure Neural TTS (West Europe/DE)** (klarst dokumentierte EU-
Residency, via Container sogar on-prem). **ElevenLabs** nur als optionale Premium-Stimme
für Kunden **ohne** strikte DSGVO-Anforderung — und selbst dann nur via Enterprise-EU-
Residency + Zero-Retention + API + DPA (sonst Storage≠Processing-Falle); **taugt NICHT**
als Beleg für „in DE/EU gebaut".

**K.O. für strikten Pitch:** Play.ht (tot + Meta/US), Coqui XTTS (Lizenz), ElevenLabs
Standard/Non-Enterprise (US-Mutter, Cloud-only, Storage≠Processing).

### 3.4 Gesamt-Stack-Empfehlung (DSGVO-nativ, strikte Lesart)

| Schicht | DSGVO-Held (Self-Host) | Managed-EU-Fallback (Residency) | K.O. |
|---|---|---|---|
| **Transport** | **LiveKit self-hosted** (Turn-Taking inkl.!) | LiveKit Cloud EU / Daily+Pipecat (Frankfurt) | Vapi |
| **STT** | **Whisper large-v3** (oder Deepgram-on-prem für Latenz) | Gladia (EU) / Azure germanywestcentral | AssemblyAI (für strikt) |
| **TTS** | **Piper + Thorsten-Voice** | Cartesia-On-Prem / Azure Neural (DE) | Play.ht, Coqui, ElevenLabs-Standard |
| **LLM (Agent-Gehirn)** | Bereits Anthropic (Opus/Sonnet) — **bestehende Kosten/AVV**, separat zu bewerten | — | — |

🟢 **Der Witz:** Mit **LiveKit + Whisper + Piper, alle in eigener Frankfurt-Infra**, gibt
es **keinen einzigen externen Prozessor im Audio-Pfad**. Das ist die einzige Konstellation,
in der „DSGVO-nativ, in DE gebaut" bei **Audio echter Menschen** keine Marketing-Behauptung,
sondern eine technische Tatsache ist. Jeder managed Baustein (egal wie EU-gepinnt) macht
daraus „Residency mit US-Konzern + SCCs" — verteidigbar, aber angreifbar.

⚠️ **Aber Self-Host = Ops + GPU.** Whisper-Streaming-Latenz und Piper-Natürlichkeit sind
die zwei „zu verifizieren"-Risiken, die den Self-Host-Pfad real machen oder nicht.

---

## 4. Die schweren Teile — ehrlich benannt

### 4.1 Latenz-Budget — und die Forced-Tool-Use-Kollision (das härteste Teil)

**Ziel:** die ganze Schleife unter ~1 Sek, sonst wirkt der Agent träge. Wo geht Zeit
verloren?

| Term | Realistisch | Anmerkung |
|---|---|---|
| WebRTC-RTT (EU/Frankfurt) | ~20–50 ms je Richtung | unkritisch bei In-EU |
| End-of-Turn-Detection (VAD/semantisch) | ~einige 100 ms | von LiveKit/Pipecat; verbessert Natürlichkeit |
| STT (final/endpoint) | ~200–300 ms (Gladia <103 ms) **ODER ~3,3 s naiv-Whisper** | ⚠️ Whisper-Streaming ist der Risiko-Term |
| **Agent-LLM (findr-Gehirn)** | **ganzes `{done,message}`-Objekt**, nicht gestreamt | ⚠️ **der dominante + variabelste Term** |
| TTS (First-Byte) | ~75–150 ms (Cartesia/ElevenLabs Flash) / lokal Piper schnell | unkritisch |

⚠️ **Die Kern-Kollision (im Code belegt, nicht spekuliert):** `callClaudeStructured` nutzt
`tool_choice: {type:"tool"}` **ohne** `stream` (`structured.ts:181-182`). Forced-Tool-Use
liefert das **vollständige `{done,message}`-Objekt erst, wenn es fertig ist**. Damit
**entfällt der Standard-Trick** jeder Sub-1-s-Voice-Pipeline (Pipecat/LiveKit Agents/Vapi):
LLM-Tokens **streamend** in eine Streaming-TTS geben, damit der erste Satz schon
gesprochen wird, während das Modell weiterschreibt. Bei findr kann die TTS **erst nach dem
ganzen Objekt** starten.

**Ehrliche Einordnung (eine Workflow-Recherche hat das leicht überzeichnet — hier die
nüchterne Version):**

- Die Agent-Nachrichten sind **kurz** (Prompt: „ONE short message at a time", `maxTokens
  1024`). Ein **kurzes** Objekt mit **Sonnet/Haiku** (via `VOICE_MODEL`) ist ~mehrere
  hundert ms bis ~1–2 s — **nicht** die „40–60 s", die der Worst-Case-Timeout-Kommentar
  (`interviewer.ts:250`) nennt (das ist das Budget, nicht die Norm).
- Mit **Opus** (heutiger Default) ist es spürbar länger und variabler → für Voice eher
  **Modell-Swap** auf Sonnet/Haiku (geht ohne Codeänderung) — **aber das ändert das
  Verhalten → Re-Eval nötig** (§4.4).

**Drei Wege aus der Kollision (mit ehrlichem Preis):**

1. **Akzeptieren + maskieren:** kurzes Modell + **Backchannel/Filler-Audio** („Mhm,
   verstehe…") während STT→LLM→TTS. Standard in Voice-Agents. **Billig, aber Decke bei
   ~1–1,5 s wahrgenommen.** Reicht oft, aber nicht „snappy".
2. **Modell-Swap** (Opus→Sonnet/Haiku) für die gesprochene Runde. **Kleiner Eingriff
   (Env), aber Re-Eval nötig** — die Evals sind auf Opus/Text.
3. **Streaming-Redesign:** `done` vom gesprochenen `message` **entkoppeln** — `message`
   als **plain-text-Stream** (kein Forced-Tool) generieren und `done` separat/leicht-
   gewichtig bestimmen. **Echtes sub-1s, aber:** weicht vom eval'ten Pfad ab, eigener
   Prompt, eigene Robustheit (Forced-Tool schützt heute vor Malformed JSON), und **muss
   neu eval'd werden**. **Das ist die eigentliche Arbeit, kein Footnote.**

🟢 **Fazit Latenz:** Sub-1s ist für Transport+STT+TTS erreichbar. Der **findr-Agent-Turn**
ist der Term, der das Budget bedroht. Das Gehirn ist **wiederverwendbar** — aber „truly
snappy" kostet entweder Filler-UX (Weg 1) oder eine **Streaming-Variante + Re-Eval**
(Weg 3). **Nicht gratis.**

### 4.2 Turn-Taking / Barge-in / Voice-Activity-Detection — wer löst das?

🟢 **Gute Nachricht: nicht selbst bauen.** Bei **LiveKit Agents** (Silero VAD + lokales
semantisches End-of-Turn-Modell + adaptives Barge-in, das ~51 % False-Positive-VAD-
Unterbrechungen abweist) und **Pipecat** (Silero + Smart Turn v3) ist das **out-of-box**
und **self-hostbar**. Das war historisch das härteste Echtzeit-UX-Teil — es ist im
empfohlenen Transport-Layer gelöst. **Bei Twilio (rohes Transport) müsste man es selbst
bauen → ein weiterer Grund gegen Twilio.**

⚠️ **Berührung mit dem Agenten:** Barge-in heißt, der Mensch unterbricht die TTS. Der
Transport liefert dann eine (evtl. abgeschnittene) Nutzer-Äußerung. Da das Gehirn pro
Runde **eine** Nutzer- + **eine** Agent-Nachricht erwartet (klare turn-basierte Struktur),
mappt das sauber — der Agent bekommt einfach die (gekürzte) Runde. Kein Konflikt. **Aber:**
wird die TTS mitten im Satz gestoppt, ist die **persistierte** Agent-Nachricht länger als
das Gehörte → kleine Transkript-Treue-Frage (was steht im `conversation`-JSONB? das
Gesagte oder das Gesprochene?). Lösbar (das tatsächlich gesprochene Präfix speichern),
aber **neu zu entscheiden**.

### 4.3 Sprach-Stack-Bruch (TS-Gehirn ↔ Python-Voice-Frameworks)

⚠️ Das Gehirn (`nextResearchMessage`) ist **TypeScript + `server-only`**. Die reifsten
Voice-Agent-Frameworks (Pipecat, LiveKit Agents) sind **Python-first**. Drei Optionen:

- **LiveKit Agents TS-SDK** (v1.2.0+): Voice-Prozess in TS → Gehirn **in-process**
  importierbar. **Sauberste Wiederverwendung**, aber TS-SDK jünger/weniger Beispiele als
  Python.
- **Python-Voice-Prozess ruft eine dünne findr-HTTP-Route** pro Runde (die
  `nextResearchMessage` kapselt). Entkoppelt, aber +1 Netz-Hop pro Turn (Latenz §4.1).
- **Pipecat (Python)** + HTTP-Bridge. Reifste Turn-Taking-Bibliothek, aber Bridge nötig.

🔶 **ANNAHME:** Für maximale Reuse + minimale Latenz **LiveKit Agents TS-SDK** — zu
verifizieren, ob das TS-SDK Feature-Parität (Turn-Detector, Barge-in) zum Python-SDK hat.

### 4.4 Re-Eval — der unsichtbare Pflichtposten

⚠️ Der heutige Agent ist **auf den Text-Pfad eval'd** (Memory: research-agent evals,
Opus/Sonnet). Jede Echtzeit-Anpassung — **Modell-Swap** (Sonnet/Haiku) **oder** Streaming-
Redesign **oder** kürzere Antworten für Sprache — **ändert das Verhalten** und braucht
einen **neuen Eval-Lauf** (Anker-Treue, Saturation/Stop-Verhalten, „never lead the
witness", DACH-Deutsch). Das ist Arbeit, die im „nur eine Hülle"-Narrativ leicht
verschwindet. **Realistisch einplanen.**

### 4.5 Video — bewusst als spätere, separate Stufe (NICHT mit Voice vermischen)

**Video (Visual Intelligence à la Outset: Gesicht/Affekt sehen, Klickpfade/Screenshare)
ist eine NOCH größere Stufe** und gehört **nicht** in den Voice-Plan:

- **Recht eskaliert:** Video = **biometrienahe**, noch sensiblere Daten; Einwilligung,
  Speicherung, Löschung deutlich schwerer; Kamera-Consent zusätzlich.
- **Kosten eskalieren:** Video-Transport + -Speicherung + visuelle Modelle (Affekt/
  Attention) sind ein Vielfaches von Audio.
- **Produktfrage offen:** *Was* macht findr mit dem visuellen Signal? Affekt-Scoring?
  Usability-Klickpfad? Das ist eine **eigene Produktentscheidung**, kein Transport-Add-on.
- **Architektur:** LiveKit/Daily transportieren Video bereits (gleiche SFU) — der Transport
  ist **nicht** das Problem. Das Problem ist die **visuelle Intelligenz-Schicht** dahinter.

🔶 Video = **Phase V3+**, eigener Plan, erst nach erfolgreichem Voice **und** klarer
Antwort auf „welches visuelle Signal liefert nachweisbaren Wert?".

---

## 5. DSGVO / Recht (eigener Abschnitt)

> **Allgemeine Information, keine Rechtsberatung.** Ein DACH-Datenschutzanwalt muss VOR
> jedem Live-Gang prüfen. Hier nur die Punkte benennen.

- **Einwilligung (Audio-/Video-Aufnahme!):** Aufnahme/Verarbeitung der Stimme echter
  Teilnehmer braucht **vorab, informiert, aktiv, dokumentiert** (DSGVO Art. 6(1)(a);
  für Audio trägt berechtigtes Interesse i.d.R. **nicht**). §201 StGB (DE,
  nicht-öffentliches Wort), AT (DSG+StGB), CH (revFADP + StGB All-Party-Consent). Bei
  besonderen Kategorien/Profiling ggf. **Art. 9**. → **Consent-Banner + echter
  Ablehnungs-Pfad (stoppt Aufnahme) + Consent-Log** sind **nicht verhandelbar**.
- **Aufnahme ja/nein?** ⚠️ **Designentscheidung:** Muss das **Audio überhaupt
  gespeichert** werden, oder reicht das **Transkript**? Datenminimierung spricht stark für
  „**nur Transkript, Audio sofort verwerfen**" (kein `recording_url` befüllen) — das
  vereinfacht die Rechtskette massiv und passt zum DSGVO-Pitch. **Empfehlung: kein
  Roh-Audio speichern, außer es gibt einen harten Grund.**
- **Speicherung / Löschung:** Aufbewahrungsfristen, Lösch-Workflow, Teilnehmer-Rechte
  (Auskunft/Löschung). Transkript-Anonymisierung (der Research-Prompt verspricht den
  Teilnehmern bereits Vertraulichkeit/Anonymisierung — das muss **technisch** auch gelten).
- **AVV-Kette über ALLE Anbieter:** jeder Prozessor im Pfad (Transport, STT, TTS, LLM)
  braucht AVV + dokumentierte Transfer-Grundlage. 🟢 **Self-Host minimiert diese Kette
  auf ~null** (nur noch das LLM = Anthropic, das findr schon nutzt). Jeder managed Baustein
  fügt einen AVV + Schrems-II-Posten hinzu.
- **EU-Hosting:** für den „in DE/EU gebaut"-Anspruch bei sensiblen Daten = **harte
  Anforderung**, nicht nice-to-have. Managed-US-Anbieter mit EU-Region sind
  „Residency", nicht „Souveränität".
- **Beschäftigten-/Betriebsrat-Kontext** (falls Interviewte Mitarbeiter sind): §26 BDSG /
  Betriebsrat = Rechtsberatungs-Territorium.

**Was ein DACH-Anwalt prüfen muss (benennen, nicht beraten):** Consent-UX + -Text;
ob Transkript-only die Rechtslast genug senkt; AVV-Musterkette für den gewählten Stack;
Löschkonzept; Sonderkategorien (Audio-Inhalt kann Gesundheits-/Gewerkschafts-/… Infos
enthalten); bei Video zusätzlich Biometrie/Art. 9.

---

## 6. Phasen & Aufwand (kleinster sinnvoller Schritt zuerst, Video bewusst spät)

> Verifikation: **`tsc` + `next build`** (NIE `pnpm dev`), plus die je Phase genannten
> Funktionstests. Migrationen additiv. Aufwände = grobe Eng-Spannen (**ein** Entwickler),
> **ohne** Konto-/Infra-/Rechts-Vorlaufzeit. Kosten = grobe laufende €/Interview-Minute,
> **alle „zu verifizieren"**.

### V0 — Interner Voice-Spike (kein Kunde, kein echter Teilnehmer) — De-Risking
**Ziel:** die **Gesamtkette** + die **zwei „zu verifizieren"-Risiken** (Latenz, deutsche
Stimm-/STT-Qualität) **beweisen**, mit minimalem Stack.
**Bauen:** LiveKit (Cloud-EU **oder** lokal) + **einen** STT (Gladia oder Whisper) +
**einen** TTS (Piper oder Azure) → LiveKit-Agents-Loop ruft `nextResearchMessage`
(Sonnet via `VOICE_MODEL`) → ein **internes** Voice-Interview end-to-end in die
**bestehende** Synthese. Dünne Finish-Route. Consent nur intern/dokumentiert (eigene
Stimmen).
**Verifizieren:** wahrgenommene Turn-Latenz messen (Filler ja/nein); deutsches Audio
(STT-WER) + Stimm-Akzeptanz subjektiv; Transkript landet korrekt in `product_discovery_insights`.
**Aufwand:** **~2–4 Wochen** (Glue: Media-Konto, Agent-Prozess, STT/TTS-Wiring,
Turn-Bridge, Finish-Route, minimaler Consent). **Kosten:** managed ~**$0.05–0.20/Min**
(≈ $1–3 pro 15-Min-Interview, zu verifizieren) bzw. self-host ~Infra-only + LLM (= heutige
Text-Kosten).
**Warum zuerst:** beweist das **riskanteste** (Latenz-Kollision §4.1) mit **null**
Teilnehmer-/Rechts-Arbeit.

### V1 — DSGVO-nativer Pilot (echte, begrenzte Teilnehmer)
**Bauen:** auf den **Self-Host-Stack** schwenken wo es zählt (LiveKit self-host **oder**
Cloud-EU, **Whisper/Deepgram-on-prem** STT, **Piper/Thorsten** TTS); **Consent-Flow**
(Banner + Decline-Stop + Log); **Voice-Screening = Form-Vorab-Gate** (kein verbales
Screening); **Re-Eval** der Voice-Agent-Variante; `mode:"voice"` + `transcript_source`
sauber stempeln; Entscheidung **Transkript-only vs. Audio-Speicherung**.
**Braucht VORHER:** **DACH-Anwalt** (Consent + AVV-Kette), **Self-Host-Ops** (SFU + GPU).
**Verifizieren:** echter (Test-)Teilnehmer führt ein DSGVO-sauberes Voice-Interview →
Synthese; Latenz/Qualität bestätigt; Anwalt-Abnahme.
**Aufwand:** **~4–8 Wochen** Eng + **Rechts-/Infra-Vorlaufzeit** (parallel, kann länger
dauern als der Code).
**Kosten:** self-host ~Infra (GPU/SFU fix) + LLM; marginal/Min ~Cents.

### V2 — Produkt-Härtung
**Bauen:** Skalierung (Multi-Concurrent), Failover-Stimme, Barge-in-Tuning, Kosten-/
Monitoring-Kontrollen, Lösch-Workflow, Abandon-/Reconnect-Handling, Voice-spezifische
Session-States (z.B. `media_negotiating`/`media_failed` als additive Spalte).
**Aufwand:** **~3–6 Wochen** + laufender Betrieb.

### V3+ — VIDEO / Visual Intelligence (separate Stufe, eigener Plan)
Bewusst **deferred** (§4.5). **Nicht** in diesem Plan dimensioniert — eigene Architektur-,
Recht- (Art. 9/Biometrie) und Produkt-Analyse („welches visuelle Signal liefert Wert?").

**Aufwands-Summe Voice (V0–V2):** grob **~9–18 Wochen** reine Eng + Rechts-/Infra-/Ops-
Vorlaufzeit, die **separat** und teils **länger** läuft (Anwalt, GPU-Beschaffung,
Self-Host-Aufbau). **Das ist kein Wochenend-Projekt** — aber dank des gut vorbereiteten
Codes auch **kein Greenfield**: das Gehirn + Synthese + Studien + Screening stehen.

---

## 7. Ehrliche Empfehlung — jetzt oder später?

**Jetzt noch nicht als Produkt. Später, wie der Nutzer selbst sagte — der Plan bestätigt
das.** Begründung, nüchtern:

1. **Es ist ein substanzielles neues Subsystem, kein Add-on.** „Nur eine Hülle" stimmt für
   das *Gehirn*, aber die Hülle = Self-Host-Media-Infra + STT + TTS + Turn-Taking +
   Consent/Recht + **Re-Eval** + Sprach-Stack-Bruch + die **Latenz-Kollision** (§4.1).
   Das braucht **Ops-Kapazität** (SFU + GPU betreiben/skalieren), **Rechts-Kapazität**
   (DACH-Anwalt für Audio-Einwilligung), und **echte laufende Kosten**.
2. **Die Voraussetzungen stehen noch nicht** (siehe unten). Ein Voice-Interview ohne
   **Teilnehmer** ist sinnlos; ein Voice-Interview, dessen **Text-Variante** sich noch
   nicht am Markt bewährt hat, optimiert das Falsche zuerst.
3. **Aber der Code ist ungewöhnlich gut vorbereitet** (Datenmodell antizipiert Voice,
   Gehirn + Synthese reuse ist real). Das senkt die Schwelle für einen **kleinen,
   internen V0-Spike** deutlich.

**Konkrete Empfehlung:**

- **JETZT:** **nicht bauen** als Produkt. Optional ein **interner V0-Spike** (§6 V0)
  **als Lern-Spike** (Latenz + deutsche Qualität messen) — **wenn** gerade Kapazität da
  ist und man die Echtzeit-Machbarkeit für die Roadmap quantifizieren will. **Nicht
  launchen.**
- **VORHER stehen muss** (Reihenfolge ist die Empfehlung):
  1. **Teilnehmer-Quelle entscheiden** (Prolific/Panel-Plan). Ohne Interviewte kein
     Interview — egal ob Text oder Voice. (Vgl. Memory `project_market-research-separation-plan`,
     „47/200"-Sample.)
  2. **Text-Research-Interview am Markt beweisen.** Zieht das AI-Interview-Format in DACH
     überhaupt? Voice ist eine **Konversions-/Differenzierungs**-Wette **auf** ein
     funktionierendes Format, kein Ersatz dafür. (Die MR-/Synthetic-Participants-Linie ist
     noch in Arbeit — erst die Basis.)
  3. **Ops- & Rechts-Kapazität.** Self-Host-Infra (das ist der DSGVO-Trumpf — managed
     entwertet den Pitch) **und** DACH-Anwalt für Audio-Consent. Ohne beides ist der
     „DSGVO-native Voice"-Pitch nicht einlösbar.
- **DANN, wenn Geld/Kapazität da:** V0 (intern) → V1 (DSGVO-Pilot) mit dem **Self-Host-
  Stack** (LiveKit + Whisper + Piper). Genau die Beschaffung, die der Nutzer schon nannte
  (Anwalt, Azure/EU-Infra, ggf. GPU) ist hier real — **das bestätigt „später, wenn Geld
  da ist".**

🟢 **Einzeiler:** Das Gehirn, die Synthese, die Studien-Struktur und das Datenmodell sind
**bereit**. Was fehlt, ist nicht im Code, sondern **drumherum**: Teilnehmer, ein
bewährtes Text-Format, Ops + Anwalt + Budget für einen **self-gehosteten** Echtzeit-Stack.
Voice ist eine **gute, glaubwürdige Wette für DACH** — aber die nächste sinnvolle
Investition ist nicht der Voice-Code, sondern die drei Voraussetzungen. Wenn die stehen,
ist V0 erstaunlich nah dran.

---

## Anhang A — Verifizierte Code-Referenzen (selbst gelesen)

| Faktum | Datei:Zeile |
|---|---|
| Voice-Ingest = nur Text-Transkript, kein Audio | `src/lib/schemas/voice-ingest.ts` (`transcriptText`), `supabase/migrations/20260627000000_voice_ingest.sql` |
| Gehirn-Naht (reine Funktion) | `src/lib/voice-agent/interviewer.ts:607` (`nextResearchMessage`), Schema `:82` (`{done,message}`) |
| Default-Modell Opus, via `VOICE_MODEL` swappbar | `interviewer.ts:29`, `src/lib/anthropic/client.ts:13` (`opus="claude-opus-4-7"`) |
| Forced-Tool-Use, **kein Streaming** | `src/lib/anthropic/structured.ts:181-182` (`tool_choice:{type:"tool"}`, `maxTokens:1024`) |
| Turn-Mechanik + Synthese-Anschluss | `src/lib/voice-agent/session-service.ts:660` (`advanceInterview`), `:685` (Gehirn-Call), `:717` (`persistResearchTranscriptAndDiscovery`) |
| Datenmodell antizipiert Voice/Video | `session-service.ts:259-261, 336` (`mode`, `transcript_source`); `research_invites.mode_preference` |
| Synthese nimmt `transcript: string` (kanal-agnostisch) | `src/lib/research/transcript-service.ts:47, 96` |
| Screening-Gate deterministisch, vor Session | `session-service.ts:501` (`resolvePublicEntry`), `evaluateScreening` |
| Heutiger Transport (Request/Response, 1 Opus/POST) | `src/app/api/interview/[token]/route.ts:81` |
| Research-Cap | `session-service.ts:64` (`MAX_RESEARCH_TOTAL_TURNS=16`) |

## Anhang B — Wichtigste „zu verifizieren"-Punkte (nicht raten — messen/klären)

1. **Deutsches STT-WER auf findrs ECHTEM Interview-Audio** (Whisper large-v3 vs. Gladia
   vs. Azure de-DE vs. Deepgram) — alle öffentlichen de-DE-Zahlen sind vendor-biased oder
   abwesend. **Die kritischste Vorab-Messung.**
2. **Self-hosted-Whisper-Realtime-Latenz** am Ziel-Chunk-Size (~3,3 s naiv vs. ~200 ms
   purpose-built) — entscheidet Whisper-als-Live-Engine vs. Hybrid.
3. **Wahrgenommene Turn-Latenz** der Forced-Tool-Use-Runde mit Sonnet/Haiku + Filler
   (§4.1) — entscheidet, ob Modell-Swap reicht oder Streaming-Redesign nötig ist.
4. **LiveKit-Turn-Detector-Modell-Lizenz** für self-hosted-commercial (Framework
   Apache-2.0; Gewichte separat). Analog Daily Smart Turn v3.
5. **LiveKit-Agents-TS-SDK-Parität** (Turn-Detector/Barge-in) vs. Python — entscheidet
   den Sprach-Stack (§4.3).
6. **Cartesia EU-Residency** aus **eigener** Doku/Vertrag (Drittquelle reicht nicht) +
   **de-DE-Stimmqualität** (Deutsch fehlt in Beispielen).
7. **ElevenLabs:** schriftlich, ob EU-Residency das **Processing** (nicht nur Storage) in
   EU hält.
8. **Azure Speech-Container:** unterstützen sie **de-DE-Realtime-Streaming** (würde Azure
   zu DE-resident **und** in-house aufwerten)?
9. **Aktuelle €/Min** für jeden Shortlist-Anbieter (alle Preise hier = Schätzung).
10. **Twilio Programmable Video** committed-Status (EOL-Saga) — falls überhaupt erwogen.
11. **Recht:** ob „US-Mutter-Prozessor in EU-Region + SCCs/EU Data Boundary" für findrs
    Risiko-Appetit bei **sensiblem Audio** akzeptabel ist, oder ob nur **kein externer
    Prozessor** (Self-Host) den Marketing-Claim trägt.
