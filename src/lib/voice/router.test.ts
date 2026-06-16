import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Deal } from "@/lib/deals/types";
import type { AnalyzeAccountResult } from "@/lib/accounts/health-service";
import { routeIngestedCall, type VoiceCallInput } from "./router";
import { analyzeAccountTranscript } from "@/lib/accounts/health-service";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { analyzeDealRiskWithFallback } from "@/lib/risk/classifier";
import { getResearchPlan } from "@/lib/research/plans-service";
import { persistResearchTranscriptAndDiscovery } from "@/lib/research/transcript-service";

/**
 * Disambiguation contract for the Klymeo Voice router (Etappe 1). The engines are
 * mocked, so this runs with no DB / no Claude / no migration — it proves ONLY
 * the routing: each assignment.kind hits EXACTLY ONE engine, the sales path sets
 * the deal_id parent and never account_id (calls XOR), unknown targets fail
 * closed, and "inbox" is not the router's concern.
 */

// Capture admin-client inserts (sales path: calls + risk_scores) without a DB.
const h = vi.hoisted(() => {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  const makeAdminClient = () => ({
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return {
            select() {
              return {
                single: async () => ({ data: { id: `${table}-id` }, error: null }),
              };
            },
          };
        },
      };
    },
  });
  return { inserts, makeAdminClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => h.makeAdminClient(),
}));
vi.mock("@/lib/accounts/health-service", () => ({
  analyzeAccountTranscript: vi.fn(),
}));
vi.mock("@/lib/deals/service", () => ({ getDealById: vi.fn() }));
vi.mock("@/lib/calls/service", () => ({ getCallsByDealId: vi.fn() }));
vi.mock("@/lib/risk/classifier", () => ({ analyzeDealRiskWithFallback: vi.fn() }));
vi.mock("@/lib/research/plans-service", () => ({ getResearchPlan: vi.fn() }));
vi.mock("@/lib/research/transcript-service", () => ({
  persistResearchTranscriptAndDiscovery: vi.fn(),
}));

const mAnalyzeAccount = vi.mocked(analyzeAccountTranscript);
const mGetDeal = vi.mocked(getDealById);
const mGetCalls = vi.mocked(getCallsByDealId);
const mAnalyzeRisk = vi.mocked(analyzeDealRiskWithFallback);
const mGetPlan = vi.mocked(getResearchPlan);
const mPersistDiscovery = vi.mocked(persistResearchTranscriptAndDiscovery);

const INPUT: VoiceCallInput = {
  transcriptText: "Sprecher A: Hallo.\nSprecher B: Servus.",
  externalMeetingId: "ext-1",
  recordedAt: "2026-05-31T10:00:00.000Z",
  durationSeconds: 600,
};

function healthResult(): AnalyzeAccountResult {
  return {
    health: { id: "health-1", source_call_id: "call-h" },
    source: "llm",
  } as unknown as AnalyzeAccountResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;

  mAnalyzeAccount.mockResolvedValue(healthResult());
  mGetDeal.mockResolvedValue({ id: "deal-1" } as unknown as Deal);
  mGetCalls.mockResolvedValue([]);
  mAnalyzeRisk.mockResolvedValue({
    result: {
      riskScore: 50,
      riskLevel: "medium",
      overallReasoning: "x",
      recommendations: [],
      signals: [],
    },
    source: "llm",
  } as unknown as Awaited<ReturnType<typeof analyzeDealRiskWithFallback>>);
  mGetPlan.mockResolvedValue({ id: "plan-1" } as unknown as Awaited<
    ReturnType<typeof getResearchPlan>
  >);
  mPersistDiscovery.mockResolvedValue({ callId: "call-d", discoveryRan: true });
});

describe("routeIngestedCall — disambiguation", () => {
  it("existing_customer → health ONLY", async () => {
    const res = await routeIngestedCall("org-1", INPUT, {
      kind: "existing_customer",
      accountId: "acc-1",
    });

    expect(res).toEqual({
      ok: true,
      engine: "health",
      callId: "call-h",
      resultRef: "health-1",
    });
    expect(mAnalyzeAccount).toHaveBeenCalledWith(
      "org-1",
      "acc-1",
      INPUT.transcriptText,
    );
    expect(mGetDeal).not.toHaveBeenCalled();
    expect(mAnalyzeRisk).not.toHaveBeenCalled();
    expect(mPersistDiscovery).not.toHaveBeenCalled();
    // Health inserts its own call row inside the engine — the router writes none.
    expect(h.inserts).toHaveLength(0);
  });

  it("sales_call → risk ONLY, calls row carries deal_id and NOT account_id (XOR)", async () => {
    const res = await routeIngestedCall("org-1", INPUT, {
      kind: "sales_call",
      dealId: "deal-1",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.engine).toBe("risk");
      expect(res.callId).toBe("calls-id");
      expect(res.resultRef).toBe("risk_scores-id");
    }

    const callInsert = h.inserts.find((i) => i.table === "calls");
    expect(callInsert).toBeDefined();
    expect(callInsert?.payload.deal_id).toBe("deal-1");
    // XOR: the sales path must NOT set account_id.
    expect(callInsert?.payload.account_id).toBeUndefined();
    expect(callInsert?.payload.source).toBe("findr_voice");
    expect(h.inserts.some((i) => i.table === "risk_scores")).toBe(true);

    expect(mAnalyzeRisk).toHaveBeenCalledTimes(1);
    expect(mAnalyzeAccount).not.toHaveBeenCalled();
    expect(mPersistDiscovery).not.toHaveBeenCalled();
  });

  it("discovery → product-discovery ONLY, with planId", async () => {
    const res = await routeIngestedCall("org-1", INPUT, {
      kind: "discovery",
      planId: "plan-1",
    });

    expect(res).toEqual({
      ok: true,
      engine: "discovery",
      callId: "call-d",
      resultRef: "call-d",
    });
    expect(mPersistDiscovery).toHaveBeenCalledWith({
      orgId: "org-1",
      planId: "plan-1",
      inviteId: null,
      transcript: INPUT.transcriptText,
    });
    expect(mAnalyzeAccount).not.toHaveBeenCalled();
    expect(mAnalyzeRisk).not.toHaveBeenCalled();
    // Discovery inserts its own call row inside its service — router writes none.
    expect(h.inserts.some((i) => i.table === "calls")).toBe(false);
  });
});

describe("routeIngestedCall — fail closed on missing/foreign targets", () => {
  it("account not in org → account_not_found, no engine side effects", async () => {
    mAnalyzeAccount.mockResolvedValue(null);
    const res = await routeIngestedCall("org-1", INPUT, {
      kind: "existing_customer",
      accountId: "acc-x",
    });
    expect(res).toEqual({ ok: false, code: "account_not_found" });
  });

  it("deal not in org → deal_not_found, no calls/risk insert", async () => {
    mGetDeal.mockResolvedValue(null);
    const res = await routeIngestedCall("org-1", INPUT, {
      kind: "sales_call",
      dealId: "deal-x",
    });
    expect(res).toEqual({ ok: false, code: "deal_not_found" });
    expect(h.inserts).toHaveLength(0);
    expect(mAnalyzeRisk).not.toHaveBeenCalled();
  });

  it("plan not in org → plan_not_found, discovery never runs", async () => {
    mGetPlan.mockResolvedValue(null);
    const res = await routeIngestedCall("org-1", INPUT, {
      kind: "discovery",
      planId: "plan-x",
    });
    expect(res).toEqual({ ok: false, code: "plan_not_found" });
    expect(mPersistDiscovery).not.toHaveBeenCalled();
  });
});
