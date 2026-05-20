export type SignalType =
  | "champion_loss"
  | "competitor_pressure"
  | "stalling"
  | "budget_friction"
  | "late_decision_maker"
  | "stakeholder_churn"
  | "engagement_drop"
  | "multi_threading_failure";

export type Severity = "low" | "medium" | "high" | "critical";

export interface DetectedSignal {
  type: SignalType;
  confidence: number;
  severity: Severity;
  evidence: SignalEvidence[];
  detected_at: string;
}

export interface SignalEvidence {
  call_id?: string;
  segment_id?: string;
  speaker?: string;
  quote: string;
  context_summary: string;
  timestamp_seconds?: number;
}

export interface DetectorInput {
  deal_id: string;
  org_id: string;
  calls: CallWithSegments[];
  deal_stage: string;
  deal_metadata?: Record<string, unknown>;
}

export interface CallWithSegments {
  id: string;
  recorded_at: string;
  duration_seconds: number;
  segments: CallSegment[];
}

export interface CallSegment {
  id?: string;
  speaker_id?: string;
  speaker_role?:
    | "sales_rep"
    | "buyer"
    | "buyer_team"
    | "champion"
    | "decision_maker"
    | "unknown";
  speaker_name?: string;
  text: string;
  start_seconds: number;
  end_seconds: number;
}

export interface DetectorResult {
  signal_type: SignalType;
  detected: boolean;
  signals: DetectedSignal[];
  detector_version: string;
}

export interface Recommendation {
  signal_type: SignalType;
  priority: "urgent" | "high" | "medium" | "low";
  action: string;
  rationale: string;
  template_id?: string;
}
