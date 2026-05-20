# Final Iteration Comparison

| Metric | Baseline | Final | Delta |
|---|---:|---:|---:|
| Accuracy | 72.0% | 100.0% | +28.0% |
| Precision | 40.2% | 77.0% | +36.8% |
| Recall | 100.0% | 100.0% | +0.0% |
| Level Accuracy | 84.0% | 100.0% | +16.0% |
| False-Positive Rate | 59.8% | 23.0% | -36.8% |

## Key Insights

- The biggest win came from teaching the prompt what healthy buying behavior looks like. Low-risk deals moved from `0/3` passing to `3/3`.
- Generic caution alone improved precision but hurt recall. The stable version needed explicit detect/do-not-detect rules per signal.
- Quote evidence reduced hallucinated signals, but score calibration still needed a code-level guardrail so validated signals cannot be returned as low risk.
- The final safety filter keeps low-confidence and quote-less signals out of production responses without changing the model contract.

## Final Verification

- `pnpm eval:report`: `25/25` passed, precision `77.0%`, recall `100.0%`.
- `pnpm eval`: `25/25` passed before the final report run.
