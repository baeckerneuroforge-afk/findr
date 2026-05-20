# Iteration 4: Targeted Calibration + Post-Processing Floor

Prompt changes:

- Added signal-independence rules so the model avoids padding extra signals from one weak quote.
- Clarified common confusions:
  - slow replies and shorter calls should map to `ENGAGEMENT_DROP` / `CHAMPION_DISENGAGEMENT`, not automatic `STALLING_PATTERN`;
  - named competitor benchmarks are `COMPETITOR_PRESSURE`, not `BUDGET_FRICTION`.
- Tightened true-positive rules for collaborative late CFO/CEO involvement, new sales leaders reopening criteria, and minor stakeholder ownership changes.
- Added a post-validation safety filter:
  - drop signals with confidence below `0.65`;
  - drop signals without quote evidence;
  - cap signal-free deals at low risk;
  - keep any deal with validated signals at least medium.

## Metrics

Final run: `pnpm eval:report 2>&1 | tee eval-final-report.log`

| Metric | Baseline | Iteration 4 Final |
|---|---:|---:|
| Accuracy | 72.0% | 100.0% |
| Precision | 40.2% | 77.0% |
| Recall | 100.0% | 100.0% |
| False-Positive Rate | 59.8% | 23.0% |
| Level Accuracy | 84.0% | 100.0% |

## Observations

- Healthy low-risk cases stayed clean: `3/3` low cases passed with no forbidden signals.
- Medium cases recovered after the score floor: `6/6` passed.
- Precision cleared the target while recall stayed perfect on this run.
- The remaining false positives are extra signals inside otherwise passing high/critical cases; they no longer create healthy-deal false alarms.
