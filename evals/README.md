# Findr Eval Suite

Automated quality testing for the risk classifier.

## Running

```bash
# Run all unit tests
pnpm test

# Run only evals (costs ~$0.50-1.00 per run)
pnpm eval

# Verbose eval output
pnpm eval:report

# Interactive UI
pnpm test:ui
```

## Adding Test Cases

1. Add new case to `evals/dataset.ts`
2. Run `pnpm eval` to validate

## Metrics Explained

- **Accuracy**: % of cases where score is in expected range AND level matches AND all required signals detected
- **Signal Precision**: of all signals the classifier detected, what % were correctly identified
- **Signal Recall**: of all signals the case expected, what % did the classifier catch
- **False Positive Rate**: of all detected signals, what % were not expected for the case
- **Level Accuracy**: % of cases where riskLevel matched exactly

## Cost

Each eval case = 1 Anthropic Sonnet call ≈ $0.02. Full suite of 25 cases ≈ $0.50.

## When To Run

- Before merging prompt changes
- Before releasing new signal types
- After model upgrades
- Weekly as CI smoke test (optional)
