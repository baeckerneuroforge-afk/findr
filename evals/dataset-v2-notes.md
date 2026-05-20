# Eval Dataset v2 Notes

Dataset v2 expands the risk-classifier eval suite from 25 to 50 cases without
running the evals. Anthropic is disabled right now, so this is dataset work only.

## Edge-Case Groups

### A. DE/EN Language Mix

DACH SaaS calls often switch between German and English, especially when
international finance, legal, or data stakeholders join. These cases test
whether the classifier can detect risk across code-switching while avoiding
false positives when mixed language is simply normal operating context.

### B. Very Long Calls With Low Signal Density

Real calls are rarely concise. The long-call cases bury one or two material
signals inside implementation detail, small talk, and technical discovery. This
should stress evidence selection and prevent the classifier from overreacting to
generic process language.

### C. Ambiguous Signals

Common phrases like "intern besprechen", "schriftlich schicken", discount asks,
or delegation can be healthy or risky depending on context. These cases force
the classifier to use surrounding evidence instead of keyword-triggering.

### D. Multi-Stakeholder Complexity

Enterprise DACH deals often involve finance, procurement, legal, IT, sales ops,
works council, and executives. These cases test whether late stakeholder entry,
stakeholder churn, and partial engagement drops are separated from healthy
multi-threading.

### E. DACH Industry Specifics

Regulated and traditional verticals have slower processes by design. Banking,
FinTech, HR-tech, Mittelstand, and industrial software cases test whether the
classifier distinguishes normal governance from actual stalling, budget
friction, or engagement loss.

## Distribution

- Critical: 10
- High: 15
- Medium: 15
- Low: 10

## Expected Stress Points

- Maintaining high precision on healthy process-heavy deals.
- Not treating code-switching or works-council review as risk by itself.
- Detecting single explicit signals hidden in long transcripts.
- Handling late decision makers only when they are genuinely new blockers.
- Avoiding budget false positives on standard commercial negotiation.

No `pnpm eval` run was performed for this update.
