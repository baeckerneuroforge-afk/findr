# Klymeo · UX Research / Usability-Testing — Spec-Discovery-Fragen

**Stand:** 22. Juni 2026. **Baut auf:** [Integrationsplan](docs/klymeo-ux-research-integration-plan-2026-06-22.md) + [Compliance-Plan](docs/klymeo-ux-research-dsgvo-ai-act-plan-2026-06-22.md).
**Zweck:** Die offenen Entscheidungen aus dem Plan als Interview-Fragen, an denen entlang wir die v1-Spec schreiben. Jede Frage füllt einen Spec-Abschnitt.

## So nutzen wir das
- **Jede Frage hat einen Vorschlag/Default aus dem Plan** — du kannst meist nur „passt" oder „nein, anders weil …" sagen.
- 🔒 = **blockierend** (ohne das kann ich die Spec nicht schreiben). ⭐ = **hoher Hebel** (kollabiert viele Folgefragen).
- **Minimal-Set zum Loslegen:** Beantworte nur die 🔒-Fragen (Q1, Q2, Q3, Q8, Q12, Q21–Q26, Q36) — daraus ziehe ich einen v1-Spec-Entwurf, den Rest verfeinern wir daran.
- Antworte gern per Nummer.

---

## 1 · Nordstern & Scope
*Füllt: Spec §1 „Ziel & Abgrenzung v1"*

**Q1 🔒⭐ — Wer ist der erste (zahlende) Anwendungsfall, und was genau will der messen?**
*Warum:* Der Bau-Auslöser laut Roadmap ist „ein zahlender Kunde verlangt es konkret". Diese eine Antwort kollabiert die halbe Spec (Tiefe, Prototyp-Quelle, Metriken).
*Vorschlag:* Ein konkreter Pilot-Kunde mit einer echten Aufgabe (z. B. „Findet der Nutzer den Checkout in unserem Figma-Prototyp?").
*Legt fest:* den ganzen v1-Zuschnitt.

**Q2 🔒 — Welche Erfassungs-Tiefe in v1?**
*Warum:* Drei Tiers, drei Aufwands- und Rechtsstufen.
*Vorschlag:* **Nur Event-Tier** (semantische Interaktionsmetriken: Klick/Scroll/Dwell/Time-on-Task/Erfolg). Voll-Replay und Screen-Sampling als spätere, separat eingewilligte Tiers — minimierungs- und DPIA-freundlicher.
*Legt fest:* §3 (welche Tiers gebaut werden), Phasen.

**Q3 🔒⭐ — Welche Prototyp-Quelle braucht der erste Kunde?**
*Warum:* Entscheidet den Cross-Origin-Weg, ob Erfolg *automatisch* messbar ist, und die Figma-Rechtsfrage.
*Optionen:* (a) Klymeo-gehostet / First-Party-iFrame → volle Instrumentierung + Auto-Messung; (b) echte Live-Seite → nur Screen-Sampling, keine DOM-Messung; (c) Figma-Embed → Dritt-Akteur (§ Recht).
*Vorschlag:* (a) als Primärweg.
*Legt fest:* §4, Q8, Q24.

**Q4 — Moderiert oder unmoderiert?**
*Warum:* Klymeo ist interview-first.
*Vorschlag:* Aufgabe **in den Interview-Flow eingebettet** (KI fragt vorher/nachher nach), Debrief im Anschluss — kein stilles Solo-Tool.
*Legt fest:* §Teilnehmer-Erlebnis, Interviewer-Prompt.

**Q5 — Desktop-only in v1 ok, oder Mobile-Usability nötig?**
*Vorschlag:* Desktop-only (wie das heutige Screen-Sampling); Mobile additiv später.
*Legt fest:* Instrumentierungs-Scope, Geräte-Gate.

**Q6 — Voice-Interviews auch, oder Text-only für v1?**
*Warum:* Instrumentierung ist visuell; Voice + Bildschirm ist umständlich.
*Vorschlag:* **Text-only** für die Usability-Tasks in v1.
*Legt fest:* Welche Interview-Modi den Task-Pfad bekommen.

**Q7 — Eine Aufgabe pro Studie in v1 ok?**
*Vorschlag:* Ja, 1:1 (`task_definition` als Objekt). Multi-Task additiv später.
*Legt fest:* L1/Datenmodell.

---

## 2 · Task-Modell
*Füllt: Spec §2 „Was ist eine Aufgabe"*

**Q8 🔒 — Wie wird „Erfolg" bestimmt: menschlich beurteilt oder automatisch erkannt?**
*Warum:* Größte technische Weiche. Auto-Erkennung (Ziel-URL/Selektor erreicht) braucht einen instrumentierbaren First-Party-Prototyp; menschliche Beurteilung (Forscher markiert) geht für jeden Prototyp, ist aber **keine „Messung"** (Ehrlichkeits-Leitplanke).
*Vorschlag:* Auto-Erkennung wo First-Party möglich; sonst menschlich + ehrlich als „beobachtet" labeln.
*Legt fest:* §2, §3 (computeTaskResult), Marketing-Claim.

**Q9 — Welche Felder braucht eine Aufgabe über Instruktion + Erfolgskriterium + Prototyp-URL hinaus?**
*Optionen:* erwartete Dauer, optionaler Hinweis, „Aufgeben erlaubt", max. Versuche.
*Vorschlag:* v1 schlank: Instruktion + Erfolgskriterium + URL + „Aufgeben erlaubt" (bool).
*Legt fest:* `task_definition`-Shape.

**Q10 — Wann sieht der Proband die Aufgabe: vor, während oder als eigene Phase neben den Interview-Themen?**
*Vorschlag:* Eigene Task-Phase nach der Begrüßung/Offenlegung, vor dem qualitativen Debrief.
*Legt fest:* Teilnehmer-Flow, Interviewer-Prompt.

**Q11 — Darf der Proband abbrechen, und zählt „Aufgeben" als Misserfolg?**
*Vorschlag:* Ja, „Aufgeben"-Button; zählt als Misserfolg, aber separat ausgewiesen.
*Legt fest:* Erfolgs-/Friction-Definition.

---

## 3 · Messung & Metriken
*Füllt: Spec §3 „Metriken & Reibung"*

**Q12 🔒 — Welche Metriken in v1?**
*Optionen:* Erfolg/Misserfolg · Time-on-Task · Klick-Anzahl · Klickpfad · Reibung · Heatmaps.
*Vorschlag:* **Erfolg + Time-on-Task + Klick-Anzahl + Reibungs-Counts** in v1; Klickpfad-Visualisierung und Heatmaps später (brauchen mehr Daten + UI).
*Legt fest:* `task_result`/`interaction_summary`-Shape, Synthese-Block.

**Q13 — Was zählt operativ als „Reibung", und welche Schwellen?**
*Optionen:* Rage-Clicks (N Klicks in T ms), Backtracks, Dwell-vor-Klick (> X s), Dead-Clicks, Fehler-Events.
*Vorschlag:* Rage-Clicks + Backtracks + langes Dwell-vor-Klick in v1; Schwellen konfigurierbar mit Defaults.
*Legt fest:* `computeTaskResult`-Logik, `RECHTSANKER` (rein verhaltensbasiert).

**Q14 — Time-on-Task: von wann bis wann?**
*Vorschlag:* Von „Aufgabe angezeigt" bis „Erfolg erkannt / Aufgeben". Server-`created_at` ist die autoritative Uhr (nicht Client-`ts_ms`).
*Legt fest:* Metrik-Definition.

**Q15 — Min-N für aggregierte Synthese: Default 3 — passt?**
*Vorschlag:* 3 (wie Turn-Signals/Stimulus), darunter ehrliches „noch zu wenige Sessions".
*Legt fest:* `MIN_INTERACTION_AGGREGATE_SESSIONS`.

**Q16 — Brauchen wir Soll-/Benchmark-Werte (z. B. „Aufgabe sollte < 30 s") oder nur Ist-Beschreibung?**
*Vorschlag:* v1 nur Ist; optionales Soll pro Aufgabe additiv später.
*Legt fest:* ob `task_definition` ein Ziel-Feld bekommt.

---

## 4 · Teilnehmer-Erlebnis
*Füllt: Spec §4 „Participant Flow"*

**Q17 ⭐ — Layout: Prototyp im iFrame neben dem Chat (Split-View wie Stimulus) oder Vollbild-Aufgabe, dann zurück zum Chat?**
*Vorschlag:* Split-View (`PrototypeSurface` neben dem Chat) für First-Party; Vollbild nur beim Screen-Sampling.
*Legt fest:* `PrototypeSurface`, UI.

**Q18 — Was passiert, wenn der Proband den Event-Tier ablehnt?**
*Vorschlag:* Aufgabe läuft **un-instrumentiert** weiter (rein qualitative Reaktion), Studie bleibt gültig. Teilnahme erfordert nie den invasivsten Tier.
*Legt fest:* Granularitäts-Regel, Fail-closed-Verhalten.

**Q19 — „Aufnahme stoppen / widerrufen"-Button: Platzierung + Wirkung?**
*Vorschlag:* Persistent in der `PrototypeSurface`; stoppt Collector sofort (Client) + löscht via `/withdraw` (Server).
*Legt fest:* Art. 7(3)-Umsetzung.

**Q20 — Woher kommen die Probanden (Prolific/Panel vs BYO)?**
*Warum:* Relevant für die AI-Act-rote-Linie: Probanden dürfen kein „Arbeitsplatz/Bildung"-Kontext sein.
*Vorschlag:* Externe rekrutierte Probanden (BYO/Panel), nicht Mitarbeiter des Kunden.
*Legt fest:* AUP-Klausel, DPIA-Begründung.

---

## 5 · Consent & Recht *(die tragende Schicht)*
*Füllt: Spec §5 „Drei-Schichten-Consent"*

**Q21 🔒 — Consent-Datenmodell: drei Spalten (empfohlen) oder JSONB?**
*Vorschlag:* **Drei Spalten** `*_consent_at` (bewährte `WHERE IS NULL`-Idempotenz). JSONB nur, wenn du atomaren Multi-Write klar bevorzugst.
*Legt fest:* L4, alle Migrationen.

**Q22 🔒 — Wer schreibt/prüft den gebündelten §25+DSGVO-Consent-Text + die DPIA, und bis wann?**
*Warum:* Phase-0-Gate — kein Tier-Toggle in Prod ohne anwaltlich geprüften Text.
*Vorschlag:* Anwalt + du; Text muss alle Zwecke nennen (inkl. „fließt in KI-Synthese", DSK Rz. 29).
*Legt fest:* Release-Gate, `CONSENT_TEXT_VERSION`-Bump.

**Q23 🔒 — Retention-Defaults: `event_retention_days` und `replay_retention_days` — welche Zahlen?**
*Vorschlag:* Events Tage–wenige Wochen; Replay kürzer (Cap 90); abgeleitete maskierte Befunde leben länger (im Synthese-Text).
*Legt fest:* Retention-Cron, DPIA.

**Q24 🔒 — Figma-Embed in v1: nein oder ja-mit-Hard-Gate?**
*Vorschlag:* **Nein in v1** (First-Party + echte URL decken den Bedarf). Ja nur, wenn Figma-Sub-Prozessor + Kapitel-V-Transfer dokumentiert sind und der Consent-Text Figma nennt.
*Legt fest:* §4, `prototypeHosting`-Enum, Sub-Prozessor-Liste.

**Q25 🔒⭐ — Annex-III-Fusion: Friction + bestehendes Text-Affekt (turn-signals) gleichzeitig?**
*Warum:* Beide laufen auf denselben Sessions; der Compliance-Kritiker warnt, dass die Fusion die Hochrisiko-Argumentation verstärken könnte.
*Optionen:* (a) beides erlauben (anwaltliche Freigabe einholen); (b) pro Studie **exklusiv** (entweder Signals **oder** Usability) — strukturell sicherer.
*Vorschlag:* (b) für v1, bis (a) anwaltlich freigegeben.
*Legt fest:* Studien-Gating, AI-Act-Risikoposition.

**Q26 🔒 — Screen-Sampling-Tier in v1 zulassen?**
*Warum:* Frames gehen an Anthropics Vision-Modell = Kapitel-V-Transfer möglicher Art.-9-Daten; rohe Frames sind nicht maskierbar.
*Vorschlag:* **In v1 ausschließen**, bis Anthropic-EU-Routing/AVV für Bildinhalte bestätigt ist; First-Party-Instrumentierung deckt den Kern.
*Legt fest:* ob der Screen-Tier gebaut wird; DPIA.

**Q27 — Granularität bestätigen: Teilnahme erfordert nie den invasivsten Tier — ok?**
*Vorschlag:* Ja (DSGVO-Anforderung).
*Legt fest:* Consent-UI-Logik.

---

## 6 · Replay & Speicher
*Füllt: Spec §6 „Replay-Tier"*

**Q28 — Ist Session-Replay überhaupt in v1, oder verschoben?**
*Vorschlag:* **Verschoben** (Premium-Tier, separater Consent); v1 lebt vom Event-Tier.
*Legt fest:* ob §7 in v1 gebaut wird.

**Q29 — rrweb-Event-Stream vs Video?**
*Vorschlag:* **rrweb** (kompakt, maskierbar, EU-Bucket).
*Legt fest:* `replay_kind`, Bucket-MIME.

**Q30 — Wer darf Replays sehen, und ist Teilen/Export erlaubt?**
*Vorschlag:* Nur org-interne Forscher (RLS), kein öffentliches Teilen in v1.
*Legt fest:* Viewer-Auth, Share-Scope.

**Q31 — Speicher-Budget-Toleranz / TTL-Cap?**
*Vorschlag:* Cap 90 Tage; rohe Replays Tage–Wochen. (Kostenmodell: ~Cents/Monat bei MVP-Volumen.)
*Legt fest:* `replay_retention_days`-Defaults.

---

## 7 · Synthese & Ausgabe
*Füllt: Spec §7 „Auswertung & Report"*

**Q32 ⭐ — Wie erscheinen die Interaktionsmetriken im Report?**
*Optionen:* eigener Abschnitt · Pro-Task-Aufschlüsselung · verwoben mit den qualitativen Themen.
*Vorschlag:* Eigener „Usability-Befunde"-Abschnitt mit Pro-Task-Kennzahlen (server-berechnet) + gegroundete Prosa, getrennt von den qualitativen Themen.
*Legt fest:* `interaction_summary`/`interaction_observations`-Rendering.

**Q33 — Friction-nicht-Affekt-Sprachregel bestätigen?**
*Vorschlag:* Ja — „Reibung/Reibungssignal" erlaubt, „frustriert/verärgert" verboten (rote Linie, Eval-Gate).
*Legt fest:* Prompt-Regel, Deny-List.

**Q34 — Sollen Metriken in PDF/PPTX-Export und Share-View erscheinen?**
*Vorschlag:* Ja, derselbe server-berechnete Block; v1 ggf. nur Web-Ansicht, Export additiv.
*Legt fest:* Export-Pfade.

**Q35 — Sollen Usability-Befunde in die Persona-Synthese einfließen oder getrennt bleiben?**
*Vorschlag:* Getrennt in v1 (Personas bleiben qualitativ).
*Legt fest:* Synthese-Router.

---

## 8 · Rollout, Betrieb, Abhängigkeiten
*Füllt: Spec §8 „Lieferung & Risiken"*

**Q36 🔒 — Bau-Auslöser: wirklich erst bei zahlendem Kunden, oder dünnes v1 proaktiv für Demos?**
*Vorschlag:* Nachfrage-getrieben (wie Roadmap); ggf. Phase 1 (Task + First-Party-Prototyp, ohne Capture) als ehrliche Demo vorbauen.
*Legt fest:* Timing.

**Q37 — Phasen-Reihenfolge 0→1→2→3 bestätigen?**
*Vorschlag:* Ja (Recht → Task/Prototyp → Events/Store → Synthese/Replay).
*Legt fest:* Build-Plan.

**Q38 — Design-Partner / erste Dogfood-Studie?**
*Vorschlag:* Eine interne Test-Studie mit echtem Consent, bevor ein Kunde live geht.
*Legt fest:* Validierungsplan.

**Q39 — Voice-Agent-Repo (Hetzner): wer prüft, dass dessen `select('*')` die neuen Session-Spalten verträgt?**
*Vorschlag:* Vor Phase 2 verifizieren (Cross-Repo-Risiko).
*Legt fest:* Phase-2-Vorbedingung.

**Q40 — Rate-Limiting (noch uncommitted): blockierende Abhängigkeit für `/events`/`/replay`, oder parallel?**
*Vorschlag:* Parallel; `/events` reiht sich in die `participant`-Klasse ein, Replay-Upload braucht eigenes Quota.
*Legt fest:* Ingestion-Schutz.

**Q41 — Die zwei latenten Lücken (Storage-Wipe bei Org-Delete · serverseitiger Consent-Check in `/visual-capture`): jetzt separat fixen oder mit dem Modul bündeln?**
*Vorschlag:* Storage-Wipe zeitnah separat (betrifft schon heute); `/visual-capture`-Gate mit dem `assertCaptureConsent`-Helper in Phase 2 bündeln.
*Legt fest:* Reihenfolge, die zwei Task-Chips.

---

## Nächster Schritt
Beantworte mindestens die 🔒-Fragen (idealerweise auch die ⭐). Daraus schreibe ich einen **v1-Spec-Entwurf** (Ziel, Scope, Datenmodell, Consent-Flow, Metriken, Phasen, Akzeptanzkriterien), den wir dann verfeinern.
