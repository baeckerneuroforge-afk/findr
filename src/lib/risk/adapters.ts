import type { CallRow } from "@/lib/calls/service";
import type { Deal } from "@/lib/deals/types";
import type { CallForPrompt } from "@/lib/risk/prompts";
import type {
  RiskAnalysisResult,
  RiskSignal,
} from "@/lib/schemas/risk";
import type {
  CallSegment,
  CallWithSegments,
  DetectorInput,
  SignalType,
} from "./types";
import type { RiskAnalysis } from "./orchestrator";

const SIGNAL_TO_LEGACY: Record<SignalType, RiskSignal["type"]> = {
  champion_loss: "CHAMPION_LOSS",
  competitor_pressure: "COMPETITOR_PRESSURE",
  stalling: "STALLING_PATTERN",
  budget_friction: "BUDGET_FRICTION",
  late_decision_maker: "LATE_DECISION_MAKER",
  stakeholder_churn: "STAKEHOLDER_CHURN",
  engagement_drop: "ENGAGEMENT_DROP",
  multi_threading_failure: "MULTI_THREADING_FAILURE",
};

function speakerRoleFromCall(
  call: CallRow,
  speakerId: string,
): CallSegment["speaker_role"] {
  const speaker = call.call_speakers.find((item) => item.id === speakerId);
  if (!speaker) return "unknown";
  if (speaker.speaker_type === "sales_rep") return "sales_rep";
  return speaker.speaker_type;
}

function speakerNameFromCall(call: CallRow, speakerId: string): string | undefined {
  return call.call_speakers.find((item) => item.id === speakerId)?.name;
}

function transcriptFallbackSegments(call: CallRow): CallSegment[] {
  if (!call.transcript) return [];
  return call.transcript
    .split(/\n{2,}/)
    .map((text, index) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      speaker_role: "unknown",
      text,
      start_seconds: index * 30,
      end_seconds: index * 30 + 30,
    }));
}

export function callsToDetectorCalls(calls: CallRow[]): CallWithSegments[] {
  return calls.map((call) => {
    const segments =
      call.transcript_segments.length > 0
        ? call.transcript_segments.map((segment) => ({
            id: segment.id,
            speaker_id: segment.speaker_id,
            speaker_name: speakerNameFromCall(call, segment.speaker_id),
            speaker_role: speakerRoleFromCall(call, segment.speaker_id),
            text: segment.text,
            start_seconds: segment.start_seconds,
            end_seconds: segment.end_seconds,
          }))
        : transcriptFallbackSegments(call);

    return {
      id: call.id,
      recorded_at: call.recorded_at ?? new Date(0).toISOString(),
      duration_seconds: call.duration_seconds ?? 0,
      segments,
    };
  });
}

function inferSegmentRole(text: string): CallSegment["speaker_role"] {
  const speaker = text.split(":", 1)[0]?.trim().toLowerCase() ?? "";
  if (speaker === "ae" || speaker.includes("sales")) return "sales_rep";
  if (speaker.includes("champion")) return "champion";
  if (speaker.includes("decision")) return "decision_maker";
  if (speaker.includes("buyer")) return "buyer";
  return "unknown";
}

export function promptCallsToDetectorCalls(
  calls: CallForPrompt[],
): CallWithSegments[] {
  return calls.map((call, callIndex) => {
    const transcriptLines = call.transcript
      ? call.transcript
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    return {
      id: `prompt_call_${callIndex + 1}`,
      recorded_at: call.recorded_at ?? new Date(0).toISOString(),
      duration_seconds: call.duration_seconds ?? 0,
      segments: transcriptLines.map((line, index) => {
        const [speakerPrefix, ...rest] = line.split(":");
        const text = rest.length > 0 ? rest.join(":").trim() : line;
        const speakerName = rest.length > 0 ? speakerPrefix.trim() : undefined;

        return {
          id: `prompt_call_${callIndex + 1}_segment_${index + 1}`,
          speaker_id: speakerName,
          speaker_name: speakerName,
          speaker_role: inferSegmentRole(line),
          text,
          start_seconds: index * 30,
          end_seconds: index * 30 + 30,
        };
      }),
    };
  });
}

export function buildDetectorInput(args: {
  orgId: string;
  deal: Deal;
  calls: CallRow[];
}): DetectorInput {
  return {
    org_id: args.orgId,
    deal_id: args.deal.id,
    calls: callsToDetectorCalls(args.calls),
    deal_stage: args.deal.stage,
    deal_metadata: {
      name: args.deal.name,
      companyName: args.deal.companyName,
      amount: args.deal.amount,
      currency: args.deal.currency,
      ownerName: args.deal.ownerName,
      championName: args.deal.championName,
      championTitle: args.deal.championTitle,
      daysSinceLastActivity: args.deal.daysSinceLastActivity,
      callsCompleted: args.deal.callsCompleted,
      emailsSent: args.deal.emailsSent,
      stakeholdersCount: args.deal.stakeholdersCount,
      competitorsMentioned: args.deal.competitorsMentioned,
      closeDate: args.deal.closeDate,
      dataSource: args.deal.dataSource,
    },
  };
}

export function riskAnalysisToLegacyResult(
  analysis: RiskAnalysis,
): RiskAnalysisResult {
  const signals: RiskSignal[] = analysis.signals.slice(0, 8).map((signal) => ({
    type: SIGNAL_TO_LEGACY[signal.type],
    confidence: signal.confidence,
    reasoning:
      signal.evidence[0]?.context_summary ??
      `${signal.type} detected by heuristic detector.`,
    quotes: signal.evidence.map((item) => item.quote).slice(0, 3),
  }));

  return {
    riskScore: analysis.overall_risk_score,
    riskLevel: analysis.overall_severity,
    signals,
    overallReasoning:
      signals.length === 0
        ? "No confirmed heuristic risk signals detected. Deal appears healthy based on available calls and metadata."
        : `${signals.length} heuristic risk signal${
            signals.length === 1 ? "" : "s"
          } detected across recent calls. Top issue: ${signals[0]?.type ?? "risk signal"}.`,
    recommendations: analysis.recommendations
      .map((recommendation) => recommendation.action)
      .slice(0, 5),
  };
}
