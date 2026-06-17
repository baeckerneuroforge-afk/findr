# Spec — „So klingt Forschung" neu: Voice/Text-Interview über ein Stimulus-Bild

> Status: **UMGESETZT (E1–E5), verifiziert, noch nicht committed.** Worktree
> `vigilant-goldwasser-1ca50d` (Branch `claude/vigilant-goldwasser-1ca50d`, von
> `main` @ `3dcf759`). Co-authored im Interview mit André, 2026-06-17.
>
> Geänderte Dateien: `src/components/marketing/studio/SessionDeck.tsx` (Rewrite),
> `src/components/marketing/studio/studio.css` (neue `.st-*`-Klassen), `src/app/(marketing)/page.tsx`
> (K.02-Intro-Copy). Kein Backend, keine Migration, `.studio`-gescoped.
>
> **Gates:** tsc 0 · eslint 0 · keine Console-Fehler · keine Regression bei K.04/produkt
> (geteilte Klassen verifiziert scoped). Browser-verifiziert: Voice- & Text-Modus,
> Stimulus-Reveal, klickbare Befunde (Befund→Zeile+Analyse-Feld), Dark-Mode, Mobile.
>
> **Adversarialer 3-Linsen-Review:** 16 erhoben, 9 bestätigt. Gefixt: HIGH Stale-
> `typeChar`-Race (Generation-Guard `genRef`), color-mix()-Fallbacks, 3 Klarheits-/
> Mobile-Nits. Bewusst gelassen (intentional/Konvention): Modus-Toggle während Play
> (State bleibt erhalten, Re-Skin gewollt), `#ffffff` auf Indigo (= `.st-who`-Konvention),
> `analysisOpen`-Reopen bei Replay (= Spec §9.3), `--st-amber` ohne Dark-Override
> (vorbestehend, optisch okay).

## 0. Ziel in einem Satz

Die Landing-Sektion **K.02 „So klingt Forschung"** behält ihre geliebte Optik, zeigt
inhaltlich aber statt der „Was koche ich?"-Koch-Studie ein **Voice/Text-Interview
über einen Stimulus-Entwurf**, dessen **echte Analyse** (Stimulus-Analyse-Felder +
Befunde + Synthese-Fazit) rechts live „aufgelistet" wird — interaktiv mitverfolgbar
über Play/Replay, **umschaltbares Voice ⇄ Text**, und **klickbare Befunde**.

## 1. Was bleibt / was sich ändert

| Bleibt (unangetastet) | Ändert sich |
|---|---|
| Gesamt-Look der Karte (`.st-deck`, Paper-Optik, Scan-Schimmer, Rec-Dot, Timecode) | Skript/Inhalt: Koch-Studie → Stimulus-Konzept-Test |
| Tipp-Animation + Caret + Befund-Stempel auf der Zeile | Linke Bühne bekommt **Voice ⇄ Text**-Toggle + **Stimulus-Splitview** |
| Rechte Befund-Spalte + „Annahme vs. Realität"-Karte (Mechanik) | Rechte Spalte zeigt **echte** Produkt-Artefakte (3 Blöcke) statt erfundener Labels |
| Autostart bei Scroll, Play/Replay/Überspringen | Zusätzlich: **klickbare Befunde** (Beleg → Gesprächsstelle) |
| Reduced-Motion-Sofort-Endzustand, `.studio`-Scope, kein Backend, Deutsch | Neue `.st-*`-Klassen für Orb + Analyse-Raster |

**Nicht-Ziele (bewusst draußen):** echtes Audio/TTS, echtes Backend/API, echte
Teilnehmerdaten, Turn-Signal-Chips (vorerst), i18n/Englisch, Scrubbing-Timeline,
Schritt-für-Schritt-Navigation. Mehrsprachigkeit bleibt wie der Rest der Marketing-
Seite: hartkodiertes Deutsch.

## 2. Entscheidungen aus dem Interview (verbindlich)

1. **Szenario:** Voice-Interview über ein Stimulus-Bild (kombiniert).
2. **Platzierung:** umschaltbar im selben Block — **Tabs „Voice" ⇄ „Text"**, beide
   zeigen *dasselbe* Interview/denselben Entwurf, nur andere Modalität.
3. **Interaktion:** Play/Replay **+ klickbare Befunde**. (Kein Scrub, kein Step.)
4. **Vokabular:** **echte Produkt-Sprache** (Stimulus-Analyse-Felder, echte Befund-
   Kategorien). Keine erfundenen „Bedürfnis/Workaround/Reibung"-Labels mehr.
5. **Stimulus-Asset:** **stilisierter Entwurf in CSS/SVG** (kein echtes Bild) — analog
   zur „A"-Kachel in K.04.
6. **Auflistung rechts:** **Stimulus-Analyse-Felder + Befunde (Kategorie + Beleg) +
   Synthese-Fazit**. (Turn-Signal-Chips bewusst nicht.)
7. **Ton:** stilles Theater, kein Audio.

## 3. Vorgeschlagenes Narrativ (tauschbar)

Führt das Beispiel weiter, das **schon in K.04** steht
(`„Das Dunkelblau wirkt hochwertig — aber ich finde den Preis nicht."`,
[page.tsx:259](../src/app/(marketing)/page.tsx#L259)) — so dramatisiert K.02 genau das,
was K.04 nüchtern beschreibt. Produkt: ein **Packshot-Entwurf** „NORDLICHT · Premium
Kaffee", Variante A.

**Gesprächsverlauf (7 Turns, geteilt von Voice & Text):**

| # | Wer | Aussage | Stempel/Befund |
|---|-----|---------|----------------|
| 1 | Klymeo | „Ich zeig dir gleich einen Entwurf — sag einfach, was dir spontan durch den Kopf geht." | — *(Stimulus wird hier eingeblendet)* |
| 2 | Person | „Das Dunkelblau wirkt richtig hochwertig, fast premium." | **Markenwahrnehmung · Stark** |
| 3 | Klymeo | „Und wenn du das im Regal sehen würdest — was suchst du als Nächstes?" | — |
| 4 | Person | „Ehrlich? Den Preis. Den finde ich hier gar nicht." | **Preis-Sichtbarkeit · Hoch** |
| 5 | Klymeo | „Angenommen, der Preis stünde gut sichtbar drauf — würdest du zugreifen?" | — |
| 6 | Person | „Wahrscheinlich ja. Ohne Preis lege ich's eher zurück." | **Kaufabsicht · Bedingt** |
| 7 | Klymeo | „Danke — das hilft enorm." | — |

**Stimulus-Analyse rechts („Was die KI im Bild gesehen hat", 6 Felder):**
- *Layout & Aufbau:* „Zentrierter Packshot, viel Weißraum, klare Mittelachse."
- *Farbwelt:* „Dominantes Dunkelblau, goldener Akzent — kühl, hochwertig."
- *Bildelemente:* „Verpackung mittig, Markenname oben, **kein** Preis-Element."
- *Text im Bild (wörtlich):* „NORDLICHT · Premium Kaffee".
- *Claim / Botschaft:* „Ruhig, hochwertig — Genuss-Positionierung."
- *Auffällige Gestaltung:* „Sehr großzügiger Weißraum; Preis/CTA fehlen."

**Befunde (echte Kategorien, Mapping zur App-Schema):**
| Anzeige-Label | Echtes Schema | Stärke | Beleg |
|---|---|---|---|
| Markenwahrnehmung | `BRAND_PERCEPTION` | Stark | „… wirkt richtig hochwertig, fast premium." |
| Preis-Sichtbarkeit | `PRICE_SENSITIVITY` | Hoch | „Den Preis finde ich hier gar nicht." |
| Kaufabsicht | `PURCHASE_INTENT` | Bedingt | „Ohne Preis lege ich's eher zurück." |

**Synthese-Fazit (im „Annahme vs. Realität"-Gewand, aber aus echter Synthese-Logik):**
- *Annahme:* „Premium-Look reicht zum Verkauf."
- *Klymeo:* „Der Look überzeugt — fehlende Preis-Sichtbarkeit ist das eigentliche
  Conversion-Risiko."

## 4. UI-Aufbau

```
┌─ .st-deck ──────────────────────────────────────────────────────────┐
│ Session 001 · Konzept-Test          [ Voice ⏐ Text ]      TC 00:0x:xx │  ← Top-Leiste + NEUER Modus-Toggle
├──────────────────────────────────────┬──────────────────────────────┤
│  LINKE BÜHNE (modusabhängig)         │  RECHTE AUSWERTUNG (geteilt)  │
│                                      │                              │
│  Voice-Modus:                        │  ▸ Stimulus-Analyse (6 Felder)│
│   ◉ Orb (Hört zu/Spricht/Denkt)      │     „Was die KI im Bild sah"  │
│   ▁▂▅▇ Stimmbalken (.st-voicebars)   │     (klappt nach Play auf)    │
│   Transkript tippt sich + Stempel    │                              │
│                                      │  ▸ Befunde — live mitgeschnitten│
│  Text-Modus:                         │     [Markenwahrnehmung·Stark] │
│   💬 Chat-Bubbles (Klymeo/Person)     │     [Preis-Sichtbarkeit·Hoch] │ ← klickbar
│   gleiche Turns + Stempel            │     [Kaufabsicht·Bedingt]     │
│                                      │                              │
│  ┌ Stimulus-Splitview (.st-stim) ──┐ │  ▸ Synthese-Fazit            │
│  │ [Entwurf A]  „Was fällt auf?"   │ │     Annahme → Realität        │
│  └─────────────────────────────────┘ │                              │
│  [▶ abspielen] [↺ nochmal] [⏭]       │                              │
└──────────────────────────────────────┴──────────────────────────────┘
```

- **Modus-Toggle** oben rechts neben/unter dem Timecode. Default **Voice** (die
  Sektion heißt „So klingt Forschung"). Umschalten wechselt nur die Darstellung der
  linken Bühne; der Abspiel-Zustand/die Stelle bleibt erhalten (re-skin, kein Neustart).
- **Stimulus-Splitview** erscheint in beiden Modi. Im Voice-Modus „enthüllt" er sich
  zum Timing von Turn 1 (DataPacket-Metapher: Platzhalter „Material wird im Gespräch
  eingeblendet" → Entwurf fährt rein). Im Text-Modus steht er beim ersten Turn beside.
- **Rechte Spalte:** drei Blöcke, untereinander, jeweils mit Reveal-Animation. Die
  Stimulus-Analyse klappt nach dem ersten Play automatisch auf (zeigt das „aufgelistet").

## 5. Interaktion im Detail

- **Play/Replay/Überspringen:** wie heute (Mechanik aus `play()`/`finishAll()`).
- **Voice ⇄ Text:** State `mode: "voice" | "text"`. Wechsel rendert dieselbe Timeline
  in anderer Skin. Geteilter Abspiel-State (`typed[]`, `stamped[]`, `phase`).
- **Klickbare Befunde:** jede Befund-Karte trägt `findingKey ↔ turnIndex`. Klick →
  (a) Zeile/Bubble des auslösenden Turns wird hervorgehoben + sanft ins Bild gescrollt,
  (b) der zugehörige Stempel „pulst" kurz, (c) optional das passende Stimulus-Analyse-
  Feld kurz markiert. Funktioniert nach Abschluss des Durchlaufs; während des Tippens
  springt es zum Endzustand und hebt dann hervor.
- **Reduced-Motion:** wie heute — `play()` rendert sofort den Endzustand (alles getippt,
  gestempelt, Analyse offen, Fazit sichtbar), keine Bewegung. Toggle & Klick-Sprung
  funktionieren trotzdem (nur ohne Scroll-/Puls-Animation).

## 6. Datenmodell (neue Konstanten, rein client-seitig)

Ersetzt `LINES`/`FINDINGS` in `SessionDeck.tsx` (oder ausgelagert nach
`SessionDeck.data.ts`). Skizze:

```ts
type Turn = { who: "Klymeo" | "Person"; f: boolean; text: string;
              reveal?: boolean;            // Stimulus an diesem Turn einblenden
              finding?: number };          // Kopplung zur Befund-Karte
type Finding = { k: number; label: string; schema: string;  // echtes Kategorie-Enum
                 strength: "Stark" | "Hoch" | "Bedingt" | ...; quote: string;
                 turnIndex: number; analysisField?: number };
type AnalysisField = { k: number; label: string; value: string };  // 6 Stimulus-Felder
type Synthesis = { annahme: string; realitaet: string };
const STIMULUS = { label: "Dein Entwurf · Variante A", kind: "packshot-css" };
```

## 7. Wiederverwendung (Design-System schon vorhanden)

| Vorhanden | Datei | Verwendung |
|---|---|---|
| `.st-deck`, `.st-tape*`, `.st-caret`, `.st-stamp(--2/--3)` | studio.css:528+ | Bühne, Tipp, Stempel |
| `.st-finding`, `.st-verdikt`, `.st-tag` | studio.css:761+ | Befunde + Fazit |
| `.st-voicebars` / `@keyframes st-vb` | studio.css:1498 | Stimmbalken im Voice-Modus |
| `.st-stim`, `.st-stim-asset`, `.st-stim-chat` | studio.css:1533 | Stimulus-Splitview |
| `--st-rec/-deep`, `--st-amber`, `--st-ease(-stamp)`, Mono/Serif-Fonts | studio.css | Tokens |
| IntersectionObserver-Autostart, `playingRef`-Doppelstart-Schutz | SessionDeck.tsx | übernehmen |

**Neu zu bauen (CSS):** Orb (`.st-orb` mit Zustands-Ringen Hört-zu/Spricht/Denkt,
color-mix wie im echten `VoiceInterviewView`), Modus-Toggle (`.st-modetab`),
Stimulus-Analyse-Raster (`.st-analysis` / Felder), CSS-Packshot („NORDLICHT", Dunkelblau).

## 8. Bauplan in Etappen

- **E1 — Daten & Skript:** `Turn[]`/`Finding[]`/`AnalysisField[]`/`Synthesis`/`STIMULUS`
  als Konstanten; Reduced-Motion-Endzustand korrekt. (Reiner Datentausch, noch alte UI.)
- **E2 — Linke Bühne:** Modus-State + Toggle; Voice-Skin (Orb + `.st-voicebars`),
  Text-Skin (Bubbles); Stimulus-Splitview + Reveal-Timing.
- **E3 — Rechte Auswertung:** 3 Blöcke (Stimulus-Analyse aufklappbar, Befunde mit echten
  Kategorien, Synthese-Fazit); Reveal-Choreografie an die Stempel gekoppelt.
- **E4 — Klickbare Befunde:** Kopplung `findingKey ↔ turnIndex (↔ analysisField)`,
  Highlight + Scroll + Stempel-Puls.
- **E5 — Feinschliff:** neue `.st-*`-Klassen, Reduced-Motion, Mobile (Single-Column),
  Dark-Mode-Parität, A11y (`aria-live`, Alt-Text/Beschriftung für den CSS-Entwurf),
  Copy-Politur. Build/tsc/Lint grün.

Jede Etappe in sich lauffähig; Review vor jedem Schritt (Workflow-Regel: Solo-Agent,
Merge+Push erst nach Abnahme).

## 9. Offene Mini-Entscheidungen (Vorschläge — sag Bescheid, wenn anders)

1. **Default-Tab = Voice.** (Begründung: Sektionstitel „So klingt Forschung".)
2. **Toggle behält die Abspiel-Stelle** (re-skin), startet nicht neu.
3. **Stimulus-Analyse klappt nach Play automatisch auf.**
4. **Narrativ = NORDLICHT-Packshot (Dunkelblau/Preis).** Thema/Branche frei tauschbar
   (z. B. Landingpage- oder Anzeigen-Entwurf) — ändert nur Copy + CSS-Asset.
5. **Eyebrow-Text der Sektion** („Ein Ausschnitt aus einem Klymeo-Tiefeninterview …")
   wird angepasst (Stimulus/Voice statt generisch), Ehrlichkeits-Hinweis bleibt.

## 10. Guardrails (Ehrlichkeit & Konsistenz)

- „Vorgefertigtes Beispiel, kein Login, keine echten Teilnehmerdaten" bleibt sichtbar.
- Echte Begriffe = echte App-Ausgabe; keine erfundenen Kategorien. Stimulus-Analyse-
  Felder 1:1 wie im Produkt (Layout & Aufbau, Farbwelt, Bildelemente, Text im Bild,
  Claim/Botschaft, Auffällige Gestaltung).
- Kein Audio, keine Emotions-/Biometrie-Anmutung (AI-Act-Disziplin) — nur Text-basierte
  Befunde, Stimmbalken als sichtbar „simuliert".
- `.studio`-Scope: nichts leckt in App/Dashboard. Kein Backend, kein Migrationsbedarf.
```
