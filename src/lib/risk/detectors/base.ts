import type {
  CallSegment,
  CallWithSegments,
  DetectedSignal,
  DetectorInput,
  DetectorResult,
  Severity,
  SignalEvidence,
  SignalType,
} from "../types";

export interface Detector {
  readonly type: SignalType;
  readonly version: string;
  detect(input: DetectorInput): Promise<DetectorResult>;
}

export abstract class BaseDetector implements Detector {
  abstract readonly type: SignalType;
  readonly version = "1.0.0";

  abstract detect(input: DetectorInput): Promise<DetectorResult>;

  protected createEmptyResult(): DetectorResult {
    return {
      signal_type: this.type,
      detected: false,
      signals: [],
      detector_version: this.version,
    };
  }

  protected createResult(signals: DetectedSignal[]): DetectorResult {
    return {
      signal_type: this.type,
      detected: signals.length > 0,
      signals,
      detector_version: this.version,
    };
  }

  protected createSignal(args: {
    confidence: number;
    severity: Severity;
    evidence: SignalEvidence[];
  }): DetectedSignal {
    return {
      type: this.type,
      confidence: Math.max(0, Math.min(1, args.confidence)),
      severity: args.severity,
      evidence: args.evidence,
      detected_at: new Date().toISOString(),
    };
  }

  protected flattenSegments(calls: CallWithSegments[]) {
    return calls.flatMap((call, callIndex) =>
      call.segments.map((segment) => ({ call, callIndex, segment })),
    );
  }

  protected evidence(
    call: CallWithSegments,
    segment: CallSegment,
    contextSummary: string,
  ): SignalEvidence {
    return {
      call_id: call.id,
      segment_id: segment.id,
      speaker: segment.speaker_name ?? segment.speaker_id,
      quote: segment.text,
      context_summary: contextSummary,
      timestamp_seconds: segment.start_seconds,
    };
  }

  protected matchingEvidence(
    calls: CallWithSegments[],
    patterns: RegExp[],
    contextSummary: string,
    roleFilter?: Set<string>,
  ): SignalEvidence[] {
    const evidence: SignalEvidence[] = [];

    for (const { call, segment } of this.flattenSegments(calls)) {
      if (roleFilter && !roleFilter.has(segment.speaker_role ?? "unknown")) {
        continue;
      }

      if (patterns.some((pattern) => pattern.test(segment.text))) {
        evidence.push(this.evidence(call, segment, contextSummary));
      }
    }

    return evidence;
  }

  protected buyerSideSegments(calls: CallWithSegments[]) {
    return this.flattenSegments(calls).filter(({ segment }) =>
      ["buyer", "buyer_team", "champion", "decision_maker", "unknown"].includes(
        segment.speaker_role ?? "unknown",
      ),
    );
  }

  protected uniqueBuyerSpeakers(calls: CallWithSegments[]): Set<string> {
    const speakers = new Set<string>();
    for (const { segment } of this.buyerSideSegments(calls)) {
      const key = this.speakerKey(segment);
      if (key) speakers.add(key);
    }
    return speakers;
  }

  protected speakerKey(segment: CallSegment): string | null {
    return segment.speaker_id ?? segment.speaker_name ?? null;
  }

  protected sortCalls(calls: CallWithSegments[]): CallWithSegments[] {
    return [...calls].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  }

  protected daysBetween(a: string, b: string): number {
    const start = new Date(a).getTime();
    const end = new Date(b).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    return Math.abs(end - start) / (1000 * 60 * 60 * 24);
  }
}
