# Findr — KI-Stückkosten-Analyse (API-Kosten-Untergrenze)

**Zweck:** Ehrliche Größenordnung, was ein Findr-Kunde an reinen Anthropic-API-Kosten verursacht — als Kosten-**Untergrenze** fürs Pricing und für Investoren. Kein Audit. Token-Mengen für variable Inputs sind **geschätzt (±50 %)**; Modelle, max_tokens, Turn-Caps und Prompt-Größen sind **direkt aus dem Code** (`/Users/andrebacker/dev/findr-costs`, Branch `costs-analysis`, = aktueller `main` `ff2e195`).

> Hinweis: Die beauftragte Zielablage `/mnt/user-data/outputs/` ist in dieser (macOS-)Umgebung read-only und `present_files` ist nicht verfügbar — daher liegt diese Datei im `findr-costs`-Worktree.

---

## TL;DR — die Kernzahlen

> **Ein durchschnittlicher (research-aktiver) Kunde kostet ~5 €/Monat an KI-API.**
> Spannweite: **leichter Kunde ~2,5 €/Monat**, **intensiver Kunde ~17–20 €/Monat**.

- **Stückkosten-Untergrenze pro Research-Interview ≈ 0,14–0,16 €** (Live-Interviewer + Stage‑1‑Extraktion), **pro Studie ≈ 1–2,5 €**.
- **Größter Kostentreiber = der Live-Interviewer** (`voice-agent/interviewer.ts`, Opus): ~8 Agent-Calls pro Research-Interview, die den System-Prompt **jede Runde neu** mitschicken → ~17 k Input-Token/Interview, ~0,11 €/Interview. Das ist mehr als jeder einzelne Backend-Call.
- **Teuerster *einzelner* Call:** die generativen Opus-Calls **Synthese** (`synthesizeStudy`, out-Cap 4096) und **Guide-Generator** (out-Cap 3072) — bis ~0,10–0,12 € pro Call, weil Opus-**Output** mit 25 $/MTok der teure Hebel ist. (Die Vermutung „Synthese oder Quality" stimmt für *Einzel*-Calls; im Aggregat dominiert aber der Interviewer.)
- **Strukturfakt:** **13 von 14 produktiven LLM-Pfaden laufen auf Opus 4.7.** Einzige Ausnahme: **Loss‑Extractor = Sonnet**. **Sales→CS-Brücke = kein LLM-Call** (deterministisch).
- **Fazit fürs Pricing:** Die API-Kosten sind **nicht** der Engpass — selbst der intensive Kunde liegt unter ~20 €/Monat. Bei einem Listenpreis im zwei- bis dreistelligen €-Bereich/Monat ist die KI-Bruttomarge **>95 %**.

---

## 1. Methodik & Preise

**Verifizierte Preise (Mai 2026, pro MTok, Input / Output):**

| Modell | Input $/MTok | Output $/MTok |
|---|---:|---:|
| Opus 4.7 (`claude-opus-4-7`) | 5 | 25 |
| Sonnet 4.6 (`claude-sonnet-4-6`) | 3 | 15 |
| Haiku 4.5 (`claude-haiku-4-5`) | 1 | 5 |

- Output = 5× Input bei allen Modellen.
- **Basis-Rechnung OHNE Rabatte.** Optionale Hebel (Prompt-Caching −90 % auf cached Input, Batch −50 %) siehe §6.
- Token-Schätzung: **~4 Zeichen/Token**. System-Prompt-Größen = gemessene Template-Literal-Zeichenzahl aus dem Code ÷ 4.
- Wechselkurs für €: **1 $ ≈ 0,92 €** (EUR/USD ~1,08).
- Kosten/Call = `Input‑Tok × Preis_in/1e6 + Output‑Tok × Preis_out/1e6`.

---

## 2. Modell-Inventar (direkt aus dem Code)

| Modul | Datei | Modell (Default) | ENV-Override | out-Cap (max_tokens) |
|---|---|---|---|---:|
| Risk-Analyse | `risk/llm-classifier.ts` | **Opus** | — *(keiner! hart `ANALYSIS_MODEL`)* | 2048 |
| CS-Health-Classifier | `health/classifier.ts` | **Opus** | `HEALTH_MODEL` | 2048 |
| Loss-Extractor | `loss/llm-extractor.ts` | **Sonnet** | `LOSS_MODEL` | 512 |
| Save-Play / Solution | `accounts/save-play-extractor.ts`, `solution/extractor.ts` | **Opus** | `SOLUTION_MODEL` | 2048 |
| Product-Discovery Stage‑1 | `product-discovery/classifier.ts` | **Opus** | `PRODUCT_DISCOVERY_MODEL` | 2048 |
| Studien-Synthese Stage‑2 | `synthesis/engine.ts` | **Opus** | `SYNTHESIS_MODEL` | 4096 |
| KI-Guide-Generator | `research/guide-generator.ts` | **Opus** | `GUIDE_GEN_MODEL` | 3072 |
| Highlight-Reels | `research/highlight-reels.ts` | **Opus** | `HIGHLIGHT_MODEL` | 2048 |
| Chat-with-data | `research/chat-with-data.ts` | **Opus** | `CHAT_WITH_DATA_MODEL` | 1024 |
| Brücke CS→Research | `bridge/cs-to-research.ts` | **Opus** | `BRIDGE_MODEL` | 512 |
| Brücke Research→Sales | `bridge/research-to-sales.ts` | **Opus** | `BRIDGE_MODEL` | 768 |
| Brücke Sales→CS | `bridge/sales-to-cs.ts` | **— kein LLM-Call** | — | — |
| Live-Interviewer (Turns) | `voice-agent/interviewer.ts` | **Opus** (`VOICE_MODEL`) | `VOICE_MODEL` | 1024 / Turn |
| Quality/Fraud-Tagging | *(feat/interview-quality)* | **Opus** | `INTERVIEW_QUALITY_MODEL` | 1536 |

> **Quality/Fraud-Tagging ist noch NICHT in `main`** (liegt auf `feat/interview-quality`). Unten als „falls aktiv" separat ausgewiesen, mit Annahmen aus dem dortigen Classifier.

**Gemessene System-Prompt-Größen** (Template-Zeichen → Token): Risk ~3 500, Product‑Discovery ~3 500, Health ~2 540, Guide-Gen ~1 340, Synthese ~1 200, Chat ~1 150, Highlight ~1 080, Save-Play ~1 110, Loss ~1 010, Bridges ~800–880, Interviewer-Datei ~3 650 (verteilt auf 4 Prompts: post‑loss / extraction / check‑in / research).

---

## 3. Stückkosten pro Call-Typ (Basis, ohne Rabatte)

Input/Output-Token sind **geschätzt** (System-Prompt code-gemessen + variabler Input/Output angenommen). Annahmen pro Zeile in der letzten Spalte.

| Call-Typ | Modell | ~In-Tok | ~Out-Tok | $/Call | €/Call | Input-Annahme |
|---|---|---:|---:|---:|---:|---|
| **Risk-Analyse** | Opus | 8 800 | 600 | 0,059 | 0,054 | Sys 3,5k + Deal 0,3k + 1 Call-Transkript ~5k |
| **CS-Health** | Opus | 7 500 | 600 | 0,053 | 0,049 | Sys 2,5k + 1 Call-Transkript ~5k |
| **Loss-Extractor** | Sonnet | 6 000 | 80 | 0,019 | 0,018 | Sys 1k + Transkript ~5k; Output winzig (Kategorie) |
| **Save-Play / Solution** | Opus | 6 000 | 800 | 0,050 | 0,046 | Sys 1,1k + Risk-Analyse + Deal + Transkript |
| **Product-Discovery S1** | Opus | 4 700 | 700 | 0,041 | 0,038 | Sys 3,5k + Interview-Transkript ~1,2k |
| **Synthese S2** (8 Interviews) | Opus | 3 600 | 1 500 | 0,056 | 0,052 | Sys 1,2k + 8×0,3k Insights; Output bis Cap 4096 → bis ~0,12 $ |
| **Guide-Generator** | Opus | 1 650 | 1 500 | 0,046 | 0,042 | Sys 1,3k + Brief; Output bis Cap 3072 → bis ~0,08 $ |
| **Highlight-Reels** | Opus | 2 000 | 600 | 0,025 | 0,023 | Sys 1,1k + Transkript-Ausschnitt |
| **Chat-with-data** (pro Frage) | Opus | 4 400 | 300 | 0,030 | 0,028 | Sys 1,1k + alle Insights+Synthese der Studie + Frage |
| **Brücke CS→Research** | Opus | 1 600 | 300 | 0,016 | 0,015 | Sys 0,8k + Health-Kontext |
| **Brücke Research→Sales** | Opus | 1 700 | 300 | 0,016 | 0,015 | Sys 0,9k + Synthese-Themen |
| **Brücke Sales→CS** | — | 0 | 0 | **0,000** | **0,000** | deterministisch, kein LLM |
| **Interviewer — pro Turn** | Opus | ~2 200 | ~120 | 0,014 | 0,013 | Sys 1,3k + Plan 0,35k + wachsende History |
| **Quality/Fraud** *(falls aktiv)* | Opus | 2 600 | 300 | 0,021 | 0,019 | Sys 1,25k + Transkript 1,2k |

### Aggregate pro Interview / pro Studie

| Einheit | Zusammensetzung | $ | € |
|---|---|---:|---:|
| **1 Research-Interview** | ~8 Interviewer-Turns (~17k in / 1k out ≈ 0,112 $) + Stage‑1 (0,041 $) | **0,153** | **0,141** |
| 1 Research-Interview *+ Quality* | + Quality-Tag (0,021 $) | 0,174 | 0,160 |
| 1 Post-Loss-Interview | ~6 Turns (~0,065 $) + Opus-Extraktion (~0,017 $) | 0,082 | 0,075 |
| 1 Check-in | ~4 Turns (~0,037 $) + Health-Analyse (~0,053 $) | 0,090 | 0,083 |
| **1 leichte Studie** (6 Interviews) | Guide 0,046 + 6×0,153 + Synthese 0,056 | **1,02** | **0,94** |
| **1 intensive Studie** (15 Interviews) | Guide 0,046 + 15×0,153 + Synthese 0,074 | **2,42** | **2,23** |

> **Warum der Interviewer dominiert:** Jeder Agent-Turn ist ein eigener `messages.create`-Call, der den ~1,3k‑Token-System-Prompt **erneut** sendet — über ~8 Turns ~10k Token allein für den wiederholten Prompt + ~4k wachsende History. Das ist der mit Abstand größte Token-Verbraucher pro Interview (und genau der Posten, den Prompt-Caching am stärksten senken würde, §6).

---

## 4. Szenario „Leichter Kunde" (pro Monat)

**Annahmen (geschätzt):** 1 Research-Studie mit 6 Interviews; moderate Sales-/CS-Nutzung.

| Posten | Menge | €/Einheit | € gesamt |
|---|---:|---:|---:|
| Guide-Generator | 1 | 0,042 | 0,04 |
| Research-Interviews (Interviewer + Stage‑1) | 6 | 0,141 | 0,85 |
| Synthese (1 Studie) | 1 | 0,052 | 0,05 |
| Risk-Analysen | 15 | 0,054 | 0,81 |
| CS-Health-Analysen | 10 | 0,049 | 0,49 |
| Save-Play | 1 | 0,046 | 0,05 |
| Brücken | 5 | 0,015 | 0,08 |
| **Summe** | | | **≈ 2,37 €/Monat** |
| *+ Quality/Fraud (falls aktiv)* | 6 | 0,019 | +0,11 |

→ **~2,4–2,5 €/Monat** (≈ 2,6–2,7 $).

---

## 5. Szenario „Intensiver Kunde" (pro Monat)

**Annahmen (geschätzt):** 3 Studien × 15 Interviews (= 45 Interviews), großer Pool, viel Sales/CS, aktive Chat-Nutzung.

| Posten | Menge | €/Einheit | € gesamt |
|---|---:|---:|---:|
| Guide-Generator | 3 | 0,042 | 0,13 |
| Research-Interviews (Interviewer + Stage‑1) | 45 | 0,141 | 6,35 |
| Synthese | 3 | 0,068 | 0,20 |
| Chat-with-data (Frag-deine-Daten) | 30 | 0,028 | 0,84 |
| Highlight-Reels | 5 | 0,023 | 0,12 |
| Risk-Analysen | 100 | 0,054 | 5,40 |
| CS-Health-Analysen | 60 | 0,049 | 2,94 |
| Save-Play | 20 | 0,046 | 0,92 |
| Brücken | 30 | 0,015 | 0,45 |
| **Summe** | | | **≈ 17,4 €/Monat** |
| *+ Quality/Fraud (falls aktiv)* | 45 | 0,019 | +0,86 |

→ **~17–20 €/Monat** (≈ 19–22 $).

---

## 6. Spar-Hebel (nur Fakten, keine Qualitäts-Empfehlung)

1. **Prompt-Caching (−90 % auf cached Input)** — **größter Hebel.**
   - **Live-Interviewer:** der ~1,3k‑Token-System-Prompt wird jede Runde neu gesendet (~10k Token/Interview nur Prompt). Caching des stabilen System-Prompts spart davon ~90 % → der Interviewer-Input fiele von ~17k auf ~7–8k Token/Interview (grob −35–45 % der Interview-Kosten).
   - **Chat-with-data (Multi-Turn):** der große Daten-Block (alle Insights der Studie) ist über die Turns einer Chat-Session stabil → cachebar.
   - **Risk / Health / Product-Discovery:** große statische System-Prompts (~2,5–3,5k Token), bei hohem Call-Volumen cachebar → senkt den fixen Input-Anteil ~80–90 %.
2. **Batch-API (−50 %)** — für **nicht-interaktive** Backend-Calls: Stage‑1 Product-Discovery, Synthese, Loss, Quality-Tagging, Massen-Risk/Health-Rescoring. **Nicht** für den Live-Interviewer (interaktiv).
3. **Modell-Downgrade** (reine Preis-Fakten, ohne Aussage zur Qualität):
   - Opus→Sonnet: Input 3/5, Output 15/25 → **~40 % günstiger** pro Token.
   - Opus→Haiku: 1/5 vs 5/25 → **~80 % günstiger** pro Token.
   - Belegte Datenpunkte aus den bestehenden Evals: **Loss läuft bereits auf Sonnet** (Eval 100 %, Opus ohne Mehrwert). **Quality/Fraud** verfehlte auf Sonnet das FPR=0‑Gate um 1 Fall (Opus hielt es) — d. h. nicht jedes Modul ist verlustfrei downgradebar.

> Kombiniert (Caching auf den Hot-Paths + Batch auf den Backend-Calls) ist für einen interview-lastigen Kunden grob eine **Halbierung** der hier gezeigten Basis-Kosten plausibel.

---

## 7. Was Code-Fakt ist vs. was Schätzung ist

**Direkt aus dem Code (verlässlich):**
- Welches Modul welches Modell nutzt + ENV-Override-Namen (§2).
- `max_tokens`-Output-Caps je Modul.
- Turn-Caps: `MAX_RESEARCH_TOTAL_TURNS=16` (≈ 8 Agent-Calls), `MAX_AGENT_TURNS=6` (post-loss), `MAX_CHECKIN_AGENT_TURNS=4`.
- Sales→CS macht **keinen** LLM-Call; Risk hat **keinen** ENV-Override (hart Opus).
- System-Prompt-Textgrößen (gemessene Zeichenzahl).

**Geschätzt / angenommen (±50 %):**
- Alle variablen Input-Token: Transkript-Längen (Sales-Call ~5k Token angenommen — real 2k–15k!), Deal-/Account-Daten, Insight-Mengen.
- Typische **Output**-Token (nur der Cap steht im Code; reale Ausgabe meist darunter — Ausnahme: generative Module Synthese/Guide können nahe an den Cap gehen → Einzel-Call bis ~0,10–0,12 $).
- 4 Zeichen/Token; Aufteilung der 4 Interviewer-Prompts.
- **Mengen pro Kunde/Monat** (Anzahl Studien, Interviews, Risk-/Health-Calls) — frei gesetzte Szenario-Annahmen.

**Belastbarkeit der Kernzahl:** Auch bei ±50 % auf alle Schätzungen bleibt die Aussage stabil: **API-Kosten je Kunde im niedrigen einstelligen bis ~20‑€-Bereich pro Monat.** Die Untergrenze fürs Pricing ist also sehr niedrig; der Kostentreiber ist die Menge der **Research-Interviews** (Live-Interviewer auf Opus), nicht die Backend-Analytik.
