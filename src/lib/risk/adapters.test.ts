import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals/types";
import type { RiskAnalysis } from "./orchestrator";
import {
  buildDetectorInput,
  promptCallsToDetectorCalls,
  riskAnalysisToLegacyResult,
} from "./adapters";

const deal: Deal = {
  id: "deal_1",
  name: "Nordbank Enterprise",
  companyName: "Nordbank AG",
  amount: 120000,
  currency: "EUR",
  stage: "negotiation",
  ownerName: "Sarah Mueller",
  championName: "Anna Becker",
  championTitle: "Head of Sales Ops",
  daysSinceLastActivity: 4,
  callsCompleted: 2,
  emailsSent: 6,
  stakeholdersCount: 4,
  competitorsMentioned: ["Salesforce"],
  closeDate: "2026-06-30T00:00:00.000Z",
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("risk adapters", () => {
  it("converts prompt calls into detector calls", () => {
    const calls = promptCallsToDetectorCalls([
      {
        call_type: "Discovery",
        duration_seconds: 1200,
        recorded_at: "2026-04-01T10:00:00.000Z",
        transcript_summary: "Initial call",
        transcript: "ae: Danke fuer die Zeit\nchampion: Wir evaluieren parallel Salesforce",
      },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.segments[0]?.speaker_role).toBe("sales_rep");
    expect(calls[0]?.segments[1]?.speaker_role).toBe("champion");
    expect(calls[0]?.segments[1]?.text).toBe("Wir evaluieren parallel Salesforce");
  });

  it("builds detector input with deal metadata", () => {
    const input = buildDetectorInput({
      orgId: "org_1",
      deal,
      calls: [],
    });

    expect(input.org_id).toBe("org_1");
    expect(input.deal_id).toBe("deal_1");
    expect(input.deal_stage).toBe("negotiation");
    expect(input.deal_metadata?.ownerName).toBe("Sarah Mueller");
  });

  it("maps new engine results to the legacy risk result shape", () => {
    const analysis: RiskAnalysis = {
      deal_id: "deal_1",
      overall_risk_score: 70,
      overall_severity: "high",
      signals: [
        {
          type: "competitor_pressure",
          confidence: 0.82,
          severity: "high",
          evidence: [
            {
              quote: "Wir evaluieren parallel Salesforce",
              context_summary: "Buyer references an active competitor.",
            },
          ],
          detected_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      recommendations: [
        {
          signal_type: "competitor_pressure",
          priority: "high",
          action: "Send a tailored competitor-differentiation note.",
          rationale: "Competitive pressure needs specific positioning.",
        },
      ],
      analyzed_at: "2026-04-01T00:00:00.000Z",
      detector_versions: {
        champion_loss: "1.0.0",
        competitor_pressure: "1.0.0",
        stalling: "1.0.0",
        budget_friction: "1.0.0",
        late_decision_maker: "1.0.0",
        stakeholder_churn: "1.0.0",
        engagement_drop: "1.0.0",
        multi_threading_failure: "1.0.0",
      },
    };

    const result = riskAnalysisToLegacyResult(analysis);

    expect(result.riskScore).toBe(70);
    expect(result.riskLevel).toBe("high");
    expect(result.signals[0]?.type).toBe("COMPETITOR_PRESSURE");
    expect(result.recommendations[0]).toContain("competitor-differentiation");
  });

  it("preserves multi_threading_failure as its own legacy signal type", () => {
    const analysis: RiskAnalysis = {
      deal_id: "deal_1",
      overall_risk_score: 66,
      overall_severity: "high",
      signals: [
        {
          type: "multi_threading_failure",
          confidence: 0.76,
          severity: "high",
          evidence: [
            {
              quote: "Nur Anna ist im Loop, CFO und Legal haben wir noch nicht gesprochen.",
              context_summary: "Champion is the only engaged buyer-side stakeholder.",
            },
          ],
          detected_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      recommendations: [],
      analyzed_at: "2026-04-01T00:00:00.000Z",
      detector_versions: {
        champion_loss: "1.0.0",
        competitor_pressure: "1.0.0",
        stalling: "1.0.0",
        budget_friction: "1.0.0",
        late_decision_maker: "1.0.0",
        stakeholder_churn: "1.0.0",
        engagement_drop: "1.0.0",
        multi_threading_failure: "1.0.0",
      },
    };

    const result = riskAnalysisToLegacyResult(analysis);

    expect(result.signals[0]?.type).toBe("MULTI_THREADING_FAILURE");
  });
});
