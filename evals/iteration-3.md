# Iteration 3: Quote Evidence Requirement

Prompt changes:

- Added mandatory quote evidence for every detected signal.
- Required 1-3 direct transcript quotes in each signal's `quotes` field.
- Clarified that empty quote arrays make a signal invalid and should be dropped.

## Metrics

| Metric | Baseline | Iteration 1 | Iteration 2 | Iteration 3 |
|---|---:|---:|---:|---:|
| Accuracy | 72.0% | 68.0% | 52.0% | 72.0% |
| Precision | 40.2% | 58.9% | 75.0% | 72.6% |
| Recall | 100.0% | 91.5% | 89.4% | 95.7% |
| False-Positive Rate | 59.8% | 41.1% | 25.0% | 27.4% |
| Level Accuracy | 84.0% | 92.0% | 84.0% | 84.0% |

## Observations

- Low-risk healthy deals stayed fixed at 3/3.
- Recall recovered strongly compared with iteration 2.
- Precision is much better than baseline, but still below the 75% target.
- Remaining failures are mostly under-detection or under-scoring, not false positives:
  - `ENGAGEMENT_DROP` is missed when the transcript uses subtle evidence such as shortened calls, two-to-three-day response delays, or "not top priority".
  - `STAKEHOLDER_CHURN` is missed when the buyer provides continuity through a backup champion, even though the owner changed.
  - `LATE_DECISION_MAKER` is missed when a CFO appears late but collaboratively.
  - Some true critical/high cases are just below their expected score range.

## Next Hypothesis

Keep the quote requirement and false-positive discipline, but add narrow true-positive exceptions for explicit ownership changes, future-quarter procurement pauses, collaborative but late economic buyers, and measurable engagement decline. Add a post-validation safety filter so low-confidence or quote-less signals cannot survive the LLM output.
