# Iteration 1: False-Positive Discipline + Confidence + Healthy Markers

Prompt changes:

- Added explicit "healthy by default" instruction.
- Added confidence calibration and "below 0.65: do not include" rule.
- Added healthy-deal markers such as multi-threading, named decision-maker, concrete next steps, and normal procurement involvement.

## Metrics

| Metric | Baseline | Iteration 1 | Delta |
|---|---:|---:|---:|
| Accuracy | 72.0% | 68.0% | -4.0% |
| Precision | 40.2% | 58.9% | +18.7% |
| Recall | 100.0% | 91.5% | -8.5% |
| False-Positive Rate | 59.8% | 41.1% | -18.7% |
| Level Accuracy | 84.0% | 92.0% | +8.0% |

## Observations

- Low-risk healthy deals improved strongly: low category moved from 0/3 to 3/3.
- Precision improved materially, but accuracy dropped because several true medium/high signals were now under-detected or under-scored.
- Recall is still above the 85% floor, but the failures show the prompt became too conservative for `STAKEHOLDER_CHURN` and `ENGAGEMENT_DROP`.
- Medium one-signal cases are under-scored now (`eval_019`, `eval_020`, `eval_022`), while one critical case dropped just below critical (`eval_005`).

## Next Hypothesis

The prompt needs sharper per-signal boundaries rather than only generic caution. Add explicit detect/do-not-detect rules and score calibration so normal process stays low, one confirmed signal stays medium, and severe multi-signal blockers remain high/critical.
