# Klymeo Plattform-Redesign — Spec v0.1

> Gemeinsamer Entwurf (André + Claude), Stand 25.06.2026. Lebendes Dokument —
> bitte direkt kommentieren/ändern. Betrifft die **Plattform** (Dashboard/Konsole),
> NICHT die Marketing-Landing (die ist schon fertig) und NICHT die Teilnehmer-
> Interview-Flächen (eigene Etappe, white-label, bleiben hell).

---

## 1. Ziel

Die Konsole soll sich **cleaner, hochwertiger und ruhiger** anfühlen — weg vom
Twilight-Violett (#4A51A8) als Allzweck-Akzent und der fehlenden Hover-Haptik,
hin zu einem **werkzeug-ruhigen, dokumenthaften** Look à la **Notion / Attio**.
Wichtig: **nicht bunt** (die 3D-Farbkachel-Variante war zu viel), aber auch
**nicht eintönig** (die rein graue Variante war zu kahl). Die Lösung dafür steht
in §3.

## 2. Festgelegte Entscheidungen (aus dem gemeinsamen Q&A)

| Dimension | Entscheidung |
|---|---|
| Stil-Vorbild | **Notion / Attio** — hell, neutral, ruhig, dokumenthaft |
| Farbeinsatz | **Neutral + 1 Akzent** (sparsam), Status separat |
| Akzentfarbe | **Graphit / Tinte** (near-black). **Keine** chromatische Markenfarbe |
| Icons | **Linien-Icons, einfarbig** (Stroke). Aktiv in Tinte. Kein Fill, kein 3D |
| Typografie | **Durchgehend Sans** (eine Grotesk für Headlines + Body, kein Serif) |
| Palette (hell) | **Kühl-neutral** (neutrale, leicht kühle Grautöne auf Weiß) |
| Lebendigkeit | Weißraum/Kontrast · Status-/Tag-Farben · Empty-States/Illustration · feine Mikro-Animationen |
| Grundmodus | **Hell als Standard**, Dunkel weiterhin voll unterstützt |

**Referenz-Anker:** Attio. Kühl-neutral, einfarbige Tinte als einziger Chrome-
Akzent, Linien-Icons, viel Luft, Farbe ausschließlich in Daten (Status, Tags),
präzise Mikro-Interaktionen.

## 3. Wie wir „nicht eintönig" lösen (ohne bunt zu werden)

Das ist der Kern. Lebendigkeit kommt **nicht** aus Chrome-Farbe, sondern aus vier
Quellen — alle vier sind freigegeben:

1. **Material & Weißraum.** Klare Hierarchie aus Kontrast, großzügigen Abständen,
   echten Haarlinien und einer ruhigen Lesespalte. Dichte da, wo Daten sind;
   Luft drumherum.
2. **Farbe in den Daten, nicht im Chrome.** Die einzige Buntheit:
   - **Status-Signale**: grün (im Feld / erfolgreich), amber (Entwurf / Achtung),
     rot (Fehler / Risiko) — als Chips/Badges.
   - **Kategorie-Tags**: ein kleiner, gedämpfter Farbpunkt pro Studientyp
     (Konzepttest / Marktforschung / Usability …), Notion-Tag-Stil — Punkt + neutraler Text.
   So entsteht Farbe genau dort, wo sie **Bedeutung** trägt.
3. **Empty-States & Illustration.** Liebevolle Leerzustände (Heute, Studien,
   „noch keine Synthese") mit kleiner Linien-Illustration / Klymeo-Mark + klarer
   nächster Aktion. Das nimmt der ruhigen Fläche die Kahlheit.
4. **Feine Mikro-Animationen.** Präzise Hover-/Press-/Eintritts-Bewegungen
   (siehe §4.6). Hochwertig, nie laut.

> ⚠️ Kleiner Klärungspunkt: Bei „Lebendigkeit" war auch *„Warme Neutrals"*
> angehakt, bei „Palette" aber *„Kühl-neutral"*. Ich gehe von **kühl-neutral**
> als verbindlicher Palette aus und nutze „Material/Weißraum/Kontrast" als
> Lebendigkeits-Hebel. Falls du doch einen warmen Unterton willst → kurz sagen,
> ist ein Token-Dreh.

## 4. Design-System

### 4.1 Farb-Tokens — Hell (kühl-neutral)
```
--bg            #fbfbfc   /* Canvas */
--surface       #ffffff   /* Karten */
--surface-2     #f4f5f7   /* Hover-Wash / Zebra */
--ink           #1c1d22   /* Überschriften + Akzent (Tinte) */
--text          #3c3e45   /* Body */
--muted         #6b6e76   /* Sekundär / Icons default */
--faint         #9a9da6   /* Captions */
--line          #ebecef   /* Haarlinien */
--line-strong   #dcdee2   /* betonte Linien / Hover-Border */
--accent        #1c1d22   /* = ink: Primary-Button, Aktiv */
--accent-on     #ffffff   /* Text auf Tinte */
--accent-wash   rgba(28,29,34,.055)  /* Aktiv-/Hover-Fläche */
--ring          rgba(28,29,34,.30)   /* Focus-Ring */
```

### 4.2 Farb-Tokens — Dunkel
```
--bg #0f1011 · --surface #17181b · --surface-2 #202126
--ink #f2f3f5 · --text #c7c9cf · --muted #8a8d95 · --faint #5f626a
--line #26272c · --line-strong #34363c
--accent #f2f3f5 (Tinte invertiert) · --accent-on #17181b
--accent-wash rgba(242,243,245,.07) · --ring rgba(242,243,245,.28)
```

### 4.3 Status- & Tag-Farben (die EINZIGE Buntheit)
```
success  #16a34a   chip bg #ecfdf3 / text #15803d   (im Feld, erfolgreich)
warning  #b45309   chip bg #fef6e7 / text #92500a   (Entwurf, Achtung)
danger   #dc2626   chip bg #fef2f2 / text #b91c1c   (Fehler, Risiko)
info     #4b5563   neutral-grau                      (sachliche Hinweise)
```
Kategorie-Tag-Dots (gedämpft, 8 px Punkt + neutraler Text), Vorschlag je Studientyp:
Konzepttest · Marktforschung · Usability · Brand · Allg. Befragung — feste,
ruhige Hues, ausschließlich als kleiner Punkt vor neutralem Text.

### 4.4 Typografie (durchgehend Sans)
- **Eine Familie: Geist Sans** ✅ (entschieden 25.06.) — bereits self-hosted im
  Projekt (`--font-geist-sans`, DSGVO-sauber) und die Headline-Schrift der neuen
  Marketing-Seite → Plattform und Marketing teilen damit eine Stimme.
- **Zahlen/KPIs:** JetBrains Mono (tabular), schon im Stack.
- **Skala (unverändert zur heutigen, nur Sans):** display 28/600/-0.02 · h1 22/600
  · h2 18/600 · h3 14/600 · body 14/400 · small 13 · caption 12.
- **Kein Serif** mehr (IBM Plex Serif entfällt für die Plattform).

### 4.5 Form & Tiefe
- Radius: Karten/Flächen **10 px**, Controls **8 px**, Pills **999 px**.
- Schatten: sehr flach. `--shadow-1: 0 1px 2px rgba(20,21,27,.05)` (Ruhe),
  `--shadow-2: 0 6px 18px -6px rgba(20,21,27,.12)` nur bei Hover/Pop.
- Trennung primär über **Haarlinien**, nicht über Schatten (Attio-Prinzip).

### 4.6 Motion & Haptik (das „cleaner beim Drüberfahren")
- Drei Dauern, eine Kurve `cubic-bezier(.22,1,.36,1)`:
  **120 ms** Mikro (Farbe/Hover/Focus) · **180 ms** UI (Lift/Press) · **320 ms** View (Eintritt).
- **Hover:** zarte `--surface-2`-Wash + (bei Karten) **−1 px** Lift + Border zu `--line-strong`.
- **Press:** `translateY(1px) scale(.99)` — taktiles Feedback, das es heute NIRGENDS gibt.
- **Focus-visible:** 2 px Tinte-Ring mit 1 px Offset (einheitlich über alle Controls).
- **Eintritt:** bestehende `console-rise`/`st-rise`-Staffelung (respektiert reduced-motion).
- `prefers-reduced-motion`: alle Bewegungen aus, Endzustand sofort.

## 5. Struktur & Komponenten

### 5.1 Sidebar (Hauptwunsch)
- **Kollabierbar:** 248 px ⇄ 64 px Icon-Rail. Zustand in `localStorage` gemerkt.
- **Linien-Icon pro Eintrag** (einfarbig): default `--muted`, Hover `--ink`,
  **aktiv** `--ink` + `--accent-wash`-Fläche + dünne 3 px Tinte-Leiste links.
  Eingeklappt: nur Icons + Tooltip-Labels.
- **Heute = Haus-Icon** (statt nur Text), oben, immer sichtbar.
- Gruppen (Captions) + „Externe Forschung"-Band + Arbeitsbereich-Footer bleiben
  inhaltlich/route-gleich. Die gleitende Aktiv-Pille bleibt erhalten.
- Aktiv-Icon optional als **gefüllte** Variante (dezenter „selected"-Cue) — zu klären.

### 5.2 Header
- Bleibt 3-spaltig (Org · Suche · Aktionen), Höhe 56–58 px, Haarlinie unten.
  Glass/Blur raus (siehe §6). Org-Mark als schlichte Tinte-Initiale statt Farbkachel.

### 5.3 „Heute" (Startseite)
- Begrüßung (Sans, groß), Digest-Zeile, 4 Stat-Karten (Zahl in Tinte, kleines
  **Linien-Icon** statt Farbkachel), „Nächste Schritte", „Läuft gerade" (Ringe in
  **Tinte**, Status-Punkt in Statusfarbe), „Auswertung".
- **Empty-State** mit kleiner Illustration + „Erste Studie anlegen".

### 5.4 „Studien" (Liste)
- Karten/Tabelle mit **Status-Chip** (Farbe) + **Kategorie-Tag-Dot** (Farbe) —
  hier lebt die Farbe. Fortschrittsbalken in Tinte. Hover-Lift.

### 5.5 „Neue Studie" = der gefuehrte **Studien-Wizard** (von André gebaut)
> ⚠️ **Update 25.06.:** Das „etwas Cooles bei der Studienerstellung" EXISTIERT
> bereits — André hat einen geführten Wizard gebaut, der das alte 2620-Zeilen-
> Einzelformular ersetzt. Meine frühere „Neue-Studie"-Annahme (Single-Form mit
> Anker-Karten) ist damit überholt. Liegt auf Branch
> `claude/focused-yonath-30ac5e` (Worktree `focused-yonath-30ac5e`), **nicht** auf
> dem Redesign-Branch — muss zusammengeführt werden.
- **Flow (5 Schritte):** Briefing („Was willst du herausfinden?", ein Satz) →
  **KI-Vorschlag** (Titel + Zielgruppe + Art der Studie + Leitfaden, alles
  editierbar) → Interview (Modus/Tiefe/Sprache/Analytics) → Review/Start →
  **Verteilung** (Pool/Open-Link/Prolific, auf der Launch-Seite).
- **Zwei Ausprägungen:** echter Dashboard-Wizard `src/components/dashboard/
  guided-study/GuidedStudyWizard.tsx` (gegen echte Endpunkte: POST /plans, /guide,
  PATCH) + isolierter Klick-Prototyp `/studio`
  (`src/components/_prototype/study-wizard/`, Dummy-Daten). Alte Form bleibt unter
  `/dashboard/market-research/new/classic`.
- **Optik:** schon clean & KI-first (große Sans-Headline, viel Luft, Beispiel-Chips,
  „✦ Vorschlag erzeugen", `WizardSteps`-Leiste, `ThinkingState` mit animate-ping).
- **Redesign-Eingriff = praktisch NULL:** Die Wizard-UI (`guided-study/wizard-ui.tsx`)
  ist **komplett token-basiert** (`bg-card`, `neutral-*`, `primary-*`). Der **E1-
  Token-Remap (Violett→Tinte) stylt den Wizard automatisch mit** — am 25.06. live
  am laufenden `/studio` verifiziert (primary-* injiziert → Schritte/Chips/Eyebrow
  wurden Tinte, Screenshots im Chat). Headlines werden über `--font-heading`→Geist
  automatisch Geist.
- **Verbleibende kleine Angleichungen (E4):** Haptik (Hover/Press auf
  `ChoiceCard`/`Chip`/`PrimaryButton`), Disabled-Opazität (heute 0.40 → 0.50),
  Tag-Punkte für „Art der Studie", `ThinkingState`-Ping ggf. ruhiger. Kein Umbau.
- „Schreiben"-Motiv (Feder/Stift) optional als Kopf-Icon — der Ein-Satz-Briefing-
  Schritt erfüllt den Wunsch „etwas mit dem Schreiben" bereits inhaltlich.

### 5.6 Primitives (app-weiter Effekt)
- `Button` (primary = Tinte / secondary = Linie / ghost / danger) + **Press-Feedback**.
- `Card`, `StatCard`, `Field`, `Table`, `Badge`, **neu: `Tag`** (Dot + Label).
- Einheitliche Focus-Ringe, einheitliche Disabled-Opazität.

## 6. Altlasten-Bereinigung (im Zuge)
- **Glass raus:** `backdrop-blur` in `RiskDrilldownPanel`, `StickyStudyBar`,
  `CommandPalette` → solide Fläche + Haarlinie.
- **5 tote Keyframes** in `globals.css` entfernen (gradient/shimmer/float/pulse-glow/
  border-flow — 0 Nutzer).
- Voice-ORB + 210 Inline-Hex der **Teilnehmer-Flächen**: **separate, spätere Etappe**
  (white-label, bleibt hell) — nicht Teil dieses Plattform-Umbaus.

## 7. Umsetzungs-Etappen (gestaffelt, jede Etappe `tsc`+Tests+`build`+Review grün)

- **E1 — Fundament:** `globals.css` Tokens (kühl-neutral, Tinte-Akzent, Status/Tag-
  Palette, Sans-Typo, Geist als `--font-display`), 5 tote Keyframes raus.
- **E2 — Haptik:** `Button/Card/StatCard/Field/Table` + neues `Tag` → Hover/Press/
  Focus. Wirkt sofort überall.
- **E3 — Sidebar:** kollabierbar + Linien-Icons (Haus für Heute), `localStorage`.
- **E4 — Heute & Neue Studie:** Sans-Headlines, Linien-Icons, Empty-States/Illustration,
  Stepper/KI-Vorschau-Feinschliff.
- **E5 — Glass-Altlasten:** RiskDrilldown/StickyStudyBar/CommandPalette.
- **E6 (separat):** Teilnehmer-/Voice-Flächen (ORB + Inline-Hex).

## 8. Offene Punkte (bitte entscheiden)
1. ~~Schrift~~ → **Geist Sans** ✅ (25.06.)
2. **Palette-Temperatur:** kühl-neutral gewählt — im v3-Preview umgesetzt; passt so?
3. **Aktiv-Icon** in der Sidebar gefüllt oder gleich (aktuell: nur Wash + Tinte-Leiste)?
4. **Kategorie-Tag-Hues:** feste Farbe je Studientyp festlegen. Im Preview vorläufig
   Konzepttest = Indigo, Usability = Amber, Marktforschung = Teal. Welche Typen sind
   die relevanten (Brand / Allg. Befragung …) und welche Farbe je Typ?
5. ~~Korrigiertes Preview v3 bauen~~ → **erledigt** (`platform-preview.html`).
6. **Go für Implementierung?** Reihenfolge E1 → E6 (siehe §7).
