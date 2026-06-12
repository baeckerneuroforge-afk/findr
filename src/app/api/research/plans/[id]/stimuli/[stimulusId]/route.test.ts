import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  listPlanStimuli,
  removePlanStimulus,
  updatePlanStimulus,
  type ResearchPlanStimulusRecord,
} from "@/lib/research/plans-service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { DELETE, PATCH } from "./route";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/research/plans-service", () => ({
  getResearchPlan: vi.fn(),
  listPlanStimuli: vi.fn(),
  removePlanStimulus: vi.fn(),
  updatePlanStimulus: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockGetResearchPlan = vi.mocked(getResearchPlan);
const mockListPlanStimuli = vi.mocked(listPlanStimuli);
const mockRemovePlanStimulus = vi.mocked(removePlanStimulus);
const mockUpdatePlanStimulus = vi.mocked(updatePlanStimulus);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-000000000002";
const STIMULUS_ID = "00000000-0000-4000-8000-000000000003";

function context(stimulusId = STIMULUS_ID) {
  return { params: Promise.resolve({ id: PLAN_ID, stimulusId }) };
}

function patchRequest(body: unknown) {
  return new Request(
    `http://localhost/api/research/plans/${PLAN_ID}/stimuli/${STIMULUS_ID}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as never;
}

function deleteRequest() {
  return new Request(
    `http://localhost/api/research/plans/${PLAN_ID}/stimuli/${STIMULUS_ID}`,
    { method: "DELETE" },
  ) as never;
}

function record(
  overrides: Partial<ResearchPlanStimulusRecord>,
): ResearchPlanStimulusRecord {
  return {
    id: STIMULUS_ID,
    planId: PLAN_ID,
    orgId: ORG_ID,
    position: 1,
    stimulusType: "image",
    url: "https://storage.example/s1.png",
    storagePath: `${ORG_ID}/${PLAN_ID}/s1.png`,
    label: null,
    description: null,
    analysis: null,
    analysisStatus: "done",
    createdAt: "2026-06-12T10:00:00.000Z",
    ...overrides,
  };
}

function mockStorage() {
  const remove = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn(() => ({ remove }));
  mockCreateAdminSupabaseClient.mockReturnValue({
    storage: { from },
  } as never);
  return { remove };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOrgIdOrError.mockResolvedValue({ orgId: ORG_ID } as never);
  mockGetResearchPlan.mockResolvedValue({ id: PLAN_ID } as never);
});

describe("PATCH /api/research/plans/[id]/stimuli/[stimulusId]", () => {
  it("updates label and description sparsely", async () => {
    mockUpdatePlanStimulus.mockResolvedValue(
      record({ label: "Variante B", description: "Rotes Packaging" }),
    );

    const response = await PATCH(
      patchRequest({ label: "Variante B", description: "Rotes Packaging" }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdatePlanStimulus).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      STIMULUS_ID,
      { label: "Variante B", description: "Rotes Packaging" },
    );
    expect(body.stimulus.label).toBe("Variante B");
  });

  it("rejects a body without any field", async () => {
    const response = await PATCH(patchRequest({}), context());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_stimulus_patch");
    expect(mockUpdatePlanStimulus).not.toHaveBeenCalled();
  });

  it("maps an unknown stimulus to 404", async () => {
    mockUpdatePlanStimulus.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ label: "X" }), context());

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("stimulus_not_found");
  });
});

describe("DELETE /api/research/plans/[id]/stimuli/[stimulusId]", () => {
  it("removes the row first, then cleans the bucket object best-effort", async () => {
    const storage = mockStorage();
    mockListPlanStimuli.mockResolvedValue([record({})]);
    mockRemovePlanStimulus.mockResolvedValue(true);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(200);
    expect(mockRemovePlanStimulus).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      STIMULUS_ID,
    );
    expect(storage.remove).toHaveBeenCalledWith([
      `${ORG_ID}/${PLAN_ID}/s1.png`,
    ]);
  });

  it("skips the bucket for link stimuli (no storage path)", async () => {
    const storage = mockStorage();
    mockListPlanStimuli.mockResolvedValue([
      record({ stimulusType: "link", storagePath: null }),
    ]);
    mockRemovePlanStimulus.mockResolvedValue(true);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(200);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("maps an unknown id (incl. synthetic legacy ids) to 404 without deleting", async () => {
    mockListPlanStimuli.mockResolvedValue([]);

    const response = await DELETE(deleteRequest(), context(`legacy:${PLAN_ID}`));

    expect(response.status).toBe(404);
    expect(mockRemovePlanStimulus).not.toHaveBeenCalled();
  });
});
