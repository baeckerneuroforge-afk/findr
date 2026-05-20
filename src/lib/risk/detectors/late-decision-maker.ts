import { BaseDetector } from "./base";
import type { CallSegment, DetectorInput, DetectorResult } from "../types";

const DECISION_MAKER_PATTERNS = [
  /cfo|ceo|coo|cro|cio|cdo/i,
  /procurement|legal|datenschutz|security|betriebsrat/i,
  /geschäftsführer|geschaeftsfuehrer|vorstand|vp\s+sales|head\s+of/i,
  /final\s+(approver|approval)|veto|blocken|freigabe/i,
];

export class LateDecisionMakerDetector extends BaseDetector {
  readonly type = "late_decision_maker" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const sorted = this.sortCalls(input.calls);
    if (sorted.length === 0) return this.createEmptyResult();

    const earlyCalls = sorted.slice(0, Math.max(1, sorted.length - 2));
    const recentCalls = sorted.slice(-2);
    const earlySpeakers = this.speakerSet(earlyCalls.flatMap((call) => call.segments));

    const evidence = recentCalls.flatMap((call) =>
      call.segments
        .filter((segment) => {
          const speaker = this.speakerKey(segment);
          const newSpeaker = speaker ? !earlySpeakers.has(speaker) : false;
          return (
            segment.speaker_role === "decision_maker" ||
            (newSpeaker &&
              DECISION_MAKER_PATTERNS.some((pattern) => pattern.test(segment.text))) ||
            /bisher\s+nicht\s+im\s+prozess|not\s+in\s+the\s+previous\s+loop|war\s+bisher\s+gar\s+nicht/i.test(
              segment.text,
            )
          );
        })
        .map((segment) =>
          this.evidence(
            call,
            segment,
            "A senior approver or veto stakeholder appears late and introduces approval risk.",
          ),
        ),
    );

    if (evidence.length === 0) return this.createEmptyResult();

    return this.createResult([
      this.createSignal({
        confidence: 0.74,
        severity: "medium",
        evidence,
      }),
    ]);
  }

  private speakerSet(segments: CallSegment[]): Set<string> {
    const speakers = new Set<string>();
    for (const segment of segments) {
      const key = this.speakerKey(segment);
      if (key) speakers.add(key);
    }
    return speakers;
  }
}
