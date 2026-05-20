import { BaseDetector } from "./base";
import type { DetectorInput, DetectorResult, SignalEvidence } from "../types";

export class StallingDetector extends BaseDetector {
  readonly type = "stalling" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const vagueDelayEvidence = this.findVagueDelayEvidence(input);
    const cadenceEvidence = this.findCadenceGapEvidence(input);
    const evidence = [...vagueDelayEvidence, ...cadenceEvidence];

    if (evidence.length === 0) return this.createEmptyResult();

    const strongStall =
      vagueDelayEvidence.length >= 2 ||
      evidence.some((item) => /q3|quartal|juni|july|paus/i.test(item.quote));

    return this.createResult([
      this.createSignal({
        confidence: strongStall ? 0.82 : 0.68,
        severity: strongStall ? "high" : "medium",
        evidence,
      }),
    ]);
  }

  private findVagueDelayEvidence(input: DetectorInput): SignalEvidence[] {
    const patterns = [
      /intern\s+(nochmal\s+)?(besprechen|abstimmen|kl[aä]ren)/i,
      /wir\s+melden\s+uns/i,
      /let\s+me\s+(get\s+back|check)/i,
      /take\s+it\s+offline/i,
      /noch\s+eine\s+interne\s+runde/i,
      /q3\s+nochmal|im\s+q3|ende\s+juni|vor\s+juni\s+nichts/i,
      /keinen?\s+(zeitplan|datum|owner)/i,
      /no\s+signature|nothing\s+until/i,
      /verschieben|schieben/i,
    ];

    const evidence = this.matchingEvidence(
      input.calls,
      patterns,
      "Buyer gives vague delay language, pushes timeline, or avoids a concrete owner/date.",
    );

    const hasSpecificNextStep = this.buyerSideSegments(input.calls).some(
      ({ segment }) =>
        /termin\s+steht|owner\s+ist|bis\s+(montag|dienstag|mittwoch|donnerstag|freitag)|next\s+step\s+is|signed?\s+on/i.test(
          segment.text,
        ),
    );

    if (evidence.length <= 1 && hasSpecificNextStep) return [];
    return evidence;
  }

  private findCadenceGapEvidence(input: DetectorInput): SignalEvidence[] {
    const sorted = this.sortCalls(input.calls);
    if (sorted.length < 2) return [];

    const latest = sorted.at(-1);
    const previous = sorted.at(-2);
    if (!latest || !previous) return [];

    const gapDays = this.daysBetween(previous.recorded_at, latest.recorded_at);
    if (gapDays < 21) return [];

    return [
      {
        call_id: latest.id,
        quote: `There are ${Math.round(gapDays)} days between the latest two calls.`,
        context_summary:
          "Call cadence has slowed materially, indicating deal velocity risk.",
      },
    ];
  }
}
