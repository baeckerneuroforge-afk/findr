# Klymeo · Plan & Recherche: UX Research / Usability-Testing DSGVO- und EU-AI-Act-konform einbetten

**Status:** Orientierung. Geparkt — Umsetzung bewusst erst nach den ersten zahlenden Kunden (wie die Roadmap). **Stand:** 22. Juni 2026.
**Zweck:** Dieses Dokument baut auf `klymeo-ux-research-roadmap.md` auf und schließt deren zwei Lücken: (1) die Bestandsaufnahme ist hier **gegen den echten Code verifiziert** (die Roadmap zitiert einen Juni-Snapshot), und (2) das Rechtliche ist **deutlich vertieft** — die Roadmap deckt DSGVO nur knapp ab und den **EU AI Act sowie das deutsche §25 TDDDG gar nicht**. Genau danach hat die Aufgabe gefragt.
**Leitprinzip (von der Roadmap übernommen):** Nichts behaupten, was nicht live ist. Dieses Dokument ist **kein Code-Change** und **keine Rechtsberatung** — es gibt die Richtung und benennt, was anwaltlich abzusichern ist (Abschnitt 7).

> **Methodik-Hinweis:** Die Code-Belege stammen aus einer Multi-Agenten-Verifikation gegen den aktuellen Worktree. Die Rechtsaussagen wurden web-recherchiert und die riskantesten Behauptungen **adversarial gegengeprüft** (Abschnitt 8). Wo die Recherche eine verbreitete Annahme widerlegt oder das Recht unsicher ist, steht das ausdrücklich dabei.

---

## 0. Kurzfassung (für den eiligen Blick)

1. **Machbar — und Klymeos DSGVO-/AI-Act-Fundament ist überraschend stark.** Consent-Stempel mit Versionierung, Selbst-Widerruf, Org-weites Hard-Delete/Export, konfigurierbare Retention-Cron, EU-Hosting, KI-Offenlegung, eine „rote Linie" gegen biometrische Emotionserkennung samt Code-`RECHTSANKER`, ein AUP-Entwurf und sogar ein DPIA-Dokument existieren bereits. Das neue Modul **erweitert** dieses Fundament additiv, es baut es nicht neu.

2. **Es gibt nicht eine, sondern DREI rechtliche Schichten.** Die Roadmap sah nur die DSGVO. Real sind es:
   - **§25 TDDDG / ePrivacy** (Zugriff aufs Endgerät) — verlangt **vorherige Einwilligung, unabhängig von der DSGVO**, bevor irgendein Tracking-Skript (rrweb, Klick/Scroll/Dwell) lädt. Das ist die Schicht, die die Roadmap komplett übersehen hat.
   - **DSGVO** (Verarbeitung der entstehenden Daten) — Einwilligung als Rechtsgrundlage, DPIA, Datenminimierung, Art.-9-Risiko, Retention, AVV.
   - **EU AI Act / KI-VO** (das KI-System) — Transparenzpflicht und die Emotionserkennungs-Falle.

3. **Die eine Linie, die alles entscheidet (AI Act):** Reibung/Frust **nur aus nicht-biometrischen Verhaltenssignalen** ableiten (Task-Erfolg, Time-on-Task, Klickpfad, Rage-Clicks, Scroll/Dwell, Text). **Niemals** aus Stimme (= biometrisch!), Gesicht oder Webcam. Tut man Letzteres, wird das ganze Modul **Hochrisiko-System (Annex III 1(c))** mit Konformitätsbewertung, CE-Kennzeichnung und EU-Registrierung. Die bestehende „keine Video-/Emotionsanalyse"-Linie ist also nicht nur Marke, sondern juristisch tragend — und sollte explizit auf **„keine Affekt-Labels aus Verhalten"** erweitert werden.

4. **Reine Usability-Analyse ist NICHT Hochrisiko** unter Annex III, solange keine biometrischen Daten verarbeitet werden. Verifiziert.

5. **Bauen, wenn ein zahlender Kunde es konkret verlangt — dann mit dem Rechts-Workstream pro Phase parallel.** Das volle Modul ist mehrwöchig bis mehrmonatig (siehe Roadmap §5/§6).

---

## 1. Worum es geht & was dieses Dokument hinzufügt

UX Research hat zwei Hälften (Roadmap §1):
- **Das Warum** (interviewbasiert) — Discovery, Verständnis, Reaktion auf Entwürfe. **Deckt Klymeo heute ab.**
- **Das Was** (task-basiert, Usability) — was Menschen *tun*: Aufgaben lösen, Klickpfade, Hänger, Fehlklicks. **Deckt Klymeo heute nicht ab.**

Die Roadmap beschreibt sehr gut, *was* für die zweite Hälfte technisch fehlt und *wie* der Cross-Origin-Kernhaken zu lösen ist. Dieses Dokument ergänzt:
- **Abschnitt 2** — verifizierte Bestandsaufnahme inkl. des bereits vorhandenen **Compliance-Fundaments** (das die Roadmap nicht inventarisiert hat).
- **Abschnitt 3** — der vollständige rechtliche Rahmen über alle drei Schichten.
- **Abschnitt 4** — wie das Modul **additiv** in Klymeos vorhandene Struktur passt (Migrations-Muster, Consent-Gate, Synthese-Hook).
- **Abschnitt 5–7** — Phasenplan mit eingewobenem Rechts-Workstream, Ehrlichkeits-Leitplanke, offene Punkte für André/Anwalt.

---

## 2. Bestandsaufnahme — was Klymeo heute REAL hat (gegen Code verifiziert)

### 2.1 Vorhandene Fähigkeiten (alle Roadmap-Claims bestätigt)

| Fähigkeit | Status | Beleg | Roadmap-Claim |
|---|---|---|---|
| **A) Stimulus-Vision-Analyse** | voll live | [stimulus-analysis.ts](src/lib/research/stimulus-analysis.ts), [stimulus/route.ts](src/app/api/research/plans/[id]/stimulus/route.ts) | bestätigt¹ |
| **B) Bildschirm-Stichprobe** | teilweise/nascent | [InterviewChat.tsx](src/components/interview/InterviewChat.tsx), [vision.ts](src/lib/visual-intelligence/vision.ts), [visual-capture/route.ts](src/app/api/interview/[token]/visual-capture/route.ts) | bestätigt |
| **C) Klickpfad-/Interaktions-Analyse** | fehlt komplett | bestätigt durch Grep über `src/` + alle Migrationen | bestätigt |

**A) Stimulus-Erkennung.** Bild wird beim Upload base64-kodiert als echter Vision-Block an Claude Opus 4.8 geschickt (inkl. OCR via `textImBild`), Video clientseitig in bis zu 16 Keyframes zerlegt (`MAX_VIDEO_FRAMES = 16`, Frames sind reine Transport-Daten, werden nie persistiert). Analyse läuft einmalig beim Upload (fail-open), fließt als Nachhak-Material in den Interviewer (`formatStimulus` → `NACHHAK-MATERIAL … ERSETZT NICHT die TOPICS`), sichtbar in Text- und Voice-Modus. Link-/Prototyp-URLs bekommen **keine** Vision-Analyse. Forscher-Uploads liegen dauerhaft im Bucket `research-stimuli`.
> **¹ Eine Präzisierung zur Roadmap:** Das Studientyp-Gate („nur Marktforschung") sitzt **nicht in der Upload-Route**, sondern beim Kontext-Bau in `planToAgentContext` (gegated auf `studyType === 'market_research'` UND `status === 'done'`). Die Analyse selbst läuft für jedes Bild/Video. Designentscheidung, kein Bug — aber gut zu wissen, wenn ein Usability-Studientyp dazukommt.

**B) Bildschirm-Stichprobe.** Echtes `getDisplayMedia({ video: true, audio: false })`, ein Frame alle 8 s, max. 24 Frames, 960 px lange Kante, JPEG 62 %. Frames → **Claude Sonnet** → reine Text-Beobachtungen (`FLÜSSIG`/`REIBUNG`). **Kein Video, keine Frames gespeichert** — nur ein abgeleitetes Text-Envelope (`interview_sessions.visual_capture` JSONB) plus ein Transkript-Block. Standardmäßig **aus** (`visual_capture_enabled DEFAULT false`); Route gibt 403, wenn nicht aktiviert. Kein Audio, Desktop-only (Mobile via UA-Check ausgeschlossen), Secure-Context-Pflicht. Der serverseitige ffmpeg-Pfad in `vision.ts` existiert, ist aber im Live-Produkt toter Code (nur Offline-Analyse). **Alle 7 Roadmap-Claims exakt bestätigt.**

**C) Klickpfad.** Bestätigt **komplett abwesend:** kein rrweb/hotjar/fullstory/posthog/mixpanel/segment/amplitude/clarity in `package.json`, keine `events`-Tabelle in den 28 Tabellen, kein Replay-SDK. Sentry ist **error-only** (kein `replaysSessionSampleRate`, `sendDefaultPii: false`). Die einzigen Event-Listener sind legitime UI-Handler (Scroll für Sticky-Bar, IntersectionObserver für Animationen).

### 2.2 Was fehlt (die Bausteine — wie Roadmap §5)

Task-Modell · einbettbarer/beobachtbarer Prototyp (Cross-Origin-Kern) · Client-Instrumentierung (Klick/Maus/Scroll/Dwell) · Event-Ingestion-Route + Event-Store · Time-on-Task & Erfolg/Misserfolg · Pfad-/Fehlklick-Analyse + Heatmaps · Session-Replay-Speicher + Viewer · Synthese-Integration als eigener Insight-Typ · Rechtstext/Consent für Aufzeichnung.

### 2.3 Das Compliance-Fundament, das **schon existiert** (der eigentliche Schatz)

Das hat die Roadmap nicht inventarisiert — es ist aber der Grund, warum das Modul DSGVO-/AI-Act-konform *einbettbar* statt von Grund auf neu baubar ist:

| Baustein | Wo | Was es kann |
|---|---|---|
| **Consent-Stempel** | [session-service.ts](src/lib/voice-agent/session-service.ts), Migration `20260704000001_interview_consent.sql` | `consent_accepted_at` (server-gestempelt, idempotent `WHERE … IS NULL`) + `consent_version` (= `CONSENT_TEXT_VERSION`, aktuell `2026-06-11`) → DSGVO Art. 7(1) Nachweis |
| **KI-Offenlegung** | [InviteConsentGate.tsx](src/components/interview/InviteConsentGate.tsx), [OpenLinkEntry.tsx](src/components/interview/OpenLinkEntry.tsx), [interview/[token]/page.tsx](src/app/(participant)/interview/[token]/page.tsx) | Gate **vor** der ersten KI-Interaktion (Text **und** Voice) → AI Act Art. 50(1) |
| **Selbst-Widerruf** | `withdrawSessionByToken()`, [withdraw/route.ts](src/app/api/interview/[token]/withdraw/route.ts) | Teilnehmer löscht eigene Session per Token → DSGVO Art. 17 |
| **Org-Hard-Delete & Export** | Migrationen `20260709…delete_organization_data_fn.sql`, `20260708…export_organization_data_fn.sql` | `SECURITY DEFINER`, service-role-only, scannt alle `org_id`-Tabellen + verwaiste Transkripte; Export strippt Secrets |
| **Retention** | `org_settings.interview_retention_days`, [cron/retention/route.ts](src/app/api/cron/retention/route.ts) | tägliche Auto-Löschung + Abbruch verwaister Sessions |
| **Emotions-Rote-Linie** | [turn-signals.ts](src/lib/research/turn-signals.ts) (`RECHTSANKER`-Block), [vision.ts](src/lib/visual-intelligence/vision.ts) | Turn-Signals **nur aus Wortlaut-Text**, „NIEMALS Audio-Features/Prosodie … würde das System zum Emotionserkennungssystem (Hochrisiko Annex III 1(c), Verbotszone Art. 5(1)(f)) machen". Vision-Prompt verbietet Inferenz von „emotion, intent, identity". |
| **AUP-Entwurf** | [docs/findr-e0-aup-klausel-entwurf.md](docs/findr-e0-aup-klausel-entwurf.md) | verbietet Beschäftigten-/Bildungskontext, Biometrie-Reuse, Art.-22-Automatik, De-Anonymisierung |
| **DPIA-Dokument** | [docs/findr-dpia-ki-interviews.md](docs/findr-dpia-ki-interviews.md) | Kurz-DPIA (Art. 35), Rechtsgrundlage Art. 6(1)(a), Risiken R1–R7, No-Backfill-Versprechen |
| **EU-Hosting + Prozessor-Liste** | [datenschutz/page.tsx](src/app/(marketing)/[lang]/datenschutz/page.tsx) | Supabase (Frankfurt), Hetzner (DE), Anthropic via AWS Bedrock (EU), LiveKit, Deepgram, Stripe, Clerk — je mit Zweck/Datenkategorien/Rechtsgrundlage/Standort |
| **Marketing-Leitplanke** | [use-case-template.tsx](src/components/marketing/use-case-template.tsx) | „kein Video-/Emotion-/Screen-Recording-Claim" |

**Konsequenz für den Plan:** Fast jede neue Pflicht aus Abschnitt 3 hat hier bereits einen Haken zum Andocken. Das senkt den Aufwand und das Risiko erheblich.

---

## 3. Der rechtliche Rahmen (das Herzstück)

### 3.0 Das Drei-Schichten-Modell (zuerst verstehen)

Ein einziger „Aufnahme-Schalter" berührt **drei voneinander unabhängige Rechtsregime**. Jede Schicht muss separat erfüllt sein — eine erfüllt nicht die andere:

```
Teilnehmer-Klick im Prototyp
        │
        ▼
 ① §25 TDDDG / ePrivacy Art. 5(3)      ← Skript greift auf das ENDGERÄT zu
    → VORHERIGE Einwilligung Pflicht,      (rrweb lädt, liest DOM/Events)
      UNABHÄNGIG von der DSGVO.            Diese Schicht hat die Roadmap übersehen.
        │
        ▼
 ② DSGVO Art. 6/9/35                    ← VERARBEITUNG der entstehenden
    → Rechtsgrundlage (Einwilligung),       personenbezogenen Daten
      DPIA, Minimierung, Art.-9-Schutz,
      Retention, AVV, Betroffenenrechte
        │
        ▼
 ③ EU AI Act / KI-VO                    ← das KI-SYSTEM, das auswertet
    → Art. 50 Transparenz; Emotions-/
      Biometrie-Falle (Art. 5 / Annex III)
```

Merksatz: **TDDDG fragt „darfst du das Gerät anfassen?", die DSGVO fragt „darfst du die Daten verarbeiten?", der AI Act fragt „darf die KI das tun, und musst du es offenlegen?".** Für Klymeos Usability-Modul lautet die Antwort auf alle drei: ja — **mit Einwilligung und innerhalb der roten Linie**.

---

### 3.1 EU AI Act / KI-VO

#### 3.1.1 Einstufung: NICHT Hochrisiko (verifiziert, mit Vorbehalt)

Ein task-basiertes Usability-Tool, dessen LLM Beobachtungen aus **Interaktionssignalen** (Klicks, Pfade, Task-Erfolg, Timing, Text) ableitet — **ohne** biometrische Identifikation und **ohne** Emotionserkennung — fällt unter **keine** der 8 Annex-III-Hochrisiko-Kategorien.
- **Annex III Punkt 1 (Biometrie)** — alle drei Unterpunkte verlangen Verarbeitung **biometrischer Daten** (Art. 3(34)). Ein Klickstream/Text-Analyzer verarbeitet keine. Raus.
- **Punkt 3 (Bildung), Punkt 4 (Beschäftigung)** — Domänen-Trigger; ein rekrutierter Produkttest-Teilnehmer ist **weder Lernender noch Beschäftigter** des Kunden. Raus.
- Punkte 2/5/6/7/8 (Infrastruktur, essenzielle Dienste, Strafverfolgung, Migration, Justiz) — offensichtlich raus.

**Kategorien, in die man NICHT abdriften darf:**
- **1(c) Emotionserkennung** — keine Inferenz von Emotionen/Absichten aus Gesicht/Stimme.
- **1(a)/1(b)** — keine Gesichts-/Stimm-Identifikation, keine biometrische Kategorisierung nach geschützten Merkmalen.
- **Punkt 4** — das Tool **nicht** umwidmen, um eigene Mitarbeiter/Bewerber des Kunden zu bewerten.
- **Punkt 3** — nicht zum Benoten/Prüfen von Lernenden einsetzen.

> Selbst wenn man in eine Annex-III-Kategorie geriete, gäbe es die Art.-6(3)-Ausnahme („kein erhebliches Risiko" / nur Vorbereitungs-/Verfahrensaufgabe) — **aber sie entfällt, sobald das System *Profiling* betreibt.** Pro-Teilnehmer-Verhaltensprofile vermeiden; Synthese auf Aggregat-/Insight-Ebene halten.

#### 3.1.2 Die rote Linie: die biometrische Emotionserkennungs-Falle

Das ist der **wichtigste juristische Satz des ganzen Dokuments:**

> **Frust/Reibung/Verwirrung NUR aus nicht-biometrischen Signalen ableiten — Task-Erfolg, Time-on-Task, Klickpfad, Rage-Clicks, Backtracks, Scroll/Dwell, Fehler-Events und den TEXT der Antworten. NIEMALS aus Stimme (= biometrisch!), Gesicht oder Webcam.**

Begründung über die Tatbestände:
- **Art. 5(1)(f) — Verbot** der Emotionserkennung, aber **ausschließlich „in den Bereichen Arbeitsplatz und Bildungseinrichtungen".** Ein rekrutierter Forschungs-Teilnehmer außerhalb dieser Kontexte fällt **nicht** darunter. (Verifiziert; Commission-Guidelines zu verbotenen Praktiken, Feb 2025: Kunden ≠ Beschäftigte.) **Achtung:** Einwilligung heilt Art. 5 **nicht** — das Verbot ist absolut; es greift hier nur deshalb nicht, weil der Kontext draußen ist. „Arbeitsplatz" wird **breit** gelesen (inkl. Recruiting) — also nie Mitarbeiter des Kunden als Probanden in einem beschäftigungsnahen Setting auswerten.
- **Aber: Emotionserkennung außerhalb Arbeit/Bildung ist NICHT frei** — verarbeitet sie **biometrische** Daten (Stimmlage/Prosodie, Gesichtsausdruck), ist sie automatisch **Hochrisiko nach Annex III 1(c)** (Commission-Guidelines Rz. 37/263/266) und zieht das **ganze Kapitel-III-Abschnitt-2-Regime** plus Art.-50(3)-Hinweispflicht nach sich: Risikomanagement, Daten-Governance, technische Doku, Logging, menschliche Aufsicht, Konformitätsbewertung, CE, EU-Registrierung. Das ist der Step-Change, den man vermeiden will.
- **Text, Klicks, Maus, Scroll, Dwell, Time-on-Task sind KEINE Emotionserkennung** im Sinne der KI-VO — sie sind keine biometrischen Daten (Art. 3(39) verlangt „auf der Grundlage biometrischer Daten"; Guidelines Rz. 265 schließt Text-Sentiment ausdrücklich aus). **Vorsicht-Caveat:** *Keystroke-Dynamik* und *Gait* können verhaltensbiometrisch sein (Rz. 278). Also: aus **WAS** und **WANN** geklickt wurde ableiten (Events), nicht aus **WIE** jemand tippt/sich bewegt als biometrisches Muster.
- **Voice-Interviews:** zu Text transkribieren und **den Text** analysieren — nie Affekt/Emotion auf der Audio-Wellenform. (Genau das tut Klymeo heute schon bei Turn-Signals — Muster beibehalten.)

**Empfehlung:** Die bestehende „keine Video-/Emotionsanalyse"-Linie explizit erweitern auf **„keine Affekt-Labels aus Verhalten"**: Rage-Clicks als „Reibung" framen — in Ordnung; „frustriert/verärgert" als Affekt-Label — vermeiden. Das hält das Modul außerhalb Annex III 1(c) und Art. 5 — und ist zugleich ein DACH-Verkaufsargument („Verhaltens-Usability-Metriken, keine biometrische Emotionsanalyse").

#### 3.1.3 Transparenz (Art. 50) — größtenteils schon erfüllt

- **Art. 50(1)** — Pflicht des **Anbieters** (= Klymeo), Teilnehmer beim ersten Kontakt zu informieren, dass sie mit einer KI interagieren — **Text und Voice**. ✅ Bestehende KI-Offenlegungs-Gates erfüllen das. Die „ist eh offensichtlich"-Ausnahme liest die Kommission **streng** → nicht darauf verlassen, im gesprochenen ersten Satz offenlegen, nicht nur im Banner/AGB (Art. 50(5)).
- **Art. 50(2)** — maschinenlesbare Kennzeichnung synthetischer Inhalte: betrifft am ehesten die **synthetische KI-Stimme** (synthetisches Audio). Mit dem TTS-/Voice-Anbieter Provenienz/Watermark (z. B. C2PA) klären, „soweit technisch machbar". Die **KI-geschriebene Synthese** ist wahrscheinlich **ausgenommen** (menschliche/redaktionelle Prüfung durch den Forscher; interne Nutzung, keine Marktplatzierung als Generativ-Dienst).
- **Art. 50(4)** (Deepfake/öffentliches Interesse) — greift **nicht** für private Research-Interviews und interne Synthese.
- **Art. 4 — KI-Kompetenz** (seit 2. Feb 2025): kurze interne Schulung der Mitarbeitenden, die Interviewer/Synthese betreiben, intern dokumentieren (kein Zertifikat nötig); B2B-Kunden als „Betreiber" via Onboarding-Material unterstützen.

#### 3.1.4 Zeitschiene — **wichtige Korrektur durch den Digital Omnibus**

Die Recherche hat hier eine Aktualisierung gegen den ursprünglichen Fahrplan gefunden:

| Meilenstein | Datum | Vom Digital Omnibus geändert? |
|---|---|---|
| Inkrafttreten | 1. Aug 2024 | unverändert |
| Verbote (Art. 5) + KI-Kompetenz (Art. 4) | 2. Feb 2025 | unverändert |
| GPAI + Governance | 2. Aug 2025 | unverändert |
| **Allgemeine Anwendung inkl. Art. 50 Transparenz** | **2. Aug 2026** | **bleibt** (nur maschinenlesbare Markierung Art. 50(2) für *bereits am Markt* befindliche Systeme → 2. Dez 2026) |
| **Hochrisiko Annex III (standalone)** | ~~2. Aug 2026~~ → **2. Dez 2027** | **verschoben** |
| **Hochrisiko Annex I (produkt-eingebettet)** | ~~2. Aug 2027~~ → **2. Aug 2028** | **verschoben** |

> **Caveat (Stand Recherche):** Der Digital Omnibus war **noch nicht im Amtsblatt** (EP-Zustimmung 16. Juni 2026, Rats-Annahme ~29. Juni 2026 erwartet). Bis zur OJ-Veröffentlichung gelten formal die Originaldaten — die Verschiebungen sind politisch beschlossen und nahezu sicher, aber noch nicht hartes Recht. **Vor einem Launch den konsolidierten Text prüfen.** Für Klymeo praktisch entscheidend: **Art. 50 bleibt bei 2. Aug 2026** — also nicht annehmen, die Transparenzpflichten seien mit Hochrisiko verschoben worden.

#### 3.1.5 Rollen: Anbieter, Betreiber, GPAI

- Klymeo ist **Anbieter** seines eigenen KI-Systems (entwickelt & platziert „Klymeo" unter eigenem Namen, Art. 3(3)). Die B2B-Kunden sind **Betreiber** (Art. 3(4)). In AVV/Bedingungen abbilden.
- „Den Namen draufschreiben" (Art. 25) macht **nicht** hochrisiko — das **Feature** (biometrische Emotionserkennung) täte es.
- **GPAI:** Anthropic ist GPAI-Modell-Anbieter (Claude); Klymeo ist nachgelagerter System-Anbieter. **Keine Haftungsübertragung** — die eigene System-Verantwortung bleibt. Anthropics Doku/Nutzungsbedingungen einholen und einhalten (stützt die eigene Konformitätsstory).
- Die **„wissenschaftliche-Forschung"-Ausnahme** (Art. 2(6)/(8)) schützt **nicht** — Klymeo ist ein kommerziell platziertes Produkt mit echten Teilnehmern.

---

### 3.2 DSGVO

| Thema | Anforderung | Klymeo-Andockpunkt |
|---|---|---|
| **Rechtsgrundlage** | **Einwilligung (Art. 6(1)(a))** ist faktisch die einzige tragfähige Basis für Screen-Recording/Session-Replay — **nicht** berechtigtes Interesse (Art. 6(1)(f) kann die TDDDG-Gerätezugriffs-Einwilligung ohnehin nicht ersetzen). | bestehendes `consent_accepted_at`-Muster, granular erweitern (3.3) |
| **Art. 9 Sonderkategorien** | Screen-Capture/Replay erfasst **inzidentell** Gesundheits-/Religions-/etc.-Daten (offene Tabs, Formularfelder, echte Seiten). Lösung ist **technische Prävention**: maskieren **zum Erfassungszeitpunkt**, nicht „erst speichern, dann blurren". Passwort/Zahlung **per Default blocken**. | Screen-Sampling bleibt **off by default** + eigener Opt-in |
| **DPIA (Art. 35)** | **Sehr wahrscheinlich Pflicht** — trifft mehrere WP248-Kriterien: systematische Verhaltensüberwachung + innovative Technik + Bewertung/Scoring + ggf. sensible Daten. (Regulatoren haben gezielt das Fehlen einer Vor-DPIA bei Monitoring sanktioniert, z. B. CNIL 32 Mio. € 2024.) | bestehende DPIA ([docs/findr-dpia-ki-interviews.md](docs/findr-dpia-ki-interviews.md)) als Vorlage erweitern |
| **Minimierung & Zweckbindung (Art. 5(1)(b),(c))** | Nur erfassen, was die Aufgabe braucht. **Semantische Events** (Task-Erfolg, Klick auf Ziel, Time-on-Task) statt Pixel-Replay bevorzugen. **Sampling/trigger-basiert, nicht blanket.** Kein Repurposing (kein Training, kein Retargeting). | Event-Tier als Default, Replay als Premium-Tier |
| **Retention (Art. 5(1)(e))** | Kurz + automatische Hard-Löschung. CNIL-Entwurf: Stunden für Support, „wenige Monate" für UX/Fehleranalyse. | bestehende `retention`-Cron + Org-Hard-Delete erweitern |
| **Betroffenenrechte** | Auskunft (15), Löschung (17), Portabilität (20), Widerruf (7(3) — stoppt Erfassung **und** löscht). Store muss pro Session/Teilnehmer **gekeyt** sein. | `withdrawSessionByToken` erweitern |
| **Rollen** | Standard: Kunde = Verantwortlicher, Klymeo = **Auftragsverarbeiter** (Art. 28, AVV). **Aber** Klymeo holt die Einwilligung in der **eigenen UI** ein → zieht für die Consent-Schicht Richtung **(gemeinsame) Verantwortlichkeit**. **Consent-Pflichten lassen sich nicht per Vertrag auf den Kunden abwälzen** (CNIL). | AVV-Addendum + Sub-Prozessor-Liste |
| **Sub-Prozessoren & Transfer** | Anthropic (Screen-Frames/Transkripte → **US-Transfer-Dimension**: SCC/DPF oder EU-Endpoint), Supabase/Hetzner (EU). Jeder braucht Art.-28-Vertrag. | bestehende Prozessor-Liste erweitern |

---

### 3.3 §25 TDDDG / ePrivacy — die Schicht, die die Roadmap übersah

**Verifiziert (hohe Konfidenz), Quelle: DSK „OH Digitale Dienste" v1.2, Nov 2024 + EDPB Guidelines 2/2023 + BGH Planet49 II):**

- **(a) JA** — ein Session-Replay-/rrweb-Skript und Klick/Scroll/Dwell-Tracker zu laden und Interaktionsdaten zu lesen, ist **„Zugriff auf … Endeinrichtung"** und löst die **vorherige Einwilligungspflicht nach §25(1) TDDDG / Art. 5(3) ePD** aus — **unabhängig von und zusätzlich zur DSGVO**. Gilt auch **ohne** Personenbezug (DSK Rz. 26; EDPB para 52–53: lokal erzeugte und dann zum Server gesendete Daten = „Zugriff").
- **(b) NEIN** — Usability-Analytik (Time-on-Task, Klickpfad, Reibung, Heatmaps, Replay) qualifiziert sich **praktisch nie** für die „unbedingt erforderlich"-Ausnahme (§25(2) Nr. 2). Diese meint **technische** Notwendigkeit für den ausdrücklich angeforderten Dienst; wirtschaftliche/Analyse-Zwecke zählen nicht (DSK Rz. 77, 87–90).
- **(c) Zwei Schichten, aber eine Handlung möglich** — §25-Einwilligung und DSGVO-Einwilligung sind rechtlich verschieden, dürfen aber in **einem gebündelten Opt-in** erteilt werden — **nur wenn der Text auch die nachgelagerten Verarbeitungszwecke nennt** (sonst hat man nur eine TDDDG-Einwilligung, und die DSGVO-Grundlage fehlt; DSK Rz. 29).
- **(d) First-Party-iFrame/Figma ändert nichts** — §25 ist partei- und herkunftsneutral. Ein Figma-Embed ist ein **Dritt-Akteur**, der eigene Cookies/Storage setzt → muss im Consent-Gate mit abgedeckt und als Prozessor/Transfer dokumentiert werden. Reines On-Device-Processing, das **nie** das Gerät verlässt, wäre ausgenommen — Usability-Telemetrie sendet aber an Klymeos Route, also greift die Ausnahme nicht.
- **(e) Skript hart blocken, bis Opt-in vorliegt.** Der **klassische Fehler**: rrweb startet beim Laden, Banner kommt danach → Erfassung *vor* Einwilligung = rechtswidrig (DSK Rz. 36). Engineering muss die Skript-Injektion bis nach dem Opt-in **aufschieben** (fail-closed). Widerruf so einfach wie Erteilung (Rz. 61–62).

> Bußgeld: §25-TDDDG-Verstöße zzgl. separater DSGVO-Haftung. **Caveat:** Die kursierende „bis 300.000 €"-Zahl ließ sich gegen eine primäre Bußgeldnorm **nicht bestätigen** — mit Vorsicht behandeln, anwaltlich prüfen.

---

### 3.4 Präzedenz & Wettbewerbs-Benchmark

- **Mythos entkräftet:** Eine konkrete **Garante-(Italien)-Durchsetzung gegen Hotjar / Session-Replay** ließ sich in **keiner** belastbaren Quelle (Garante-Site, Enforcement-Tracker) finden — das ist eine **Halluzination** und darf **nicht** zitiert werden. Real und zitierbar: die Garante-**Cookie-Leitlinien** (Provv. Nr. 231, 10.06.2021, doc-web 9677876) — Tracking zu Nicht-Technik-Zwecken braucht Opt-in (per Analogie auch Session-Replay).
- **Echter on-point-Präzedenz:** Garantes **Google-Analytics-Bann** (Caffeina Media, 23.06.2022) — verurteilte genau die Kombination **Verhaltensdaten + US-Transfer**. Lehre: Verhaltens-Tracking-Daten **sind** personenbezogen, und der **US-Transfer** macht aus Routine eine Rechtswidrigkeit. **EU-only-Hosting eliminiert diesen ganzen Fehlermodus.**
- **CNIL-Entwurfsempfehlung zu Session-Replay (Konsultation 25.02.–22.04.2026)** = die konkreteste EU-Regulator-Blaupause. Als **Design-Spec** behandeln (auch wenn französisch und noch Entwurf): Einwilligung Pflicht; Retargeting verboten; Passwort/Zahlung **per Default geblockt**; Content-Masking by design; **Sampling statt blanket**; kurze Retention; Rollen-Zugriffe; „Consent kann nicht per Vertrag verschoben werden".
- **Microsoft Clarity** erzwingt seit **31. Okt 2025** Consent-Signal in EEA/UK/CH — selbst ein Gratis-Tool wurde ins harte Consent-Gating gezwungen. Validiert Klymeos Consent-first-Haltung; zeigt aber die US-Transfer-Schwäche (Azure/US-Kette).
- **UserTesting / Maze / rrweb-Muster:** Kunde = Verantwortlicher, Plattform = Auftragsverarbeiter; Consent beim Test-Start; **PII-Maskierung per Default**; per-Session-Löschung; **EU-Datenresidenz als Differenzierer**. rrweb-Maskierung **allow-list** konfigurieren (Bug #1609: versteckte Inputs werden bei `maskAllInputs` nicht maskiert → niemals auf deny-list verlassen).
- **EU-US DPF** überlebt (General Court, Latombe, 03.09.2025), aber unter Berufung angefochten (CJEU C-703/25 P) → strukturell fragil. **→ EU-only First-Party-Hosting ist der saubere, dauerhafte Weg** und passt zu Klymeos DSGVO-first-Marke.

---

## 4. Integrationsplan — additiv in die vorhandene Struktur

Leitprinzip (wie im ganzen Repo, vgl. Studie-Typ/Interview-Tiefe/Stimulus): **additive Migrationen mit nullable Spalten + CHECK, kein Backfill, byte-identische Altpfade, ein einziger Persistenzpfad (kein zweiter Create-Weg).**

### 4.1 Datenmodell (additive Migrationen)

```
research_plans  (+ nullable Spalten)
  task_definition           jsonb     -- { instruction, successCriterion, targetUrl }
  event_tracking_enabled    boolean default false
  -- screen sampling existiert schon: visual_capture_enabled

interview_sessions  (+ nullable Spalten)
  task_result               jsonb     -- { success, time_on_task_seconds, click_count, friction_events[] }
  replay_ref                text      -- Pointer in EU-Bucket (kein Inline-Blob)
  -- consent: granular, siehe 4.2

research_session_events  (NEUE Tabelle, leaf, FK → interview_sessions)
  id, session_id, org_id, event_type, timestamp_ms,
  target_selector, payload jsonb, created_at
  idx(session_id, created_at)   -- RLS erbt Org-Isolation über die Session

org_settings  (+ nullable)
  event_retention_days      int       -- getrennt von interview_retention_days
```

- **Studientyp-Frage (offen, von der Recherche aufgeworfen):** Usability als **eigener `study_type`** (eigenes Prompt/Billing) oder als **Use-Case innerhalb `market_research`/`product_discovery`** (z. B. `useCase === 'usability_testing'` + `task_definition`)? **Empfehlung:** als **Use-Case/Feature-Flag**, nicht als dritter Top-Level-Typ — das hält die Synthese-Pfade vereint und vermeidet einen zweiten Create-Weg. André entscheidet das beim Bau.
- **Task-Speicherung:** JSONB-Spalte (wie `stimulus_analysis`/`interview_depth`), **nicht** eigene Tabelle — v1 ist 1:1, Multi-Task später additiv.

### 4.2 Consent-Schicht erweitern (der Kern der Konformität)

- **Granulare, zweck-getrennte Einwilligung** — separate Schalter für **(a) Interaktions-Events**, **(b) visuelles Session-Replay**, **(c) Screen-Sampling**. Teilnahme am Interview **darf nicht** vom invasivsten Tier abhängen.
- **Ein gebündeltes Opt-in** das **gleichzeitig** §25 TDDDG (Gerätezugriff) **und** DSGVO Art. 6(1)(a) (Verarbeitung inkl. „fließt in KI-Synthese") erfüllt — der Text muss **alle nachgelagerten Zwecke** nennen (sonst fehlt die DSGVO-Grundlage, DSK Rz. 29).
- **`CONSENT_TEXT_VERSION` bumpen** + DE/EN-Texte ergänzen (Interaktion wird aufgezeichnet, Replay, optionales Screen-Sampling, Retention, KI-Synthese, freiwillig/widerrufbar). Pro-Zweck-Flags neben `consent_accepted_at` persistieren (Nachweis: Zeitpunkt, Version, akzeptierte Zwecke).
- **Hart fail-closed:** rrweb/Event-Collector **nicht importieren/injizieren** und `getDisplayMedia` **nicht aufrufen**, bevor der Consent-Record existiert. Genau Klymeos bestehendes Gating-Muster.
- **Persistenter In-Session-„Aufnahme stoppen/Widerruf"-Button** (Widerruf so einfach wie Erteilung, DSK Rz. 61–62).
- **Löschung/Retention wiederverwenden:** `withdrawSessionByToken` um `research_session_events` + Bucket-Objekte erweitern; `retention`-Cron um Event-/Replay-Sweep erweitern; `delete_organization_data`/`export_organization_data` erfassen `org_id`-Tabellen automatisch.

### 4.3 Task-Modell im Setup (Roadmap-Baustein 1)

Block in [ResearchPlanForm.tsx](src/components/dashboard/ResearchPlanForm.tsx) **gegated** auf den Usability-Use-Case — exakt das vorhandene `needsStimulus`-Muster (Sichtbarkeit + Pflichtvalidierung). Zod-Schema in den POST/PATCH-Routen, lenient `coerceTaskDefinition()` beim Lesen, `taskDefinition`-Block in `planToAgentContext` nur wenn vorhanden (Altstudien byte-identisch).

### 4.4 Cross-Origin-Kernhaken (Roadmap §4) — und warum die DSGVO dieselbe Wahl trifft

Die Roadmap nennt drei Wege. **First-Party-iFrame / gehosteter Prototyp** ist nicht nur technisch sauber, sondern auch **rechtlich** der beste: Klymeo kontrolliert das DOM → kann rrweb-Maskierung **erzwingen** und den Akteur-Kreis klein halten. **Figma-Embed** importiert einen Dritt-Akteur (eigene Cookies/Storage, Prozessor-/Transfer-Beziehung). **Voller `getDisplayMedia`-Screen-Capture** ist am riskantesten (fängt fremde Tabs/Apps/PII, die niemand einwilligen kann und Klymeo nicht maskieren kann). → **First-Party bevorzugen; Screen-Sampling off by default belassen.**

### 4.5 Instrumentierung & Event-Store (Roadmap-Bausteine 3+4)

- **rrweb first-party**, Events an eine neue `POST /api/interview/[token]/events`-Route (Token-Capability-Auth wie `visual-capture`), Replay in **EU-Bucket** (Supabase/Hetzner). Kein US-Vendor → kein Kapitel-V-Transfer.
- **Maskierung allow-list-by-default:** `maskAllInputs` + alle Text-Inputs maskieren, Passwort/Zahlung hart blocken, `.rr-ignore` auf Sensibles, nur die getestete Prototyp-UI explizit unmaskieren. Bug #1609 einkalkulieren.
- **Default-Tier = semantische Events** (task_started, click-on-target, success/failure, time-on-task, scroll-depth, dwell) — erfüllt Minimierung, senkt DPIA-Risiko. **Voll-Replay + Screen-Sampling = separat eingewilligtes Premium-Tier.**

### 4.6 Synthese-Integration (Roadmap-Baustein 8) — der eleganteste Teil

Die Recherche hat das exakte Muster gefunden: **Interaktionsmetriken sind server-berechnete Fakten**, genau wie die bestehenden **E4-Turn-Signals** und **E7-Stimulus**-Blöcke. Prinzip aus [signals.ts](src/lib/synthesis/signals.ts): **„ZAHLEN RECHNET DER SERVER, NIE DAS MODELL".**

- Neuen `loadSynthesisInteractionInputs`-Loader (spiegelt `loadSynthesisSignalInputs`) bauen, der aus `research_session_events`/`task_result` einen **server-berechneten** `InteractionMetricsSummary` aggregiert (success_rate, mean_time_on_task, median_click_count, friction_session_count) und als Prompt-Block anhängt.
- Das LLM schreibt nur **prosaische `interaction_observations`**, gegroundet in diesen Fakten (kein Erfinden von Prozenten), persistiert additiv nach `study_synthesis.interaction_summary` + `interaction_observations` (nullable, wie E4/E7).
- Die bestehenden **Anti-Halluzinations-Gates** (`buildAnchorSet`/`applyAnchoredFilter`, [engine.ts](src/lib/synthesis/engine.ts)) bleiben unverändert wirksam.
- **Rote Linie auch hier:** **Reibungssignale, keine Affekt-Labels** (3.1.2).

### 4.7 Günstige Zwischenstufe (Roadmap §7) — ehrlich bleiben

Die vorhandene Bildschirm-Stichprobe (Fähigkeit B) aufbohren (höhere Sampling-Frequenz, bessere Vision-Auswertung) ergibt eine **approximierte Reibungs-Timeline** bei kleinem Aufwand. **Ehrliche Grenze:** bleibt **Inferenz, keine Messung** — vermarktbar nur als „KI-beobachtete Reibung", nicht als Klickpfad/Heatmap/gemessene Verweildauer. Rechtlich gilt für Aufbohren dasselbe Consent-Regime (TDDDG-Gerätezugriff via `getDisplayMedia` + DSGVO + Art.-9-Maskierung).

---

## 5. Phasenplan (Roadmap §6 + eingewobener Rechts-Workstream)

| Phase | Bau (Roadmap) | **Rechts-Workstream parallel** |
|---|---|---|
| **0 · Recht zuerst skizzieren** | — | DPIA-Vorlage für das Replay-Tier (Art. 35); Consent-Texte (DE/EN) entwerfen, die §25 **und** DSGVO bündeln; AVV-Addendum + Sub-Prozessor-Liste; rote Linie in AUP + Marketing-Leitplanke fixieren |
| **1 · Messbarer Prototyp** | Task-Modell; einbettbarer **First-Party**-Prototyp; Cross-Origin lösen | First-Party-Wahl = Art.-9-/Maskierungs-Kontrolle; Task-Text in Consent aufnehmen |
| **2 · Echte Events** | rrweb/Eigenbau-Instrumentierung; Event-Route + Store | **Hard-gate** (fail-closed) vor Skript-Load; allow-list-Maskierung; EU-Bucket; Event-Retention-Cron |
| **3 · Auswertung** | Time-on-Task, Erfolg/Misserfolg, Heatmaps, Replay-Viewer, Synthese-Insight-Typ | Reibungssignale statt Affekt; kurze Retention + Auto-Delete; Betroffenenrechte pro Session; Art.-50-Disclosure auf Tasks ausweiten; finalen CNIL-Text + Omnibus-OJ gegenprüfen |

**Gesamteinschätzung (wie Roadmap):** mehrere Wochen bis Monate + laufende Speicherkosten für Replays. Eigenes Produktmodul, kein Nebenbei-Feature. **Auslöser zum Bau:** ein zahlender Kunde verlangt echtes task-basiertes Usability-Testing konkret — dann mit **Phase 0+1** starten, nicht alles gleichzeitig.

---

## 6. Ehrlichkeits-Leitplanke (Roadmap §9, erweitert)

**Ehrlich, darf gesagt werden (heute):** Konzepte/Screens/Mockups im Interview zeigen; die KI sieht den Entwurf, liest Text im Bild, fragt zu Ersteindruck/Verständnis nach; optional teilt der Teilnehmer den Bildschirm, Klymeo erfasst stichprobenartig Standbilder und beschreibt, wo es flüssig lief und wo es hakte.

**Tabu, wäre Halbwahrheit/falsch (bis der Baustein live ist):** „Wir zeichnen den Bildschirm auf, während Nutzer klicken" (es ist Standbild-Sampling); „Klickpfad-Analyse, wir sehen jeden Klick" (keine Event-Erfassung); „Heatmaps/Verweildauer pro Element"; „wir messen Zögern/Fehlklicks" als **Messung** (ist KI-Schätzung aus Standbildern).

**Neu hinzu (Compliance-Leitplanken, dauerhaft):**
- **Nie** mit „Emotions-/Affekt-Erkennung", „Frustrations-Messung aus Stimme/Gesicht" werben — das ist die Hochrisiko-/Verbots-Zone. „Verhaltens-Reibungssignale" ist erlaubt und ehrlich.
- ⚠️ Die bestehende Creative-Test-Copy „emotionale Wirkung" auf den Marketing-Seiten **gegen die rote Linie prüfen** (von der Recherche als möglicher Konflikt geflaggt).
- EU-only-Hosting darf als Differenzierer genannt werden — solange wirklich kein US-Vendor in der Replay-/Event-Kette sitzt.

---

## 7. Offene Punkte (André / Anwalt)

**Anwaltlich abzusichern, bevor das Modul live geht:**
1. **DPIA** für das Screen-Recording-/Replay-Tier (Art. 35) — die bestehende Interview-DPIA als Vorlage erweitern.
2. **Consent-Text** (DE/EN), der §25 TDDDG **und** DSGVO sauber bündelt, mit allen nachgelagerten Zwecken (DSK Rz. 29).
3. **AVV-Addendum** für Recording/Events + aktualisierte **Sub-Prozessor-Liste**; **Anthropic-Transfer** (Screen-Frames/Transkripte) via EU-Endpoint oder SCC/DPF klären.
4. **Rollen** (Verantwortlicher/Auftragsverarbeiter, ggf. gemeinsam für die Consent-Schicht) vertraglich fixieren.
5. Die **„bis 300.000 €"-TDDDG-Bußgeldzahl** verifizieren (Recherche konnte sie nicht an einer Primärnorm bestätigen).

**Beobachten / vor Launch prüfen:**
6. **Digital Omnibus** im Amtsblatt (Hochrisiko-Verschiebung + Art.-50(2)-Karenz bis 2. Dez 2026) — Stand Recherche noch nicht final.
7. **Finale CNIL-Session-Replay-Empfehlung** (Konsultation endete 22. Apr 2026) — Masking/Sampling/Retention-Defaults daran ausrichten.
8. **Art.-50(2)-Voice-Markierung** mit dem TTS-/LiveKit-Anbieter (C2PA/Watermark) klären, Deadline 2. Aug 2026.

**Entscheidungen von André beim Bau:**
9. Usability = eigener `study_type` oder Use-Case (Empfehlung: Use-Case, 4.1).
10. Event-Tier vs. Voll-Replay als v1-Scope (Empfehlung: Event-Tier zuerst — minimierungs- und DPIA-freundlicher).

---

## 8. Verifikations-Protokoll (was gegengeprüft wurde)

| Behauptung | Verdikt | Kernaussage |
|---|---|---|
| Emotions-Verbot Art. 5(1)(f) gilt nur Arbeit/Bildung; Research-Teilnehmer raus | **bestätigt** | korrekt; Einwilligung heilt Art. 5 nicht; „Arbeit" breit gelesen; Stimme IST biometrisch; Art. 50(3) bleibt generell |
| AI-Act-Zeitschiene & Omnibus | **nuanciert** | Hochrisiko **verschoben** (Annex III → 2. Dez 2027, Annex I → 2. Aug 2028); Art. 50 **bleibt 2. Aug 2026**; noch nicht im OJ |
| Usability-Analyse NICHT Hochrisiko (Annex III) | **nuanciert/bestätigt** | korrekt, solange keine biometrischen Daten; Kategorien 1(a–c), 3, 4 meiden |
| §25 TDDDG: Vorab-Consent unabhängig von DSGVO; Usability fällt nicht unter „erforderlich" | **bestätigt** | hohe Konfidenz; DSK OH Digitale Dienste v1.2 + EDPB 2/2023 + BGH Planet49 |
| DSGVO: Einwilligung statt berechtigtes Interesse; DPIA wahrscheinlich Pflicht | **nuanciert** | „wahrscheinlich" ist die korrekte Formulierung (risikobasiert, kein automatischer Art.-35(3)-Fall) |
| Garante-Durchsetzung gegen Hotjar/Session-Replay | **WIDERLEGT** | kein verifizierbarer Fall — Halluzination; realer Präzedenz = Garante GA-Bann (Caffeina, 2022) + Cookie-Leitlinien 2021 |

---

## 9. Anhang

### 9.1 Code-Belege (für den späteren Bau)
- **Stimulus (A):** [stimulus-analysis.ts](src/lib/research/stimulus-analysis.ts), [stimulus/route.ts](src/app/api/research/plans/[id]/stimulus/route.ts), [plans-service.ts](src/lib/research/plans-service.ts), [interviewer.ts](src/lib/voice-agent/interviewer.ts) · Migration `20260703000007`
- **Bildschirm-Stichprobe (B):** [InterviewChat.tsx](src/components/interview/InterviewChat.tsx), [vision.ts](src/lib/visual-intelligence/vision.ts), [visual-capture/route.ts](src/app/api/interview/[token]/visual-capture/route.ts), [transcript-service.ts](src/lib/research/transcript-service.ts) · Migrationen `20260703000000`, `20260703000001`
- **Synthese-Hook:** [engine.ts](src/lib/synthesis/engine.ts), [synthesis/prompts.ts](src/lib/synthesis/prompts.ts), [signals.ts](src/lib/synthesis/signals.ts) (E4-Muster), [product-discovery/prompts.ts](src/lib/product-discovery/prompts.ts) · Migrationen `20260609000000`, `20260617000000`
- **Setup:** [ResearchPlanForm.tsx](src/components/dashboard/ResearchPlanForm.tsx) · Migrationen `20260611000000`, `20260630000000` (study_type), `20260721000000` (interview_depth = Vorlage)
- **Consent/DSGVO-Fundament:** [session-service.ts](src/lib/voice-agent/session-service.ts), [consent/route.ts](src/app/api/interview/[token]/consent/route.ts), [withdraw/route.ts](src/app/api/interview/[token]/withdraw/route.ts), [cron/retention/route.ts](src/app/api/cron/retention/route.ts) · Migrationen `20260704000001`, `20260711000000`, `20260709000000`, `20260708000000`
- **AI-Act-Anker:** [turn-signals.ts](src/lib/research/turn-signals.ts) (`RECHTSANKER`), [vision.ts](src/lib/visual-intelligence/vision.ts), [docs/findr-dpia-ki-interviews.md](docs/findr-dpia-ki-interviews.md), [docs/findr-e0-aup-klausel-entwurf.md](docs/findr-e0-aup-klausel-entwurf.md), [use-case-template.tsx](src/components/marketing/use-case-template.tsx)

### 9.2 Rechtsquellen (Primär & Regulator)
- **EU AI Act:** Verordnung (EU) 2024/1689 — Art. 3(34)/(39), 5(1)(f), 6(2)/(3), 25, 50, 53/55, Annex III; Recital 18 · Commission Guidelines on Prohibited AI Practices C(2025) 5052 (Feb 2025) · Implementation-Timeline + Digital Omnibus (EP-Zustimmung 16.06.2026)
- **DSGVO:** Art. 5, 6, 7, 9, 17, 28, 35; EDPB Guidelines 05/2020 (Consent), WP248 (DPIA-Kriterien)
- **ePrivacy/TDDDG:** §25 TDDDG (ex-TTDSG, umbenannt 14.05.2024) · DSK „Orientierungshilfe für Anbieter digitaler Dienste" v1.2 (Nov 2024) · EDPB Guidelines 2/2023 (technischer Anwendungsbereich Art. 5(3) ePD) · BGH Planet49 II (I ZR 7/16) · CJEU Planet49 (C-673/17)
- **Regulator/Präzedenz:** CNIL Session-Replay-Empfehlung (Entwurf, Konsultation bis 22.04.2026) · Garante Cookie-Leitlinien (Provv. 231/2021) + GA-Bann Caffeina (23.06.2022) · Microsoft Clarity Consent-Mandat (31.10.2025) · EU-US DPF / Latombe (General Court 03.09.2025, Berufung C-703/25 P)

> *Vollständige URL-Liste der recherchierten Quellen liegt im Workflow-Output dieser Recherche-Session.*
