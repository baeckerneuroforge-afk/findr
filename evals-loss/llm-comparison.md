# Loss-Analysis: Regex vs LLM — Comparison & Production Decision

- **Measured:** 2026-05-22
- **Dataset:** `evals-loss/dataset.ts` — 12 hand-crafted cases (easy ×7, paraphrased ×4, trap ×1)
- **Metric:** does the extracted `primary_reason` equal `expected.primary`?
- **Reproduce:**
  - regex: `pnpm exec tsx evals-loss/run.ts`
  - llm (Sonnet, current default):
    `env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-loss/run.ts llm`
  - llm (Opus): prefix the above with `LOSS_MODEL=claude-opus-4-7`

## Results

| Extractor | Overall | easy | paraphrased | trap |
| --- | --- | --- | --- | --- |
| Regex heuristic | **4/12 (33%)** | 4/7 (57%) | 0/4 (0%) | 0/1 (0%) |
| LLM — Opus (`claude-opus-4-7`) | **12/12 (100%)** | 7/7 | 4/4 | 1/1 |
| LLM — Sonnet (`claude-sonnet-4-6`) | **12/12 (100%)** | 7/7 | 4/4 | 1/1 |

The LLM closes exactly the gaps the regex failed on: paraphrased reasons
(0/4 → 4/4) and the Salesforce-as-integration trap (0/1 → 1/1), with no
regression on the easy cases. **Opus and Sonnet tied at 100%** — Opus showed no
measurable advantage on this set.

## Decision: Sonnet in production

- **Switched the production loss path from regex to the LLM extractor**
  (`src/lib/loss/service.ts` now calls `extractLossReasonLLM`).
- **Model: Sonnet (`claude-sonnet-4-6`).** Opus had no measurable edge over Sonnet
  here (both 100%) and Sonnet is ~5x cheaper. Loss analysis has lower stakes than
  risk analysis (which stays on Opus), so the cheaper model is the right default.
- **Regex fallback retained.** If the LLM call fails or returns invalid JSON, the
  path falls back to the regex `extractLossReason` automatically. The persisted
  `extraction_method` is `"ai"` on success and `"heuristic"` on fallback, so every
  row records which engine produced it. The feature never fully breaks.

## Re-test trigger (do not skip)

12 hand-crafted cases is a thin basis for a model choice. **Once 50–100 REAL loss
cases are available, re-run the Opus-vs-Sonnet comparison** before trusting Sonnet
at scale. If Opus pulls measurably ahead there, reconsider the default.

```
LOSS_MODEL=claude-opus-4-7 env -u ANTHROPIC_API_KEY \
  pnpm exec tsx --conditions=react-server evals-loss/run.ts llm
```

**Caveat:** the 100% LLM scores are on a small, hand-crafted set built to expose
regex weaknesses. Read them as "clears the bar comfortably", not as a precise
real-world accuracy figure.
