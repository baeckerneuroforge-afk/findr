import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createManualDeal } from "@/lib/manual-import/service";

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/manual-import/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/manual-import/service")>(
    "@/lib/manual-import/service",
  );
  return {
    ...actual,
    createManualDeal: vi.fn(),
  };
});

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockCreateManualDeal = vi.mocked(createManualDeal);

function request(body: unknown) {
  return new Request("http://localhost/api/deals/manual", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/deals/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated organization", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await POST(request({ name: "Nordbank" }));

    expect(response.status).toBe(401);
    expect(mockCreateManualDeal).not.toHaveBeenCalled();
  });

  it("validates required deal fields", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: "org_1" });

    const response = await POST(request({ name: "" }));

    expect(response.status).toBe(400);
    expect(mockCreateManualDeal).not.toHaveBeenCalled();
  });

  it("creates a manual deal and returns the new id", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: "org_1" });
    mockCreateManualDeal.mockResolvedValue({ id: "deal_1" });

    const response = await POST(
      request({
        name: "Nordbank Enterprise",
        amount: "85000",
        stage: "negotiation",
        ownerName: "Sarah Müller",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, dealId: "deal_1" });
    expect(mockCreateManualDeal).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({
        name: "Nordbank Enterprise",
        amount: 85000,
        stage: "negotiation",
        currency: "EUR",
        ownerName: "Sarah Müller",
      }),
    );
  });
});
