import { BaseDetector } from "./base";
import type { DetectorInput, DetectorResult, SignalEvidence } from "../types";

export class EngagementDropDetector extends BaseDetector {
  readonly type = "engagement_drop" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const quoteEvidence = this.findEngagementQuotes(input);
    const cadenceEvidence = this.findCadenceEvidence(input);
    const attendanceEvidence = this.findAttendanceEvidence(input);
    const evidence = [...quoteEvidence, ...cadenceEvidence, ...attendanceEvidence];

    if (evidence.length === 0) return this.createEmptyResult();

    return this.createResult([
      this.createSignal({
        confidence: evidence.length >= 2 ? 0.76 : 0.68,
        severity: evidence.length >= 2 ? "high" : "medium",
        evidence,
      }),
    ]);
  }

  private findEngagementQuotes(input: DetectorInput): SignalEvidence[] {
    const patterns = [
      /funkstille|wenig\s+rueckmeldung|wenig\s+rückmeldung/i,
      /andere\s+priorit[aä]ten|nicht\s+mehr\s+prio/i,
      /response\s+times?\s+(got\s+)?worse|emails?\s+(taking|lagen)/i,
      /nur\s+\d+\s+minuten\s+statt/i,
      /attendance\s+(has\s+)?dropped|fewer\s+attendees/i,
      /meeting\s+cadence\s+drops?|weekly\s+to\s+monthly/i,
      /thema\s+nicht\s+mehr\s+ganz\s+oben/i,
    ];

    return this.matchingEvidence(
      input.calls,
      patterns,
      "Buyer mentions slower engagement, reduced attendance, lower priority, or weaker response cadence.",
    );
  }

  private findCadenceEvidence(input: DetectorInput): SignalEvidence[] {
    const sorted = this.sortCalls(input.calls);
    if (sorted.length < 3) return [];

    const firstGap = this.daysBetween(sorted[0].recorded_at, sorted[1].recorded_at);
    const latestGap = this.daysBetween(
      sorted.at(-2)!.recorded_at,
      sorted.at(-1)!.recorded_at,
    );

    if (firstGap > 0 && latestGap >= firstGap * 2.5 && latestGap >= 14) {
      return [
        {
          call_id: sorted.at(-1)?.id,
          quote: `Call gap increased from ${Math.round(firstGap)} to ${Math.round(latestGap)} days.`,
          context_summary:
            "Meeting cadence materially slowed compared with earlier deal activity.",
        },
      ];
    }

    return [];
  }

  private findAttendanceEvidence(input: DetectorInput): SignalEvidence[] {
    const sorted = this.sortCalls(input.calls);
    if (sorted.length < 2) return [];

    const firstBuyerCount = this.uniqueBuyerSpeakers([sorted[0]]).size;
    const latestBuyerCount = this.uniqueBuyerSpeakers([sorted.at(-1)!]).size;

    if (firstBuyerCount >= 4 && latestBuyerCount <= 2) {
      return [
        {
          call_id: sorted.at(-1)?.id,
          quote: `Buyer-side attendance dropped from ${firstBuyerCount} to ${latestBuyerCount} speakers.`,
          context_summary:
            "Fewer buyer-side stakeholders are joining recent calls.",
        },
      ];
    }

    return [];
  }
}
