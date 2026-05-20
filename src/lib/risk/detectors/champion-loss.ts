import { BaseDetector } from "./base";
import type {
  CallWithSegments,
  DetectorInput,
  DetectorResult,
  SignalEvidence,
} from "../types";

export class ChampionLossDetector extends BaseDetector {
  readonly type = "champion_loss" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const champion = this.identifyChampion(input.calls);
    if (!champion) return this.createEmptyResult();

    const departureEvidence = this.findDepartureQuotes(input.calls, champion);
    const decayEvidence = this.checkEngagementDecay(input.calls, champion);
    const evidence = [...departureEvidence, ...decayEvidence];

    if (evidence.length === 0) return this.createEmptyResult();

    return this.createResult([
      this.createSignal({
        confidence: departureEvidence.length > 0 ? 0.9 : 0.66,
        severity: departureEvidence.length > 0 ? "critical" : "high",
        evidence,
      }),
    ]);
  }

  private identifyChampion(calls: CallWithSegments[]): string | null {
    const explicitChampion = this.flattenSegments(calls).find(
      ({ segment }) =>
        segment.speaker_role === "champion" && this.speakerKey(segment),
    );
    if (explicitChampion) return this.speakerKey(explicitChampion.segment);

    const counts = new Map<string, number>();
    for (const { segment } of this.buyerSideSegments(calls)) {
      if (segment.speaker_role === "decision_maker") continue;
      const speaker = this.speakerKey(segment);
      if (!speaker) continue;
      counts.set(speaker, (counts.get(speaker) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  private findDepartureQuotes(
    calls: CallWithSegments[],
    champion: string,
  ): SignalEvidence[] {
    const patterns = [
      /verlasse?\s+die\s+(firma|abteilung|organisation)/i,
      /wechsle?\s+(den\s+bereich|die\s+rolle|zu|in|nach)/i,
      /nicht\s+mehr\s+(im\s+loop|zust[aä]ndig|owner|sponsor)/i,
      /mein(?:e|)\s+nachfolger/i,
      /letzte[rn]?\s+(arbeitstag|tag|woche)/i,
      /moving\s+to\s+a\s+different/i,
      /leaving\s+the\s+company/i,
      /my\s+last\s+(day|week)/i,
    ];

    const evidence: SignalEvidence[] = [];
    for (const { call, segment } of this.flattenSegments(calls)) {
      if (this.speakerKey(segment) !== champion) continue;
      if (patterns.some((pattern) => pattern.test(segment.text))) {
        evidence.push(
          this.evidence(
            call,
            segment,
            "Champion explicitly mentions departure, role change, or loss of ownership.",
          ),
        );
      }
    }
    return evidence;
  }

  private checkEngagementDecay(
    calls: CallWithSegments[],
    champion: string,
  ): SignalEvidence[] {
    const sorted = this.sortCalls(calls);
    if (sorted.length < 4) return [];

    const previous = sorted.slice(0, -2);
    const recent = sorted.slice(-2);
    const wasActive = previous.some((call) =>
      call.segments.some((segment) => this.speakerKey(segment) === champion),
    );
    const recentlyAbsent = recent.every(
      (call) =>
        !call.segments.some((segment) => this.speakerKey(segment) === champion),
    );

    if (!wasActive || !recentlyAbsent) return [];

    return [
      {
        call_id: recent[0]?.id,
        speaker: champion,
        quote: "Champion absent from the last two calls after previously participating.",
        context_summary:
          "Champion was active earlier in the deal but disappeared from recent calls.",
      },
    ];
  }
}
