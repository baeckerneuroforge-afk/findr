# Cross-Study-Agent — Plan & Entscheidungsgrundlage

> **Status:** Nur Plan. Kein Code, keine Migration, keine Änderung. Branch `plan/cross-study-agent` (Worktree `findr-csa-plan`), Stand 2026-05-30.
> **Verifiziert am echten Code** (nicht geraten): `src/lib/mission-control/{engine,prompts}.ts`, `src/lib/schemas/mission-control.ts`, `src/lib/research-agent/engine.ts`, `src/lib/anthropic/structured.ts`, `src/lib/schemas/synthesis.ts`, Route `/api/mission-control`, Seite `/dashboard/insights`.

---

## TL;DR (die Kurzfassung vorab — volle Begründung am Ende)

- **Mission-Control (Chat) deckt heute ~80–90 % der „studienübergreifenden Fragen" ab**, weil es schlicht ALLE Synthesen gleichzeitig in den Kontext lädt und darin vergleichen/ranken kann. Solange eine Org < ~15–20 Studien hat, **IST der Chat schon der Agent** — er sieht alles.
- Der Agent verdient sich seinen Aufwand nur an **drei** Stellen: (a) Studienzahl sprengt das Kontextbudget → selektives Laden nötig; (b) Aufgaben brauchen **deterministische Aggregation** (exakte Frequenzen, Trendumkehr), die das Modell nicht „nach Augenmaß" machen darf; (c) mehrschrittige Meta-Deliverables.
- **Die zentrale Gefahr ist NICHT Zitat-Halluzination** (die löst der bestehende Anker-Filter auch iterativ) — sondern **Meta-Muster-Halluzination in der Prosa** („dieses Thema taucht in 5 Studien auf", „der Trend dreht sich"). Der Anker-Filter prüft Zitate, **nicht Aussagen**. Und es gibt **keine studienübergreifende Themen-Taxonomie** → „dasselbe Thema über Studien hinweg" ist ein Fuzzy-Match ohne Ground Truth. Das ist ungelöst und nur teilweise lösbar.
- **Empfehlung in einem Satz:** Nicht jetzt den vollen agentischen Loop bauen. Erst **Etappe 0** (deterministischer Cross-Study-Index, KEINE KI, KEIN Loop) bauen — beweist Wert, ist halluzinationssicher — **und** vor dem Loop bei echten Nutzern verifizieren, ob sie überhaupt das Studienvolumen + die Meta-Fragen haben. Details unten.

---

## 1. Was heute existiert (verifizierte Grundlage)

Damit der Rest ehrlich ist, hier die echten Mechaniken:

**Mission-Control (Cross-Study-CHAT)** — `src/lib/mission-control/engine.ts`
- `loadOrgSyntheses(orgId)` lädt **ALLE** Synthesen der Org (normalisiert, mit Titeln) in einem Rutsch.
- `buildMissionControlAnchorSet(syntheses)` baut eine **Per-Studie-Map** `studyId → folded haystack` (nur die Synthese-Strings der jeweiligen Studie).
- `applyMissionControlAnchorFilter`: jede Citation `{studyId, quote}` überlebt **nur**, wenn `quote` ein Verbatim-(folded-)Substring **genau der zitierten** Studie ist. `answered=true` ohne überlebende Citation → Downgrade auf ehrliche Absage. → Das ist die Garantie gegen Falsch-Zuordnung und Vermischen.
- Ein **einziger** Modell-Call pro Frage via `callClaudeStructured` (forced tool-use). Multi-Turn = History als Kontext, aber **History wird nie in den Anker-Haystack gefaltet**.

**Research-Agent (Single-Study, deliverable-orientiert)** — `src/lib/research-agent/engine.ts`
- `applyAnchorFilter`: pro Item werden `themeRefs`/`quotes` gegen **einen** `foldedHaystack` (eine Synthese) geprüft; Item ohne gültigen Anker → gedroppt; alle Items gedroppt → Downgrade. Deliverable-Typen: `summary | breakdown | theme_ranking | custom`, Item = `{heading, text, themeRefs, quotes}`.

**Das Tool-Use-Primitiv** — `src/lib/anthropic/structured.ts`
- `callClaudeStructured` macht **genau einen erzwungenen Tool-Call** (`tool_choice:{type:"tool",name}`), gibt **ein** Zod-validiertes Objekt zurück, 1 Retry, fail-closed (`StructuredOutputError`). **Es ist KEIN Agent-Loop** — kein Auto-Tool-Dispatch, keine Iteration, keine `tool_result`-Rückführung.
  - **Konsequenz:** Der agentische Loop (mehrere Tools, `tool_choice:auto`, Schleife über `stop_reason==="tool_use"`) ist **NEU** und kann `callClaudeStructured` nicht einfach wiederverwenden. Das ist der größte neue Baustein.

**Das Datenmodell (entscheidend für „Meta")** — `src/lib/schemas/synthesis.ts`
- `EmergentTheme.title` ist **freier Text** (`z.string().min(3).max(120)`) — **kein** Kategorie-/Tag-/Cross-Study-Schlüssel.
- `EmergentTheme.frequency` ist die **Respondentenzahl INNERHALB einer Studie** (distinct `sourceInsightIds`), **nicht** studienübergreifend.
- `research_plans` hat `title, objective, persona, status, created_at` — **kein** Quartal-/Topic-Tag. „Q1 vs Q3" müsste aus `created_at` gebinnt, „Pricing-Studien" aus Titel/Objective-Text **erraten** werden.
- **Fazit:** Es existiert **keine** studienübergreifende Themen-Frequenz und **keine** geteilte Themen-Sprache als Daten. Beides müsste der Agent erst *konstruieren* — und genau dort entsteht Halluzination.

---

## 2. Abgrenzung zu Mission-Control — wo ist die echte Grenze?

| Fähigkeit | Mission-Control (Chat) kann das? | Agent zusätzlich? |
|---|---|---|
| „Welche Themen tauchen studienübergreifend auf?" | **Ja** (alle Synthesen im Kontext, Modell vergleicht direkt) | Nein — Overkill |
| „Vergleiche Befunde aus Studie A und B" | **Ja** | Nein — Overkill |
| „Ranke Themen nach studienübergreifender Frequenz" | **Teilweise** — Modell schätzt nach Augenmaß; **kein exakter Count** | **Ja**: deterministisches `aggregate_theme_frequency` liefert exakte Zahl |
| 50+ Studien, Frage betrifft nur 4 davon | **Nein** — alles laden sprengt Kontext/Attention | **Ja**: selektives Laden via `list_studies`→`load_synthesis` |
| „Mehrstufiges Meta-Deliverable über alle Onboarding-Studien" | Mittelmäßig — ein Schuss, keine Zwischenschritte | **Ja**: Plan→Laden→Aggregieren→Bauen |
| „Wo dreht sich der Trend zwischen Q1 und Q3?" | **Nein** belastbar (keine Zeit-/Trend-Logik, keine geteilte Themen-Achse) | **Nur scheinbar** — siehe §6, das ist die gefährlichste Frage |

**Die echte Grenze:** Der Agent lohnt sich, sobald **(a)** die Studienzahl das Kontextbudget übersteigt **oder (b)** die Antwort eine **exakt berechnete** Zahl/Überlappung braucht, die ein Modell nicht halluzinieren darf. Für reine „vergleiche/fasse zusammen"-Fragen bei **niedriger Studienzahl ist der Agent Overkill** — er ist teurer (viele Calls statt einem), langsamer (Loop) und führt eine neue Fehlerklasse ein (Zwischenschritt-Halluzination), ohne mehr zu liefern als der Chat.

> **Ehrlich:** Bei der aktuellen Pilot-Realität (Orgs mit vermutlich 1–5 Studien) gibt es **fast keine** Frage, die der Chat nicht schon kann. Der Agent ist eine Wette auf **künftiges** Studienvolumen.

---

## 3. Architektur-Vorschlag (agentischer Loop mit Tools)

### Loop-Skizze
```
1. list_studies()                      → dünner Index (ohne Quotes/Summaries)
2. Modell plant: welche Studien sind relevant?
3. load_synthesis(studyId) × N         → füllt INKREMENTELL die Per-Studie-Anker-Map
   [optional] aggregate_theme_frequency(query) → exakter Count (in CODE berechnet)
4. Loop, solange stop_reason === "tool_use" UND step < BUDGET (z. B. 10)
5. Abschluss: ERZWUNGENER finaler Tool-Call emit_cross_study_answer
   (= dasselbe MissionControlResultSchema: {answered, answer, citations[]})
6. applyMissionControlAnchorFilter(finalAnswer, anchorMapDerNurGeladenenStudien)
```

### Tools (konkret)
| Tool | Zweck | Sicher sinnvoll? |
|---|---|---|
| `list_studies()` | Dünner Index `[{studyId,title,persona,createdAt,basedOnCount,themeTitles[],tensionCount}]` — **ohne** Quotes/Summaries, damit billig | **Ja** — reine Plumbing, low-risk |
| `load_synthesis(studyId)` | Voller STUDY-Block einer Studie → geht in die Anker-Map **dieser** Studie | **Ja** — das ist die Kontext-Lösung |
| `aggregate_theme_frequency(themeQuery)` | **Deterministisch in Code**: fold-Substring-Match einer Themen-Phrase über alle **geladenen** Studien → exakter Count + Liste der `studyId` + je 1 Verbatim-Beleg | **Ja, aber** nur exakt-Phrase (siehe §6) |
| `compare_studies(a,b)` | Zwei Blöcke nebeneinander | **Fraglich** — ist nur 2× `load_synthesis`; eigener Tool-Nutzen gering |
| `search_theme_across_studies(query)` | Fuzzy/semantische Themensuche | **SPEKULATIV + gefährlich** — ohne geteilte Taxonomie ist „semantisch gleich" Modell-Urteil = Halluzinationsvektor |

### Wiederverwendung vs. Neu
- **Wiederverwenden:** `loadOrgSyntheses` (für `list_studies` + `load_synthesis`-Inhalte, kanonischer Lesepfad, kein paralleler Datenpfad), `fold` + `buildMissionControlAnchorSet`-Idee (Per-Studie-Map), `applyMissionControlAnchorFilter` (finale Garantie **unverändert**), `MissionControlResultSchema` (finaler Antwort-Shape), das fail-closed-Muster, das Eval-Pattern (pure entry + tsx-Runner).
- **Neu:** der **Loop-Harness** (`client.messages.create` mit `tools:[…]`, `tool_choice:auto/any`, `tool_result`-Rückführung, Step-Budget, Loop-Terminierung), die **Tool-Implementierungen**, die **inkrementelle** Anker-Map, der finale erzwungene `emit`-Schritt, ein **neues** Eval-Harness mit Fake-Tools.

> **Designprinzip:** Der Loop ist nur der *Recherche*-Teil (welche Studien lade ich). Die **Antwort** entsteht in **einem** erzwungenen Abschluss-Call mit demselben Schema + demselben Anker-Filter wie Mission-Control. So bleibt die finale Garantie identisch — die Iteration ändert nur, *welcher* Haystack vorliegt, nicht *wie* gefiltert wird.

---

## 4. Das Kontext-Problem

**Heute:** `loadOrgSyntheses` lädt ALLES. Grobe Schätzung pro Studie: Overview + N Themen (Titel/Summary/Quotes) + M Tensions ≈ **0,5–2k Tokens**. Bei 50 Studien → **25k–100k Tokens** allein als Datensektion. Opus-Fenster (200k) hält das zwar, aber: (a) Attention/Qualität degradiert mit Fülle, (b) jeder Turn zahlt die Tokens, (c) Prompt-Cache hilft nur beim **stabilen** Präfix.

**Lösung des Agenten:** `list_studies` liefert nur den **dünnen Index** (Titel + Themen-Titel, keine Quotes) — das skaliert auf hunderte Studien für wenige k Tokens. `load_synthesis` zieht nur die **relevanten** Vollblöcke nach.

**Grenzen — ehrlich:**
- Fragen, die **wirklich alle** Studien brauchen („ranke jedes Thema über alle 50 Studien") zwingen den Agenten doch zum Voll-Laden → zurück am Kontext-Limit. Dann ist die **deterministische Aggregation in Code** (Tool rechnet, Modell lädt nicht alles in den Prompt) der einzige Ausweg.
- `list_studies` braucht eine **dünne Projektion**. Sauberste Variante: aus `loadOrgSyntheses` im Speicher projizieren (kein paralleler Datenpfad, aber lädt intern doch alles) **oder** einen dedizierten schlanken Loader (zweiter Lesepfad — Tradeoff bewusst benennen, nicht heimlich einführen).
- Realistisch wird's **ab ~30–50 Studien** relevant. Darunter ist selektives Laden Komplexität ohne Ertrag.

---

## 5. Anker-Sicherheit über iterative Schritte — der harte Teil

**Beim Chat** liegt alles gleichzeitig vor; jede Citation wird gegen die zitierte Studie geprüft. **Beim Agenten** entsteht eine Kette (laden → schließen → nachladen). Frage: Wie verhindern wir Halluzination/Falsch-Zuordnung in Zwischenschritten?

### Die gute Nachricht: die finale Garantie bleibt erzwingbar
Der Trick ist, **die Sicherheits-Grenze ans Ende zu legen**, nicht in jeden Zwischenschritt:
1. Die Per-Studie-Anker-Map wird **inkrementell** nur aus **tatsächlich geladenen** `load_synthesis`-Ergebnissen gebaut.
2. Die **finale** Antwort ist ein erzwungener `emit`-Call mit `{answered, answer, citations:[{studyId,quote}]}`.
3. `applyMissionControlAnchorFilter` prüft jede finale Citation: `studyId` muss in der **geladenen** Menge sein **und** `quote` Verbatim-Substring **genau dieser** Studie. → Eine Citation auf eine **nicht geladene** Studie ist strukturell unmöglich (studyId ∉ Map → gedroppt). Falsch-Zuordnung (Quote aus B unter A) → gedroppt. Alle gedroppt → ehrliche Absage.

**Damit ist die finale Zitat-Garantie IDENTISCH zu Mission-Control** — Zwischenschritt-„Gedanken" des Modells erreichen den Nutzer nicht, **solange die Antwort ausschließlich aus dem `emit`-Schritt kommt** und nichts aus dem Scratchpad durchsickert.

### Die schlechte Nachricht: zwei reale Restlücken
1. **Tool-Output ist selbst-vergiftend, wenn ein Tool halluzinationsfähig ist.** `load_synthesis` ist sicher (gibt echte DB-Strings zurück). Ein **fuzzy** `search_theme_across_studies` dagegen würde Modell-/Embedding-Urteile als „Beobachtung" in den Loop speisen — und worauf der Agent dann seine Antwort stützt, ist nicht mehr Verbatim. **Regel: jedes Tool muss verifizierbare, aus der DB stammende Strings zurückgeben — keine interpretierten.**
2. **Der Anker-Filter deckt nur CITATIONS, nicht die PROSA.** Das ist §6 — die eigentliche Gefahr.

### Muss JEDER Zwischenschritt geankert werden?
**Nein — und das ist gut so**, *sofern* (a) Tools nur Verbatim-DB-Inhalte liefern und (b) die finale Antwort zwingend durch den `emit`+Filter-Trichter muss. Der Scratchpad darf „frei denken", weil er **nicht** ausgegeben wird. Was ausgegeben wird, ist erneut Verbatim-geankert. **Kritische Implementierungsregel:** Der Loop darf **niemals** den Modell-Freitext der Zwischenschritte als Antwort an den Nutzer durchreichen — nur das gefilterte `emit`-Ergebnis. Ein „Streaming der Gedanken" in die UI würde die Garantie aushebeln.

---

## 6. Meta-Halluzination — die inhaltliche Kerngefahr

> Das ist der Punkt, an dem dieses Feature scheitern oder gefährlich werden kann. Brutal ehrlich:

**Der Anker-Filter prüft, dass ein Zitat ECHT ist — nicht, dass die AUSSAGE stimmt.** Genau das ist der bekannte Blind Spot aus dem gehärteten Research-Agent-Eval: ein Modell kann eine **erfundene Behauptung an ein echtes Zitat hängen** und besteht den Anker-Check. Auf Meta-Ebene wird das schlimmer, weil „Muster erkennen" das Modell **aktiv dazu verleitet**, Verbindungen zu behaupten:

- „Dieses Thema taucht in **5** Studien auf" → die Zahl ist **Prosa**, nicht zitierbar. Mit 2 echten Zitaten dekoriert wirkt sie belegt.
- „Die Studien A, B, C zeigen **denselben** Trend" → „denselben" ist ein Modell-Urteil ohne geteilte Themen-Achse.
- „Der Trend **dreht sich** in Q3" → setzt Zeitordnung + vergleichbare Studien + eine Trend-Metrik voraus, die es als Daten **nicht gibt**.

### Warum das hier besonders hart ist
**Es gibt keine studienübergreifende Themen-Taxonomie** (verifiziert: `EmergentTheme.title` ist freier Text, `frequency` ist per-Studie). „Dasselbe Thema in >3 Studien" ist daher ein **Fuzzy-Matching-Problem ohne Ground Truth**:
- **Exakter Titel-Match** unterzählt massiv (jede Studie benennt „Onboarding-Friction" anders).
- **Semantischer Match** ist genau der Halluzinationsvektor, den wir vermeiden wollen.

### Guardrails (was wirklich hilft vs. Kosmetik)
1. **Deterministische Aggregate statt Modell-Schätzung (wirkt):** Zahlen/Überlappungen werden **in Code** berechnet (`aggregate_theme_frequency` macht fold-Substring-Matching über geladene Studien, gibt exakten Count + die `studyId`-Liste + je 1 Beleg). Das Modell **berichtet** das Tool-Ergebnis, **erfindet** keine Zahl. → löst „in N Studien" für **exakt-Phrase**.
2. **Pro-Studie-Citation-Pflicht für jede Cross-Study-Aussage (wirkt, schon im MC-Prompt):** „Ein Thema gilt nur als studienübergreifend, wenn es **unabhängig in >1 Studie** belegt ist — mit **je einer** Citation pro beitragender Studie." Keine Citation pro Seite → Aussage fällt.
3. **Trennung Fakt vs. Inferenz (teilweise):** Trend-/Muster-Narration **nicht als Fakt** rendern. Entweder verbieten oder klar als „Interpretation (nicht direkt belegt)" auszeichnen. Ehrlich: das ist UI-Disziplin, kein harter Filter.
4. **Verbot fuzzy-semantischer Aggregat-Behauptungen ohne deterministische Stütze:** „dieselbe zugrundeliegende Sorge" nur, wenn durch (1) oder (2) gedeckt — sonst Absage.

> **Restrisiko, das bleibt:** Fuzzy-Meta-Muster, die **nicht** deterministisch berechenbar sind, bleiben ein echter, **ungelöster** Halluzinationsraum. Die ehrliche Konsequenz: Der Agent sollte sich auf **(a) verbatim pro Studie zitierbare** und **(b) tool-exakt berechnete** Aussagen beschränken — und „weiche" Trend-/Muster-Erzählung entweder verweigern oder sichtbar als Spekulation kennzeichnen. **Wenn der Haupt-Verkaufswert genau die weichen Trends sind, ist das Feature inhärent riskant.**

---

## 7. Eval-Strategie

Spiegelt das gehärtete Research-Agent-Eval (22 adversariale Fälle, pure entry, tsx-Runner, fail-closed), erweitert um **Loop-/Tool-Use-Dimensionen**:

**Harness:** pure entry, die den Loop mit **Fake-Tools** aus Hand-Fixtures treibt (mehrere synthetische Studien, deterministisch). Keine DB. Beide bestehenden Engines haben dieses Muster — wiederverwendbar.

**Achsen, die ein adversariales Eval abdecken MUSS:**
1. **Tool-Use-Korrektheit / „richtige Studien geladen":** Fixture taggt die relevanten `studyId`. Messe **Recall** (alle relevanten geladen?) + **Precision** (nicht wahllos alles geladen?). Plus: terminiert der Loop im Budget? Keine Tool-Schleifen?
2. **Finaler Anker-Pass** (per-Studie Verbatim) — wie MC: 0 % Falsch-Zuordnung, 0 erfundene Zitate.
3. **Meta-Halluzination (der Kern):** Fälle mit **erfundenem** Cross-Study-Muster, **übergeneralisiertem** Trend, **falsch zugeschriebenem** Befund → Agent muss ablehnen oder korrekt einschränken.
4. **Deterministik-Korrektheit:** Wenn `aggregate_theme_frequency` „3" liefert, muss die Antwort **3** sagen — Eval prüft Zahl gegen Tool-Ground-Truth (fängt „Modell rundet auf 5").
5. **Negativ-Kontrollen:** Konstellationen, in denen **keine** Cross-Study-Aussage möglich ist (nur 1 Studie zum Thema; widersprüchliche Befunde) → ehrliche Absage, kein erfundener Konsens.
6. **Cross-Modell:** Sonnet vs. Opus je 1× (Cost-Guard), wie beim Research-Agent — trennt der Loop die Modelle?

**Caveat:** Dieses Eval ist **deutlich aufwändiger** als die Single-Shot-Evals (Tool-Simulation + Recall/Precision-Messung + Loop-Terminierung). Das ist ein realer Kostenposten, kein Nebeneffekt.

---

## 8. Kunden-Use-Case-Ehrlichkeits-Check

> Brutal ehrlich — was ist Bedarf, was Vermutung?

| Annahme | Status | Was VOR dem Bau zu klären ist |
|---|---|---|
| Kunden haben **viele** Studien (>15) | **VERMUTUNG** — Pilot-Orgs haben vermutlich 1–5 | Echte Studienzahl-Verteilung pro Org messen (DB-Query, kein Raten) |
| Kunden stellen **Meta-Fragen** über Studien | **VERMUTUNG** | 5–10 echte Nutzer fragen: welche studienübergreifenden Fragen stellst du wirklich? |
| Studien sind **zeitlich vergleichbar** (Q1 vs Q3, gleiche Persona/Topic) | **VERMUTUNG + datenseitig fraglich** | Gibt es überhaupt Wiederhol-Studien gleicher Art? `created_at`-Verteilung + Persona/Topic-Ähnlichkeit prüfen |
| „Trend dreht sich"-Analysen sind gewünscht | **SPEKULATION** — und genau die gefährlichste Fähigkeit (§6) | Nur bauen, wenn echter, wiederholter Bedarf — und dann mit Spekulations-Kennzeichnung |

**Tools nach Sicherheit:**
- **Sicher sinnvoll:** `list_studies`, `load_synthesis` (reine selektive-Lade-Plumbing), `aggregate_theme_frequency` für **exakt-Phrase** (deterministisch).
- **Nur falls Kunde X will:** `compare_studies` (geringer Eigennutzen), Trend-über-Zeit.
- **Gefährlich / erst nach Beweis:** `search_theme_across_studies` (fuzzy-semantisch) — Halluzinationsvektor, nicht ohne harten Bedarf.

**Die unbequeme Wahrheit:** Die im Auftrag genannten Vorzeige-Beispiele („Pricing-Sensitivität Q1 vs Q3, wo dreht der Trend") sind genau die Fragen, die das **schwächste Datenfundament** (keine geteilte Achse, keine Trend-Metrik) und das **höchste Halluzinationsrisiko** haben. Die **sicheren** Fähigkeiten (selektiv laden, exakt zählen) sind weniger glamourös, aber real.

---

## 9. Aufwand + Etappierung

**Grobe Größenordnung:** mittel–groß. Der Loop-Harness + Tools + das aufwändigere Eval sind der Brocken; das ist **mehr** als eine Mission-Control-Etappe, weil der agentische Loop ein **neues Primitiv** ist (nicht `callClaudeStructured`-Reuse).

| Etappe | Inhalt | Beweist | Stop-Gate |
|---|---|---|---|
| **0 — Deterministischer Index (KEINE KI, KEIN Loop)** | `list_studies`-Index + deterministische Cross-Study-Views (exakte Themen-Frequenz per Code) — evtl. als 1–2 Tools/Views an Mission-Control angehängt | Wert + **0 % Halluzination** (reines Zählen), schnell, billig | **Wenn Etappe 0 die echten Fragen schon beantwortet → STOP, kein Agent nötig** |
| **Kunden-Check** | Studienzahl-Verteilung messen + 5–10 Nutzer zu echten Meta-Fragen | Bedarf real? Volumen real? | **Wenn <10 Studien/Org & seltene Meta-Fragen → STOP, Chat reicht** |
| **1 — Loop-Kern (eval-getrieben)** | Loop-Harness + `list_studies`/`load_synthesis` + inkrementelle Anker-Map + finaler `emit`+Filter; pure entry + Fake-Tool-Eval; **noch keine** Aggregat-Tools | Loop ist sicher (Anker + Absage) auf Multi-Studien-Fixtures | Wenn Eval Meta-Halluzination nicht zähmt → zurück zu Etappe 0 |
| **2 — Deterministische Aggregation + Meta-Guardrails** | `aggregate_theme_frequency` (Code-berechnet) + Citation-pro-Studie-Pflicht + Fakt/Inferenz-Trennung; Eval um Meta-Fälle härten | exakte Zahlen ohne Erfindung | — |
| **3 — Route + UI** | `/dashboard/insights` erweitern oder eigene Fläche; Tool-Schritte sichtbar machen | Nutzbarkeit | — |

**Schnellster Wertbeweis:** Etappe 0 (deterministischer Index) — niedrigstes Risiko, kein Loop, kein Halluzinationsraum, beantwortet einen echten Teil der Meta-Fragen.
**Riskantester Teil:** Etappe 1/2 (Loop + Meta-Guardrails) — neues Primitiv, neue Fehlerklasse, teures Eval.

---

## 10. Risiken + offene Fragen

**Technische Risiken**
- **Loop-Terminierung / Runaway:** Auto-Tool-Loop kann hängen/zu viele Calls machen → harter Step-Budget + fail-closed nötig.
- **Kosten/Latenz:** N Tool-Calls + finaler Call pro Frage statt **einem** beim Chat → Token- und Latenzkosten vervielfachen sich. Lohnt nur, wenn der Chat es wirklich nicht kann.
- **Forced-Tool-Modus verändert Verhalten:** Der Codebase hat schon gelernt (Risk-Tooluse), dass erzwungenes Tool-Use die Modell-Kalibrierung verschieben kann. Ein **Auto**-Tool-Loop ist nochmal ein anderer Modus — Wirkung unbekannt, muss empirisch (Eval) geprüft werden.
- **Tool-Output-Vergiftung:** Ein interpretierendes Tool (fuzzy search) speist Nicht-Verbatim in den Loop → unterläuft die Verbatim-Garantie. Disziplin: nur DB-Verbatim-Tools.
- **Scratchpad-Leak:** Wird Zwischen-Freitext je in die UI gestreamt, ist die Anker-Garantie tot. Strikt: nur `emit`-Ergebnis ausgeben.

**Offene Fragen (zu entscheiden)**
1. **Datenfundament:** Gibt es überhaupt vergleichbare Wiederhol-Studien (Persona/Topic über Zeit)? Ohne das ist „Trend/Vergleich" wertlos. → DB messen.
2. **`list_studies`-Lesepfad:** dünn aus `loadOrgSyntheses` projizieren (intern doch alles) **oder** dedizierter Loader (zweiter Pfad)? Tradeoff entscheiden.
3. **Fuzzy-Themen-Match:** gar nicht (nur exakt-Phrase, ehrlich begrenzt) **oder** semantisch (mächtiger, aber Halluzinationsrisiko)? Default-Empfehlung: **gar nicht**, bis Bedarf bewiesen.
4. **Trend-Narration:** verbieten **oder** als gekennzeichnete Inferenz erlauben? Default: kennzeichnen, nie als Fakt.
5. **Surface:** in `/dashboard/insights` integriert (Chat + Agent als ein „Modus-Umschalter") **oder** getrennt? Integration spart UI, verwischt aber die Grenze für den Nutzer.

---

## 11. Gesamt-Empfehlung

**Nicht jetzt den vollen agentischen Loop bauen. Stattdessen gestaffelt + bedarfsgetrieben:**

1. **Jetzt: Etappe 0** — deterministischer Cross-Study-Index + exakte Themen-Frequenz **in Code**, evtl. als Tool/View an Mission-Control angehängt. **Begründung:** beweist den Meta-Wert sofort, ist **halluzinationssicher** (reines Zählen), billig, kein neues Primitiv. Deckt einen echten Teil der „in wie vielen Studien"-Fragen ab, ohne irgendein Loop-Risiko.

2. **Parallel: Kunden-Check** — Studienzahl pro Org **messen** (DB) und 5–10 Nutzer nach ihren echten studienübergreifenden Fragen fragen. **Begründung:** Die teuren/riskanten Fähigkeiten (selektives Laden, Trend) hängen komplett an **unbewiesenen** Annahmen (Volumen, Vergleichbarkeit, Bedarf).

3. **Erst danach, und nur wenn der Check positiv ist: Etappe 1+2** (Loop-Kern + deterministische Aggregation, eval-getrieben). **Begründung:** Der Loop verdient seinen Aufwand nur bei **echtem** hohem Studienvolumen oder **echtem** Bedarf an exakt berechneten Aggregaten — und selbst dann muss der Agent inhaltlich auf verbatim-zitierbare + tool-exakte Aussagen beschränkt bleiben.

**Warum nicht jetzt voll bauen:**
- Mission-Control deckt die Mehrheit der Fragen beim aktuellen Studienvolumen bereits ab — der Agent wäre für ~80–90 % der Fälle Overkill (teurer, langsamer, riskanter).
- Die glamourösen Vorzeige-Fragen (Trend-Umkehr, „dasselbe Thema über Studien") stehen auf dem **schwächsten** Datenfundament (keine geteilte Themen-Achse, keine Trend-Metrik) und sind der **größte** Halluzinationsraum — genau die Fähigkeit, die am schwersten sicher zu bauen ist.
- Der Loop ist ein **neues Primitiv** mit neuer Fehlerklasse (Zwischenschritt-Halluzination, Loop-Runaway, Forced-Tool-Modus-Effekte) und einem deutlich teureren Eval. Das ist ein echtes Investment, das man erst nach Bedarfsnachweis tätigen sollte.

**Anders zuschneiden (die eigentliche Empfehlung):** Den „Cross-Study-Agent" gedanklich aufspalten in **(A)** ein **deterministisches Aggregations-Feature** (sicher, sofort, hoher Wert-pro-Risiko) und **(B)** den **agentischen Loop** (Wette auf Volumen + Bedarf). **(A) jetzt, (B) nach Beweis.** Falls der Kunden-Check zeigt, dass niemand >10 Studien hat und die Meta-Fragen selten sind: **(B) gar nicht bauen** und Mission-Control + Etappe-0-Aggregation als „Cross-Study" verkaufen.
