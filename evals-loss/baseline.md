# Loss-Analysis Baseline — Regex Heuristic

- **Measured:** 2026-05-22
- **Extractor:** `src/lib/loss/extractor.ts` — regex heuristic, **no LLM, no API calls**
- **Dataset:** `evals-loss/dataset.ts` — 12 hand-crafted cases
- **Reproduce:** `pnpm exec tsx evals-loss/run.ts`
- **Metric:** does the extracted `primary_reason` equal `expected.primary`?

## Headline

**33% accuracy (4 / 12).**

| Difficulty   | Hit rate    |
| ------------ | ----------- |
| easy         | 4/7 (57%)   |
| paraphrased  | 0/4 (0%)    |
| trap         | 0/1 (0%)    |
| **Overall**  | **4/12 (33%)** |

## Per-case results

| ID       | lang | difficulty   | expected            | got          | hit  |
| -------- | ---- | ------------ | ------------------- | ------------ | ---- |
| loss_01  | de   | easy         | pricing             | pricing      | PASS |
| loss_02  | de   | paraphrased  | pricing             | other        | MISS |
| loss_03  | de   | easy         | competitor          | competitor   | PASS |
| loss_04  | en   | paraphrased  | competitor          | other        | MISS |
| loss_05  | de   | trap         | feature_gap         | competitor   | MISS |
| loss_06  | de   | easy         | budget              | other        | MISS |
| loss_07  | de   | paraphrased  | budget              | other        | MISS |
| loss_08  | de   | easy         | champion_lost       | other        | MISS |
| loss_09  | de   | easy         | timing              | timing       | PASS |
| loss_10  | de   | easy         | compliance          | compliance   | PASS |
| loss_11  | en   | paraphrased  | no_decision         | other        | MISS |
| loss_12  | de   | easy         | internal_priority   | other        | MISS |

## Failures that matter

**These are not mislabeled cases.** Manual review confirms the ground-truth labels
are correct — the regex is wrong. Its patterns demand near-exact word adjacency or
specific keywords, so natural phrasings slip through.

### Easy cases the regex still misses (expected to score well; only 57%)

- **loss_06 — `budget` → `other`.** Pattern `budget(freigabe|genehmigung)\s+(verweigert|nicht)`
  needs the words adjacent, but the transcript says "Budgetfreigabe **am Ende** verweigert"
  (words in between → no match). And `cfo\s+(hat|sagt)\s+nein` doesn't fire on
  "CFO hat … **verweigert**". Reason is unmistakably budget; regex finds nothing.
- **loss_08 — `champion_lost` → `other`.** `(verlasse|wechsle|gehe)\s+(die\s+firma|den\s+job)`
  misses "hat das **Unternehmen** verlassen" (Unternehmen ≠ firma/job), and
  `(neuer|anderer)\s+ansprechpartner` misses "Ihr **Nachfolger**" (≠ ansprechpartner).
- **loss_12 — `internal_priority` → `other`.** `interne?\s+(reorganisation|umstrukturierung)`
  misses "**große** Umstrukturierung" (no "intern"), and `fokus\s+liegt\s+(jetzt|momentan)\s+auf`
  misses "Fokus liegt **komplett woanders**".

### Trap — the active error

- **loss_05 — `feature_gap` → `competitor`.** "Salesforce" trips the competitor brand
  list (`/(gong|clari|aviso|salesforce|hubspot)/i`), even though here Salesforce is a
  *wanted integration*. `feature_gap` is also detected ("fehlt euch"), but both reasons
  tie at one match and `competitor` wins on declaration order. True reason: a missing
  integration = `feature_gap`. The regex confidently picks the wrong category.

## Takeaway

The regex is **more brittle than the dataset's optimistic note assumed** — it misses
even 3 of 7 "easy" cases and makes a confident wrong call on the trap. Paraphrased
language defeats it entirely (0/4). 8 of 12 cases collapse to `other`.

This is the baseline an LLM extractor must beat. The bar is low (33%); the gap on
paraphrased + trap cases is exactly where an LLM should earn its cost. If a future
LLM run does **not** clear this comfortably, that itself is a finding.
