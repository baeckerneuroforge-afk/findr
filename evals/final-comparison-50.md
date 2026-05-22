# Risk Eval — Full 50-Case Run (v2 dataset)

- **Date:** 2026-05-22
- **Branch:** `risk-eval-full-50-run`
- **Model:** `claude-opus-4-7` (Opus, production default — not downgraded)
- **Command:** `npm run eval:report` (Vitest, real Opus calls)
- **Cost / duration:** ~$1.00 · 584s (~9.7 min)
- **Dataset:** `evals/dataset.ts` — 50 cases (v2; first full run since the 25→50 expansion)

> Note on setup: an **empty** `ANTHROPIC_API_KEY=""` in the shell environment
> shadowed the real key in `.env.local` (dotenv does not override existing
> vars). Run was launched with that empty var unset so the real key loaded.

## Overall

| Metric          | 25-case (prev) | **50-case (this run)** |
| --------------- | -------------: | ---------------------: |
| Passed          | 25/25 (100%)   | **46/50 (92.0%)**      |
| LLM/technical errors | 0         | **0**                  |
| Precision       | 77.0%          | 66.7%                  |
| Recall          | 100.0%         | 98.6%                  |
| Level accuracy  | 100.0%         | 92.0%                  |
| False-positive rate | 23.0%      | 33.3%                  |

Per category: **critical 9/10 (90%)** · **high 15/15 (100%)** · **medium 11/14 (79%)** · **low 11/11 (100%)**.

The drop vs the 25-case run is expected: v2 added the harder edge cases
(DE/EN code-switching, very long low-signal calls, ambiguous phrasing,
multi-stakeholder, DACH industry governance) specifically to stress the
classifier. Recall stayed near-perfect; the losses are at score/level
**calibration boundaries**, not signal detection.

## Real classification errors vs technical failures

**0 technical failures.** No case errored (`LLM errors: 0`, no "LLM did not run"),
no 429/529 surfaced — the maxRetries-4 backoff wasn't even exercised. **All 4
failures below are genuine disagreements with the labels**, not API overload.

## Failures (4 of 50)

| id | category | stage | amount | expected | actual | what went wrong |
| --- | --- | --- | --- | --- | --- | --- |
| **eval_004** | critical | proposal_sent | €210k | critical (80–92) | **high (78)** | All 3 required signals detected (+ENGAGEMENT_DROP extra). Score **78 — 2 points below the critical cutoff (80)**. Pure calibration near-miss. |
| **eval_040** | medium | demo | €64k | medium (45–59) | **high (62)** | Required CHAMPION_DISENGAGEMENT detected (+STAKEHOLDER_CHURN extra). Score **62 — 3 over the medium ceiling (59)**. Over-aggregated. |
| **eval_045** | medium | proposal_sent | €149k | medium (48–63) | **high (62)** | Required LATE_DECISION_MAKER detected (+STAKEHOLDER_CHURN extra). Score **62 is inside the medium range**, but the level was returned as `high` → medium/high boundary disagreement. |
| **eval_048** | medium | qualified | €135k | medium (42–58) | **low (25)** | **Missed required BUDGET_FRICTION**; returned no signals, scored 25. (Forbidden STALLING_PATTERN correctly avoided.) The only signal-recall miss in the run. |

Signal-recall note: 3 of 4 failures detected **all** required signals and failed
only on score/level. The single missed required signal in the whole run is
`BUDGET_FRICTION` on eval_048.

## eval_004 spotlight (DACH Logistics, €210k, proposal_sent)

- **Detected exactly the right signals:** CHAMPION_DISENGAGEMENT, STALLING_PATTERN,
  COMPETITOR_PRESSURE (all required) plus ENGAGEMENT_DROP.
- **Failed only on score:** 78, two points under the critical floor of 80 → labelled
  `high` instead of `critical`.
- This is the closest possible miss. Detection is perfect; it's a calibration
  question of whether a late-stage deal with 3–4 co-occurring severe signals
  should be floored into critical. (Matches the earlier "eval_004 deferred /
  SEVERE-BLOCKERS" note.)

## Late-stage under-aggregation pattern — checked, NOT systemic

Hypothesis: late-stage deals (`proposal_sent`/`negotiation`) with multiple severe
signals get aggregated too low (high instead of critical).

The data does **not** support this as a systemic pattern:

- **9/10 critical cases passed (90%)** and **high is 15/15 (100%)** — no high-risk
  deal was under-called down to medium anywhere.
- Only **eval_004** has the under-call shape, and it's a 2-point borderline (78 vs
  80) with full signal detection — a calibration near-miss, not aggregation failure.
- **Counter-evidence:** the other two late-/mid-stage boundary failures go the
  *opposite* way — eval_040 (62) and eval_045 (62) were *over*-aggregated to high
  where the labels want medium. So around score **60–63 the model trends slightly
  high, not low.**

**Real takeaway:** the weak spot is the **medium↔high boundary near score ~62**
(two over-calls) plus one **under-detection** of budget friction on an ambiguous
"legitimate budget gate" case — not a late-stage critical under-call.

## Caveat on precision / FP-rate

The metric counts any detected signal **not** in a case's minimal `requiredSignals`
as a false positive. Several "extras" here (ENGAGEMENT_DROP on eval_004,
STAKEHOLDER_CHURN on eval_040/045) are plausibly real secondary signals, just not
in the required set. So 66.7% precision / 33.3% FP is a **pessimistic floor**, not
"a third of detected signals are wrong."

## Status

Not merged — for joint review before any prompt/calibration change. The 4 failures
above are the agenda: eval_004 critical-floor calibration, the ~62 medium/high
boundary (eval_040/045), and eval_048 budget-friction recall.
