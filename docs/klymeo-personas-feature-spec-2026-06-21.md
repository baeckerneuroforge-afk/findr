# Klymeo — Persona-Feature Spec (v1)

> Stand: 2026-06-21 · Status: **Spec abgenommen (Interview), noch nicht gebaut** · Leitprinzip: **additive Erweiterung der Synthese-Engine; ohne Personas bleibt jeder bestehende Pfad byte-identisch.**

Personas verdichten die bestehende Studien-Synthese zu 3–5 belegten Zielgruppen-Segmenten. Der Differenzierer ist **nicht** „wir machen auch Personas", sondern die durchgängige **Belegkette + Anti-Halluzinations-Gates** (jeder Trait verbatim verankert, ehrliche Größen server-erzwungen).

---

## Fortschritt (Umsetzung)

- [x] **M1 — Schema** (`synthesis.ts`: AudiencePersona/Evidence/Result-Schemas, EnrichedAudiencePersona + PersonasSummary, `normalizePersonas`/`normalizePersonasSummary`) + Unit-Tests (`synthesis.test.ts`, 12 Tests).
- [x] **M2 — Engine** (`audience-personas.ts`: 2. LLM-Call, 3-Schicht-Anker-Filter, Partition, share-override, Anreicherung, Min-Gate, `generatePersonas`) + Engine-Tests (8). Persona-Prompt in `prompts.ts`; geteilter Service-Client + Anker-Helfer aus `engine.ts` exportiert (DRY). Persona-Spalten-TYPEN in der geteilten Engine-Augmentation vorgezogen (Migration bleibt M3).
- [x] **M3 — Persistenz** (Migration `20260722000000_study_synthesis_personas.sql` + kanonische `db.ts`-Typen + `getStudyPersonas`/`StudyPersonasRecord` in `service.ts`). ⚠️ Migration NOCH NICHT auf Prod-DB angewandt (Deploy-Schritt, gemeinsam prüfen).
- [x] **M4 — API** (`POST /personas/route.ts`, modelliert auf der Synthese-Route: Auth + Ownership-Gate, Domain-Envelope, 404/500; Error-Key `errors.research.personasFailed` in de+en).
- [x] **M5 — UI** (Sub-Route `/personas` page+loading, `PersonaCard` Galerie/Detail+Belegketten+Sentiment, `GeneratePersonasButton`, Min-Gate-Zustand, `research.personas`-i18n de+en (43 Keys, Parität), Link-Karte+TOC auf der Markt-Detailseite). ⚠️ Browser-Hands-on noch offen (braucht Login + market_research-Studie ≥10 Insights + angewandte Migration).
- [x] **M6 — Eval** (deterministische Gates in `eval-checks.ts` — share-honest/min-cluster/disjoint/field-evidence/quote-coverage, alle „fail" + 14 Unit-Tests; `judgePersonas` Grounding-Judge; `PERSONA_EVAL_CASES` inkl. Negativfälle n=1/homogen; Persona-Abschnitt im Runner). LLM-Teile via `pnpm eval:synthesis` mit API-Key (nicht in CI/`vitest run src`).

> Verify-Baseline (vor M1): tsc sauber · vitest 778 grün · eslint 34 **vorbestehende** Fremdfehler (unrelated, NICHT Teil dieses Features). Maßstab: geänderte Dateien fügen 0 neue Lint-Fehler hinzu.

---

## 0. Entscheidungen (aus dem Spec-Interview)

| # | Thema | Entscheidung |
|---|-------|--------------|
| 1 | **Clustering** | **Hybrid** — das LLM clustert emergent aus Zielen/Pains/Verhalten; **share% rechnet der Server** aus den tatsächlich zugeordneten `sourceInsightIds` (wie der `frequency`-Override). |
| 2 | **Cluster-Semantik** | **Strikte Partition** — jeder Befragte in genau einer Persona; Anteile = 100 % (Edge: Rest-Count ehrlich als Fußnote, keine Rest-Karte, s. §5.5). |
| 3 | **Persona-Anzahl** | **Dynamisch 3–5** nach Datenlage. |
| 4 | **Persistenz** | **Additive JSONB-Spalte** `personas` auf `study_synthesis` (Muster wie `methodology`/`stimulus`). |
| 5 | **Min-Gate** | **10 Interviews hart**, sichtbarer Qualitäts-Hinweis zwischen 10 und 15. |
| 6 | **Trait-Anker** | **Pro Feld hart belegt** — jedes Trait-Feld trägt ≥1 verbatim verankertes Zitat; Feld ohne Beleg wird unterdrückt. |
| 7 | **Beleg-Untergrenze je Persona** | **< 2 Zitate aus < 2 Befragten → Persona unterdrückt** (server-seitig, hart). |
| 8 | **Studientypen v1** | **Nur `market_research`** — dort lösen Belegketten zu echten Interview-Sessions auf (klickbar). product_discovery später. |
| 9 | **Erzeugung** | **Eigener `POST /personas`-Endpoint + eigener Button**, separater 2. LLM-Call; unabhängig von der Synthese regenerierbar. |
| 10 | **Oberfläche** | **Eigene Sub-Route** `/research-plans/[id]/personas` (Muster der Synthese-Seite); Karten-Galerie + Detail. |
| 11 | **v1-Umfang** | **Strikt Kern + Vertrauens-Layer.** Vergleich/Chat/Export/predefined bewusst später. |
| 12 | **Felder** | 6 Pflichtfelder **+ Leitzitat + Rolle/Segment-Label + Sentiment-Verteilung** (letzte beide server-berechnet). |
| 13 | **Avatare** | Monogramm statt Foto (aus Aufmachung). |
| 14 | **Sprache** | DE-Ausgabe (Chrome übersetzt DE/EN, Persona-Prosa verbatim wie Synthese). |

**Offen / Implementierungs-Default (überschreibbar):** internes Naming, um die Kollision mit `src/lib/synthetic/personas.ts` (Test-Charakterbögen) und `research_plans.persona` (Freitext) zu vermeiden → Modul `audience-personas.ts`, Typen `AudiencePersona*`, DB-Spalte `personas`, UI-Label „Personas".

---

## 1. Wie die Synthese heute entsteht (Kontext, verifiziert)

- **Stage 1** → `product_discovery_insights` (1 Zeile = 1 Befragter via `source_call_id`): `feature_requests`/`pain_points`/`themes` (JSONB), `summary`, **`respondent_role`/`respondent_segment`/`sentiment`**. Tabellenname ist Legacy — sie hält Stage-1-Insights **aller** Studientypen.
- **Stage 2** → `synthesizeStudy(orgId, planId)` in `src/lib/synthesis/engine.ts`: lädt **nur** verdichtete Zeilen (Kostenschutz, nie Transkripte), **ein** Opus-Call (`claude-opus-4-8`, `maxTokens 10_000`, erzwungenes Tool `emit_study_synthesis`, 180 s).
- **Anker-Maschinerie** (`applyAnchoredFilter`, die Blaupause für Personas):
  - **L1** jede `sourceInsightId` muss im Eingabe-Set existieren; sonst raus; Theme ohne IDs → verworfen.
  - **L2** jedes Zitat **pro zitiertem Insight** verbatim verankert (Typo-Fold: Umlaute/Quotes/Dashes), **nicht** global → blockt Cross-Respondent-Attribution.
  - **L3** `frequency` **immer** server-override = `unique(sourceInsightIds).length`.
- **Persistenz**: `study_synthesis` (`UNIQUE(org_id, plan_id)`, Upsert = last-write-wins); Kern im Haupt-Upsert, additive Felder im **best-effort Zweit-UPDATE**.
- **Eval (Tier-2a)**: „**deterministisch gatet, Judge berät**" — `src/lib/synthesis/eval-checks.ts` (Zahlentreue/Quote-Coverage/Kongruenz), `evals-synthesis/judge.ts` (immer WARN). Runner-Gates `anchored`/`frequency-honest`/`no-fake-tension` sind hart.
- **UI**: keine Tabs; Synthese ist Sub-Route. Belegketten via `mapInsightsToSessionIds` (nur market_research auflösbar).

---

## 2. Datenmodell & Eingabe

- Input = dieselben `SynthesisInsightInput[]` wie die Synthese (Kostenschutz bleibt: nie Transkripte).
- v1 nur Pläne mit `study_type = 'market_research'`. Personas-Button/Route bei anderen Typen ausgeblendet bzw. mit Hinweis.
- Pflicht-Metadaten je Insight: `source_call_id` (Identität), `respondent_role`, `respondent_segment`, `sentiment` → speisen Label & Sentiment-Verteilung **server-seitig**.

---

## 3. Zod-Schema (`src/lib/schemas/synthesis.ts`, additiv)

```ts
// Beleg pro Trait-Feld: verbatim Zitat + Quell-Insights (pro-Insight verankert)
const PersonaEvidenceSchema = z.object({
  field: z.enum(["goal", "pain", "behavior", "motivation", "lead_quote"]),
  text: z.string().min(1).max(400),         // verbatim, wird verankert
  sourceInsightIds: z.array(z.string()).min(1).max(50),
});

const AudiencePersonaSchema = z.object({
  name: z.string().min(2).max(80),          // sprechender Segmentname (DE)
  // share: NUR Modell-Hinweis; Server überschreibt count+percent hart (s. §5.3)
  shareCount: z.number().int().min(0),
  goals: z.array(z.string().min(1).max(300)).min(1).max(6),
  pains: z.array(z.string().min(1).max(300)).min(1).max(6),
  behavior: z.array(z.string().min(1).max(300)).min(1).max(6),
  motivation: z.string().min(1).max(600),
  leadQuote: z.string().min(1).max(400),    // Aushängeschild, verankert
  sourceInsightIds: z.array(z.string()).min(2).max(200), // Cluster-Mitglieder
  evidence: z.array(PersonaEvidenceSchema).min(1).max(40),
});

export const AudiencePersonasResultSchema = z.object({
  personas: z.array(AudiencePersonaSchema).min(0).max(5),
});
```

- **Kein Diskriminator in v1** (nur eine Persona-Art → YAGNI; `z.discriminatedUnion` ist im Stack vorhanden, falls je nötig).
- Server-berechnete Felder (`roleLabel`, `segmentLabel`, `sentimentDistribution`, `sharePercent`) liegen **nicht** im Modell-Output, sondern werden nach dem Anker-Filter ergänzt (kein Halluzinationsfenster).
- `normalizePersonas(value): AudiencePersona[]` defensiv (legacy `undefined`/null → `[]`), damit Reader/PDF/PPTX nie crashen.

---

## 4. Persistenz

- **Migration** `supabase/migrations/2026XXXXXXXXXX_study_synthesis_personas.sql`:
  ```sql
  alter table public.study_synthesis
    add column if not exists personas jsonb,          -- AudiencePersona[] (angereichert)
    add column if not exists personas_summary jsonb,  -- {version,totalInsights,assigned,unassigned,generatedAt,model}
    add column if not exists personas_generated_at timestamptz;
  ```
- **Typen** `src/lib/research/db.ts` (`StudySynthesisRow/Insert/Update`) um die drei Spalten erweitern (`Json`).
- Schreiben im **best-effort Block** (gleiches Muster wie methodology/stimulus): `personas` wird unabhängig vom Synthese-Upsert über `POST /personas` aktualisiert (eigener Schreibpfad, nicht im Synthese-Flow).
- **Read**: `getStudyPersonas(orgId, planId)` analog `getStudySynthesis` mit `normalizePersonas`.

---

## 5. Engine (`src/lib/synthesis/audience-personas.ts`)

### 5.1 Entry & Call
- `generatePersonas(orgId, planId, model?)` → lädt Plan + Insights (wie `synthesizeStudy`), prüft Min-Gate, ruft `clusterPersonasFromInputs(input, model)`.
- Separater strukturierter Call `callClaudeStructured(AudiencePersonasResultSchema, …, toolName: "emit_audience_personas")`.
- `SYNTHESIS_PERSONA_MODEL` (Default `CLAUDE_MODELS.opus`), `maxTokens` ~16_000 (5 Personas × reiche Felder + Evidence), `maxDuration = 300` auf der Route.
- Prompt-Auftrag: **strikte Partition** (jeder Befragte exakt einem Segment), 3–5 Segmente nach Datenlage, jedes Trait-Feld mit ≥1 verbatim Zitat aus den Insights belegen, Anker-Regeln wörtlich nennen („Engine re-checkt und verwirft").

### 5.2 Anker-Filter `applyPersonaAnchoredFilter` (analog `applyAnchoredFilter`)
1. `sourceInsightIds` → nur existierende IDs behalten.
2. Jedes `evidence.text` **pro zitiertem Insight** verbatim verankern (Fold). Nicht verankerte Evidence raus.
3. **Trait-Feld ohne überlebende Evidence → Feld unterdrücken** (Entscheidung #6).
4. **Disjunktheit erzwingen** (Partition): erscheint ein Befragter in mehreren Personas, bleibt er nur in der mit der stärksten Evidence (sonst erste); aus den anderen entfernt.
5. **Min-Cluster-Gate**: Persona mit `unique(sourceInsightIds).length < 2` ODER ohne ≥2 verankerte Zitate → **komplett verworfen** (Entscheidung #7).

### 5.3 Ehrliche Größe (server-override, wie `frequency`)
- `shareCount = unique(sourceInsightIds).length` (überschreibt Modellwert).
- `sharePercent = round(shareCount / totalInsights * 100)`.
- `totalInsights = insights.length` (Live-Count zum Erzeugungszeitpunkt — **nicht** das veraltbare `based_on_count` der Synthese).

### 5.4 Server-berechnete Anreicherung (kein LLM)
- `roleLabel` / `segmentLabel` = Modus von `respondent_role`/`respondent_segment` über die Cluster-Mitglieder.
- `sentimentDistribution` = Zählung `sentiment` (positive/neutral/negative/mixed) über die Mitglieder.

### 5.5 Coverage / Partition-Edge
- `personas_summary` führt `assigned = Σ shareCount`, `unassigned = totalInsights − assigned`.
- Bleiben Befragte nach Anker-Filter unzugeordnet (z. B. einzige Zuordnung fiel mangels Verankerung weg), **keine** erzwungene Zuordnung und **keine** Rest-Karte (Entscheidung #2): Anteile bleiben ehrlich, `unassigned > 0` wird in der UI als kleine Fußnote „k Befragte nicht eindeutig zuzuordnen" gezeigt.

### 5.6 Min-Gate
- Konstante `MIN_PERSONA_INTERVIEWS = 10`, `PERSONA_QUALITY_HINT_UNTIL = 15`.
- Neuer Rückgabestatus `insufficient_data` (Engine-seitig, symmetrisch zu `no_insights`).
- `< 10` → kein Call, Status `insufficient_data`. `10 ≤ N < 15` → Call läuft, `personas_summary.qualityHint = true`.

---

## 6. API (`src/app/api/research/plans/[id]/personas/route.ts`)
- `POST` — Auth + `getResearchPlan`-Ownership-Gate (Muster der Synthese-Route), `maxDuration = 300`.
- Studientyp-Guard: kein `market_research` → `409`/`422` mit klarer Meldung.
- `< MIN_PERSONA_INTERVIEWS` → `200 { status: 'insufficient_data', count }` (UI greift Gate ab; kein Fehler).
- Erfolg → `200 { success: true, result }` (Envelope wie `SynthesizeStudyResult` — **nicht** der Record; der alte Synthese-TODO-Kommentar ist falsch, hier von Anfang sauber).
- Optional `GET` für SSR-Reads (oder Server-Component liest direkt via Service).

---

## 7. UI (`/research-plans/[id]/personas`, Server-Component)
- **Karten-Galerie**: Monogramm + `name`, `sharePercent` (Balken), `roleLabel`/`segmentLabel`, 1 Leitzitat.
- **Detailansicht**: Ziele/Pains/Verhalten/Motivation; an **jedem Trait** die Belegkette → klickbarer Link zur Interview-Session (`mapInsightsToSessionIds`, in v1 immer auflösbar, weil nur market_research). Sentiment-Verteilung als kleine Leiste.
- **Erzeugen/Neu-erzeugen-Knopf**: UX-Wiederverwendung von `UpdateSynthesisButton` (Spinner/Inline-Fehler/Toast + `router.refresh()`), POST auf `/personas`.
- **Min-Gate-Zustand**: `< 10` → Button **ausgegraut** + Hinweis „ab 10 Interviews erzeugbar (aktuell N)". `10–14` → Button aktiv + dezenter Qualitäts-Hinweis.
- **Empty/Loading**: `EmptyState` + `loading.tsx`-Skeleton (Muster der Synthese-Seite).
- **Link-Karte** von der Plan-Detailseite (neben der Synthese-Karte).
- **i18n**: neuer Namespace `research.personas` in **`de.json` UND `en.json`** (Parity-Test `src/i18n/messages-parity.test.ts` erzwingt Gleichstand). Chrome DE/EN; Persona-Prosa verbatim.

---

## 8. Eval (`evals-synthesis/` + `src/lib/synthesis/eval-checks.ts`)
**Prinzip:** deterministisch gatet (FAIL), Judge berät (WARN).

**Neue deterministische Gates (hart FAIL):**
- `persona-anchored` — jede `sourceInsightId` ∈ Eingabe-Set; jedes `evidence.text` pro zitiertem Insight verankert.
- `persona-share-honest` — `shareCount == unique(sourceInsightIds).length` und `sharePercent == round(count/total*100)`.
- `persona-min-cluster` — keine Persona mit < 2 Mitgliedern / < 2 Zitaten.
- `persona-disjoint` — Cluster paarweise disjunkt (Partition).
- `persona-no-n1` — Negativfall: aus n=1-Input darf **keine** Persona entstehen.

**Judge-WARN (Prosa-Grounding):** `judge.ts` um Persona-Felder erweitern (Ziele/Pains/Verhalten/Motivation/Name) → `unsupported_claim` ⇒ WARN „erfundener Trait". (Determ. Scan fängt Zahlen, nicht Traits.)

**Negativ-Fälle im Dataset (analog `synth_15`):**
- `persona_n1` — 1 Interview → erwartet 0 Personas (HARD).
- `persona_invented_trait` — Input ohne Beleg für ein Trait → Feld muss unterdrückt sein / Judge-WARN.
- `persona_inflated_share` — Modell nennt 80 %, real 40 % → Server-Override greift, `share-honest` grün.
- `persona_singleton_cluster` — ein Cluster mit 1 Stimme → muss verworfen sein.

**Lauf:** `pnpm eval:synthesis` (Persona-Fälle in `evals-synthesis/dataset.ts` + Checks in `eval-checks.ts`, von Runner **und** `eval-checks.test.ts` importiert).

---

## 9. Anti-Halluzinations-Invarianten (Zusammenfassung)
1. Kein Trait ohne pro-Insight verankertes verbatim Zitat (sonst Feld weg).
2. Keine Persona aus < 2 Stimmen / < 2 Zitaten (sonst Persona weg).
3. `share%` server-erzwungen aus echten Mitglied-IDs gegen Live-Total — Schönen strukturell unmöglich.
4. Rolle/Segment-Label & Sentiment server-berechnet, nie vom LLM.
5. Partition disjunkt erzwungen; Rest ehrlich ausgewiesen statt erzwungen zugeordnet.
6. Kostenschutz: nur verdichtete Insights, nie Transkripte.

---

## 10. Bewusst NICHT in v1 (später)
Persona-Vergleich (A vs B), Persona-Chat (DSGVO-Prüfung nötig), Export in Share-Link/PDF/PPTX, vordefinierte vs. auto-generierte Personas, Avatare/Fotos, product_discovery-Support (Belegkette ohne Sessions), Persona-Versionshistorie, Cross-Study-Personas.

---

## 11. Meilensteine & Verify
1. **M1 Schema** (`synthesis.ts` + `normalizePersonas`) + Unit-Tests.
2. **M2 Engine** (`audience-personas.ts`: Call, Anker-Filter, share-override, Anreicherung, Min-Gate) + Engine-Tests (Anker/Partition/Min-Cluster wie `engine.test.ts`).
3. **M3 Persistenz** (Migration + `db.ts`-Typen + Service-Read).
4. **M4 API** (`POST /personas`).
5. **M5 UI** (Sub-Route, Galerie, Detail, Belegketten, Min-Gate-Zustand, Button, i18n `de`+`en`).
6. **M6 Eval** (deterministische Gates + Judge-Erweiterung + Negativfälle).

**Verify je Schritt:** `tsc` 0, `vitest run` (neue Suites grün), `messages-parity` grün, abschließend `pnpm eval:synthesis` mit Persona-Fällen (Gates grün, Negativfälle wie erwartet).

**Risiken/Gotchas:** Upsert last-write-wins (gleichzeitige Erzeugung = Race, akzeptiert wie Synthese); `based_on_count` veraltet → für share% Live-Count nutzen; Fold muss identisch zur Engine bleiben (bewusst dupliziert); legacy `study_synthesis`-Zeilen ohne `personas`-Spalte → `normalizePersonas` muss `undefined` tolerieren.
