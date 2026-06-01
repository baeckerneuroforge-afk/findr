import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRepCoachingProfiles } from "./service";
import { getDealsByOrg } from "@/lib/deals/service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Deal, DealStage } from "@/lib/deals/types";

vi.mock("@/lib/deals/service", () => ({
  getDealsByOrg: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockGetDealsByOrg = vi.mocked(getDealsByOrg);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

let dealCounter = 0;

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  dealCounter += 1;
  return {
    id: `deal_${dealCounter}`,
    name: `Deal ${dealCounter}`,
    companyName: "Acme AG",
    amount: 50_000,
    currency: "EUR",
    stage: "negotiation" as DealStage,
    ownerName: "Sarah Mueller",
    championName: "",
    championTitle: "",
    daysSinceLastActivity: 0,
    callsCompleted: 0,
    emailsSent: 0,
    stakeholdersCount: 0,
    competitorsMentioned: [],
    closeDate: "2026-07-01",
    createdAt: "2026-01-01",
    ...overrides,
  };
}

interface FakeScore {
  deal_id: string;
  risk_score: number;
  risk_level?: string;
  signals?: unknown;
  analyzed_at?: string;
}

/** Stub the `from(...).select(...).eq(...).order(...)` chain used by the service. */
function stubRiskScores(rows: FakeScore[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  mockCreateAdminSupabaseClient.mockReturnValue({ from } as never);
}

describe("getRepCoachingProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dealCounter = 0;
    stubRiskScores([]);
  });

  it("groups case-/whitespace-variant owner names into one rep (dedup)", async () => {
    mockGetDealsByOrg.mockResolvedValue([
      makeDeal({ ownerName: "Sarah Mueller" }),
      makeDeal({ ownerName: "sarah mueller" }),
      makeDeal({ ownerName: "Sarah  Mueller " }),
    ]);

    const profiles = await getRepCoachingProfiles("org_1");

    expect(profiles).toHaveLength(1);
    expect(profiles[0].totalDeals).toBe(3);
  });

  it("uses the first original spelling as the display name", async () => {
    mockGetDealsByOrg.mockResolvedValue([
      makeDeal({ ownerName: "Sarah Mueller" }),
      makeDeal({ ownerName: "sarah mueller" }),
    ]);

    const profiles = await getRepCoachingProfiles("org_1");

    expect(profiles[0].repName).toBe("Sarah Mueller");
  });

  it("treats empty / whitespace-only owners as one Unassigned rep", async () => {
    mockGetDealsByOrg.mockResolvedValue([
      makeDeal({ ownerName: "" }),
      makeDeal({ ownerName: "   " }),
      makeDeal({ ownerName: "Real Rep" }),
    ]);

    const profiles = await getRepCoachingProfiles("org_1");

    const unassigned = profiles.find((p) => p.repName === "Unassigned");
    expect(unassigned).toBeDefined();
    expect(unassigned?.totalDeals).toBe(2);
    expect(profiles).toHaveLength(2);
  });

  it("counts only active deals as at-risk, ignoring closed ones (FIX 4)", async () => {
    const active = makeDeal({ ownerName: "Lena Vogt", stage: "negotiation" });
    const won = makeDeal({ ownerName: "Lena Vogt", stage: "closed_won" });
    const lost = makeDeal({ ownerName: "Lena Vogt", stage: "closed_lost" });
    mockGetDealsByOrg.mockResolvedValue([active, won, lost]);

    stubRiskScores([
      { deal_id: active.id, risk_score: 80 },
      { deal_id: won.id, risk_score: 90 },
      { deal_id: lost.id, risk_score: 75 },
    ]);

    const profiles = await getRepCoachingProfiles("org_1");

    expect(profiles).toHaveLength(1);
    expect(profiles[0].dealsAtRisk).toBe(1);
    expect(profiles[0].activeDeals).toBe(1);
  });

  it("surfaces a recommendation for MULTI_THREADING_FAILURE (FIX 3)", async () => {
    const deal = makeDeal({ ownerName: "Tom Berg", stage: "demo" });
    mockGetDealsByOrg.mockResolvedValue([deal]);

    stubRiskScores([
      {
        deal_id: deal.id,
        risk_score: 70,
        signals: [
          {
            type: "MULTI_THREADING_FAILURE",
            confidence: 0.8,
            reasoning: "Only the champion ever joins the calls.",
            quotes: [],
          },
        ],
      },
    ]);

    const profiles = await getRepCoachingProfiles("org_1");

    expect(profiles[0].topPattern?.type).toBe("MULTI_THREADING_FAILURE");
    expect(profiles[0].recommendations.length).toBeGreaterThan(0);
  });
});
