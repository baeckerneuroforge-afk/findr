import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallRow } from "@/lib/calls/service";
import type { Deal } from "@/lib/deals/types";
import type { CallForPrompt } from "@/lib/risk/prompts";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";
import { analyzeRisk } from "./orchestrator";
import { analyzeDealRiskLLM } from "./llm-classifier";
import {
  analyzeDealRisk,
  analyzeDealRiskWithFallback,
} from "./classifier";

vi.mock("./llm-classifier", () => ({
  ANALYSIS_MODEL: "claude-opus-4-7",
  LLMUnavailableError: class LLMUnavailableError extends Error {},
  analyzeDealRiskLLM: vi.fn(),
}));

vi.mock("./orchestrator", () => ({
  analyzeRisk: vi.fn(),
}));

const mockAnalyzeRisk = vi.mocked(analyzeRisk);
const mockAnalyzeDealRiskLLM = vi.mocked(analyzeDealRiskLLM);

const deal: Deal = {
  id: "deal_1",
  name: "Nordbank Enterprise",
  companyName: "Nordbank AG",
  amount: 85000,
  currency: "EUR",
  stage: "negotiation",
  ownerName: "Sarah Müller",
  championName: "Thomas Becker",
  championTitle: "Head of Sales",
  daysSinceLastActivity: 4,
  callsCompleted: 1,
  emailsSent: 3,
  stakeholdersCount: 3,
  competitorsMentioned: [],
  closeDate: "2026-06-30T00:00:00.000Z",
  createdAt: "2026-05-01T00:00:00.000Z",
  dataSource: "manual",
};

const callRow: CallRow = {
  id: "call_1",
  deal_id: "deal_1",
  call_type: "Discovery",
  duration_seconds: 1800,
  recorded_at: "2026-05-20T10:00:00.000Z",
  source: "manual",
  transcript_summary: "Buyer raised timing concerns.",
  transcript: "Buyer: Wir müssen das nochmal intern besprechen.",
  call_speakers: [],
  transcript_segments: [],
};

const llmResult: RiskAnalysisResult = {
  riskScore: 72,
  riskLevel: "high",
  signals: [
    {
      type: "STALLING_PATTERN",
      confidence: 0.82,
      reasoning: "Buyer delayed without a concrete next step.",
      quotes: ["Wir müssen das nochmal intern besprechen."],
    },
  ],
  overallReasoning: "The deal is slowing down late in negotiation.",
  recommendations: ["Set a dated mutual action plan."],
};

function mockHeuristicResult() {
  mockAnalyzeRisk.mockResolvedValue({
    deal_id: "deal_1",
    overall_risk_score: 65,
    overall_severity: "high",
    signals: [
      {
        type: "stalling",
        confidence: 0.8,
        severity: "high",
        evidence: [
          {
            call_id: "call_1",
            quote: "Wir müssen das nochmal intern besprechen.",
            context_summary: "Repeated internal-review language detected.",
            timestamp_seconds: 0,
          },
        ],
        detected_at: "2026-05-21T10:00:00.000Z",
      },
    ],
    recommendations: [
      {
        signal_type: "stalling",
        priority: "high",
        action: "Reconfirm the decision date with the buyer.",
        rationale: "Stalling needs a dated next step.",
      },
    ],
    analyzed_at: "2026-05-21T10:00:00.000Z",
    detector_versions: {} as never,
  });
}

describe("analyzeDealRiskWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockHeuristicResult();
  });

  it("uses heuristic detectors when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = await analyzeDealRiskWithFallback(deal, [callRow], "org_1");

    expect(result.source).toBe("heuristic");
    expect(result.result.riskScore).toBe(65);
    expect(result.result.signals[0].type).toBe("STALLING_PATTERN");
    expect(mockAnalyzeDealRiskLLM).not.toHaveBeenCalled();
    expect(mockAnalyzeRisk).toHaveBeenCalledOnce();
  });

  it("uses the LLM as primary source when an API key is present", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mockAnalyzeDealRiskLLM.mockResolvedValue(llmResult);

    const result = await analyzeDealRiskWithFallback(deal, [callRow], "org_1");

    expect(result).toEqual({ result: llmResult, source: "llm" });
    expect(mockAnalyzeRisk).not.toHaveBeenCalled();
  });

  it("converts CallRow records into CallForPrompt objects for the LLM", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mockAnalyzeDealRiskLLM.mockResolvedValue(llmResult);

    await analyzeDealRiskWithFallback(deal, [callRow], "org_1");

    expect(mockAnalyzeDealRiskLLM).toHaveBeenCalledWith(deal, [
      {
        call_type: "Discovery",
        duration_seconds: 1800,
        recorded_at: "2026-05-20T10:00:00.000Z",
        transcript_summary: "Buyer raised timing concerns.",
        transcript: "Buyer: Wir müssen das nochmal intern besprechen.",
      },
    ]);
  });

  it("passes existing prompt calls directly to the LLM", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mockAnalyzeDealRiskLLM.mockResolvedValue(llmResult);
    const promptCalls: CallForPrompt[] = [
      {
        call_type: "Negotiation",
        duration_seconds: 1200,
        recorded_at: "2026-05-20T10:00:00.000Z",
        transcript_summary: "Budget concerns.",
        transcript: "Buyer: Budget ist gerade schwierig.",
      },
    ];

    await analyzeDealRiskWithFallback(deal, promptCalls, "org_1");

    expect(mockAnalyzeDealRiskLLM).toHaveBeenCalledWith(deal, promptCalls);
  });

  it("falls back to heuristic detectors when the LLM throws", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mockAnalyzeDealRiskLLM.mockRejectedValue(new Error("Claude timeout"));

    const result = await analyzeDealRiskWithFallback(deal, [callRow], "org_1");

    expect(result.source).toBe("heuristic");
    expect(result.result.riskLevel).toBe("high");
    expect(mockAnalyzeRisk).toHaveBeenCalledOnce();
  });

  it("keeps the compatibility analyzeDealRisk export returning only the result", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mockAnalyzeDealRiskLLM.mockResolvedValue(llmResult);

    const result = await analyzeDealRisk(deal, [callRow], "org_1");

    expect(result).toBe(llmResult);
  });
});
