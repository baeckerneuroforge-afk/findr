# Loss-Analysis — Tool-Use Migration Verification

- **Verified:** 2026-05-30
- **What this checks:** the `extractLossReasonLLM` production path after it was
  migrated from a fragile text-JSON parse to forced **tool-use** via
  `callClaudeStructured` (one of the 12 modules in the json-robustness work). Loss
  was the **only** one of those 12 that had no eval — it was build-verified only.
  This run confirms the migration did not break loss extraction.
- **Model:** Sonnet (`claude-sonnet-4-6`) — the production default
  (`DEFAULT_LOSS_MODEL`), no `LOSS_MODEL` override. The eval runner calls the same
  `extractLossReasonLLM` that `src/lib/loss/service.ts` calls in production, so the
  forced-tool path is exercised end-to-end (schema `emit_loss_reason` →
  `LlmLossOutputSchema`), not a re-implementation.
- **Reproduce:** `pnpm eval:loss`
  (= `env -u ANTHROPIC_API_KEY tsx --conditions=react-server evals-loss/run.ts llm`)

## Result

| Extractor (path) | Overall | easy | paraphrased | trap |
| --- | --- | --- | --- | --- |
| LLM — Sonnet, **tool-use** (`callClaudeStructured`) | **12/12 (100%)** | 7/7 | 4/4 | 1/1 |

**No fallbacks fired.** The runner prints
`[fallback: regex heuristic — LLM call failed]` whenever the LLM path throws and
degrades to the regex. That line appeared on **zero** cases — every result came
from a successful forced-tool call (`extraction_method: "ai"`), and every evidence
quote was a real verbatim transcript snippet. A broken tool-use transport would
have surfaced as silent regex fallbacks (which would have collapsed the
paraphrased/trap cases back toward the 33% regex baseline); none occurred.

## Conclusion

The tool-use migration leaves loss extraction **intact**: identical to the
pre-migration text-JSON LLM baseline measured 2026-05-22 in `llm-comparison.md`
(Sonnet 12/12, easy 7/7, paraphrased 4/4, trap 1/1). No regression, no real bug.
No production logic was changed for this verification.

**Caveat (unchanged from `llm-comparison.md`):** 100% is on a small, hand-crafted
12-case set built to expose regex weaknesses. Read it as "clears the bar
comfortably and the tool-use transport is sound", not as a precise real-world
accuracy figure. The 50–100-real-case re-test trigger documented in
`llm-comparison.md` still stands.
