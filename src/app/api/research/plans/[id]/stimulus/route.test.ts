import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";
import {
  analyzeStimulusImage,
  analyzeStimulusVideo,
} from "@/lib/research/stimulus-analysis";
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

vi.mock("@/lib/research/stimulus-analysis", () => ({
  analyzeStimulusImage: vi.fn(),
  analyzeStimulusVideo: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockGetResearchPlan = vi.mocked(getResearchPlan);
const mockUpdateResearchPlan = vi.mocked(updateResearchPlan);
const mockAnalyzeStimulusImage = vi.mocked(analyzeStimulusImage);
const mockAnalyzeStimulusVideo = vi.mocked(analyzeStimulusVideo);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

const ANALYSIS_PAYLOAD = {
  version: 1 as const,
  model: "claude-opus-4-7",
  generatedAt: "2026-06-10T12:00:00.000Z",
  analysis: {
    layout: "Zentrierte Headline über Produktbild",
    farbwelt: "Blau-dominant mit gelbem Akzent",
    bildelemente: ["Produktverpackung", "CTA-Button"],
    textImBild: ["Jetzt testen"],
    claimBotschaft: "Schnell startklar",
    gestaltungsentscheidungen: ["Sehr großer Weißraum"],
    frageansaetze: [
      "Was fällt Ihnen zuerst auf?",
      "Was verstehen Sie unter der Headline?",
      "Welche Rolle spielt das Produktbild für Sie?",
    ],
  },
  textBlock: "Layout/Aufbau: Zentrierte Headline über Produktbild",
};

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

function mockStorage(
  publicUrl = "https://storage.example/stimulus.png",
  objectInfo: Record<string, unknown> | null = {
    contentType: "video/mp4",
    size: 12_345_678,
  },
) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl } });
  const info = vi.fn().mockResolvedValue(
    objectInfo
      ? { data: objectInfo, error: null }
      : { data: null, error: { message: "Object not found" } },
  );
  const from = vi.fn(() => ({ upload, getPublicUrl, info }));
  mockCreateAdminSupabaseClient.mockReturnValue({
    storage: { from },
  } as never);
  return { upload, getPublicUrl, info, from };
}

/** Gültiger Frame fürs Video-Body-Schema (≥32 Zeichen reines base64). */
function videoFrame(index = 0, timestampSeconds = 2.5) {
  return {
    index,
    timestampSeconds,
    mediaType: "image/jpeg" as const,
    data: "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=",
  };
}

const VIDEO_PATH = `${ORG_ID}/${PLAN_ID}/1717171717171-stimulus.mp4`;

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

  it("uploads a validated PNG, persists its public URL and runs the one-time analysis", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_171);
    const storage = mockStorage();
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://storage.example/stimulus.png", "image"),
    );
    mockAnalyzeStimulusImage.mockResolvedValue(ANALYSIS_PAYLOAD);
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
      stimulus_analysis_status: "done",
    });
    expect(storage.from).toHaveBeenCalledWith("research-stimuli");
    expect(storage.upload).toHaveBeenCalledWith(
      `${ORG_ID}/${PLAN_ID}/1717171717171-stimulus.png`,
      expect.any(Blob),
      { contentType: "image/png", upsert: true },
    );
    // First write: stimulus fields + invalidated analysis, status 'pending'.
    expect(mockUpdateResearchPlan).toHaveBeenNthCalledWith(1, ORG_ID, PLAN_ID, {
      stimulusUrl: "https://storage.example/stimulus.png",
      stimulusType: "image",
      stimulusDescription: "Landingpage mit blauem CTA",
      stimulusAnalysis: null,
      stimulusAnalysisStatus: "pending",
    });
    // Second write: the analysis payload, status 'done'.
    expect(mockUpdateResearchPlan).toHaveBeenNthCalledWith(2, ORG_ID, PLAN_ID, {
      stimulusAnalysis: ANALYSIS_PAYLOAD,
      stimulusAnalysisStatus: "done",
    });
    expect(mockAnalyzeStimulusImage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "image/png",
        imageBase64: expect.any(String),
      }),
    );
  });

  it("keeps the upload successful when the analysis throws (fail-open) and marks it failed", async () => {
    mockStorage();
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://storage.example/stimulus.png", "image"),
    );
    mockAnalyzeStimulusImage.mockRejectedValue(
      new Error("Anthropic timed out"),
    );
    const form = new FormData();
    form.set(
      "file",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "stimulus.png",
    );

    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stimulus_analysis_status).toBe("failed");
    expect(mockUpdateResearchPlan).toHaveBeenLastCalledWith(ORG_ID, PLAN_ID, {
      stimulusAnalysisStatus: "failed",
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

  it("enforces the 4 MB image limit server-side (4.5 MB Vercel body cap minus headroom)", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], {
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
    // Link mode invalidates any previous image analysis and NEVER analyzes.
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID, {
      stimulusUrl: "https://www.figma.com/proto/abc",
      stimulusType: "link",
      stimulusDescription: "Klickbarer Checkout-Prototyp",
      stimulusAnalysis: null,
      stimulusAnalysisStatus: null,
    });
    expect(mockAnalyzeStimulusImage).not.toHaveBeenCalled();
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
      stimulusAnalysis: null,
      stimulusAnalysisStatus: null,
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

  it("accepts a video (storagePath + frames), persists the public URL and runs the one-time video analysis", async () => {
    const storage = mockStorage("https://storage.example/stimulus.mp4");
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://storage.example/stimulus.mp4", "video"),
    );
    mockAnalyzeStimulusVideo.mockResolvedValue(ANALYSIS_PAYLOAD);

    const response = await POST(
      jsonRequest({
        storagePath: VIDEO_PATH,
        frames: [videoFrame(0, 2.5), videoFrame(1, 10)],
        stimulusDescription: "30s-Spot, Variante B",
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      stimulus_url: "https://storage.example/stimulus.mp4",
      stimulus_type: "video",
      stimulus_analysis_status: "done",
    });
    // Kein Datei-Upload durch die Route — nur Objekt-Verifikation + URL.
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.info).toHaveBeenCalledWith(VIDEO_PATH);
    expect(mockUpdateResearchPlan).toHaveBeenNthCalledWith(1, ORG_ID, PLAN_ID, {
      stimulusUrl: "https://storage.example/stimulus.mp4",
      stimulusType: "video",
      stimulusDescription: "30s-Spot, Variante B",
      stimulusAnalysis: null,
      stimulusAnalysisStatus: "pending",
    });
    expect(mockUpdateResearchPlan).toHaveBeenNthCalledWith(2, ORG_ID, PLAN_ID, {
      stimulusAnalysis: ANALYSIS_PAYLOAD,
      stimulusAnalysisStatus: "done",
    });
    expect(mockAnalyzeStimulusVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        frames: [
          expect.objectContaining({ index: 0, timestampSeconds: 2.5 }),
          expect.objectContaining({ index: 1, timestampSeconds: 10 }),
        ],
      }),
    );
    expect(mockAnalyzeStimulusImage).not.toHaveBeenCalled();
  });

  it("rejects a storagePath outside the org/plan namespace before any storage access", async () => {
    const storage = mockStorage();

    const response = await POST(
      jsonRequest({
        storagePath: `other-org/other-plan/123-stimulus.mp4`,
        frames: [videoFrame()],
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_storage_path");
    expect(storage.info).not.toHaveBeenCalled();
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
    expect(mockAnalyzeStimulusVideo).not.toHaveBeenCalled();
  });

  it("rejects a video whose bucket object does not exist", async () => {
    mockStorage("https://storage.example/stimulus.mp4", null);

    const response = await POST(
      jsonRequest({ storagePath: VIDEO_PATH, frames: [videoFrame()] }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("stimulus_video_not_found");
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });

  it("rejects a bucket object that is not video/mp4 (defense-in-depth behind the bucket limits)", async () => {
    mockStorage("https://storage.example/stimulus.mp4", {
      contentType: "image/png",
      size: 1234,
    });

    const response = await POST(
      jsonRequest({ storagePath: VIDEO_PATH, frames: [videoFrame()] }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_video_type");
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });

  it("keeps the video upload successful when the analysis throws (fail-open) and marks it failed", async () => {
    mockStorage("https://storage.example/stimulus.mp4");
    mockUpdateResearchPlan.mockResolvedValue(
      updatedPlan("https://storage.example/stimulus.mp4", "video"),
    );
    mockAnalyzeStimulusVideo.mockRejectedValue(new Error("Anthropic timed out"));

    const response = await POST(
      jsonRequest({ storagePath: VIDEO_PATH, frames: [videoFrame()] }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stimulus_analysis_status).toBe("failed");
    expect(mockUpdateResearchPlan).toHaveBeenLastCalledWith(ORG_ID, PLAN_ID, {
      stimulusAnalysisStatus: "failed",
    });
  });

  it("rejects more than 16 frames", async () => {
    const response = await POST(
      jsonRequest({
        storagePath: VIDEO_PATH,
        frames: Array.from({ length: 17 }, (_, i) => videoFrame(i, i * 2)),
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_video_payload");
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects a frame payload above the 3.5M-char total transport cap", async () => {
    // 12 Frames à 300k Zeichen = 3,6M > 3,5M — jeder einzelne Frame bleibt
    // unter dem per-Frame-Cap, nur die Summe reißt.
    const chunk = "A".repeat(300_000);
    const response = await POST(
      jsonRequest({
        storagePath: VIDEO_PATH,
        frames: Array.from({ length: 12 }, (_, i) => ({
          index: i,
          timestampSeconds: i * 2,
          mediaType: "image/jpeg" as const,
          data: chunk,
        })),
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_video_payload");
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects data-URL-prefixed frame data (raw base64 only)", async () => {
    const response = await POST(
      jsonRequest({
        storagePath: VIDEO_PATH,
        frames: [
          {
            ...videoFrame(),
            data: `data:image/jpeg;base64,${"QUFB".repeat(20)}`,
          },
        ],
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_video_payload");
  });

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
      stimulusAnalysis: null,
      stimulusAnalysisStatus: null,
    });
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
