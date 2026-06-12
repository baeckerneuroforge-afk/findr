import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  addPlanStimulus,
  getResearchPlan,
  listPlanStimuli,
  reorderPlanStimuli,
  updatePlanStimulus,
  type ResearchPlanStimulusRecord,
} from "@/lib/research/plans-service";
import {
  analyzeStimulusImage,
  analyzeStimulusVideo,
} from "@/lib/research/stimulus-analysis";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { GET, PATCH, POST } from "./route";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

// DB-berührende Funktionen gemockt; die puren Exporte (resolveStimulusSet,
// MAX_PLAN_STIMULI) bleiben REAL — die GET-Dual-Read-Tests prüfen damit den
// echten D1-Vertrag, nicht eine Mock-Nachbildung.
vi.mock("@/lib/research/plans-service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/research/plans-service")
  >()),
  getResearchPlan: vi.fn(),
  listPlanStimuli: vi.fn(),
  addPlanStimulus: vi.fn(),
  updatePlanStimulus: vi.fn(),
  reorderPlanStimuli: vi.fn(),
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
const mockListPlanStimuli = vi.mocked(listPlanStimuli);
const mockAddPlanStimulus = vi.mocked(addPlanStimulus);
const mockUpdatePlanStimulus = vi.mocked(updatePlanStimulus);
const mockReorderPlanStimuli = vi.mocked(reorderPlanStimuli);
const mockAnalyzeStimulusImage = vi.mocked(analyzeStimulusImage);
const mockAnalyzeStimulusVideo = vi.mocked(analyzeStimulusVideo);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-000000000002";

const ANALYSIS_PAYLOAD = {
  version: 1 as const,
  model: "claude-opus-4-7",
  generatedAt: "2026-06-12T12:00:00.000Z",
  analysis: {
    layout: "Zentrierte Headline",
    farbwelt: "Blau-dominant",
    bildelemente: ["Produktbild"],
    textImBild: [],
    claimBotschaft: "Schnell startklar",
    gestaltungsentscheidungen: [],
    frageansaetze: ["Was fällt Ihnen zuerst auf?"],
  },
  textBlock: "Layout/Aufbau: Zentrierte Headline",
};

function context() {
  return { params: Promise.resolve({ id: PLAN_ID }) };
}

function jsonRequest(body: unknown, method = "POST") {
  return new Request(`http://localhost/api/research/plans/${PLAN_ID}/stimuli`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function getRequest() {
  return new Request(`http://localhost/api/research/plans/${PLAN_ID}/stimuli`, {
    method: "GET",
  }) as never;
}

function formRequest(form: FormData) {
  return new Request(`http://localhost/api/research/plans/${PLAN_ID}/stimuli`, {
    method: "POST",
    body: form,
  }) as never;
}

function plainPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    createdAt: "2026-06-01T00:00:00.000Z",
    title: "Creative-Test",
    objective: "Verständlichkeit",
    topics: [],
    useCase: "creative_test",
    stimulusUrl: null,
    stimulusType: null,
    stimulusDescription: null,
    stimulusAnalysis: null,
    stimulusAnalysisStatus: null,
    ...overrides,
  } as never;
}

function record(
  overrides: Partial<ResearchPlanStimulusRecord>,
): ResearchPlanStimulusRecord {
  return {
    id: "s1",
    planId: PLAN_ID,
    orgId: ORG_ID,
    position: 1,
    stimulusType: "image",
    url: "https://storage.example/s1.png",
    storagePath: `${ORG_ID}/${PLAN_ID}/s1.png`,
    label: "Variante A",
    description: null,
    analysis: null,
    analysisStatus: null,
    createdAt: "2026-06-12T10:00:00.000Z",
    ...overrides,
  };
}

function pngFile() {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])],
    "stimulus.png",
    { type: "image/png" },
  );
}

function mockStorage(publicUrl = "https://storage.example/new.png") {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl } });
  const info = vi.fn().mockResolvedValue({
    data: { contentType: "video/mp4", size: 12_345_678 },
    error: null,
  });
  const from = vi.fn(() => ({ upload, getPublicUrl, info }));
  mockCreateAdminSupabaseClient.mockReturnValue({
    storage: { from },
  } as never);
  return { upload, getPublicUrl, info };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOrgIdOrError.mockResolvedValue({ orgId: ORG_ID } as never);
  mockGetResearchPlan.mockResolvedValue(plainPlan());
  mockListPlanStimuli.mockResolvedValue([]);
});

describe("GET /api/research/plans/[id]/stimuli — Dual-Read", () => {
  it("returns table rows without a legacy flag and never leaks storage_path", async () => {
    mockListPlanStimuli.mockResolvedValue([record({})]);

    const response = await GET(getRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stimuli).toEqual([
      {
        id: "s1",
        position: 1,
        stimulus_type: "image",
        url: "https://storage.example/s1.png",
        label: "Variante A",
        description: null,
        analysis_status: null,
        legacy: false,
      },
    ]);
    expect(body.max_stimuli).toBe(5);
    expect(JSON.stringify(body)).not.toContain("storage_path");
  });

  it("synthesizes the legacy single asset as a 1-element set with legacy:true", async () => {
    mockGetResearchPlan.mockResolvedValue(
      plainPlan({
        stimulusUrl: "https://storage.example/legacy.png",
        stimulusType: "image",
        stimulusDescription: "Altes Asset",
      }),
    );

    const body = await (await GET(getRequest(), context())).json();

    expect(body.stimuli).toHaveLength(1);
    expect(body.stimuli[0]).toMatchObject({
      id: `legacy:${PLAN_ID}`,
      position: 1,
      url: "https://storage.example/legacy.png",
      legacy: true,
    });
  });
});

describe("POST /api/research/plans/[id]/stimuli", () => {
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
  });

  it("adds a link stimulus with label and description", async () => {
    mockAddPlanStimulus.mockResolvedValue(
      record({
        id: "s-new",
        stimulusType: "link",
        url: "https://www.figma.com/proto/abc",
        storagePath: null,
        label: "Prototyp B",
      }),
    );

    const response = await POST(
      jsonRequest({
        url: "https://www.figma.com/proto/abc",
        label: "Prototyp B",
        description: "Click-Dummy",
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockAddPlanStimulus).toHaveBeenCalledWith(ORG_ID, PLAN_ID, {
      stimulusType: "link",
      url: "https://www.figma.com/proto/abc",
      storagePath: null,
      label: "Prototyp B",
      description: "Click-Dummy",
      analysisStatus: null,
    });
    expect(body.stimulus).toMatchObject({
      id: "s-new",
      stimulus_type: "link",
      analysis_status: null,
      legacy: false,
    });
    // Link → keine Vision-Analyse.
    expect(mockAnalyzeStimulusImage).not.toHaveBeenCalled();
    expect(mockAnalyzeStimulusVideo).not.toHaveBeenCalled();
  });

  it("rejects an add beyond MAX_PLAN_STIMULI before any upload", async () => {
    mockListPlanStimuli.mockResolvedValue(
      [1, 2, 3, 4, 5].map((n) => record({ id: `s${n}`, position: n })),
    );
    const storage = mockStorage();

    const response = await POST(
      jsonRequest({ url: "https://www.figma.com/proto/abc" }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("stimulus_set_full");
    expect(mockAddPlanStimulus).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("migrates the legacy slot into the set on the FIRST add (position 1, analysis copied, never re-run)", async () => {
    mockGetResearchPlan.mockResolvedValue(
      plainPlan({
        stimulusUrl: "https://storage.example/legacy.png",
        stimulusType: "image",
        stimulusDescription: "Altes Asset",
        stimulusAnalysis: ANALYSIS_PAYLOAD,
        stimulusAnalysisStatus: "done",
      }),
    );
    mockAddPlanStimulus
      .mockResolvedValueOnce(
        record({ id: "s-migrated", url: "https://storage.example/legacy.png" }),
      )
      .mockResolvedValueOnce(
        record({ id: "s-new", position: 2, stimulusType: "link" }),
      );

    const response = await POST(
      jsonRequest({ url: "https://www.figma.com/proto/abc" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mockAddPlanStimulus).toHaveBeenNthCalledWith(1, ORG_ID, PLAN_ID, {
      stimulusType: "image",
      url: "https://storage.example/legacy.png",
      description: "Altes Asset",
      analysis: ANALYSIS_PAYLOAD,
      analysisStatus: "done",
    });
    expect(mockAddPlanStimulus).toHaveBeenCalledTimes(2);
    expect(mockAnalyzeStimulusImage).not.toHaveBeenCalled();
    expect((await response.json()).stimuli_count).toBe(2);
  });

  it("uploads an image into the plan namespace and runs the per-asset analysis", async () => {
    const storage = mockStorage("https://storage.example/new.png");
    mockAddPlanStimulus.mockResolvedValue(
      record({ id: "s-img", analysisStatus: "pending" }),
    );
    mockAnalyzeStimulusImage.mockResolvedValue(ANALYSIS_PAYLOAD);
    mockUpdatePlanStimulus.mockResolvedValue(
      record({ id: "s-img", analysisStatus: "done" }),
    );

    const form = new FormData();
    form.append("file", pngFile());
    form.append("label", "Variante A");
    form.append("description", "Blaues Packaging");
    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^${ORG_ID}/${PLAN_ID}/\\d+-[a-z0-9]+-stimulus\\.png$`),
      ),
      expect.anything(),
      { contentType: "image/png", upsert: true },
    );
    expect(mockAddPlanStimulus).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      expect.objectContaining({
        stimulusType: "image",
        url: "https://storage.example/new.png",
        label: "Variante A",
        description: "Blaues Packaging",
        analysisStatus: "pending",
      }),
    );
    // Analyse sieht die Beschreibung DIESES Assets, nicht die des Plans.
    expect(mockAnalyzeStimulusImage).toHaveBeenCalledWith(
      expect.objectContaining({
        study: expect.objectContaining({
          stimulusDescription: "Blaues Packaging",
        }),
      }),
    );
    expect(mockUpdatePlanStimulus).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      "s-img",
      { analysis: ANALYSIS_PAYLOAD, analysisStatus: "done" },
    );
    expect(body.stimulus.analysis_status).toBe("done");
  });

  it("fails open when the analysis throws — the add still succeeds", async () => {
    mockStorage();
    mockAddPlanStimulus.mockResolvedValue(
      record({ id: "s-img", analysisStatus: "pending" }),
    );
    mockAnalyzeStimulusImage.mockRejectedValue(new Error("vision down"));
    mockUpdatePlanStimulus.mockResolvedValue(
      record({ id: "s-img", analysisStatus: "failed" }),
    );

    const form = new FormData();
    form.append("file", pngFile());
    const response = await POST(formRequest(form), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stimulus.analysis_status).toBe("failed");
    expect(mockUpdatePlanStimulus).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      "s-img",
      { analysisStatus: "failed" },
    );
  });

  it("rejects a video storagePath outside the plan namespace", async () => {
    mockStorage();

    const response = await POST(
      jsonRequest({
        storagePath: `${ORG_ID}/other-plan/video.mp4`,
        frames: [
          {
            index: 0,
            timestampSeconds: 1,
            mediaType: "image/jpeg",
            data: "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=",
          },
        ],
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_stimulus_storage_path");
    expect(mockAddPlanStimulus).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/research/plans/[id]/stimuli — Reorder", () => {
  it("applies an exact permutation and returns the new order", async () => {
    mockReorderPlanStimuli.mockResolvedValue([
      record({ id: "s2", position: 1 }),
      record({ id: "s1", position: 2 }),
    ]);

    const response = await PATCH(
      jsonRequest({ orderedIds: ["s2", "s1"] }, "PATCH"),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockReorderPlanStimuli).toHaveBeenCalledWith(ORG_ID, PLAN_ID, [
      "s2",
      "s1",
    ]);
    expect(body.stimuli.map((s: { id: string }) => s.id)).toEqual(["s2", "s1"]);
  });

  it("maps a stale/foreign id set to 400 stale_stimulus_order", async () => {
    mockReorderPlanStimuli.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ orderedIds: ["gone", "s1"] }, "PATCH"),
      context(),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("stale_stimulus_order");
  });
});
