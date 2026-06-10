import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { POST } from "./route";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/research/plans-service", () => ({
  getResearchPlan: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockGetResearchPlan = vi.mocked(getResearchPlan);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-000000000002";

function context() {
  return { params: Promise.resolve({ id: PLAN_ID }) };
}

function request(body: unknown) {
  return new Request(
    `http://localhost/api/research/plans/${PLAN_ID}/stimulus/upload-url`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as never;
}

function mockSignedUpload() {
  const createSignedUploadUrl = vi.fn(async (path: string) => ({
    data: {
      path,
      token: "signed-token",
      signedUrl: `https://storage.example/sign/${path}?token=signed-token`,
    },
    error: null,
  }));
  const from = vi.fn(() => ({ createSignedUploadUrl }));
  mockCreateAdminSupabaseClient.mockReturnValue({
    storage: { from },
  } as never);
  return { createSignedUploadUrl, from };
}

describe("POST /api/research/plans/[id]/stimulus/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: ORG_ID });
    mockGetResearchPlan.mockResolvedValue({ id: PLAN_ID } as never);
  });

  it("stops at the same organization auth gate as the stimulus route", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await POST(
      request({ contentType: "video/mp4", sizeBytes: 1024 }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(mockGetResearchPlan).not.toHaveBeenCalled();
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or cross-org plan before minting anything", async () => {
    mockGetResearchPlan.mockResolvedValue(null);

    const response = await POST(
      request({ contentType: "video/mp4", sizeBytes: 1024 }),
      context(),
    );

    expect(response.status).toBe(404);
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("mints a signed upload URL for a path inside the org/plan namespace", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_171);
    const storage = mockSignedUpload();

    const response = await POST(
      request({ contentType: "video/mp4", sizeBytes: 50 * 1024 * 1024 }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(storage.from).toHaveBeenCalledWith("research-stimuli");
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(
      `${ORG_ID}/${PLAN_ID}/1717171717171-stimulus.mp4`,
    );
    expect(body).toEqual({
      path: `${ORG_ID}/${PLAN_ID}/1717171717171-stimulus.mp4`,
      token: "signed-token",
      signed_url: `https://storage.example/sign/${ORG_ID}/${PLAN_ID}/1717171717171-stimulus.mp4?token=signed-token`,
    });
  });

  it.each([
    ["a non-mp4 content type", { contentType: "video/webm", sizeBytes: 1024 }],
    [
      "an oversize video",
      { contentType: "video/mp4", sizeBytes: 100 * 1024 * 1024 + 1 },
    ],
    ["a zero-byte video", { contentType: "video/mp4", sizeBytes: 0 }],
    ["a missing body", null],
  ])("rejects %s with 400", async (_label, body) => {
    const storage = mockSignedUpload();

    const response = await POST(request(body), context());
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.code).toBe("invalid_upload_request");
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("maps a storage error to 500 without leaking details", async () => {
    const createSignedUploadUrl = vi.fn(async () => ({
      data: null,
      error: { message: "bucket unavailable" },
    }));
    mockCreateAdminSupabaseClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ createSignedUploadUrl })) },
    } as never);

    const response = await POST(
      request({ contentType: "video/mp4", sizeBytes: 1024 }),
      context(),
    );

    expect(response.status).toBe(500);
  });
});
