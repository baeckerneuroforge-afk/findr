# Klymeo · UX Research — Empfohlene Antworten auf die 12 Blocker-Spec-Fragen (Entwurf)

**Stand:** 23. Juni 2026. **Bezug:** [Spec-Discovery](docs/klymeo-ux-research-spec-discovery-2026-06-22.md) · [Integrationsplan](docs/klymeo-ux-research-integration-plan-2026-06-22.md).
**Zweck:** Vorbefüllte Empfehlungen — du **bestätigst oder lenkst um**, statt aus dem Nichts zu antworten. Sobald diese 12 stehen, kann ich den v1-Spec finalisieren und Phase 2b/3 bauen.

> **Nur eine Frage braucht echt deinen Input (Q1).** Bei den übrigen 11 reicht „passt" oder „nein, anders weil …". Antworte gern per Nummer.

---

### Q1 🔒⭐ — Erster zahlender Anwendungsfall: was genau will der messen?
**Status: braucht DICH — Geschäftswissen, kann ich nicht für dich erfinden.**
Um nicht zu blockieren, hier die 3 plausiblen Formen und was jede für v1 festlegt — wähle/skizziere eine:
- **(a) Eigener Figma-Prototyp** („Findet der Nutzer X im Klickdummy?") → First-Party-iFrame, Auto-Erfolg messbar, Event-Tier reicht.
- **(b) Echte Live-Seite/Web-App** („Schaffen Nutzer Aufgabe X auf unserer Seite?") → entweder gehostet einbetten (wenn möglich) oder Screen-Sampling (schwächer, kein Klickpfad).
- **(c) Reines Verständnis/Discovery am Mockup** (kein Klick-Messen, nur Reaktion) → bereits durch Phase 1 (Stimulus + Task-Briefing) abgedeckt, ohne Phase 2b nötig.
**Wenn unklar:** Default **(a)** — der saubere, vollständig messbare Fall.

### Q2 🔒 — Erfassungs-Tiefe in v1?
**Empfehlung: nur Event-Tier** (semantische Interaktionsmetriken: Klick/Scroll/Dwell/Time-on-Task/Erfolg). Voll-Replay + Screen-Sampling als spätere, separat eingewilligte Tiers. → minimierungs-/DPIA-freundlicher, schneller live.

### Q3 🔒⭐ — Prototyp-Quelle?
**Empfehlung: First-Party-iFrame als Primärweg** (Klymeo kontrolliert das DOM → Auto-Erfolgsmessung + erzwingbare Maskierung + EU-only). Hängt an Q1 — wenn der erste Kunde nur eine echte Live-Seite hat, fällt v1 auf Screen-Sampling zurück (ehrlich schwächer).

### Q8 🔒 — Erfolg menschlich beurteilt oder automatisch erkannt?
**Empfehlung: automatisch erkannt, wo First-Party** (Ziel-URL/Selektor erreicht = Erfolg); sonst **menschlich beurteilt** und ehrlich als „beobachtet" gelabelt (keine „Messung"). Spiegelt Q3.

### Q12 🔒 — Welche Metriken in v1?
**Empfehlung: Erfolg/Misserfolg + Time-on-Task + Klick-Anzahl + Reibungs-Counts** (Rage-Clicks, Backtracks, langes Dwell-vor-Klick). **Klickpfad-Visualisierung + Heatmaps später** (brauchen mehr Daten + UI). Rote Linie: Reibung verhaltensbezogen, **keine Affekt-Labels**.

### Q21 🔒 — Consent-Datenmodell: 3 Spalten oder JSONB?
**Bereits entschieden & gebaut: 3 Spalten** (`events/replay/screen_consent_at` + `instrumentation_consent_version`) — in Phase 2a umgesetzt (Branch `claude/consent-phase2a`). Nutzt das bewährte `WHERE IS NULL`-Idempotenz-Muster. → **Bestätigen reicht.**

### Q22 🔒 — Wer schreibt/prüft Consent-Text + DPIA, bis wann?
**Empfehlung: Anwalt + du.** Ich liefere das **Gerüst** (separater Entwurf, s. DPIA/Consent-Doc); der Text muss alle Zwecke nennen (DSK Rz. 29), dann `CONSENT_TEXT_VERSION` bumpen. **Vor jedem echten Go-Live** (Phase-0-Gate).

### Q23 🔒 — Retention-Defaults?
**Empfehlung:** Events **Tage–wenige Wochen** (`event_retention_days`), Replay **kürzer**, Cap **90 Tage** (`replay_retention_days`); abgeleitete maskierte Befunde leben länger (im Synthese-Text). Auto-Hard-Delete via Retention-Cron.

### Q24 🔒 — Figma-Embed in v1?
**Empfehlung: nein in v1.** First-Party-iFrame + echte URL decken den Bedarf. Figma = Dritt-Akteur (eigene Cookies/Storage = §25-Akteur + Kapitel-V-Transfer) → nur mit dokumentiertem Sub-Prozessor + Consent-Nennung, also später.

### Q25 🔒⭐ — Friction + bestehendes Text-Affekt (turn-signals) gleichzeitig?
**Empfehlung: pro Studie EXKLUSIV** (entweder Turn-Signals **oder** Usability-Friction) — bis anwaltlich freigegeben, dass die Fusion das Kombiprodukt nicht in Annex III kippt. Strukturell sicherer; die Freigabe ist die eine echte Haftungssache.

### Q26 🔒 — Screen-Sampling-Tier in v1 zulassen?
**Empfehlung: in v1 ausschließen**, bis Anthropic-EU-Routing/AVV für Bildinhalte bestätigt ist (Frames → Vision = Kapitel-V-Transfer möglicher Art.-9-Daten, nicht maskierbar). First-Party-Instrumentierung deckt den Kern. *(Hinweis: Phase 2a hat die bestehende visual-capture-Route bereits fail-closed gemacht — das ist Härtung, kein neuer Tier.)*

### Q36 🔒 — Erst bei zahlendem Kunden bauen?
**Empfehlung: nachfrage-getrieben** (wie Roadmap). **Phase 1** (Task + First-Party-Prototyp, ohne Capture) kann als ehrliche Demo proaktiv vorgebaut werden — ist bereits gebaut.

---

## Wenn du diese als Default bestätigst, ergibt sich für v1
- **Scope:** Usability als `use_case` (Phase 1 ✅), **Event-Tier** Capture (Phase 2b, zu bauen), **First-Party-Prototyp**, **kein** Replay/Screen-Sampling/Figma in v1.
- **Metriken:** Erfolg · Time-on-Task · Klicks · Reibung (verhaltensbezogen).
- **Consent:** 3-Tier-Modell (Phase 2a ✅), `events`-Tier aktiv für v1.
- **Gates für Go-Live:** Q1 (dein Anwendungsfall), Phase-0-Recht (Consent-Text + DPIA), Python-Voice-Agent-Kompat, Q25-Freigabe.

**Offene Bau-Reihenfolge nach deiner Bestätigung:** Phase 2b (Event-Collector + `research_session_events` + `/events` + `task_result`, alles am `events`-Tier-Consent fail-closed) → Phase 3 (Synthese-Interaktionsmetriken; Replay nur falls du Q2 hochstufst).
