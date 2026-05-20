import { BaseDetector } from "./base";
import type { DetectorInput, DetectorResult } from "../types";

export class BudgetFrictionDetector extends BaseDetector {
  readonly type = "budget_friction" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const patterns = [
      /budget\s+(ist\s+)?(knapp|eingefroren|verplant|nicht\s+freigegeben)/i,
      /spend[-\s]?freeze|budget\s+freeze/i,
      /pricing\s+review|preis(?:lich)?\s+(ist\s+)?(ein\s+thema|zu\s+hoch)/i,
      /discount|rabatt|pilotpreis/i,
      /cfo\s+(sign[-\s]?off|freigabe|approval)/i,
      /roi\s+(zahlen|proof|begruendung|begründung|justification)/i,
      /koennen\s+uns\s+das\s+nicht\s+leisten|können\s+uns\s+das\s+nicht\s+leisten/i,
      /sprengt\s+(unser\s+)?(quartals)?budget/i,
      /nur\s+\d+k?\s+(freigegeben|approved)/i,
      /lower\s+first[-\s]?year|split\s+payments/i,
    ];

    const evidence = this.matchingEvidence(
      input.calls,
      patterns,
      "Buyer references budget constraint, pricing blocker, discount pressure, or finance approval risk.",
    );

    if (evidence.length === 0) return this.createEmptyResult();

    const severe = evidence.some((item) =>
      /freeze|eingefroren|stoppe|blocked|cannot buy|nicht kaufen|sprengt/i.test(
        item.quote,
      ),
    );

    return this.createResult([
      this.createSignal({
        confidence: severe ? 0.86 : 0.72,
        severity: severe ? "high" : "medium",
        evidence,
      }),
    ]);
  }
}
