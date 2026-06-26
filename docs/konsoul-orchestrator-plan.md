# Konsoul → Orchestrator & Research-Coach — Plan

> Entwurf 26.06.2026. Konsoul vom Cross-Study-Spezialisten zu einem **proaktiven
> Orchestrator/Coach** für ganz Klymeo ausbauen — **ohne** seinen Markenkern
> (geerdete Ehrlichkeit) zu verlieren. Planungsdokument, **kein** Code.
> Grundlage: 4-Agent-Recon am echten Code + 3-Agent-Design.

---

## 1. Ziel

Heute kann Konsoul genau eine Sache: studienübergreifende Fragen belegt beantworten.
Du willst, dass er **schlauer und zentraler** wird:

- **Allgemein fragbar** — auch „wie funktioniert X?", „wo mache ich Y?" (Hilfe/Onboarding).
- **Proaktiv** — analysiert deine bisherigen Studien und **gibt Tipps**, **findet Lücken**,
  **schlägt die nächste Studie vor** (basierend auf dem, was du schon gemacht hast).
- **Orchestrierend** — kann (nach Bestätigung) Dinge anstoßen: Studie als Entwurf anlegen,
  Synthese/Personas/Leitfaden auslösen, an die richtige Stelle navigieren.

**Nicht verhandelbar:** Konsouls Vertrauensmechanik bleibt. Er lächelt nur, wenn er belegen
kann; markiert Vermutungen amber; lehnt ehrlich ab. Das ist der Burggraben — nicht die Features.

## 2. Ist-Zustand — wie Konsoul heute funktioniert

Konsoul ist das Gesicht des **Cross-Study-Agenten** (jetzt „Frag Konsoul", `/dashboard/insights`).
Dahinter steckt eine durchdachte, sehr vertrauenswürdige Maschine:

**Der hand-gerollte Tool-Loop** (`engine.ts`, `STEP_BUDGET = 10`):
1. `list_studies` — dünner Index aller Org-Synthesen (Titel/Theme-Titel, KEINE Zitate).
2. `load_synthesis(studyId)` — lädt eine Synthese voll (erst dann darf zitiert werden).
3. `aggregate_theme_frequency(query)` — **reiner Code**, zählt Substring-Treffer über die
   geladenen Studien → exakte Zahl + beitragende Studien. Das Modell darf Zahlen NIE schätzen.
4. `emit_cross_study_answer` — erzwungener Final-Call, schema-validiert.

**Die Ehrlichkeits-Garantie** (3 Schichten, aus Mission-Control geerbt):
- **Per-Study-Anchor-Filter** — jedes Zitat `{studyId, quote}` wird per Substring NUR gegen
  die zitierte Studie geprüft; fremde Zitate fliegen raus. Fallen ALLE Zitate, kippt
  `answered=true → false` (ehrliche Ablehnung statt Halluzination).
- **`fold()`** — normalisiert Umlaute/Anführungszeichen/Whitespace; Schreib-Äquivalente passen,
  semantische NICHT (bewusst konservativ).
- **Deterministische Counts** — „in N Studien" kommt nur aus `aggregate_theme_frequency`, nie aus dem Modell.

**Drei Ausgabe-Arten** = Konsouls drei Gesichter: belegt (Zitate) / Interpretation
(amber, „nicht direkt belegt") / ehrliche Ablehnung (ruhig, nie rot).

**Sicherheit:** `requireOrgIdOrError()` (Zitadel) — `orgId` ist server-autoritativ, der Client
kann sie NIE setzen; alle Reads laufen org-scoped über `createOrgToolset(orgId)`. Frage/History
gekappt (max 20 Turns). Fail-closed: jeder Transport-/Schema-Fehler → 500, nie ungeerdeter Inhalt.
Modell: **Opus** (`claude-opus-4-8`), 1500 Tokens/Turn, SDK-Retries.

**Was es heute NICHT kann:** nur zählen/zitieren über Synthesen. Keine breiten Fragen, keine
Hilfe, keine Portfolio-Sicht, keine Aktionen, keine Proaktivität.

## 3. Leitprinzip: ein Gehirn, mehrere Türen

- **Ein Gehirn** — ein org-scoped Konsoul-Engine, das der Cross-Study-Loop als **ein Werkzeug** wird.
- **Mehrere Türen** — ⌘K („Frag Konsoul" von überall), `/insights` (der tiefe „Research-Raum"),
  proaktive Karten auf „Heute". Alle reden mit demselben Gehirn, nie mit einem zweiten Modell.
- **Ehrlichkeit strukturell erzwungen** — Zahlen deterministisch, Prosa nur um übergebene Zahlen
  herum, Aktionen bestätigungspflichtig. **Grüner Pip nur bei echtem Beleg** — eine Vermutung
  bekommt NIE das grüne ✓.

## 4. Die drei Erweiterungs-Dimensionen

### A) Orchestrator-Architektur
Konsoul wird ein allgemeiner Agent, der antwortet, **routet** und (nach Bestätigung) **handelt**.

- **Neues Engine als Hülle, alter Loop als Werkzeug.** Ein neues `/api/konsoul-agent`
  (Quasi-Klon der bestehenden Route → erbt Auth, Org-Autorität, Token-Caps, Fail-closed)
  betreibt einen Orchestrator-Loop, dessen **Werkzeuge** sind:
  - **Read-Tools:** `get_portfolio_overview` (Pläne + Counts + Status), Synthese-Status,
    Pool-Größe, Studientyp/Tiefe-Verteilung; und der heutige **Cross-Study-Loop als delegiertes Tool**.
  - **Action-Tools (P3, immer Confirm):** `propose_create_study` (vorbefüllt), Synthese/Personas/
    Leitfaden auslösen, „navigate →" (gibt einen Deep-Link zurück, den der **Client** klickt — der Agent
    navigiert nie selbst).
  - **Help-Tool:** kuratiertes, server-seitiges How-to-Korpus (keine Teilnehmer-Daten) → als
    **„guidance"** gelabelt (neutrale Karte, NICHT das grüne Belegt-Gesicht).
- **Routing/Modell-Split:** Routing-/Read-Turns auf **Sonnet** (günstiger, nicht zitierkritisch),
  der **finale Emit bei `kind='answer'` auf Opus** (Beleg-Parität); die delegierte Studienfrage ist
  intern eh Opus. Orchestrator-`STEP_BUDGET` niedriger (≈6); Short-Circuit, wenn die Portfolio-Übersicht
  allein reicht (Studien-Sub-Call überspringen).
- **Org-Scoping bleibt strukturell sicher:** `orgId` wird aus der authentifizierten Anfrage
  **geschlossen** (closure), nie als Modell-Argument — Cross-Org-Zugriff ist konstruktiv unmöglich.
- **Ehrlichkeit bleibt:** nur die Cross-Study-Delegation ankert/zitiert; breite Antworten bleiben
  geerdet, weil jede Zahl aus einem deterministischen Read kommt, sonst → Interpretation/Ablehnung.

### B) Proaktivität / Research-Coach
Zwei-Stufen-Pipeline, die Konsouls Charakter nie bricht.

**Stufe 1 — `SignalEngine` (rein deterministisch, kein LLM):** `computeKonsoulSignals(orgId)`
nutzt **exakt dieselben Reads wie die Heute-Seite** (`listResearchPlans`, `countCompletedSessionsForPlans`,
`loadOrgSynthesisStudyIds`, `countPoolMembers`, `getStudySynthesis`, `getAllInsightsForOrg`).
Jedes Signal trägt eine **echte Zahl + Beleg**:

| Signal | Bedeutung | Quelle |
|---|---|---|
| S1 Synthese-Lücke | aktive Studie, Interviews>0, noch keine Synthese (= heutige R1) | Plans + SynthesisIds |
| S2 unter Persona-Gate | Synthese mit n 1–9 (Gate 10) bzw. 10–14 (Qualität bis 15) | `MIN_PERSONA_INTERVIEWS`/`…QUALITY_HINT_UNTIL` |
| S3 alter Entwurf | `draft` + älter als N Tage | Plans + createdAt |
| S4 totes Feld | aktiv, completed==0, >30 Tage | Plans |
| S5 Synthese veraltet | viele neue Insights seit `synthesized_at` | `countInsightsForPlanSince` |
| S6 dünne Datenbasis | n unter Sample-Ziel-Ratio / niedrig | Synthese.based_on_count |
| **S7 wiederkehrendes Thema** | Theme-Phrase in ≥2 Synthesen | `loadOrgSyntheses` + `aggregateThemeFrequency` (gleicher Zähler!) |
| **S8 Segment nie untersucht** | Segment/Rolle in Insights, aber ohne eigene Studie/Persona | `getAllInsightsForOrg` + Personas |

S7/S8 sind der eigentliche Treibstoff für **Nächste-Studie-Empfehlungen** — und sind geerdet in
Counts, die die Plattform für ehrliche Cross-Study-Antworten ohnehin berechnet. Alle Signale
fail-open (Null → Signal weglassen, nie crashen).

**Stufe 2 — `konsoulCoach` (Opus rahmt, erfindet nie):** `POST /api/konsoul/coach` nimmt die Signale
und gibt `Recommendation[]` zurück (`tip` | `next_study`, Evidenz, optionaler CTA, `grounded`-Flag).
**Eine** Opus-Anfrage rahmt ALLE Signale (gebatcht, gecacht per `org+signal-hash`) — Systemregel
verbatim aus dem Agenten: „Du darfst NUR die übergebene Zahl/Entität wiedergeben; erfinde nie eine
Zahl/Studie/Thema; wenn du es nicht aus der Evidenz formulieren kannst, gib es ungerahmt zurück."
Beispiele: „Studie X hat 12 Interviews, aber noch keine Synthese — jetzt verdichten?" ·
„Thema Y taucht in 3 Studien auf — ein Konzepttest zu Z könnte das vertiefen." CTAs nur auf
**sichere** Routen (Synthese/Personas/Leitfaden/Create-Prefill) — **nie** Prolific-Publish oder Versand.

**Surface — „Konsoul schlägt vor" (Pull, nie Push):** an genau drei ruhigen Stellen —
(A) eine Karte auf **Heute** als natürliche Erweiterung der heutigen „Nächste Schritte" (gleiche
Grammatik, max. 3, gedeckelt); (B) ein Coach-Panel über dem Agenten auf `/insights`; (C) ein
„Was als Nächstes?"-Block auf der Synthese-Seite. **Keine** Toasts, keine Pop-ups, keine Mails.
Jede Karte zeigt **ihre Evidenz** inline („Beleg: Studie X, 12 Interviews"). Grounded vs. amber-hedged
(„auf begrenzter Datenbasis") wie gehabt klar getrennt.

### C) UX, Flächen & Rollout
- **Türen:** ⌘K-Zeile „Konsoul fragen: <Frage>" (P2), `/insights` als tiefer Raum, Heute-Karten.
- **Zwei neue Konsoul-Zustände** in der bestehenden Grammatik: **`suggest`** (proaktiver Vorschlag,
  neutraler Pip + „?" — eine Vermutung kriegt KEIN grünes ✓) und **`act`** (eine bestätigte Aktion läuft;
  Trace-Stil mit Verb-Zeile „navigate →"). Beide mit ruhigem Reduced-Motion-Standbild.
- **Zurückhaltung (harte Regeln):** nie teilnehmer-seitig, nie Consent/Recht, nie geld-/personennah ohne
  expliziten Klick; max. 3 Karten, dismissbar, nie modal.

## Getroffene Entscheidungen (26.06.)
- **Tür:** **⌘K-first** — Konsoul ist primär über die globale Suche „Frag Konsoul" von **jeder
  Seite** erreichbar; `/insights` bleibt der tiefe Research-Raum; Coaching lebt auf Heute. (Eine
  Engine, mehrere Türen.) → priorisiert die globale ⌘K-Zeile (P2) als zentrale Tür.
- **Aktionen:** **Bestätigte sichere Aktionen** — Konsoul darf nach **explizitem Confirm** sichere/
  idempotente Jobs anstoßen (Studie-Entwurf, Synthese/Personas/Leitfaden). **Nie** Versand/Prolific.
  → P3 inkl. Confirm-Flow + Audit-Tabelle (die eine Migration) ist gesetzt.

## 5. Roadmap (Phasen)

| Phase | Inhalt | Aufwand | Migration? |
|---|---|---|---|
| **P0** ✅ | „Frag Konsoul"-Rebrand, Chat entfernt, Konsoul im Cross-Study live | — | nein |
| **P1** | (a) Q&A-Scope erweitern + **Help/Guidance-Lane** (neutrale Karte, kein grünes Belegt); (b) **`SignalEngine`** (deterministisch); (c) erste „Konsoul schlägt vor"-Karten auf Heute | M | **nein** |
| **P2** | **Read-Tools + navigate** (Portfolio-Übersicht, Plan-/Synthese-/Pool-Counts) · globale **⌘K-„Konsoul fragen"**-Zeile · S7/S8-Signale · **`konsoulCoach`**-Engine · Orchestrator-Loop (Cross-Study wird ein Tool) | L | nein |
| **P3** | **Bestätigte Aktionen/Orchestrierung** (Studie-Entwurf, Synthese/Personas/Leitfaden auslösen — Confirm-Gate; Einladung nur Entwurf; nie Prolific) · neue **`suggest`/`act`**-Zustände · **Empfehlungs-Audit-Tabelle** | L | **ja** (1 additive Tabelle) |
| **P4** | Tiefer proaktiver Coach auf Heute (Konsoul-formulierte Nächste-Schritte-Karten ersetzen/ergänzen R1/R2/R3) | M | nein |
| **P5** | Politur: Inline-⌘K-Antworten (kurze Q&A im Palette-Modal), persistierte Threads (DSGVO-vorsichtig, EU/Frankfurt, nur Org-Text), **Erfolgsmetriken/Telemetrie** | M | optional |

**Empfehlung Reihenfolge-Logik:** P1 zuerst (höchster Wert pro Aufwand: kein neues Backend, keine
Migration — nur Prompt + Korpus + eine Render-Verzweigung + der deterministische SignalEngine). Erst
ab P3 entstehen echte Aktionen + die einzige Migration.

## 6. Sicherheit & Compliance — Leitplanken (gelten ab P2/P3)

- **Org-Scoping:** `orgId` immer aus der Session, NIE aus Modell-Argumenten. Jedes neue Read-/Action-Tool
  muss das einhalten — sonst Cross-Org-Leak.
- **Aktionen:** nichts Destruktives/Irreversibles/Geld-nahes ohne **expliziten Confirm**. Synthese-Re-Run
  (300s-Opus) zeigt eine stärkere „überschreibt"-Warnung (wie das zweistufige Studien-Lösch-Gate).
  **Versand** = nur Entwurf/Vorschau, nie Auto-Send. **Prolific-Publish** = nur Vorschlag+Link, Konsoul
  ruft es NIE.
- **EU AI Act Art. 22** (keine automatisierten Entscheidungen über Personen): Konsoul bleibt strikt
  **org-seitig** (Portfolio/Studien), nie über Teilnehmer entscheidend. Empfehlungen rund um Recruiting
  (z. B. „dein Pool ist dünn in Segment X") brauchen vor P3 einen Consent/AI-Act-Review (Rechts-Track).
- **DSGVO/Retention:** persistierte Empfehlungen/Threads (P3/P5) nur Org-seitige Metadaten (Counts, Plan-IDs),
  **nie Teilnehmer-Text**; EU-Region; eigene Retention-Uhr klären. AI-Offenlegung + Audit (Modell+Version,
  Heuristik-vs-Beleg) wie im bestehenden Compliance-Posture.
- **Ehrlichkeits-Vertrag:** grüner Pip = nur zitiert; Counts deterministisch; Prosa gebunden; Guidance ≠ Beleg.

## 7. Offene Produktentscheidungen (vor dem Bau zu klären)

1. **Wo „wohnt" Konsoul?** Wird `/insights` der breite „Konsoul-Hub" (Q&A + Hilfe + Coaching) oder bleibt
   es der enge tiefe Cross-Study-Raum, und Coaching lebt nur auf Heute? (Ein Endpoint kann beide Türen bedienen.)
2. **Empfehlungen persistieren?** Audit-Tabelle `research_org_recommendations` (akzeptiert vs. ignoriert →
   Ranking + Transparenz) = die **einzige Migration**. Jetzt oder später?
3. **Nächste-Studie: vorbefüllen?** Soll Konsoul das Create-Formular aus dem Kontext vorbefüllen
   (Audience/Themen aus verwandter Studie) oder nur in Prosa vorschlagen + verlinken? (Mehr Wert ↔ mehr
   vom Agenten erzeugter Inhalt, den du prüfen musst.)
4. **Modell-Kosten:** verschachtelte Opus-Loops (~2×) bei Studienfragen ok, oder nicht-trust-kritische
   Follow-ups auf Sonnet?
5. **Proaktivität opt-out je Org?** Immer-an-aber-dismissbar (passt zu „kein Clippy-Spam") vs. Settings-Toggle.
6. **Scope:** nur `market_research` (heutige Heute-Logik) oder auch `product_discovery`? (Der Cross-Study-Agent
   liest schon ALLE Synthesen.)
7. **Schwellen:** „alter" Entwurf = wie viele Tage? „veraltete" Synthese = ab wie vielen neuen Insights?
   „dünne Daten" = unter Gate (10) oder completed/Sample-Ziel-Ratio?
8. **Naming-Kanon:** „Konsoul" als Produkt-Nomen vs. „Frag Konsoul"/„Ask Konsoul" als Aktion — i18n
   (de+en) vor P1 vereinheitlichen.

## 8. Was ich als Nächstes bauen würde
**P1** als erster, risikoarmer, migrationsfreier Schritt — der die größte spürbare Wirkung bringt:
(1) die Help/Guidance-Lane (Konsoul wird das Erste, was man fragt), (2) der deterministische `SignalEngine`,
(3) die ersten „Konsoul schlägt vor"-Karten auf Heute. Danach Tür für Tür (⌘K, Read-Tools, Aktionen, Coach).
