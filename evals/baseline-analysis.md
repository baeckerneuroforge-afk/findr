# Baseline Analysis (vor Precision-Iteration)

Baseline run: `pnpm eval:report 2>&1 | tee eval-baseline.log`

## Metrics

| Metric | Baseline |
|---|---:|
| Accuracy | 72.0% |
| Precision | 40.2% |
| Recall | 100.0% |
| False-Positive Rate | 59.8% |
| Level Accuracy | 84.0% |

## Failure Patterns

- Low-risk healthy deals are treated as if normal buying process equals risk. `eval_023`, `eval_024`, and `eval_025` all kept low scores or near-low scores in some places, but still emitted forbidden signals.
- Medium cases are over-scored into high. `eval_017`, `eval_018`, and `eval_021` all landed at score `62`, just over the high threshold, despite being one-concern watchlist deals.
- The model over-interprets normal B2B process: decision-maker sign-off, procurement/legal involvement, team discussion, and multi-threading get mapped to risk signals.
- Critical/high recall is strong. All critical cases passed, and high cases were mostly correct. The problem is not missing severe risk; it is calibration and false-positive discipline.

## Top False-Positive Signals (estimated from failing cases)

- `STALLING_PATTERN`: 3 clearly incorrect detections in healthy/low deals.
- `LATE_DECISION_MAKER`: 2 clearly incorrect detections where decision-maker involvement was normal process or already collaborative.
- `ENGAGEMENT_DROP`: 2 incorrect detections in healthy deals.
- `BUDGET_FRICTION`: 1 incorrect detection where ROI review was interpreted as budget pressure.
- `STAKEHOLDER_CHURN`: 1 incorrect detection where multi-threaded/committee process was interpreted as churn.

## Hypothesis

- The prompt currently teaches the model what risks look like, but not what healthy process looks like. It lacks explicit "do not detect" boundaries.
- Confidence scores are not calibrated. The model includes weak, inferential signals instead of dropping them.
- Score calibration lets one or two moderate concerns become high-risk scores too easily.
- Quote evidence is requested but not enforced, so signals can survive based on vibes rather than direct transcript proof.
