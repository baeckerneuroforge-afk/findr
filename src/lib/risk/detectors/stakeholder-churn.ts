import { BaseDetector } from "./base";
import type { CallSegment, DetectorInput, DetectorResult } from "../types";

export class StakeholderChurnDetector extends BaseDetector {
  readonly type = "stakeholder_churn" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const explicitEvidence = this.findExplicitChurn(input);
    const absenceEvidence = this.findKeyStakeholderAbsence(input);
    const evidence = [...explicitEvidence, ...absenceEvidence];

    if (evidence.length === 0) return this.createEmptyResult();

    return this.createResult([
      this.createSignal({
        confidence: explicitEvidence.length > 0 ? 0.82 : 0.66,
        severity: explicitEvidence.length > 0 ? "high" : "medium",
        evidence,
      }),
    ]);
  }

  private findExplicitChurn(input: DetectorInput) {
    const patterns = [
      /nicht\s+mehr\s+(zust[aä]ndig|im\s+projekt|involviert|owner)/i,
      /uebernimmt|übernimmt|replacement|nachfolger|successor/i,
      /moved?\s+to\s+(another|a\s+different)|wechselt|gewechselt/i,
      /left\s+the\s+(company|team)|hat\s+das\s+unternehmen\s+verlassen/i,
      /reorg|umgebaut|neue\s+leitung|interim/i,
      /new\s+(vp|lead|owner)|neuer\s+(verantwortlicher|lead|leiter)/i,
    ];

    return this.matchingEvidence(
      input.calls,
      patterns,
      "Buyer-side ownership or key stakeholder composition changed during the deal.",
    );
  }

  private findKeyStakeholderAbsence(input: DetectorInput) {
    const sorted = this.sortCalls(input.calls);
    if (sorted.length < 4) return [];

    const early = sorted.slice(0, 2);
    const recent = sorted.slice(-2);
    const earlyCounts = this.countBuyerSpeakers(early.flatMap((call) => call.segments));
    const recentSpeakers = new Set(
      recent
        .flatMap((call) => call.segments)
        .map((segment) => this.speakerKey(segment))
        .filter((speaker): speaker is string => Boolean(speaker)),
    );

    const missingKeySpeaker = [...earlyCounts.entries()].find(
      ([speaker, count]) => count >= 2 && !recentSpeakers.has(speaker),
    );

    if (!missingKeySpeaker) return [];

    return [
      {
        call_id: recent[0]?.id,
        speaker: missingKeySpeaker[0],
        quote: `${missingKeySpeaker[0]} was active early in the deal and absent from the latest two calls.`,
        context_summary:
          "A previously active buyer-side stakeholder disappeared from recent calls.",
      },
    ];
  }

  private countBuyerSpeakers(segments: CallSegment[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const segment of segments) {
      if (segment.speaker_role === "sales_rep") continue;
      const speaker = this.speakerKey(segment);
      if (!speaker) continue;
      counts.set(speaker, (counts.get(speaker) ?? 0) + 1);
    }
    return counts;
  }
}
