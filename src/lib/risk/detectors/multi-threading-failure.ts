import { BaseDetector } from "./base";
import type { DetectorInput, DetectorResult, SignalEvidence } from "../types";

export class MultiThreadingFailureDetector extends BaseDetector {
  readonly type = "multi_threading_failure" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const singleThreadEvidence = this.findSingleThreadEvidence(input);
    const stakeholderDropEvidence = this.findStakeholderDropEvidence(input);
    const evidence = [...singleThreadEvidence, ...stakeholderDropEvidence];

    if (evidence.length === 0) return this.createEmptyResult();

    return this.createResult([
      this.createSignal({
        confidence: evidence.length >= 2 ? 0.74 : 0.66,
        severity: "medium",
        evidence,
      }),
    ]);
  }

  private findSingleThreadEvidence(input: DetectorInput): SignalEvidence[] {
    const patterns = [
      /nur\s+(noch\s+)?(mit|ueber|über)\s+(mir|den\s+champion)/i,
      /cfo\s+und\s+legal\s+sind\s+.*nicht\s+dabei/i,
      /procurement\s+spricht\s+ungern\s+mit\s+vendors/i,
      /single\s+point\s+of\s+failure/i,
      /noch\s+nicht.*(cfo|legal|procurement|finance)/i,
      /kein(?:en)?\s+backup[-\s]?champion/i,
    ];

    return this.matchingEvidence(
      input.calls,
      patterns,
      "Deal access is concentrated through one champion while other key stakeholders are not engaged.",
    );
  }

  private findStakeholderDropEvidence(input: DetectorInput): SignalEvidence[] {
    const sorted = this.sortCalls(input.calls);
    if (sorted.length < 2) return [];

    const earlyStakeholders = this.uniqueBuyerSpeakers(sorted.slice(0, 2)).size;
    const recentStakeholders = this.uniqueBuyerSpeakers(sorted.slice(-1)).size;

    if (earlyStakeholders >= 5 && recentStakeholders <= 2) {
      return [
        {
          call_id: sorted.at(-1)?.id,
          quote: `Buyer-side stakeholder coverage fell from ${earlyStakeholders} to ${recentStakeholders}.`,
          context_summary:
            "Multi-threaded access collapsed to one or two buyer contacts.",
        },
      ];
    }

    return [];
  }
}
