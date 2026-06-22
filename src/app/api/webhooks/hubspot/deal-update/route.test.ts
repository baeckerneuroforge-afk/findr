import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { processClosedLost, reconstructRequestUrl } from "./helpers";
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

const WEBHOOK_URL = "http://localhost/api/webhooks/hubspot/deal-update";
const TEST_SECRET = "test-hubspot-client-secret";

/**
 * Build a request carrying a valid HubSpot v3 signature for `bodyObj`, using the
 * same canonical-URI logic as the route so the HMAC matches what the route
 * recomputes. `options` lets a test forge the wrong secret or a stale timestamp.
 */
function signedRequest(
  bodyObj: unknown,
  options: { secret?: string; timestamp?: string } = {},
): Request {
  const secret = options.secret ?? TEST_SECRET;
  const body = JSON.stringify(bodyObj);
  const timestamp = options.timestamp ?? String(Date.now());
  const uri = reconstructRequestUrl(
    new Request(WEBHOOK_URL, { method: "POST", body }),
  );
  const signature = createHmac("sha256", secret)
    .update("POST" + uri + body + timestamp, "utf8")
    .digest("base64");
  return new Request(WEBHOOK_URL, {
    method: "POST",
    body,
    headers: {
      "x-hubspot-signature-v3": signature,
      "x-hubspot-request-timestamp": timestamp,
    },
  });
}

describe("Hubspot deal-update webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HUBSPOT_CLIENT_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects when the verification secret is not configured", async () => {
    vi.stubEnv("HUBSPOT_CLIENT_SECRET", "");
    const response = await POST(signedRequest({ events: [] }));
    expect(response.status).toBe(503);
    expect(mockFindDealByHubspotId).not.toHaveBeenCalled();
  });

  it("rejects requests without a signature", async () => {
    const response = await POST(
      new Request(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify({ events: [] }),
      }),
    );
    expect(response.status).toBe(401);
    expect(mockFindDealByHubspotId).not.toHaveBeenCalled();
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const response = await POST(
      signedRequest({ events: [] }, { secret: "attacker-secret" }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a stale timestamp (replay protection)", async () => {
    const stale = String(Date.now() - 10 * 60 * 1000);
    const response = await POST(
      signedRequest({ events: [] }, { timestamp: stale }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects invalid payload", async () => {
    const response = await POST(signedRequest({ nope: true }));
    expect(response.status).toBe(400);
  });

  it("ignores non closed-lost events", async () => {
    const response = await POST(
      signedRequest({
        events: [
          {
            objectId: "123",
            propertyName: "dealstage",
            propertyValue: "appointmentscheduled",
          },
        ],
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
      signedRequest({
        events: [
          {
            objectId: "123",
            propertyName: "dealstage",
            propertyValue: "closedlost",
          },
        ],
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
    // processClosedLost is called directly (not via POST), so no signature is
    // involved — this exercises the mock-deal guard in isolation.
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
