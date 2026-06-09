# B0-Spike-Befund: Streaming-Mechanik für Interview-Turns (Etappe B)

**Datum:** 2026-06-09 · **Modell:** claude-opus-4-7 (Production-Default) · **Setup:** echter
`buildResearchSystemPrompt`/`buildResearchPrompt` (11 054 + 2 420 Chars), realistisches
MR-Interview mitten im Gespräch, maxTokens 1024 wie `callJson`. 3 Läufe pro Variante via
`scripts/spike-streaming-b0.ts`.

**TTFC** = Zeit bis zum ersten für den Teilnehmer sichtbaren Zeichen (die UX-Zahl).

| Variante | TTFC Ø | TOTAL Ø | Output-Tokens Ø | valide |
| --- | --- | --- | --- | --- |
| BASELINE — heute (forced tool-use, kein Stream) | 3 110 ms | 3 110 ms | 134 | 3/3 |
| V1 — forced tool-use, gestreamt (`input_json_delta`) | 3 020 ms | 3 090 ms | 132 | 3/3 |
| V2 — Plain-Text-Turn (`DONE:`-Header + Text) | **1 783 ms** | **2 825 ms** | **87** | 3/3 |

## Kernbefunde

1. **V1 bringt praktisch nichts.** TTFC 3 020 ms ≈ Baseline. Die API puffert Tool-Input-JSON
   und emittiert es in groben Brocken am Ende (TTFC ≈ TOTAL in allen drei Läufen), obwohl der
   Stream selbst nach ~1,1 s startet (TTFE). Echtes feingranulares Tool-Streaming bräuchte den
   Beta-Header `fine-grained-tool-streaming-2025-05-14` — mit dem Caveat ungültigen partiellen
   JSONs bei Abbruch, plus inkrementellem Unescaping im Client. Lohnt sich nicht, denn:
2. **V2 gewinnt auf allen Achsen.** Erster sichtbarer Char nach **1,8 s statt 3,1 s** (−43 %),
   und ab da wächst der Text sichtbar weiter (gefühlte Latenz sinkt weit stärker als die Zahl).
   Gesamtzeit −9 %. **Output-Tokens −34 %** (kein JSON-Wrapper/-Escaping) = direkt
   proportionale Kostensenkung auf jedem Turn.
3. **Robustheit hielt:** 3/3 Läufe parsebar (`DONE: false` + Leerzeile + Nachricht), Fragen
   qualitativ gleichwertig zur Tool-Use-Variante (gleiche Probing-Disziplin, gleicher Fokus).

## Empfehlung für B1

**V2 — Plain-Text-Turn.** Begründung über die Zahlen hinaus:

- Der Turn-Output ist trivial strukturiert (`{done, message}`) — das Schema verdient kein
  forced tool-use; tool-use bleibt für die echten Struktur-Pfade (Extraktion, Klassifikation).
- Plain-Text-History passt exakt zu **B4** (Prompt-Umbau auf echte `messages`-Liste für
  Prefix-Caching): Agent-Turns werden natürliche assistant-Messages.
- Fail-open-Fallback ist trivial: fehlt der `DONE:`-Header, gilt `done=false` und der ganze
  Text als Nachricht — kein harter Ausfall möglich. Absicherung über die bestehenden
  Interview-Evals (eval-gesichert wie B4 geplant).

## Einschränkungen

- n=3 pro Variante; Effekt aber groß und konsistent (alle 3 V2-Läufe < schnellster Baseline-Lauf).
- Gemessen wurde der LLM-Pfad; die SSE-Strecke Route→Client (B1) kommt obendrauf, ist aber
  Standard-Next-Territorium (ReadableStream-Response).
- `DONE`-Header-first heißt: das Modell legt sich VOR dem Nachrichtentext fest, ob es abschließt
  — in allen Läufen unproblematisch, wird über Evals mit abgedeckt.
