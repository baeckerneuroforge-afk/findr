# Klymeo · UX Research — DPIA-Delta + gebündelter Consent-Text (ENTWURF)

> **ENTWURF · KEIN RECHTSRAT.** Diese Vorlage strukturiert die Phase-0-Rechtsarbeit für das Usability-/Capture-Modul, damit der Anwalt nicht bei null anfängt. Alle `{{ … }}`-Marker sind **anwaltliche Entscheidungen**. Baut auf der bestehenden Kurz-DPIA [docs/findr-dpia-ki-interviews.md](docs/findr-dpia-ki-interviews.md) und dem [Integrationsplan](docs/klymeo-ux-research-integration-plan-2026-06-22.md) (§3 Recht) auf.
>
> **Stand:** 23. Juni 2026. **Geltung:** erst wenn das Capture-Modul (Phase 2b/3) live geht — bis dahin wird nichts davon erfasst.

---

## Teil A — DPIA-Delta (Erweiterung der bestehenden KI-Interview-DPIA)

### A1 · Neue Verarbeitungstätigkeiten
| Tier | Was erfasst wird | Default | Schicht-Status |
|---|---|---|---|
| **Interaktions-Events** | semantische Events: Klick auf Ziel, Scroll-Tiefe, Dwell, Time-on-Task, Task-Erfolg/-Abbruch | OFF (`event_tracking_enabled`) | zu bauen (Phase 2b) |
| **Session-Replay** | rrweb-DOM-/Event-Stream des First-Party-Prototyps (maskiert) | OFF (`replay_capture_enabled`) | zu bauen (Phase 3, optional) |
| **Screen-Sampling** | Standbilder (getDisplayMedia) → Claude-Vision-Textnotizen | OFF (`visual_capture_enabled`) | existiert; Phase 2a jetzt **fail-closed** |

### A2 · Rechtsgrundlagen (drei Schichten — alle drei nötig)
- **§25 TDDDG / ePrivacy Art. 5(3):** vorherige Einwilligung für den **Geräte-Zugriff** (Skript/rrweb/getDisplayMedia), **unabhängig** von der DSGVO. Umgesetzt: per-Tier-Stempel + fail-closed-Gate (`assertCaptureConsent`).
- **DSGVO Art. 6(1)(a):** Einwilligung als Rechtsgrundlage der **Verarbeitung**. Kein berechtigtes Interesse.
- **EU AI Act:** Art. 50(1) KI-Offenlegung (vorhanden); **rote Linie**: keine biometrische Affekt-Erkennung → reine Verhaltens-Friction.

### A3 · DPIA-Erforderlichkeit (WP248-Kriterien)
Erfüllt **systematische Verhaltensüberwachung** + **innovative Technik (KI/Vision)** + **Bewertung/Scoring** (Task-Erfolg/Friction), ggf. **inzidentelle Sonderkategorien** (Replay/Screen). → **DPIA sehr wahrscheinlich Pflicht.**
- `{{ Anwalt: DPIA formell erforderlich? Konsultation der Aufsicht nach Art. 36 nötig (nur bei verbleibendem hohem Restrisiko)? }}`

### A4 · Risiken (Fortsetzung der bestehenden R1–R7 → R8–R13) + Mitigation (Ist-Stand)
| # | Risiko | Mitigation (gebaut / geplant) | Restrisiko |
|---|---|---|---|
| R8 | §25-Verstoß: Capture vor Einwilligung | **fail-closed** per-Tier-Consent + `assertCaptureConsent` (Phase 2a ✅) | gering |
| R9 | Inzidentelle Art.-9-Daten in Replay/Screen | allow-list-Masking **bei Erfassung** (Passwort/Zahlung blocken); Screen-Tier in v1 **ausgeschlossen** (Q26) | `{{ Anwalt: Masking-Standard ausreichend? }}` |
| R10 | US-Transfer: Screen-Frames → Anthropic-Vision (Kapitel V) | Screen-Tier v1 OFF; Event-Tier verlässt EU nicht | `{{ Anwalt: Anthropic-Transfermechanismus (EU-Endpoint / SCC / DPF) für Bildinhalte? }}` |
| R11 | Affekt-Drift (Annex III 1(c)) | strukturell: **kein Affekt-Feld** in Schemas, `.strict()`, Eval-Deny-List, RECHTSANKER | `{{ Anwalt: Fusion Friction + bestehendes Text-Affekt (turn-signals) auf denselben Sessions — kippt das in Hochrisiko? → Q25 }}` |
| R12 | Orphan-Storage bei Org-Löschung (Art. 17) | Storage-Wipe **fail-closed** vor DB-Delete (Branch `org-storage-wipe` ✅) | gering |
| R13 | Über-Retention | kurze Fristen + Auto-Hard-Delete (Cron), per-Session-Löschung, Widerruf | `{{ Anwalt: konkrete Fristen — Vorschlag: Events Tage–Wochen, Replay ≤90 Tage }}` |

### A5 · Sub-Prozessoren / Transfer (zu ergänzen in der DSE-Prozessor-Liste)
Anthropic (Synthese + ggf. Vision), Supabase (Frankfurt), Hetzner (DE). `{{ Anwalt: AVV-Addendum je Capture-Tier; Anthropic-Bildinhalte-Transfer; ggf. rrweb/Replay-Vendor — falls je nicht First-Party. }}`

---

## Teil B — Gebündelter §25-TDDDG + DSGVO-Consent-Text (ENTWURF, granular pro Tier)

> **Anforderung (DSK Rz. 29):** EIN Opt-in deckt §25 (Geräte-Zugriff) **und** DSGVO (Verarbeitung) nur, wenn der Text **alle nachgelagerten Zwecke** nennt. Granular: getrennte Schalter pro Tier; Teilnahme darf **nie** den invasivsten Tier voraussetzen. Server stempelt `<tier>_consent_at` + `instrumentation_consent_version`. **Bump `CONSENT_TEXT_VERSION`, sobald der finale Text steht.**

### B1 · Interaktions-Events (Default-Tier)
**DE (Entwurf):**
> „Damit wir verstehen, wie du diese Aufgabe löst, zeichnet Klymeo deine **Interaktionen** mit dem Prototyp auf — also **wo du klickst, scrollst und wie lange du wofür brauchst**. Diese Daten werden auf EU-Servern gespeichert und **automatisiert von einem KI-Modell (Anthropic Claude) ausgewertet**, um Hürden im Ablauf zu erkennen. Es werden **keine** Gefühls- oder Persönlichkeitsbewertungen vorgenommen. Speicherung: {{ Frist, z. B. „bis zu 30 Tage" }}. Deine Teilnahme ist freiwillig und du kannst die Aufzeichnung jederzeit beenden und widerrufen. [☐ Ich stimme der Aufzeichnung meiner Interaktionen zu.]"

**EN (draft):**
> „To understand how you complete this task, Klymeo records your **interactions** with the prototype — **where you click, scroll, and how long things take**. This data is stored on EU servers and **analysed automatically by an AI model (Anthropic Claude)** to spot friction in the flow. **No** emotion or personality assessment is made. Retention: {{ period }}. Participation is voluntary; you can stop and withdraw at any time. [☐ I consent to the recording of my interactions.]"

### B2 · Visuelles Session-Replay (Premium-Tier, separater Schalter)
**DE (Entwurf):** „Zusätzlich kann Klymeo eine **Wiedergabe deiner Sitzung** im Prototyp aufzeichnen (Bewegungen auf der Oberfläche). **Eingaben in Felder werden dabei automatisch ausgeblendet** (Passwörter/Zahlungsdaten geblockt). Speicherung: {{ Frist, kürzer }}. [☐ Ich stimme der Sitzungs-Wiedergabe zu.]" `{{ Anwalt: Masking-Zusicherung final formulieren }}`

### B3 · Bildschirmfreigabe (Screen-Sampling — in v1 NICHT angeboten)
*Nur wenn Q26 später „ja": Text muss zusätzlich warnen, **nur den Prototyp-Tab** zu teilen, und den Anthropic-Vision-Transfer nennen.* `{{ Anwalt: gesonderter Hinweis + Transfer-Offenlegung }}`

### B4 · Widerruf (alle Tiers)
„Du kannst jede Zustimmung **so einfach widerrufen, wie du sie gegeben hast** — über den Button ‚Aufnahme stoppen/widerrufen' während der Sitzung. Ein Widerruf stoppt die Erfassung und löscht die betroffenen Daten." (DSK Rz. 61–62 / Art. 7(3).)

---

## Teil C — Go-Live-Checkliste (alles abhaken, bevor ein Capture-Flag in Prod an geht)
- [ ] DPIA (Teil A) anwaltlich finalisiert; `{{ }}`-Marker entschieden.
- [ ] Consent-Text (Teil B) DE/EN anwaltlich freigegeben → `CONSENT_TEXT_VERSION` gebumpt.
- [ ] AVV-Addendum + Sub-Prozessor-Liste aktualisiert (Anthropic-Transfer geklärt).
- [ ] Annex-III-Fusions-Freigabe (Q25) oder Studien-Exklusivität aktiv.
- [ ] **Python-Voice-Agent verträgt die neuen `interview_sessions`-Spalten** (separater Check; Migration sonst nicht anwenden).
- [ ] Retention-Fristen gesetzt (`event_retention_days`, `replay_retention_days`).
- [ ] Gekoppelter Rollout: Migration + Client-Stamp + Route-Check **zusammen**.

> Sobald Teil A/B anwaltlich steht, kann ich die finalen i18n-Consent-Keys + den `CONSENT_TEXT_VERSION`-Bump als Code-Change nachziehen (in eigenem Worktree, Gates grün).
