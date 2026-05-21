import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createManualCall } from "@/lib/manual-import/service";

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/manual-import/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/manual-import/service")>(
    "@/lib/manual-import/service",
  );
  return {
    ...actual,
    createManualCall: vi.fn(),
  };
});

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockCreateManualCall = vi.mocked(createManualCall);

const DEAL_ID = "00000000-0000-4000-8000-000000000002";

function request(body: unknown) {
  return new Request("http://localhost/api/calls/manual", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/calls/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated organization", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await POST(
      request({ dealId: DEAL_ID, transcript: "Buyer: Hallo" }),
    );

    expect(response.status).toBe(401);
    expect(mockCreateManualCall).not.toHaveBeenCalled();
  });

  it("validates dealId and transcript", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: "org_1" });

    const response = await POST(
      request({ dealId: "not-a-uuid", transcript: "" }),
    );

    expect(response.status).toBe(400);
    expect(mockCreateManualCall).not.toHaveBeenCalled();
  });

  it("attaches a manual transcript to a deal", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: "org_1" });
    mockCreateManualCall.mockResolvedValue({ id: "call_1" });

    const response = await POST(
      request({
        dealId: DEAL_ID,
        transcript: "Buyer: Wir müssen das mit Procurement klären.",
        callType: "Discovery",
        durationSeconds: "1200",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, callId: "call_1" });
    expect(mockCreateManualCall).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({
        dealId: DEAL_ID,
        transcript: "Buyer: Wir müssen das mit Procurement klären.",
        callType: "Discovery",
        durationSeconds: 1200,
      }),
    );
  });
});
