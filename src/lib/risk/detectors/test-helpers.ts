import type { CallSegment, CallWithSegments, DetectorInput } from "../types";

type SegmentArgs = Partial<CallSegment> & Pick<CallSegment, "text">;

export function makeSegment(args: SegmentArgs): CallSegment {
  return {
    speaker_id: args.speaker_id ?? args.speaker_name ?? "buyer_1",
    speaker_name: args.speaker_name,
    speaker_role: args.speaker_role ?? "buyer",
    text: args.text,
    start_seconds: args.start_seconds ?? 60,
    end_seconds: args.end_seconds ?? 90,
  };
}

export function makeCall(
  id: string,
  recordedAt: string,
  segments: SegmentArgs[],
): CallWithSegments {
  return {
    id,
    recorded_at: recordedAt,
    duration_seconds: 1800,
    segments: segments.map(makeSegment),
  };
}

export function makeInput(calls: CallWithSegments[]): DetectorInput {
  return {
    deal_id: "deal_test",
    org_id: "org_test",
    calls,
    deal_stage: "negotiation",
    deal_metadata: {
      amount: 75000,
      ownerName: "Sarah Mueller",
    },
  };
}

