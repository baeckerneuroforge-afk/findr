import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, processClosedLost } from "./route";
import {
  analyzeAndPersistLossReason,
  findDealByHubspotId,
} from "@/lib/loss/service";
import { maybeTriggerDealLost } from "@/lib/alerts/triggers";

vi.mock("@/lib/loss/service", () => ({
  analyzeAndPersistLossReason: vi.fn(),
  findDealByHubspotId: vi.fn(),
}));

vi.mock("@/lib/alerts/triggers", () => ({
  maybeTriggerDealLost: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  })),
}));

const mockFindDealByHubspotId = vi.mocked(findDealByHubspotId);
const mockAnalyzeAndPersistLossReason = vi.mocked(analyzeAndPersistLossReason);
const mockMaybeTriggerDealLost = vi.mocked(maybeTriggerDealLost);

describe("Hubspot deal-update webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/hubspot/deal-update", {
        method: "POST",
        body: JSON.stringify({ nope: true }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("ignores non closed-lost events", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/hubspot/deal-update", {
        method: "POST",
        body: JSON.stringify({
          events: [
            {
              objectId: "123",
              propertyName: "dealstage",
              propertyValue: "appointmentscheduled",
            },
          ],
        }),
      }),
    );

    const body = await response.json();
    expect(body.processed).toBe(0);
    expect(mockFindDealByHubspotId).not.toHaveBeenCalled();
  });

  it("processes closed-lost event payloads", async () => {
    mockFindDealByHubspotId.mockResolvedValue({
      id: "8c35b8c0-38f5-4e10-90fb-42f45086f1d2",
      org_id: "org_1",
      name: "Nordbank",
      amount: 100000,
      owner_name: "Sarah Mueller",
      company_name: "Nordbank",
      data_source: "hubspot",
    });
    mockAnalyzeAndPersistLossReason.mockResolvedValue({
      analysis: {
        deal_id: "8c35b8c0-38f5-4e10-90fb-42f45086f1d2",
        primary_reason: "competitor",
        secondary_reasons: [],
        confidence: 0.7,
        evidence_quotes: [],
        extraction_method: "heuristic",
        extracted_at: "2026-05-01T00:00:00.000Z",
      },
      deal: {
        id: "8c35b8c0-38f5-4e10-90fb-42f45086f1d2",
        org_id: "org_1",
        name: "Nordbank",
        amount: 100000,
        owner_name: "Sarah Mueller",
        company_name: "Nordbank",
        data_source: "hubspot",
      },
    });
    mockMaybeTriggerDealLost.mockResolvedValue({ triggered: true });

    const response = await POST(
      new Request("http://localhost/api/webhooks/hubspot/deal-update", {
        method: "POST",
        body: JSON.stringify({
          events: [
            {
              objectId: "123",
              propertyName: "dealstage",
              propertyValue: "closedlost",
            },
          ],
        }),
      }),
    );

    const body = await response.json();
    expect(body.processed).toBe(1);
    expect(mockAnalyzeAndPersistLossReason).toHaveBeenCalledWith(
      "org_1",
      "8c35b8c0-38f5-4e10-90fb-42f45086f1d2",
    );
    expect(mockMaybeTriggerDealLost).toHaveBeenCalled();
  });

  it("skips mock deals", async () => {
    mockFindDealByHubspotId.mockResolvedValue({
      id: "8c35b8c0-38f5-4e10-90fb-42f45086f1d2",
      org_id: "org_1",
      name: "Demo",
      amount: 1,
      owner_name: "Demo",
      company_name: "Demo",
      data_source: "mock",
    });

    const result = await processClosedLost("123");

    expect(result).toEqual({ processed: false, reason: "mock_deal" });
    expect(mockAnalyzeAndPersistLossReason).not.toHaveBeenCalled();
  });
});
