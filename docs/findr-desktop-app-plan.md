# Findr Voice — Desktop-App: Architektur- & Umsetzungsplan

> **Status:** Architektur- & Umsetzungsplan (alle 8 Punkte unten). **Etappe 1**
> (Backend-Ingest + Router + Posteingang) wird auf Branch `feat/voice-ingest-backend`
> umgesetzt; Etappe 2–5 noch nicht. Geschrieben ehrlich und abwägend; **🔶 ANNAHME**
> markiert Punkte, die André + Claude gemeinsam entscheiden, **⚠️ RISIKO** das
> Teure/Schwere/Unsichere.

---

## 0. Kontext — warum dieses Projekt

Findr ist heute eine Conversation-Intelligence-Plattform mit vier **fertigen KI-Engines**
(Sales-Risk, CS-Health, Product-Discovery-Synthese, Cross-Study-Agent). Transkripte werden
**manuell hochgeladen** (`POST /api/calls/manual` → `calls`-Tabelle) und dann analysiert. Der
teuerste, fehleranfälligste Schritt für den Nutzer ist genau dieser manuelle Upload: er muss
selbst aufzeichnen, transkribieren, einordnen, einfügen.

**Ziel:** Eine **Findr-Voice-Desktop-App** (Granola-Stil), die B2B-Calls automatisch erkennt,
**ohne Bot** sprecher-markiert aufnimmt/transkribiert und das fertige Transkript samt Zuordnung
an Findr schickt — wo der **bestehende** Engine-Router es einteilt: Bestandskunde → Health,
Sales → Risk, Discovery → Synthese.

**Leitprinzip (aus André-Feedback):** additiv bauen, bestehende kanonische Pfade
wiederverwenden, keine Parallel-Datenpfade. Die KI-Engines und der Ingest-Pfad existieren —
neu ist im Kern **eine austauschbare Aufnahme-Schicht, eine token-authentifizierte
Ingest-Route, ein Meeting-Typ-Router, ein Posteingang und die Electron-Hülle.**

---

## 1. Architektur-Überblick — drei Schichten + Datenfluss

```
┌─ SCHICHT 1: DESKTOP-APP (Electron, NEU, separates Repo) ───────────────────────┐
│  • Clerk-Login (OAuth PKCE, einmalig) → Token im OS-Keychain                    │
│  • Vorab-Popup: Meeting-Typ + Ziel (Dropdowns ziehen ECHTE Findr-Daten via API) │
│  • Einwilligungs-/Aufnahme-Banner (DSGVO, §201 StGB)                            │
│  • Status, Verlauf, "spätere Zuordnung"                                         │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ implementiert die interne Schnittstelle ↓
┌─ SCHICHT 2: AUFNAHME-SCHICHT (austauschbares Modul, NEU) ───────────────────────┐
│  RecordingProvider:  "laufendes Meeting rein → sprecher-markiertes Transkript   │
│                       + Metadaten raus"                                          │
│  Start = Recall.ai Desktop-SDK (EU-Region).  Ziel = lokal (Option B).           │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ HTTPS POST (Bearer-Token) ↓
┌─ SCHICHT 3: FINDR-BACKEND (Next.js 16, GRÖSSTENTEILS BESTAND) ──────────────────┐
│  NEU:  POST /api/voice/ingest (Bearer-Auth)                                      │
│        lib/voice/router.ts  (Meeting-Typ → Engine)                               │
│        voice_inbox-Tabelle + Assign-Action (Posteingang)                         │
│        GET-Listen-Endpunkte für Dropdowns                                        │
│  BESTAND (wiederverwendet, NICHT angefasst):                                     │
│        analyzeAccountTranscript() · analyzeDealRiskWithFallback()                │
│        analyzeCallForProductDiscovery() · calls-Tabelle · requireOrgId-Logik     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Was existiert schon (wiederverwendbar)

| Baustein | Datei / Funktion | Rolle für Findr Voice |
|---|---|---|
| Manueller Ingest | `src/app/api/calls/manual/route.ts` → `createManualCall()` in `src/lib/manual-import/service.ts` | **Vorbild** für die Ingest-Route; baut `calls`-Row (deal_id) |
| Org-Auth | `src/lib/auth/org.ts` → `requireOrgIdOrError()` | Clerk-Org → interne `organizations.id`; **Org-Mapping wiederverwenden**, Token-Front-End neu |
| Engine A — Risk | `analyzeDealRiskWithFallback(deal, calls, orgId)`, Route `POST /api/risk` | Router-Ziel "Sales-Call" |
| Engine B — Health | `analyzeAccountTranscript(orgId, accountId, transcript)` in `src/lib/accounts/health-service.ts` | Router-Ziel "Bestandskunde"; **legt Call-Row selbst an** |
| Engine C — Discovery | `analyzeCallForProductDiscovery(callId, {planId})`; `persistResearchTranscriptAndDiscovery()` in `src/lib/research/transcript-service.ts` | Router-Ziel "Discovery/Studie" |
| Router-/Inbox-Muster | `src/lib/bridge/cs-to-research.ts` + `bridge_suggestions`-Tabelle (Migration `20260619000000`) | **Bauplan** für `voice_inbox`: pending-Zeilen + Human-Gate + Dispatch |
| Dropdown-Loader | `getAccounts()`, `getDealsByOrg()`, `listResearchPlans()`, `loadOrgSyntheses()` | Speisen die Popup-Dropdowns |
| Bestehende Listen-Endpunkte | `GET /api/accounts`, `GET /api/search/index` (deals+accounts, schlank) | Direkt für Dropdowns nutzbar |
| Marketing-Seiten | `loadMarketingPage()` in `src/lib/marketing/page-source.ts`, Vorbild `src/app/pricing/page.tsx` | "Findr Voice"-Landingpage |
| Dashboard-Menü | `src/components/dashboard/DashboardSidebar.tsx` + Cmd+K in `src/lib/search/nav-routes.ts` | Menüpunkt + Posteingang-Seite |

### Was neu ist

1. **Electron-App** (separates Repo) — Hülle, Login, Popup, Aufnahme-Anbindung.
2. **`RecordingProvider`-Schnittstelle** (in der App) — die kritische Abstraktion (§3).
3. **`POST /api/voice/ingest`** — Bearer-Token-authentifiziert, nimmt Transkript + Zuordnung.
4. **`lib/voice/router.ts`** — Meeting-Typ → bestehende Engine.
5. **`voice_inbox`-Tabelle + Assign-Action** — Posteingang für "später zuordnen".
6. **GET-Listen-Endpunkte** (`/api/research/plans` etc.) — fehlende Dropdown-Feeds.
7. **Bearer-Auth-Helper** (`requireOrgIdFromBearer()`) — verifiziert Clerk-OAuth-JWT.
8. **Findr-Voice-Marketing-Seite + Menüpunkt + Download/Status-Seite.**

---

## 2. Desktop-App-Stack — Electron (Empfehlung)

**Entscheidung (bestätigt): Electron.** Begründung:

1. **Vendor-SDK-Ausrichtung.** Recall.ai Desktop-SDK ist **Electron-first** —
   `npm i @recallai/desktop-sdk`, offizielles Electron-Sample. Das ist der dokumentierte,
   supportete Pfad; Tauri ist "non-Electron-Integration" mit wenig Anleitung.
2. **System-Audio nahezu schlüsselfertig** in Electron (`electron-audio-loopback` /
   Chromium-Flags) vs. eigener Rust-Code (WASAPI / ScreenCaptureKit) in Tauri.
3. **Null Sprach-Rampe** — André's Stack ist TypeScript/React; Electron ist reines JS/TS.
   Tauris Backend ist Rust, und System-Audio ist genau die native, plattformspezifische
   Arbeit, bei der die Rust-Lernkurve am härtesten zuschlägt.
4. **Preis:** größere Binaries (~80–150 MB) und mehr RAM als Tauri (<10 MB / ~40 MB) —
   für einen Meeting-Recorder akzeptabel, kein footprint-sensibles Tool.

**Tauri nur**, falls Installer-Größe/RAM hartes Produktkriterium würde *und* das Team Rust für
Audio-Capture übernimmt. Für schnellen Beweis mit Vendor-SDK lohnt der Tausch nicht.

### Code-Signing / Notarization / Verteilung / Auto-Update

| Thema | macOS | Windows |
|---|---|---|
| **Signing** | Apple Developer Program **99 $/Jahr**, Developer-ID-Cert, **Hardened Runtime**, Entitlements (`device.audio-input`, Screen-Capture, `cs.allow-jit`), **Notarization** via `notarytool` + Stapling | **Azure Trusted Signing** (~10 $/Mon, Cloud, kein Hardware-Token, sofortige SmartScreen-Reputation) — empfohlen statt OV/EV-Cert |
| **Verteilung** | **Direkt-Download (DMG)**, NICHT App Store | Direkt-Download (NSIS/MSI) |
| **Auto-Update** | `electron-updater` + **Hazel auf Vercel** (zieht GitHub-Releases) | dito |

⚠️ **RISIKO (App Store):** Der Mac App Store sandboxt strikt — die für System-Audio/Screen-Capture
nötigen Entitlements sind dort i.d.R. nicht erlaubt. **Direkt-Download ist Pflicht-Pfad.**
⚠️ **RISIKO (Apple Silicon only):** Recall.ai unterstützt **nur Apple-Silicon-Macs** (keine Intel),
Windows 10+ 64-bit. Intel-Mac-Nutzer fallen für die SDK-Variante raus (relevant erst bei B-Migration).

---

## 3. Aufnahme-Schicht als austauschbares Modul — die kritische Entscheidung

### 3.1 Die interne Schnittstelle (entkoppelt alles andere)

```ts
// In der Desktop-App. Der Rest der App und das gesamte Backend kennen NUR dieses Interface.
interface RecordingProvider {
  onMeetingDetected(cb: (m: DetectedMeeting) => void): Unsubscribe; // Erkennung
  start(meeting: DetectedMeeting): Promise<RecordingHandle>;        // No-Bot-Aufnahme
  stop(handle: RecordingHandle): Promise<RecordingResult>;
}
interface RecordingResult {
  segments: { speaker: string; text: string; tStart: number }[];   // sprecher-getrennt
  transcriptText: string;          // "Sprecher A: …\nSprecher B: …" (Engines parsen Prefixe)
  durationSeconds: number;
  recordedAt: string;              // ISO
  externalMeetingId: string;       // Idempotenz-Schlüssel für die Ingest-Route
  audioProcessedIn: "eu" | "us" | "local"; // für DSGVO-Transparenz mitgeführt
}
```

Diese Grenze ist der ganze Trick: **„laufendes Meeting rein → sprecher-markiertes Transkript
raus".** Dahinter ist die konkrete Lösung austauschbar, **ohne** Popup, Ingest-Route, Router
oder Engines anzufassen. Die Ingest-Payload (`transcriptText` + Zuordnung + `externalMeetingId`)
ist providerneutral.

### 3.2 Drei Optionen — explizite Bewertung

| Kriterium | **A) Recall.ai Desktop-SDK** | **B) Voll-Eigenbau + lokales Whisper** | **C) Capture-SDK + lokale Transkription** |
|---|---|---|---|
| **Aufwand** | **Niedrig** (Tage–Wochen) — npm-Paket, Erkennung+Capture+Transkript fertig | **Hoch** — siehe 3.3 | **Hoch** und zugleich kompromittiert (s.u.) |
| **Sprecher-Trennung** | Sprecher-**markiertes Transkript** ✅ (separate Audio-Spuren NICHT GA für Desktop-SDK) | Eigene Diarization nötig — **das harte Teil** | Recall liefert nur **Mix-Audio** → keine saubere Trennung → doch eigene Diarization |
| **Plattform-Abdeckung** | macOS 13+ (**nur Apple Silicon**), Win10+; Zoom/Teams/Meet automatisch erkannt; Präsenz manuell | Beide OS selbst (CoreAudio-Taps mac 14.4+ / WASAPI), Erkennung selbst | Capture via SDK, Erkennung via SDK |
| **DSGVO / Verarbeitungsort** | Audio in Recall-Infra; **EU/Frankfurt-Region** wählbar; AVV+SCCs+TIA; Zero-Retention möglich → **verteidigbar, nicht voll-nativ** | **Audio verlässt Gerät nie** → cleanste Position, „DSGVO-nativ" | **Trap:** Roh-Audio läuft über Recalls Realtime-Infra (NICHT als rein-lokal verifiziert) → erbt A's Transfer-Last, obwohl Transkription lokal |
| **Laufende Kosten** | **0,50 $/h** Aufnahme (+0,15 $/h Recall-STT, oder eigener STT-Preis); keine Plattform-/Sitzgebühr | ~0 $ Laufkosten, aber hohe Einmalkosten | 0,50 $/h Capture + lokaler STT |
| **Reife / Risiko** | GA-nah, Series-B; Webpack-`externals`-Footgun; Netzabbruch beendet Aufnahme | Capture stabil machbar; **Echtzeit-Diarization offenes Forschungsproblem** | Schlechteste beider Welten mit Recall |

**Quellen:** Recall-Pricing 2026 (recall.ai/blog/new-recall-ai-pricing-for-2026), Regions
(docs.recall.ai/docs/regions), Separate-Audio-FAQ (nicht GA), Mixed-Raw-Audio (16 kHz PCM via
Realtime-Endpoint), DPA (recall.ai/data-processing-agreement).

### 3.3 Was Eigenbau (B) konkret heißt — und wie schwer

- **System-Audio-Capture (mittel, „Breite statt Tiefe", 2–4 Wo):** macOS **CoreAudio
  Process-Taps** (14.4+, Audio-only-Consent, **umgeht** die Screen-Recording-Berechtigung),
  Windows **WASAPI-Loopback**. Zwei native Module + Format-/Geräte-Handling. Mühsam, endlich.
- **Diarization (HART — der Blocker):** Offline-pyannote ~10–13 % DER (Deutsch ~8,3 % auf
  sauberem Audio); **Echtzeit/Online-Diarization ist ein offenes Forschungsproblem** mit
  schlecht quantifizierter Genauigkeitsstrafe.
- **Transkription (gelöst, niedriges Risiko, 1–2 Wo):** **whisper.cpp** (Single-Binary,
  Metal/CUDA), Deutsch exzellent (~2,6 % WER large-v3). Modelle bei First-Run laden (nicht
  in den Installer).

🟢 **Schlüssel-Erkenntnis:** Findr ingestiert das Transkript **NACH dem Call**, nicht live.
Damit reicht **Nach-Call-Diarization (offline, lösbar)** — das 6–12-Monats-Echtzeit-Problem
**entfällt**. Das macht B deutlich realistischer (Wochen–wenige Monate für einen Post-Call-,
Cross-Platform-, sprecher-getrennten Pfad), sobald Capture+Erkennung stehen.

### 3.4 Empfehlung — Start A, Ziel B (Entscheidung bestätigt)

- **STARTEN mit A (Recall.ai, EU/Frankfurt-Region)** — beweist die *Gesamtkette* am
  schnellsten: Erkennung + No-Bot-System-Audio + sprecher-markiertes Transkript sofort,
  Electron-first. Liefert genau das, was die Findr-Engines brauchen (sprecher-prefix-Transkript).
- **MIGRIEREN zu B (Nach-Call-lokal)** für die voll-„DSGVO-native" Position, hinter derselben
  `RecordingProvider`-Schnittstelle — **ohne** Backend/Popup/Router-Umbau.
- **C mit Recall meiden:** Mix-Audio (keine saubere Sprecher-Trennung) **und** Audio über
  US-Realtime-Infra (nicht verifiziert lokal) → kombiniert die Nachteile. C wäre nur mit einem
  *anderen* Capture-SDK sinnvoll, das per-Teilnehmer-Spuren rein lokal liefert — derzeit nicht in Sicht.

🔶 **ANNAHME (gemeinsam):** Recall liefert STT-Provider-Wahl (recallai/assemblyai/deepgram/
speechmatics) — falls schon im MVP ein EU-STT gewünscht ist, hier verdrahten. **Vor B-Commit
mit Recall direkt klären, ob der Roh-Audio-Pfad rein lokal sein kann** (Doku unklar).

---

## 4. Account-Verknüpfung — Clerk OAuth (PKCE) für Desktop

**Clerk unterstützt das offiziell** (Clerk als OIDC-IdP). Empfohlener, dokumentierter Pfad:

1. **OAuth-App in Clerk** anlegen: `public: true` (PKCE, **kein** Client-Secret),
   `redirect_uris: http://127.0.0.1:*/callback` (Loopback), Scopes
   `openid profile email offline_access user:org:read`.
2. **Authorization Code + PKCE** (S256): App startet Einmal-HTTP-Server auf `127.0.0.1:0`,
   öffnet **System-Browser** (nicht eingebettetes Webview) zu `{issuer}/oauth/authorize?…`.
3. Nutzer loggt auf der Clerk-Hosted-Seite ein; **Org-Auswahl direkt auf dem Consent-Screen**.
4. Redirect zum Loopback mit `code` → Tausch an `{issuer}/oauth/token` → `access_token` (1 Tag),
   **`refresh_token` (läuft nie ab → Dauer-Login)**, `id_token`.
5. **`org_id`-Claim** liegt im verifizierten Token → Findr liest Org direkt aus dem JWT.
6. **Token-Speicherung:** Electron **`safeStorage`** (OS-Keychain / Windows DPAPI; `keytar` ist
   deprecated). Refresh-Token sicher ablegen, Access-Token vor Ablauf erneuern, bei Logout löschen.

**Backend-Seite (neu, additiv):** `requireOrgIdFromBearer()` neben `requireOrgIdOrError()` —
verifiziert das Clerk-OAuth-JWT (JWKS, offline), liest `org_id`-Claim, mappt über **dieselbe**
`organizations`-Abfrage wie `requireOrgId()` auf die interne Org-UUID. Nur das Token-Front-End
ist neu; das Org-Mapping wird wiederverwendet.

🔶 **ANNAHME:** Pure Clerk-OAuth-Token reichen (Refresh nie ablaufend) — die „eigenen Findr-
Token minten"-Variante ist damit weitgehend redundant. Falls per-Gerät-widerrufbare, opake Token
gewünscht: **Clerk-API-Keys** (user/org-scoped) statt Eigenbau.
⚠️ **RISIKO:** Refresh-Lifetime im Clerk-Dashboard verifizieren (Primärdoku „nie", eine
Sekundärquelle nannte 3 Tage). Loopback-Wildcard-Port gegen die Live-Instanz testen.

---

## 5. Findr-Backend-Erweiterung

Alles **org-scoped wie bestehende Routes**, additiv, kanonische Pfade.

### 5.1 Ingest-Route — `POST /api/voice/ingest` (Bearer-Auth)

Spiegelt `POST /api/calls/manual` (Auth → Zod-`safeParse` → Service → JSON), aber:
- Auth via `requireOrgIdFromBearer()` statt Session-Cookie.
- Body-Schema (Zod) mirror+erweitert von `ManualCallSchema`: `transcriptText`, optional
  `segments`, `recordedAt`, `durationSeconds`, `externalMeetingId`, **`assignment`**
  (`{ meetingType, targetType, targetId } | { mode: "inbox" }`), `source: "findr_voice"`.
- **Idempotenz:** Dedup auf `(org_id, external_meeting_id)` — Webhook-Retry erzeugt kein Duplikat.
- Ruft `routeIngestedCall(orgId, payload)` (§5.2). Antwort `{ success, callId? , inboxId? }`.

### 5.2 Meeting-Typ-Router — `lib/voice/router.ts`

`routeIngestedCall()` dispatcht anhand `assignment` an die **bestehenden** Engine-Eintritte —
keine neue KI-Logik:

| Zuordnung | Aktion (wiederverwendet) |
|---|---|
| Bestandskunde + `accountId` | `analyzeAccountTranscript(orgId, accountId, transcriptText)` — legt Call-Row (account_id) an + `analyzeHealth` |
| Sales-Call + `dealId` | Call-Row (deal_id) wie `buildManualCallInsert` → dann `analyzeDealRiskWithFallback(deal, calls, orgId)` |
| Discovery + `planId` | `persistResearchTranscriptAndDiscovery()` bzw. `analyzeCallForProductDiscovery(callId, {planId})` |
| `mode: "inbox"` | **kein** Routing → Zeile in `voice_inbox` (§5.3) |

Speaker-Prefix-Text geht in `calls.transcript` — die Engines parsen Sprecher-Prefixe bereits
(Hinweis in `buildManualCallInsert`). **Keine Schema-Änderung an `calls` zwingend nötig**;
additiv ggf. `source='findr_voice'` + `external_meeting_id` (Migration, s.u.).

### 5.3 Posteingang — `voice_inbox` (spiegelt `bridge_suggestions`)

Exakt das Muster aus `cs-to-research.ts`: pending-Zeilen + **Human-Gate**.
- Tabelle: `org_id`, `status` (`pending`/`assigned`/`dismissed`), `payload` (Transkript+Metadaten),
  `external_meeting_id`, `created_at`. (Inline-augmentierter Supabase-Typ wie bei
  `bridge_suggestions`, bis `database.ts` regeneriert ist.)
- `listVoiceInbox(orgId)` / `assignVoiceInboxItem(orgId, id, assignment)` →
  ruft denselben `routeIngestedCall()` + setzt `status='assigned'`; `dismissVoiceInboxItem()`.
- UI: Posteingang-Seite unter `/dashboard/voice` mit Dropdowns (gleiche Loader wie Popup).

### 5.4 Dropdown-Feed-Endpunkte

- **Vorhanden, direkt nutzbar:** `GET /api/accounts`, `GET /api/search/index` (deals+accounts, schlank).
- **Neu (GET, dünn):** `GET /api/research/plans` (`listResearchPlans`), optional
  `GET /api/research/syntheses` (`loadOrgSyntheses`). Triviales Spiegeln des Auth-Musters.

### 5.5 Findr-Voice-Seite + Menü

- **Marketing:** `src/marketing/findr-voice.html` (self-contained `<style>/<body>/<script>`) +
  `src/app/voice/page.tsx` nach Vorbild `pricing/page.tsx` (`loadMarketingPage`). Download-Links
  = einfache `<a>`. ⚠️ Loader-Footguns beachten (single style/script; JS-String-Literale werden
  gerendert) — vgl. Memory `project_landing-update`.
- **Dashboard:** Menüpunkt in `DashboardSidebar.tsx` (`/dashboard/voice`), Cmd+K in
  `nav-routes.ts`, neuer i18n-Namespace `findrVoice` in `messages/{de,en}.json` (+ ggf. Layout-
  Allowlist je nach Muster). Download/Status ggf. als Settings-/Integrations-Unterseite
  (Vorbild Slack-Integration).

---

## 6. DSGVO / Compliance

**Allgemeine Information, keine Rechtsberatung — DACH-Datenschutzanwalt vor Veröffentlichung
einer Compliance-Aussage oder vor dem Consent-Flow prüfen lassen.**

### 6.1 Einwilligung (DACH)

- **§201 StGB (DE):** Aufnahme des **nicht öffentlich gesprochenen Worts** ohne Einwilligung ist
  **Straftat**. Ein B2B-Call ist „nicht öffentlich" → **Einwilligung ALLER Teilnehmer** nötig.
- **DSGVO:** Rechtsgrundlage = **Einwilligung, Art. 6(1)(a)** (DSK 2018; berechtigtes Interesse
  trägt für Aufnahmen NICHT). Vorab, informiert, aktiv, dokumentiert.
- **AT:** praktisch identisch (DSG+GDPR). **CH:** revFADP + StGB Art. 179bis/ter (All-Party-Consent).
- **Konvergenz:** *vorab, informiert, aktive Einwilligung jedes Teilnehmers vor Aufnahmebeginn* +
  echter Ablehnungs-Pfad (stoppt Aufnahme) + Consent-Log. **Auf den strengsten Nenner bauen.**

**Produkt-Konsequenz (Findr-Voice):** Einwilligungs-Erfassung ist **nicht verhandelbar** und
gehört in die App (Banner/Opt-in vor Aufnahmestart, Consent-Log, Decline = Stop). Wird Bestandteil
von Etappe 3/4.

### 6.2 Verarbeitungsort je Option

| Option | Wo wird Audio verarbeitet | DSGVO-Posture |
|---|---|---|
| **A) Recall.ai (US-Vendor)** | Recall-Infra; **EU/Frankfurt-Region wählbar** | **Höchste Last:** Art. 28 AVV + Sub-Processor-Kette + Drittland-Transfer (Recall stützt sich auf **SCCs** + **TIA**; DPF rechtlich fragil). „Verteidigbar", nicht „nativ". Zero-Retention + EU-Region mildern. |
| **B) Voll-lokal** | Capture **und** Transkription on-device; Audio verlässt Gerät nie | **Cleanste Position** — kein Drittland-Transfer, minimale Sub-Processor-Kette. **Bester Fit für „DSGVO-nativ".** |
| **C) Capture-SDK + lokal STT** | hängt am Daten-Pfad des SDK | Mit Recall erbt es A's Transfer-Last (Audio via US-Infra) → **kein sauberer Mittelweg**. |

**Für MVP (Entscheidung A):** Recall **EU-Region + Zero-Retention (kurze Aufbewahrung) +
AVV/SCCs/TIA + Einwilligung** → ehrlich als „DSGVO-konform mit US-Sub-Processor in EU-Region"
kommunizieren, **nicht** als „voll DSGVO-nativ". Letzteres erst mit B. ⚠️ **RISIKO:**
Retention-Default für neue Recall-Accounts = „forever" → explizit auf ZDR/kurz setzen
(Daten-Minimierung).

---

## 7. Etappen-Plan (jede einzeln verifizierbar)

> Verifikation generell: **`tsc` + `next build`** (NIE `pnpm dev` — Memory `feedback_dev-server`),
> plus die je Etappe genannten Funktionstests. Migrationen additiv; **André wendet sie im
> SQL-Editor an** (Memory-Muster).

### Etappe 1 — Backend-Ingest + Router + Posteingang (gegen Fake-Transkript)
**Bauen:** `voice_inbox`-Migration (additiv), `requireOrgIdFromBearer()`, `POST /api/voice/ingest`,
`lib/voice/router.ts`, `voice_inbox`-Service + Assign-Action, GET-Listen-Endpunkte.
**Verifizieren (ohne Desktop-App):** Fake-Transkript per HTTP-POST mit jeder Zuordnung →
- Bestandskunde → neue `account_health_scores`-Zeile; Sales → `risk_scores`; Discovery →
  `product_discovery_insights`; `inbox` → `voice_inbox`-pending-Zeile; Assign → routet korrekt.
**Warum zuerst:** beweist die **wertvollste + riskanteste** Integration (Router→Engines) mit null
Desktop-Arbeit. **Risiko:** XOR-/Kontext-Auflösung (deal vs. account vs. plan) — hier zuerst klären.

### Etappe 2 — Minimale Electron-Hülle + Clerk-OAuth + Token-Storage
**Bauen:** Electron-Hülle (separates Repo), PKCE-Loopback-Login, `safeStorage`, „Connected"-Status,
trivialer authentifizierter Call (`GET /api/voice/me` zeigt Org-Name).
**Verifizieren:** App loggt ein, speichert Token, zeigt korrekten Findr-Org-Namen; Neustart =
weiterhin eingeloggt (Refresh). **Risiko:** Clerk-OAuth-App-Konfig, Refresh-Lifetime.

### Etappe 3 — Recall.ai hinter `RecordingProvider` (EU-Region)
**Bauen:** `RecordingProvider`-Interface + `RecallProvider` (EU-Region, `@recallai/desktop-sdk`,
Webpack-`externals`), Permissions-Flow (mac: mic/accessibility/screen-capture), **Einwilligungs-
Banner**, Transkript → `POST /api/voice/ingest` **zunächst mit `mode:"inbox"`**.
**Verifizieren:** echter Zoom/Meet-Call → sprecher-markiertes Transkript landet im Findr-Posteingang
und routet bei Zuordnung. **Hier zahlt sich die Abstraktion aus.** **Risiko:** Apple-Silicon-only,
Netzabbruch beendet Aufnahme, Browser-Tab-Meetings (§8).

### Etappe 4 — Vorab-Popup + Findr-Dropdowns (Live-Daten)
**Bauen:** Vorab-Popup (Typ + Ziel), Dropdowns ziehen Live-Daten via GET-Endpunkte; Zuordnung wird
mit dem Transkript gesendet → **routet automatisch** (umgeht Posteingang). Plus „später zuordnen".
**Verifizieren:** Zuordnung im Popup → korrekte Engine läuft automatisch; „später" → Posteingang.

### Etappe 5 — Verteilung / Signing / Download
**Bauen:** mac-Signing+Notarization, Windows Azure-Trusted-Signing, `electron-updater` + Hazel/Vercel,
Findr-Voice-Marketing-Seite + Download-Links + Menü/Settings-Status.
**Verifizieren:** signierter Build installiert sauber auf frischem Mac + Windows (kein Gatekeeper/
SmartScreen-Block); Auto-Update zieht neue Version. **Risiko:** Cert-Beschaffung/Vorlaufzeit.

---

## 8. Offene Fragen / Risiken

- ⚠️ **Browser-Tab-Meetings (Meet im Tab):** Recall erkennt **unterstützte** Browser/Plattformen
  automatisch; reine Präsenz-Calls und nicht unterstützte Browser brauchen **manuellen Start**
  (Adhoc-Modus). Erkennungs-Matrix je Browser/OS vor Etappe 3 prüfen.
- ⚠️ **Apple Silicon only (Recall):** Intel-Macs nicht unterstützt — Zielgruppen-Check.
- ⚠️ **Kosten-Skalierung:** ~0,65 $/h all-in (Recording + Recall-STT). Bei z. B. 20 Nutzern ×
  10 h/Woche ≈ **~560 $/Monat** nur Recall. Pro-Org-Modell rechnen; ggf. eigener STT senkt Kosten.
- ⚠️ **Drittland-Transfer (A):** SCCs+TIA solide, DPF fragil (CJEU-Appeal, FISA §702) — Audit-fest
  dokumentieren, nicht als Marketing-Label „nativ" verkaufen.
- ⚠️ **Roh-Audio-lokal (B-Migration):** Recalls Raw-Audio läuft über Realtime-Infra — vor jeder
  „lokal"-Aussage direkt mit Recall verifizieren.
- ⚠️ **Code-Signing-Hürden:** Apple 99 $/Jahr + Notarization-Setup; Windows-Reputation baut sich
  über Zeit/Installs auf (Azure Trusted Signing beschleunigt). Vorlaufzeit einplanen.
- ⚠️ **App Store:** wegen Sandbox-Entitlements **Direkt-Download** statt Store.
- 🔶 **Consent-UX im Detail** (verbal + In-App-Banner + Log + Decline-Stop) — Design + anwaltliche
  Abnahme; Beschäftigten-Kontext (DE, §26 BDSG/Betriebsrat) ist Rechtsberatungs-Territorium.

### 🔶 Gemeinsam zu entscheidende Annahmen (markiert)
1. STT-Provider im MVP (Recall-eigen vs. EU-STT) — Kosten vs. DSGVO.
2. Zeitpunkt der B-Migration (Trigger: DSGVO-Verkaufsdruck? Recall-Kosten? Intel-Mac-Bedarf?).
3. Consent-Flow-Ausgestaltung + anwaltliche Abnahme vor Live-Gang.
4. Findr-Voice als eigener bezahlter Add-on-Tarif vs. inkludiert (GTM, nicht in diesem Plan).

---

## Verifikation des Gesamtprojekts (End-to-End)

1. **Backend (Etappe 1):** drei Fake-Transkripte → je eine Engine-Ausgabe-Zeile in der DB; `inbox`
   + Assign → Routing. `tsc` + `next build` grün.
2. **Auth (Etappe 2):** Desktop-Login → org-korrekter authentifizierter API-Call.
3. **Kette (Etappe 3):** realer Call → Posteingang → Engine. 4. **Auto (Etappe 4):** Popup-Zuordnung
   → automatische Engine. 5. **Verteilung (Etappe 5):** signierte Installer auf frischem Mac+Win +
   Auto-Update.
