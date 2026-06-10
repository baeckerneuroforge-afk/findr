# findr. Plattform-Redesign „Console“ — Analyse & Etappenplan

> **Status: NUR PLAN — kein Code verändert.** Jede Etappe startet erst nach
> explizitem Approval von André. Design-Referenz: `docs/findr-plattform-vision.html`
> (statisches Mockup, von André abgenommen als Richtung).

---

## 1. Die Leitfrage: Gehen Funktionen verloren?

**Antwort: Nein — wenn die Regeln in §4 eingehalten werden.** Das Redesign ist
eine reine **Präsentations-Schicht**: Farben, Typografie, Abstände, Anordnung.
Jede interaktive Komponente (Formulare, Server-Actions, Panels, Statuswechsel,
Exporte, Chat) bleibt **dieselbe Komponente mit denselben Props und Handlern** —
sie wird umgezogen oder neu eingefärbt, niemals neu geschrieben.

Funktionsverlust könnte nur auf vier Wegen passieren — alle sind in diesem Plan
**explizit verboten** und werden je Etappe verifiziert:

| # | Verlust-Weg | Verbot / Absicherung |
|---|---|---|
| V1 | Komponente wird „nachgebaut“ statt restyled | Nur className-/Markup-Hülle ändern; Props-Signaturen byte-identisch |
| V2 | Spalten/Panels werden „für die Optik“ weggelassen (das Mockup vereinfacht!) | §3 listet jede Mockup-Vereinfachung, die die Umsetzung NICHT übernehmen darf |
| V3 | Hardcodierte deutsche Texte ersetzen i18n-Keys | Alles Neue bekommt de+en-Keys; Paritäts-Check je Etappe |
| V4 | Modul-Gating / Routen-Logik wird angefasst | `ENABLED_MODULES`, nav-routes, Guards, Redirects bleiben unberührt — Sales/CS/PD müssen per Flag-Flip wieder einschaltbar sein, im neuen Design |

---

## 2. Funktions-Inventar — was vollständig erhalten bleiben MUSS

### 2.1 Shell
- **Sidebar** (`DashboardSidebar.tsx`): Akkordeon-Gruppen, Active-Route-Logik,
  **Gating über `ENABLED_MODULES`** (abgeschaltete Module erscheinen nicht,
  bleiben aber im Code), Workspace-Footer, i18n-Labels (`nav.*`).
- **Header** (`DashboardHeader.tsx`): OrgDisplay, **SearchHeaderWidget → ⌘K
  CommandPalette** (cmdk; lazy-hydratisiert Deals/Accounts; „Gehe zu“-Liste aus
  `nav-routes.ts`, modul-gegated, **parallel zur Sidebar gepflegt** — beide
  Quellen müssen synchron bleiben), **LanguageSwitcher (de/en!)**, Clerk
  `UserButton`.
- **Layout** (`(dashboard)/layout.tsx`): `pl-60`-Shell, max-w-1400-Main.

### 2.2 Market Research
- **/market-research** (Übersicht): 3 Kennzahlen (Studien, Aktiv,
  abgeschlossene Interviews gesamt/Ziel), Kampagnen-Tabelle mit
  Status-Badge, „47 von 200“-Fortschritt, **Synthese-bereit-Badge**, „Neue
  Studie“-CTA.
- **/market-research/new**: `ResearchPlanForm` (großes Client-Formular,
  studyType=market_research; Titel/Ziel/Persona/Stichprobenziel/Themen mit
  Intent+Hypothesen). ⚠ An diesem Formular hängen **unmerged Feature-Branches**
  (Voice-Toggle, TTS, Use-Case-Selector, Stimulus) → so wenig wie möglich
  anfassen (nur geerbte Primitives), sonst Rebase-Hölle.
- **/market-research/[id]** (Kampagne) — ALLE Sektionen bleiben:
  1. Header: Titel + „Markt-Studie“-Badge + Status-Badge + Erstellt-Datum
  2. Ziel & Stichprobe (Objective, Persona, sampleTarget)
  3. **Ziel-Pool** „47 von 200“ + Balken (completed-only-Zählung, fail-open „—“)
  4. Themen-Karten (Topic/Intent/**private Hypothesen**)
  5. **Studie testen** → /test (synthetische Teilnehmer; Disclaimer
     „zählt nicht in Pool/Synthese“ muss unübersehbar bleiben)
  6. **Teilnehmer-Tabelle mit ALLEN 8 Spalten**: Name · E-Mail · Modus ·
     Termin (`ScheduleInviteAction`) · Status · Senden (`SendInviteAction`) ·
     Link (`CopyInterviewLinkButton`) · Aktionen (Edit/Delete) — inkl.
     Disabled-Logik (archiviert/terminal)
  7. Einladen: `InviteForm` (einzeln) + `BulkInviteForm` (CSV) +
     `InviteFromPoolForm` (Pool, invitedMemberIds-Dedup)
  8. `ScreeningQuestionsPanel` (CRUD, disabled bei archiviert)
  9. `OpenLinkPanel` (Token-URL, Kontingent, Ablauf, Label, Status,
     hasScreening-Hinweis)
  10. `ProlificDraftPanel` (Credential-Status, Draft-Erzeugung,
      panelCompletionConfigured-Badge)
  11. `PlanQuotaPanel` (Rollen-Quoten, getrennt vom Ziel-Pool!)
  12. Auswertung-Link → geteilter /synthesis-Pfad
  13. `PlanStatusControl` (Lifecycle draft→active→completed→archived inkl.
      Archiv-Hinweistext)
  - Guard: product_discovery-Plan → Redirect (bleibt).
- **/research-plans/[id]/synthesis** (geteilt mit PD): „X neue Interviews seit
  letzter Synthese“, `UpdateSynthesisButton`, `SynthesisShareManager`
  (öffentliche Links), Themen-Karten (auf-/zuklappbar, Frequenz „N von M“,
  Verbatim-Zitate + Quellen-IDs), `ResearchAgentPanel` (insights-Flag),
  `HighlightReelPanel`, `ChatWithDataPanel`, **PDF- UND PPTX-Export**,
  Empty-State (noch nicht synthetisiert).
- **/research-plans/pool**: `ParticipantPoolManager` (Mitglieder, Rollen).
- **/market-research/[id]/test**: synthetische Test-Runs (eigene Tabellen,
  strukturell vom echten Flow getrennt — Disclaimer-Pflicht).

### 2.3 Studienübergreifend
- **/dashboard/insights**: `InsightsModeSwitcher` — **Chat-Modus**
  (`MissionControlPanel`, org-weit, deterministische „in X von Y Studien“-
  Zählung mit Beleg je Studie, **[Markt-/Discovery-Studie]-Label**) und
  **Agent-Modus** (`CrossStudyAgentPanel`, mehrstufig).

### 2.4 Workspace
- **/data-sources** (+ /manual): Quellen-Übersicht, Links zu Integrationen.
- **/integrations/{gong,hubspot,slack,prolific}**: Settings-Panels
  (OAuth-Flows, Token-Checks) — Gong/HubSpot gehören zu deaktivierten Modulen,
  Routen existieren aber.
- **/settings/{profile,organization,team,billing,data}**: Formulare inkl.
  `DataPrivacyPanel` (DSGVO-Export/Löschung).
- **/dashboard** (Home): `ModuleLandingPage` — Einstiegskarten der AKTIVEN
  Module (derzeit MR + Cross-Study). Gating bleibt.

### 2.5 Unsichtbar, aber heilig
- **Deaktivierte Module** (Sales/CS/PD): Seiten, Komponenten, Guards bleiben
  vollständig im Code. Da sie dieselben Primitives nutzen, bekommen sie das
  neue Design **automatisch mit** — Flag-Flip muss im neuen Look funktionieren.
- **White-Label-Flächen**: `/interview/*`, `/shared/synthesis/[token]`,
  `/onboarding` — **liegen außerhalb der (dashboard)-Gruppe und werden NICHT
  angefasst** (Teilnehmer-/Kunden-Sicht, eigenes Branding).
- **Andrés uncommittete Perf-WIP**: `package.json`, `globals.css`, Root-
  `layout.tssx`, 5 API-Routen, 2 untracked `loading.tsx` — werden weder
  editiert noch committet (gleiche Disziplin wie beim Marketing-Umbau).
- **Clerk-Theming**: `appearance` im Root-Layout bleibt in E1–E5 unverändert
  (UserButton/OrgSwitcher behalten ihr heutiges Aussehen; Anpassung = eigene
  Mini-Etappe mit Approval, weil Root-Layout = Andrés WIP-Datei).

---

## 3. Mockup ≠ Spezifikation — Vereinfachungen, die NICHT übernommen werden

Das Mockup hat zur Präsentation vereinfacht. Die Umsetzung muss abweichen:

| Mockup zeigt | Realität verlangt |
|---|---|
| Teilnehmer-Tabelle mit 5 Spalten | **Alle 8 Spalten** + Edit/Delete + Disabled-Zustände |
| „Studie testen“ als ein Button im Header | Eigene Sektion mit Link-out + Disclaimer (bleibt) |
| Quoten als eine Fortschrittszeile | Volles `PlanQuotaPanel` (anlegen/ändern, Rollen-Liste) |
| Lifecycle nur als Stepper-Anzeige | Stepper = Anzeige **zusätzlich**; `PlanStatusControl` (Aktionen) bleibt |
| Hardcodiertes Deutsch | Alle neuen Strings als de+en-Keys (`nav.*`, `research.*`-Konventionen) |
| Sidebar fest verdrahtet (3 Gruppen) | Gruppen weiterhin aus `ENABLED_MODULES` abgeleitet |
| „Synchron · vor 2 min“-Chip | **Weglassen oder ehrlich**: es gibt heute keine solche Telemetrie — kein erfundener Status (UWG-/Vertrauens-Disziplin). Vorschlag: weglassen in E2, später echte Quelle |
| Erstellen-Flow nicht gezeigt | `ResearchPlanForm` bleibt funktional identisch (nur geerbtes Styling) |
| Keine Empty-/Loading-States | `EmptyState`/`Skeleton` werden restyled, nicht entfernt |
| Nur Prolific/Slack/E-Mail-Karten | Alle 4 Integrations-Routen behalten ihre Settings-Panels |

---

## 4. Architektur-Prinzipien (wie Verlust strukturell ausgeschlossen wird)

1. **Scoped Token-Remap, kein globals.css-Edit:** Neue Datei
   `src/components/dashboard/console/console.css`, importiert vom
   `(dashboard)/layout.tsx`; Wrapper-Klasse `.console` remappt die bestehenden
   Tailwind-v4-Tokens (neutral-Ramp → warme Tinte, primary-Ramp → REC-Rot
   text-sicher, Flächen → Papier) — exakt das beim Marketing bewährte Muster.
   Dashboard-Fonts: Bricolage Grotesque + Spline Sans Mono via next/font **im
   Dashboard-Layout** (self-hosted, DSGVO-sauber); Body bleibt vorerst Hanken
   (→ O1).
2. **Primitives-Restyle mit identischer API:** `Button`, `Card`, `StatCard`,
   `Badge`, `Table`, `EmptyState`, `Skeleton`, `HealthBadge`, `RiskBadge` —
   nur Klassen/Markup-Hülle. Kein Aufrufer ändert sich.
3. **Komposition statt Ersatz:** Neue Console-Bausteine (`KpiBand`,
   `LifecycleSteps`, `SectionRail`, `FieldRow`, `LampBadge`) sind **additive
   Wrapper**, in die bestehende Panels unverändert eingesetzt werden.
4. **Eine Quelle pro Wahrheit bleibt:** `ENABLED_MODULES`, `nav-routes.ts` ↔
   Sidebar-Parallelität, i18n-Kataloge, Plan-Status-Typen.
5. **Jede Etappe = eigener Branch-Commit, Diff-Review vor Merge,** Approval-
   Gate davor und danach.

---

## 5. Etappenplan (jede Etappe wartet auf Approval)

### E1 — Fundament: Tokens, Fonts, Primitives  *(klein, trägt alles)*
- **Dateien:** NEU `console/console.css`; `(dashboard)/layout.tsx` (Wrapper +
  Fonts); Restyle: `Button`, `Card`, `StatCard`, `Badge`, `Table`,
  `EmptyState`, `Skeleton`.
- **Effekt:** ALLE Dashboard-Seiten (auch Settings, Integrationen, deaktivierte
  Module) stehen auf Papier/Tinte/Rot — Funktionen unverändert.
- **Risiken:** Kontrast-Regressionen (Badges auf neuen Flächen) → WCAG-Check
  der remappten Hexes; Charts/Inline-Hexes in deaktivierten Modulen (kosmetisch,
  nicht blockierend).
- **Verifikation:** tsc/eslint/build; Render-Sweep aller Dashboard-Routen
  (Dummy-Clerk-Key-Setup wie dokumentiert); Screenshots Vorher/Nachher;
  i18n-Parität unverändert (keine neuen Keys).

### E2 — Shell: Sidebar, Header, ⌘K
- **Dateien:** `DashboardSidebar.tsx`, `DashboardHeader.tsx`,
  `CommandPalette.tsx`, `SearchHeaderWidget` (nur Styling), ggf. +2 i18n-Keys.
- **Erhalten:** Akkordeon-Logik, Modul-Gating, Active-Route, LanguageSwitcher,
  UserButton, Palette-Datenladen.
- **Bewusst NICHT:** Sync-Chip (keine erfundene Telemetrie, →§3); Breadcrumbs
  nur falls O2 = ja (additiv, eigene Komponente).
- **Verifikation:** Flag-Flip-Test (`salesIntelligence: true` lokal → Gruppe
  erscheint korrekt im neuen Design, zurück auf false); ⌘K öffnet/filtert/
  navigiert; EN-Sprache durchgeklickt.

### E3 — Market-Research-Übersicht + Home-Landing
- **Dateien:** `market-research/page.tsx` (Komposition: KpiBand +
  Tabellen-Restyle), `dashboard/page.tsx` (ModuleLandingPage-Karten).
- **Erhalten:** exakt dieselben 3 Datenquellen-Funktionen
  (listResearchPlans / countCompletedSessionsForPlan / loadOrgSyntheses),
  Synthese-bereit-Logik, Leer-Zustände. KPI-Band zeigt NUR heute berechnete
  Zahlen (keine neuen Metriken erfinden; „+18 heute“ aus dem Mockup entfällt,
  bis es eine echte Quelle gibt).
- **Verifikation:** Seite mit 0, 1, n Studien (Fixtures/lokale DB falls
  verfügbar, sonst Render-Pfade per Code-Review + Storybook-artige Probe).

### E4 — Studien-Detailseite (der große Brocken)
- **Dateien:** `market-research/[id]/page.tsx` (Re-Komposition), NEU
  `LifecycleSteps` (Anzeige), NEU `SectionRail` (Client, Scroll-Spy, additiv),
  `FieldRow`-Hülle für OpenLink/Prolific/Screening/Quoten-Sektionen; ~10–14
  neue i18n-Keys (Sektionstitel) de+en.
- **Erhalten:** alle 13 Sektionen aus §2.2 mit identischen Props; Reihenfolge
  wird gruppiert (Setup → Feldzugang → Teilnehmer → Auswertung → Lifecycle),
  aber **kein Panel entfällt, keine Spalte entfällt**; alle Disabled-Pfade
  (archiviert/completed) bleiben.
- **Risiko:** größtes Diff-Volumen → Etappe wird als reiner
  „Umzug ohne Umbau“-Diff geschnitten (Panels als Blöcke verschoben,
  git-diff -M lesbar); adversarialer Review-Pass auf Props-Parität.
- **Verifikation:** Funktions-Smoke je Sektion (Screening-Frage anlegen,
  Quota ändern, Link kopieren, Status wechseln — soweit lokale Env erlaubt;
  sonst dokumentierter manueller Testplan für André); bestehendes
  `mr:m3:smoke`-Skript, sofern Env vorhanden.

### E5 — Synthese + Cross-Study
- **Dateien:** `research-plans/[id]/synthesis/page.tsx` (Layout 2-spaltig wie
  Mockup), `SynthesisThemeCard` (Frequenz-Balken + Zitat-Styling),
  `MissionControlPanel`/`CrossStudyAgentPanel`/`InsightsModeSwitcher` (nur
  Styling: Segmented Control, Quellen-„Korpus“-Liste rechts).
- **Erhalten:** Update/Share/Export (PDF+PPTX), ResearchAgent, HighlightReel,
  Chat — alle Buttons/Flows identisch; Themen-Aufklapp-Logik bleibt die der
  bestehenden Komponente; Serif-Stil NUR auf Zitaten.
- **Verifikation:** Synthese-Seite in allen 3 Zuständen (leer / veraltet mit
  „X neue“ / aktuell); Export-Buttons klickbar; Chat sendet (Env-abhängig).

### E6 — Workspace-Feinschliff: Datenquellen, Integrationen, Settings, Pool, /new
- **Dateien:** data-sources + 4 Integrations-Seiten, 5 Settings-Seiten,
  `ParticipantPoolManager`, `ResearchPlanForm` (NUR geerbte Primitives, kein
  struktureller Eingriff — Unmerged-Branch-Schonung), `/test`-Seite
  (Disclaimer-Optik darf auffälliger, nie dezenter werden).
- **Verifikation:** Gesamtsweep aller Routen de+en, Reduced-Motion, finaler
  adversarialer Review über alle Etappen, Vorher/Nachher-Screenshot-Galerie.

**Nach jeder Etappe:** Status-Bericht mit Screenshots + Diff-Zusammenfassung
→ **Approval-Gate** → erst dann nächste Etappe. Merge/Deploy erst nach
Gesamtabnahme (eigener Approval-Schritt, wie beim Marketing).

---

## 6. Risikoregister

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Props-Drift beim Panel-Umzug (E4) | mittel | „Umzug ohne Umbau“-Diff, adversarialer Parität-Review, tsc |
| i18n-Lücke (neuer Key nur de) | mittel | Paritäts-Zähler de=en je Etappe (bewährtes Muster) |
| Kontrast-Regression durch Token-Remap | mittel | WCAG-Messung der Remap-Hexes (wie Marketing: primary-600 #b93a1b ≥4.5:1) |
| Konflikt mit unmerged UI-Branches (Voice/TTS/Use-Case am Formular) | hoch bei E6 | ResearchPlanForm nicht strukturell anfassen; Konfliktflächen dokumentieren |
| Andrés uncommittete WIP-Dateien | gegeben | Diese Dateien nie editieren/stagen; selektives Committen wie gehabt |
| Lokale Verifikation eingeschränkt (Platzhalter-Env, keine DB) | gegeben | Dummy-Clerk-Render-Sweep + Code-Review + manueller Testplan für André je Etappe |
| Flag-Flip (Module reaktivieren) bricht im neuen Design | niedrig | expliziter Flip-Test in E2-Verifikation |

---

## 7. Offene Entscheidungen (vor E1 zu klären)

- **O1 — Body-Font:** Hanken Grotesk behalten (null Risiko, vertraut) oder auf
  Archivo wechseln (Mockup-treu, minimal anderes Schriftbild)? *Empfehlung: Hanken behalten, Bricolage nur Display/KPI.*
- **O2 — Breadcrumbs im Header:** zusätzlich einführen (additiv, kleine neue
  Komponente) oder Seitenkopf-only wie heute? *Empfehlung: ja, in E2.*
- **O3 — Mono-Font:** JetBrains Mono behalten (schon geladen) oder Spline Sans
  Mono dazu (Mockup-treu)? *Empfehlung: JetBrains behalten = ein Font weniger.*
- **O4 — Sync-/Status-Chip im Header:** weglassen (ehrlich) — oder gibt es eine
  echte Quelle, die wir anzeigen können? *Empfehlung: weglassen.*
- **O5 — Scope-Reihenfolge:** E1→E6 wie oben, oder Synthese (E5) vor der
  großen Detailseite (E4) vorziehen (sichtbarer Wow früher)?

---

## 8. v5-Nachtrag (2026-06-10) — „Übersicht & Smoothness“

> **Neue Design-Referenz: `docs/findr-plattform-vision-v5.html`** (interaktiv,
> von André beauftragt als „v4 veredeln“ + „Heute“-Start). v4 bleibt als
> Vorstufe liegen. Alles unten ist **additiv zum Etappenplan oben** —
> §1–§7 (Funktions-Erhalt, Verbote, Risiken) gelten unverändert.

### 8.1 Was v5 gegenüber v4 ergänzt

| # | Ergänzung | Landet in Etappe |
|---|---|---|
| V5-1 | **Motion-System** als Querschnitt: Tokens `--dur-1/2/3` + `--ease(.22,1,.36,1)`, Eintritts-Staffelung (45 ms), Balken/Ring-Füllung, Count-up (de-DE, tabular), Reduced-Motion = Endzustände sofort. Reines CSS + Mini-Utils, **keine framer-motion-Dependency** | E1 (Tokens/Utils) + je Seite |
| V5-2 | **Toast-System** (Audit-Befund: fehlt komplett; Feedback heute nur inline) + verbindliches **Async-Muster**: Arbeiten → Fortschritts-Hairline → Erfolgszustand → Toast (Demo: Synthese-Update) | E1 (ui/Toast) + E5 |
| V5-3 | **„Heute“-Startseite** ersetzt ModuleLandingPage: Digest seit gestern, Nächste Schritte (regelbasiert: Synthese veraltet → Screening eng → alter Entwurf), Läuft-gerade-Ringe, Zuletzt-abgeschlossen-Liste. Datenquellen: ausschließlich bestehende Queries (listResearchPlans, countCompletedSessionsForPlan(s), loadOrgSyntheses, Pool-Count) | **NEU E2.5** (zwischen Shell und MR-Übersicht) |
| V5-4 | **Live-Gefühl per Polling** (~30 s) auf „Heute“ + Studienliste: neue Zeile gleitet ein, Zähler tickt. Kein Streaming; ggf. 1 kleine additive Count-Route | E2.5 / E3 |
| V5-5 | **Sidebar-IA**: „Heute“ top-level; MR-Gruppe = Studien + Teilnehmer-Pool (MR-„Übersicht“ und Studienliste sind EINE Seite); Sidebar-Pille gleitet. nav-routes ↔ Sidebar ↔ ⌘K weiter parallel pflegen; ⌘K bekommt zusätzlich **Aktionen** | E2 |
| V5-6 | **Studien-Detail**: gruppierte Rail (Überblick · Einrichtung · Feld · Auswertung) mit Scroll-Spy + **Sticky-Subbar** (Name, Status, 47/200, Synthese-CTA beim Scrollen) — konkretisiert das geplante SectionRail | E4 |
| V5-7 | **Synthese zeigt alles, was die Engine liefert**: Überblick-Absatz + **Spannungen** (Seite A/B) zusätzlich zu Themen; Frequenz „X von Y“ konsistent auf die einbezogene Interview-Zahl bezogen (44 → 47 nach Update) | E5 |
| V5-8 | **Interview-Drawer**: Transkript-Auszug + Belege je Interview als Slide-over (aus Teilnehmer-Zeile und aus Synthese-Zitat „Beleg öffnen“). Rein lesend, Daten existieren bereits | **NEU E7 (optional, klein)** |
| V5-9 | **Neue-Studie-Seite** (Ziel-Bild): KI-Leitfaden als sichtbarer Schnellstart (heute versteckter Button im Formular), 3-Schritte-Gruppierung (kein Multi-Step-Zwang), Stimulus-Analyse-Status erlebbar (läuft → fertig → Chips). ⚠ Wegen unmerged Form-Branches: nur umsetzen, wenn Branch-Lage es erlaubt — sonst eigener späterer Schritt | E6 (vorsichtig) |
| V5-10 | **Pool**: Volltext-Suche (Name/Rolle/Segment) + Rollen-Quoten-Karte | E6 |

### 8.2 Ehrlichkeits-Regeln (verschärft übernommen)
- Digest/Nächste Schritte/„64 % bestehen“/Prognose-Zeile: **nur deterministisch
  ableitbare Werte** (Zählungen, Zeitstempel, Screening-Ergebnisse). Was sich
  nicht ableiten lässt, entfällt ersatzlos (kein Sync-Chip, §3 gilt).
- Demo-Daten im Mockup sind in sich konsistent (317 Interviews gesamt,
  Cross-Korpus = 3 Synthesen · 207 Interviews) — Zahlen im Produkt kommen
  ausschließlich aus den echten Queries.

### 8.3 Neue offene Entscheidungen
- **O6 — Polling-Kadenz:** 30 s fix, oder nur bei Fenster-Fokus? *(Empfehlung: 30 s + pausiert ohne Fokus)*
- **O7 — Interview-Drawer (E7):** einplanen oder zurückstellen? *(Empfehlung: nach E4/E5, kleiner additiver Schritt)*
- **O8 — Routen beim Studien-Merge:** `/market-research` bleibt die Route, Sidebar-Label „Studien“ *(Empfehlung: ja — kein Routen-Umbau)*
- **O9 — „Heute“-Route:** `/dashboard` rendert künftig „Heute“ statt ModuleLandingPage *(Empfehlung: ja, Gating-Logik bleibt für deaktivierte Module)*
