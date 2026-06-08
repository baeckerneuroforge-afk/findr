import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { DELETE, POST } from "./route";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/research/plans-service", () => ({
  getResearchPlan: vi.fn(),
  updateResearchPlan: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockGetResearchPlan = vi.mocked(getResearchPlan);
const mockUpdateResearchPlan = vi.mocked(updateResearchPlan);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-000000000002";

function context() {
  return { params: Promise.resolve({ id: PLAN_ID }) };
}

function jsonRequest(body: unknown) {
  return new Request(
    `http://localhost/api/research/plans/${PLAN_ID}/stimulus`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as never;
}

function formRequest(form: FormData) {
  return new Request(
    `http://localhost/api/research/plans/${PLAN_ID}/stimulus`,
    {
      method: "POST",
      body: form,
    },
  ) as never;
}

function updatedPlan(
  stimulusUrl: string | null,
  stimulusType: string | null,
) {
  return { stimulusUrl, stimulusType } as never;
}

function mockStorage(publicUrl = "https://storage.example/stimulus.png") {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl } });
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  mockCreateAdminSupabaseClient.mockReturnValue({
    storage: { from },
  } as never);
  return { upload, getPublicUrl, from };
}

describe("POST /api/research/plans/[id]/stimulus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: ORG_ID });
    mockGetResearchPlan.mockResolvedValue({ id: PLAN_ID } as never);
  });

  it("stops at the same organization auth gate as plan editing", async () => {
    mockRequireOrgIdOrError.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await POST(
      jsonRequest({ url: "https://www.figma.com/proto/abc" }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(mockGetResearchPlan).not.toHaveBeenCalled();
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or cross-org plan before parsing or upload", async () => {
    mockGetResearchPlan.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ url: "https://www.figma.com/proto/abc" }),
      context(),
    );

    expect(response.status).toBe(404);
    expect(mockGetResearchPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID);
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("uploads a validated PNG and persists its public URL through the plan service", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_171);
    const storage = mockStorage();
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://storage.example/stimulus.png", "image"),
    );
    const form = new FormData();
    form.set(
      "file",
      new Blob(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
          ]),
        ],
        { type: "image/png" },
      ),
      "stimulus.png",
    );
    form.set("stimulusDescription", "Landingpage mit blauem CTA");

    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      stimulus_url: "https://storage.example/stimulus.png",
      stimulus_type: "image",
    });
    expect(storage.from).toHaveBeenCalledWith("research-stimuli");
    expect(storage.upload).toHaveBeenCalledWith(
      `${ORG_ID}/${PLAN_ID}/1717171717171-stimulus.png`,
      expect.any(Blob),
      { contentType: "image/png", upsert: true },
    );
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID, {
      stimulusUrl: "https://storage.example/stimulus.png",
      stimulusType: "image",
      stimulusDescription: "Landingpage mit blauem CTA",
    });
  });

  it("rejects SVG and other non-whitelisted MIME types before storage", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob(["<svg><script>alert(1)</script></svg>"], {
        type: "image/svg+xml",
      }),
      "stimulus.svg",
    );

    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_mime");
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });

  it("rejects active text disguised with an allowed image MIME type", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob(["<svg><script>alert(1)</script></svg>"], {
        type: "image/png",
      }),
      "stimulus.png",
    );

    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_file");
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("enforces the 5 MB image limit server-side", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
        type: "image/png",
      }),
      "large.png",
    );

    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("stimulus_file_too_large");
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("persists a canonical http/https link without touching storage", async () => {
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://www.figma.com/proto/abc", "link"),
    );

    const response = await POST(
      jsonRequest({
        url: "https://www.figma.com/proto/abc",
        stimulusDescription: "Klickbarer Checkout-Prototyp",
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID, {
      stimulusUrl: "https://www.figma.com/proto/abc",
      stimulusType: "link",
      stimulusDescription: "Klickbarer Checkout-Prototyp",
    });
  });

  it("accepts link mode via FormData and leaves an omitted description untouched", async () => {
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://prototype.example.com/flow", "link"),
    );
    const form = new FormData();
    form.set("url", "https://prototype.example.com/flow");

    const response = await POST(formRequest(form), context());

    expect(response.status).toBe(200);
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID, {
      stimulusUrl: "https://prototype.example.com/flow",
      stimulusType: "link",
    });
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
    "rejects the unsafe link scheme %s",
    async (url) => {
      const response = await POST(jsonRequest({ url }), context());
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe("invalid_stimulus_url");
      expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
      expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
    },
  );

  it("rejects ambiguous form data containing both a file and a URL", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob(
        [new Uint8Array([0xff, 0xd8, 0xff, 0x00])],
        { type: "image/jpeg" },
      ),
      "stimulus.jpg",
    );
    form.set("url", "https://example.com/prototype");

    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("ambiguous_stimulus_input");
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/research/plans/[id]/stimulus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgIdOrError.mockResolvedValue({ orgId: ORG_ID });
    mockGetResearchPlan.mockResolvedValue({ id: PLAN_ID } as never);
  });

  it("clears all stimulus fields through updateResearchPlan", async () => {
    mockUpdateResearchPlan.mockResolvedValue(updatedPlan(null, null));

    const response = await DELETE(
      new Request(
        `http://localhost/api/research/plans/${PLAN_ID}/stimulus`,
        { method: "DELETE" },
      ) as never,
      context(),
    );

    expect(response.status).toBe(200);
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID, {
      stimulusUrl: null,
      stimulusType: null,
      stimulusDescription: null,
    });
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
