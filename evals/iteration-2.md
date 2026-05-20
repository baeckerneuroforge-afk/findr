# Iteration 2: Score Calibration + Per-Signal Rules

Prompt changes:

- Added explicit score calibration table.
- Added detect/do-not-detect rules for all 8 signals.
- Kept a severity exception for 3 explicit severe blockers so true critical deals can still exceed 80.

## Metrics

| Metric | Baseline | Iteration 1 | Iteration 2 |
|---|---:|---:|---:|
| Accuracy | 72.0% | 68.0% | 52.0% |
| Precision | 40.2% | 58.9% | 75.0% |
| Recall | 100.0% | 91.5% | 89.4% |
| False-Positive Rate | 59.8% | 41.1% | 25.0% |
| Level Accuracy | 84.0% | 92.0% | 84.0% |

## Observations

- Precision reached the target threshold, but at too high an accuracy cost.
- Low-risk cases stayed fixed at 3/3.
- Critical cases were under-scored: several true critical deals landed in high (74-78).
- Medium cases were often under-scored to low/low-medium even when one true signal was detected.
- The "do not detect" boundaries for `STAKEHOLDER_CHURN`, `STALLING_PATTERN`, and `ENGAGEMENT_DROP` became too strict.

## Next Hypothesis

Iteration 3 should keep the false-positive discipline, but loosen true-positive definitions for explicit project ownership changes, explicit silence/priority drop, and explicit paused timelines. It should also enforce quote evidence and add a simple rule: if a signal is included, the score should usually be at least medium.
