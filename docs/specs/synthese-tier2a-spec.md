# Spezifikation — Synthese Tier 2a (Prosa-Grounding-Messung & Methoden-Kongruenz)

Status: ENTWURF zur Freigabe · Branch: `docs/synthese-tier2a-spec` · Basis: `main` (cf0e98d)
Vorgeschichte: [Synthese-Audit](../audits/synthese-audit.md) (Befund #1 = unverankerte Freitext-Prosa) · Tier-1-Fixes (Per-Insight-Quote-Verankerung, app-weiter Opus-4.8-Bump, gemergt auf main).

Diese Spec beschreibt **was** gebaut werden soll und **welche Akzeptanzkriterien** gelten. Sie enthält **keinen** Implementierungscode. Erstellt im Interview-Verfahren; jede Entscheidung unten ist eine bestätigte Antwort, kein Vorschlag.

---

## 0. Übergeordnete Regel (gilt für die ganze Spec)

> **Alles, was ein neues Schema-Feld oder eine DB-Migration bräuchte, gehört nach Tier 2b — nicht in 2a.**

Diese Regel hat im Zweifel Vorrang. Tier 2a ist bewusst **mess-lastig**: es prüft und dokumentiert die Grounding-Lage der Synthese, ohne den Persistenz-Pfad, das Output-Schema oder die Datenbank umzubauen. Der **einzige** Eingriff in den Produktions-Pfad in ganz 2a ist **eine zusätzliche Prompt-Zeile** (Feature A2). Alles Übrige ist Eval-Code oder Kommentar-Korrektur.

---

## 1. Ziel und Nicht-Ziele

### Ziel
Die Synthese-Stage-2 trennt heute streng zwischen maschinell verankerten Feldern (`sourceInsightIds`, `quotes`) und freier, **nicht** verankerter Prosa (`overview`, `emergent_themes[].summary`, `tensions[].description`). Letztere ist der Audit-Befund #1 („hoch"): eine Mengen- oder Wertaussage im `overview` (z.B. „8 von 10 Befragten …") wird heute durch **nichts** gedeckt.

Tier 2a soll diese Lücke **messbar und ehrlich** machen:
1. die Treue der Prosa zu den Eingaben in der Eval **messen** (deterministisch + per LLM-Judge),
2. Methoden-Kongruenz (passt die Synthese zur Studienmethode?) in der Eval **prüfen**,
3. die Belegdichte (Themen/Tensions ohne wörtliches Zitat) in der Eval **sichtbar machen**,
4. die tatsächliche Grounding-Lage im Code **ehrlich dokumentieren**.

### Nicht-Ziele
- **Keine** Durchsetzung im Prod-Pfad (kein Strippen/Umschreiben von Prosa, kein Prod-Grounding-Judge).
- **Keine** Schema-Änderung, **kein** neues Output-Feld, **keine** DB-Migration.
- **Keine** Umstrukturierung des Synthese-Schemas pro Studientyp (Zod-Diskriminator) — das ist 2b.
- **Keine** Eval-Gates auf Basis nicht-deterministischer Urteile (der LLM-Judge berät, gatet nie — siehe §3 Prinzip).

---

## 2. In-Scope (die vier Tier-2a-Punkte)

| ID | Feature | Eingriffsort | Schweregrad bei Verstoß |
|----|---------|--------------|--------------------------|
| **A1** | Methoden-Kongruenz | Eval-only (Judge-Inhaltskategorie + Regel) | WARN |
| **A2** | Prosa-Zahlentreue | Eval (deterministischer Scan) **+ 1 Prompt-Zeile** | FAIL (`overview`, `tension.description`) / WARN (`theme.summary`) |
| **A3** | LLM-Judge Prosa-Deckung | Eval-only | WARN (immer, überall) |
| **A4** | Belegpflicht-Messung (`quotes`) | Eval-only **+ Kommentar-Fix** | WARN |

### Querschnitts-Prinzip (in §3 verankert, gilt für alle vier)
> **Deterministische Checks dürfen gaten (FAIL, `process.exitCode=1`). LLM-Judge-Checks beraten nur (WARN). Der Judge gatet nirgends — auch nicht im `overview`.**

### Querschnitts-Prinzip „keine verdeckte Lücke"
Provozierende Fixtures beweisen einen Check **nicht** (das Modell kann sich korrekt verhalten und der WARN feuert nie). Darum gilt: **jede deterministische Check-Logik bekommt zusätzlich einen deterministischen Unit-Test mit synthetischem Output**, der beweist, dass der Check feuert, wenn er soll (Lehre aus dem Tier-1-P1-Negativtest). Der LLM-Judge bekommt einen **Verdrahtungstest mit gestubbtem Judge-Output** (parst der Runner das strukturierte Verdikt korrekt zu WARN?).

---

### A1 — Methoden-Kongruenz

**Gewünschtes Verhalten**
- Enforcement ausschließlich in der **Eval** (R1.1). Die vorhandenen Prosa-Hinweise in den System-Prompts (`MARKET_SYNTHESIS_USE_CASE_FOCUS`) bleiben **unverändert** — keine neue harte Prompt-Restriktion.
- Da Stage-2-Themen/Tensions **kein Kategorie-Feld** tragen, wird Kongruenz auf dem **Inhalt** geprüft: der LLM-Judge (A3) klassifiziert jede Tension/jedes Theme in eine **Methoden-Kategorie** (z.B. `price`, `purchase_intent`, `pain`, `brand_perception`, `competitive`, `segment_need`, `message_effect`, `concept_understanding`). Ein deterministischer Regel-Mapper entscheidet dann je `study_type`/`use_case`, ob diese Kategorie zulässig ist.
- **Regelsatz** (Deny-Listen):
  - `brand_research`, `creative_test` → **keine** Preis-/Kaufabsichts-/Pain-Tension (zulässig: Wahrnehmungs-/Botschafts-/Differenzierungs-Splits).
  - `concept_test` → zulässig: Verständnis/Relevanz/Adoption; **reine Pain-Tension untypisch** → Inkongruenz.
  - `product_discovery` (study_type, nicht-`market_research`) → zulässig: Feature/Pain; **keine** Markt-Preis-Lager-Tension.
  - `general_survey` → **breit, keine Deny-List** (Bedarf/Preis/Kaufabsicht zulässig). → kein Negativfall nötig; das wird **explizit dokumentiert**, nicht stillschweigend übersprungen.
- Verstoß = **WARN** (R1.3): Methoden-Fokus ist Qualität/Tendenz, kein Grounding-Bruch.

**Akzeptanzkriterien**
- [ ] Der Runner besitzt einen deterministischen Regel-Mapper `(kategorie, studyType, useCase) → kongruent? (boolean)` mit obigem Regelsatz.
- [ ] Für jeden Fall mit bekannter Methode klassifiziert der Judge Tensions/Themes; eine inkongruente Kategorie erzeugt genau **einen WARN** (nie FAIL).
- [ ] **Deterministischer Unit-Test** des Regel-Mappers: synthetische Kategorie `price` unter `brand_research` → inkongruent; `pain` unter `creative_test` → inkongruent; `pain` unter `concept_test` → inkongruent; `market_price_lager` unter `product_discovery` → inkongruent; `price` unter `general_survey` → kongruent.
- [ ] `general_survey` ist im Mapper nachweislich ohne Deny-List (Test belegt: keine Kategorie wird dort inkongruent).

**Neue Eval-Fälle / Datensätze (Pflicht, nicht optional)** — je Methoden-Regel mindestens ein **Negativfall** (provozierender Input):
- [ ] `brand_research`-Negativ: überwiegend `BRAND_PERCEPTION`-Input **mit eingestreutem Preissignal**, das eine Preis-Tension nahelegt → erwartet: keine Preis-/Intent-/Pain-Tension (kongruent).
- [ ] `creative_test`-Negativ: überwiegend Botschafts-/Wirkungs-Input **mit eingestreutem Frust-/Pain-Signal**, das eine Pain-Tension nahelegt → erwartet: keine Pain-Tension.
- [ ] `concept_test`-Negativ: Input, der eine **reine Pain-Tension** provoziert → erwartet: Achse bleibt Verständnis/Relevanz/Adoption.
- [ ] `product_discovery`-Negativ: Feature/Pain-Input **mit eingestreutem Preis-Segmentierungssignal**, das eine Markt-Preis-Lager-Tension nahelegt → erwartet: keine solche Tension.
- [ ] Keine Fixture wird so gebaut, dass sie die Lücke verdeckt; die Beweislast, dass der Check feuert, trägt der deterministische Unit-Test (oben), nicht die Fixture.

---

### A2 — Prosa-Zahlentreue

**Gewünschtes Verhalten**
- **Erlaubt-Modell** (R2.1): eine Ganzzahl in der Prosa ist zulässig, wenn sie **entweder** eine Server-Zahl ist (`based_on_count`, ein `frequency`-Wert, die Größe einer `sourceInsightIds`-Menge) **oder** wörtlich im **gefoldeten Input-Haystack** vorkommt (z.B. „20 Euro" aus einem evidence-Zitat). Erfundene Counts/Prozente sind verboten.
- **Mechanik** (R2.2): deterministischer Ganzzahl-Scan über `overview` + jede `theme.summary` + jede `tension.description`. Allowlist = {alle `frequency`-Werte, `based_on_count`, Größen der id-Mengen} ∪ {alle Ganzzahlen, die im gefoldeten Input-Haystack vorkommen} ∪ {Ganzzahlen aus `plan.title` + `plan.objective`}. Nur Zahlen, die in **keiner** Menge liegen, werden als Befund gemeldet. *(Plan-Titel/Objective ergänzt nach Live-Kalibrierung — s. Notiz unten.)*
- **Schweregrad** (R2.3): **FAIL** in `overview` und `tension.description` (die käuferseitig gelesenen Gesamtaussagen — dort ist eine erfundene Mengenaussage am schädlichsten); **WARN** in `theme.summary` (granularer, varianzanfälliger).
  - **🔧 Kalibrierungs-Notiz (nach Live-Lauf):** Der Schweregrad wurde **bewusst überall auf WARN herabgestuft** — auch in `overview`/`tension.description`. Der Live-Eval zeigte False-Positive-FAILs auf *legitimer* Synthese (Studientitel-Zahlen wie „Q3"; korrekt abgeleitete Teil-Counts wie „n=2"), und A2 war der einzige gatende Tier-2a-Check. Gegenmaßnahmen: (1) Allowlist um Plan-Titel/Objective erweitert (oben), (2) Schweregrad → WARN. Die **FAIL-Schärfe kann zurückkehren**, sobald die Allowlist erprobt ist (das `"fail"`-Literal im `CheckSeverity`-Typ bleibt dafür erhalten). Konsequenz: die Tier-2a-Schicht gatet aktuell nicht mehr hart; die ursprünglichen Anti-Halluzinations-Gates im Runner (anchored, frequency-honest, no-fake-tension, methodology-/signal-gate) bleiben unberührt und **hart**.
- **Prod** (R2.4): am Check **nur Messung** (kein Prod-Eingriff). **Zusätzlich** der einzige Prod-Touch in 2a: eine **Prompt-Zeile** „nenne Zahlen nur, wenn sie aus den Eingaben stammen" — reine Prompt-Prosa, kein Schema/Migration. Die Zeile wird in **beide** Synthese-System-Prompts gespiegelt (Discovery + Market), da `overview`/`summary`/`description` unter beiden Personas entstehen.

**Akzeptanzkriterien**
- [ ] Der Scan nutzt dieselbe Typografie-`fold()`-Logik wie die Engine (Konsistenz mit dem Anker-Haystack).
- [ ] Eine erfundene Ganzzahl im `overview`, in `tension.description` **oder** `theme.summary` erzeugt einen **WARN**-Befund (nach Kalibrierung kein FAIL mehr; `exitCode` bleibt bei reinen WARNs 0). Die Fabrikation MUSS weiterhin als Befund erscheinen (Anti-Aufweichen).
- [ ] Legitime Zitat-Zahlen (z.B. „20" in „20 Euro" aus einem evidence-Quote, Jahreszahlen) erzeugen **keinen** Befund (Haystack-Allowlist greift).
- [ ] Eine Zahl, die nur in `plan.title`/`plan.objective` vorkommt (z.B. „Q3"), erzeugt **keinen** Befund (planContext-Allowlist greift) — Gegenprobe ohne planContext liefert den WARN.
- [ ] **Deterministischer Unit-Test** des Scanners: `overview` mit „8 von 10" (frei erfunden) → WARN-Befund; `overview` mit einer echten `frequency`-Zahl → ok; `tension.description` mit Haystack-Zahl „20" → ok; `theme.summary` mit Fremd-Zahl → WARN.
- [ ] Die Prompt-Zeile existiert wörtlich in **beiden** System-Prompts.
- [ ] **Bewusste, dokumentierte Grenze:** der Ziffern-Scan erfasst **keine** ausgeschriebenen Zahlen („acht von zehn", „die Hälfte") — diese fängt der LLM-Judge (A3). Die Grenze wird im Code/Doku benannt, nicht verschwiegen.

---

### A3 — LLM-Judge für Prosa-Deckung

**Gewünschtes Verhalten**
- **Modell** (R3.1): `claude-sonnet-5` (Sonnet 5) als Default-Judge; override via Env (z.B. `SYNTHESIS_JUDGE_MODEL`). Bei Eval-Volumen (≈15 Fälle, gelegentliche Läufe) ist die Kost trivial; Sonnets Urteilsstärke wiegt schwerer als der Cent-Unterschied zu Haiku 4.5. **Hinweis:** der `effort`-Parameter darf bei Haiku 4.5 **nicht** gesetzt werden (Haiku 4.5 lehnt ihn per 400 ab) — der Judge-Call setzt `effort` nicht bzw. nur modellbedingt.
- **Eingaben:** der Judge erhält das **Input-Material** (die Insights des Falls) **und** die erzeugte Prosa.
- **Geprüfte Felder** (R3.2): `overview`, jede `theme.summary`, jede `tension.description`.
- **Doppelnutzung** (R3.2): **ein** Judge-Call je Fall liefert **getrennte strukturierte Felder** — (1) ein **Grounding-Verdikt je Feld** (`grounded | unsupported_claim`), (2) die **Methoden-Kategorie** je Tension/Theme (für A1). **Kein** verschmolzenes Prosa-Urteil; beide Outputs sind separate, schema-validierte Felder.
- **Schwelle/Schweregrad** (R3.3): jeder Judge-Befund = **WARN**, **auch im `overview`**. Der Judge gatet nirgends.

**Akzeptanzkriterien**
- [ ] Der Judge nutzt forced/structured output (wie `callClaudeStructured`) mit einem Schema, das Grounding-Verdikt und Methoden-Kategorie als **getrennte** Felder erzwingt.
- [ ] ≥1 `unsupported_claim` in einem Feld erzeugt **WARN** (nie FAIL), unabhängig vom Feld.
- [ ] Der A1-Regel-Mapper konsumiert die Methoden-Kategorie aus demselben Judge-Output (kein zweiter LLM-Call).
- [ ] **Verdrahtungstest mit gestubbtem Judge-Output:** ein synthetisches Judge-Ergebnis mit einem `unsupported_claim` wird vom Runner korrekt zu einem WARN gemappt; ein vollständig `grounded`-Ergebnis erzeugt keinen Befund.
- [ ] Prod-Pfad bleibt unberührt (kein Judge-Call in `synthesizeStudy`/`synthesizeFromInputs`).

---

### A4 — Belegpflicht-Messung (`quotes`)

**Gewünschtes Verhalten**
- **Verhalten** (R4.1, Variante c): **Prod unverändert**. Kein Hart-Entfernen quote-loser Themen, kein weiches „ohne Beleg"-Flag (Ersteres greift in P1 ein und widerspricht dem dokumentierten Design, dass summaries-grounded Themes erlaubt sind; Letzteres bräuchte ein Schema-Feld → 2b). In 2a **misst** die Eval nur: ein Theme/eine Tension-Seite ohne wörtliches Zitat (nach Anker-Filter) → **WARN**.
- **Geltungsbereich** (R4.2): `emergent_themes` **und** `tensions[].side_a` / `tensions[].side_b`.
- **Stale Kommentar** (R4.3): der irreführende Kommentar an `EmergentThemeSchema.quotes` in `src/lib/schemas/synthesis.ts` („the eval flags quote-less themes for human review") wird an den **tatsächlichen** WARN-Check angepasst — mit (c) wird die Aussage wahr.

**Akzeptanzkriterien**
- [ ] Ein Theme mit `quotes: []` (nach Anker-Filter) erzeugt **WARN**; eine Tension-Seite mit `quotes: []` ebenso.
- [ ] Ein Theme/eine Seite mit ≥1 verankertem Zitat erzeugt **keinen** Befund.
- [ ] **Deterministischer Unit-Test** der Coverage-Logik: quote-loses Theme → WARN; Theme mit Zitat → ok; quote-lose Tension-Seite → WARN.
- [ ] Der Schema-Kommentar beschreibt den real existierenden Check (keine Soll-Behauptung mehr).
- [ ] Prod-Pfad (`applyAnchoredFilter`, Survival-Regel) bleibt **unverändert** — quote-lose Themes überleben weiterhin über gültige IDs.

---

## 3. Querschnitts-Prinzip (Spec-Festschreibung)

```
Deterministische Checks gaten (FAIL, exitCode=1).
LLM-Judge-Checks beraten (WARN). Der Judge gatet nirgends — auch nicht im overview.
```

Konkret:
- **FAIL** ist ausschließlich dem **deterministischen Zahlen-Scan** (A2) in `overview` und `tension.description` vorbehalten.
- A1 (Kongruenz, vom Judge gespeist), A3 (Grounding-Judge), A4 (Belegdichte) sowie A2 in `theme.summary` sind **WARN**.
- Begründung: nicht-deterministische Urteile multiplizieren die Flakiness (Generator-Varianz × Judge-Varianz); ein gateter Judge würde die Eval instabil machen. Der manuelle Read bleibt — wie heute — das primäre Urteil; die Checks sind unterstützende Signale.

---

## 4. Ehrliche Grounding-Doku (Vorschlag-Wortlaut, Feature aus R5.3)

Einzubauen als Doku-Kommentar in `src/lib/synthesis/engine.ts` (beim bestehenden „Anchoring is enforced THREE times"-Block). Vorgabe: **ehrlich, nicht überverkaufend** — klar sagen, dass nur IDs und wörtliche Zitate anker-geprüft sind und `overview`/`summary`/`description` interpretierende, nicht maschinell verankerte Prosa sind. Vorgeschlagener Wortlaut (Andrés Freigabe vorbehalten):

> **GROUNDING — was maschinell verankert ist und was nicht (ehrlich).**
> Die Synthese trennt zwei Arten von Output:
> - **Maschinell verankert:** `sourceInsightIds` (müssen im Input-Set existieren) und `quotes` (müssen nach Typografie-Fold wörtlich in mindestens einer der *zitierten* Insight-IDs vorkommen — Per-Insight-Anker, Tier-1). Was diese Prüfung nicht besteht, wird verworfen.
> - **Interpretierende Prosa, NICHT maschinell verankert:** `overview`, `emergent_themes[].summary` und `tensions[].description` sind die Formulierung des Modells. Sie sind im Prompt an die zitierten Insights gebunden (das Modell zitiert IDs), aber es gibt **keine** programmatische Wort-für-Wort-Prüfung ihres Inhalts. Eine Mengen- oder Wertaussage in dieser Prosa ist nur so verlässlich wie das Modell — sie ist **keine** vom Server bestätigte Kennzahl. Verlässliche Kennzahlen kommen ausschließlich aus den Server-Feldern (`based_on_count`, `frequency`, `signals_summary`, `stimulus_summary`).
>
> Die Synthese-Eval misst die Treue dieser Prosa zusätzlich (deterministischer Zahlen-Scan + LLM-Grounding-Judge), aber das ist eine **Qualitätsmessung, kein Persistenz-Gate**: der Prod-Pfad schreibt die Prosa unverändert.

---

## 5. Voraussichtlich betroffene Dateien (nur Vermutung, kein Code)

**Eval (Hauptlast):**
- `evals-synthesis/run.ts` — neue Checks: A2-Zahlen-Scan, A4-Belegdichte, A1-Kongruenz-Konsum, A3-Judge-Call + Parsing; Judge-Modell-Env.
- `evals-synthesis/dataset.ts` — 4 neue Negativfälle (z.B. `synth_12`…`synth_15`) + neue `expected`-Felder (Kongruenz-Erwartung, evtl. Belegdichte).
- **Neu** `evals-synthesis/judge.ts` (o.ä.) — Sonnet-Judge-Prompt + strukturiertes Schema (getrennte Felder Grounding-Verdikt / Methoden-Kategorie), `callClaudeStructured`-basiert.

**Deterministische Check-Helfer + Unit-Tests** (damit `vitest run src` sie ausführt):
- **Empfehlung/offen (§6):** ein **pures Modul unter `src/lib/synthesis/`** (z.B. `eval-checks.ts`) mit `numberFidelityScan`, `quoteCoverageScan`, `methodCongruenceRule` — vom Runner importiert, mit ko-lokalem Test `src/lib/synthesis/eval-checks.test.ts`. Reuse der bestehenden `vitest run src`-Glob, kein Config-Umbau. (Alternative: vitest-Glob auf `evals-synthesis/` erweitern.)

**Prod-Pfad (genau ein behavioraler Touch + zwei Kommentare):**
- `src/lib/synthesis/prompts.ts` — **+1 Prompt-Zeile** (A2.4) in **beiden** System-Prompts (`STUDY_SYNTHESIS_SYSTEM_PROMPT` + `MARKET_STUDY_SYNTHESIS_SYSTEM_PROMPT`). *(Einziger Verhaltensänderung in 2a.)*
- `src/lib/synthesis/engine.ts` — **nur Kommentar** (Grounding-Doku, §4). Keine Logikänderung.
- `src/lib/schemas/synthesis.ts` — **nur Kommentar** (A4.3, stale-Kommentar-Fix). Keine Schema-Änderung.

---

## 6. Risiken und offene Punkte

1. **Eval-Laufzeit/Kosten steigen:** pro Fall jetzt 2 Modell-Calls (Opus-Synthese + Sonnet-Judge) × ≈15 Fälle. Kostenrahmen pro Lauf weiterhin niedrig (niedriger einstelliger USD-Bereich), aber spürbar länger; ggf. Judge nur on-demand (Env-Flag) ausführbar machen.
2. **Wo leben die deterministischen Check-Helfer + Tests?** (offen, Empfehlung in §5: pures Modul unter `src/lib/synthesis/`, damit `vitest run src` ohne Config-Änderung greift.) Bitte bei Implementierung bestätigen.
3. **Zahlen-Scan-Grenzen:** erfasst nur Ziffern, keine ausgeschriebenen Zahlen/Anteile; bewusste Lücke, durch den Judge (A3) abgedeckt. Muss dokumentiert sein, sonst liest sich „grün" als „alles geprüft".
4. **A1-Regelsatz ist eine Heuristik:** Deny-Listen für brand/creative/concept können legitime Grenzfälle treffen → genau deshalb **WARN, nicht FAIL**. Regelsatz ist bewusst grob; Verfeinerung ist 2b-Material.
5. **Judge-Varianz:** WARN-only mildert, aber WARNs können rauschen; der manuelle Read bleibt primär. Der Verdrahtungstest sichert nur das Mapping, nicht die Urteilsqualität.
6. **Negativfälle provozieren, erzwingen aber nicht:** ein wohlverhaltenes Modell lässt den WARN nie feuern. Die Beweislast trägt der **deterministische Unit-Test** der jeweiligen Check-Logik (§2 Querschnitts-Prinzip „keine verdeckte Lücke").
7. **`general_survey` ohne Deny-List:** bewusst kein Negativfall — explizit dokumentiert, keine stille Auslassung.

---

## 7. Ausdrücklich Out-of-Scope (Tier 2b)

- **`quotes`-Durchsetzung:** quote-lose Themen/Seiten **hart entfernen** (Engine-Eingriff in P1) **oder** **weich** mit „ohne Beleg"-Flag behalten (braucht neues Schema-Feld). In 2a nur gemessen (A4); die eigentliche Hart/Weich-Produktentscheidung ist geparkt.
- **Zod-Diskriminator je `study_type`** (discriminated union von `StudySynthesisResultSchema`) — Schema-Umbau.
- **Prod-Plausibilisierung:** Prod-Grounding-Judge (zweiter LLM-Call im Synthese-Pfad), Prod-Zahlen-Enforcement (Strippen/Umschreiben käufer-sichtbarer Prosa).
- **Jedes neue Schema-Feld, jede DB-Migration.**

---

## 8. Ausdrücklicher Hinweis

> **In Tier 2a gibt es KEINE DB-Migration und KEIN neues Schema-Feld.** Der einzige Produktions-Pfad-Eingriff ist eine einzelne Prompt-Zeile (A2). Migrationen und Schema-Änderungen werden — wenn überhaupt — manuell und in Tier 2b durchgeführt.
