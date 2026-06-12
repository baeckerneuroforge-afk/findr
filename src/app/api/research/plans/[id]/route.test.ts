import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  countSessionsForPlan,
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";
import { PATCH } from "./route";

/**
 * Mid-Study-Flip-Warnung (voiceEnabled): Der Modus-Wechsel ist nie ein
 * Fehler (legitimer Use-Case: LiveKit-Ausfall → Text), aber sobald Sessions
 * existieren, trägt der 200-Response ein non-breaking `warning`-Feld.
 * Fail-open: Zähl-Fehler (null) → KEINE Warnung statt falscher Warnung.
 */

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/research/plans-service", () => ({
  countSessionsForPlan: vi.fn(),
  getResearchPlan: vi.fn(),
  updateResearchPlan: vi.fn(),
}));

const mockRequireOrgIdOrError = vi.mocked(requireOrgIdOrError);
const mockCountSessionsForPlan = vi.mocked(countSessionsForPlan);
const mockGetResearchPlan = vi.mocked(getResearchPlan);
const mockUpdateResearchPlan = vi.mocked(updateResearchPlan);

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-000000000002";

function context() {
  return { params: Promise.resolve({ id: PLAN_ID }) };
}

function patchRequest(body: unknown) {
  return new Request(`http://localhost/api/research/plans/${PLAN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function plan(voiceEnabled: boolean) {
  return { id: PLAN_ID, voiceEnabled } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOrgIdOrError.mockResolvedValue({ orgId: ORG_ID });
  mockUpdateResearchPlan.mockResolvedValue(plan(true));
});

describe("PATCH /api/research/plans/[id] — voiceEnabled mid-study warning", () => {
  it("returns warning when voiceEnabled flips and sessions exist", async () => {
    mockGetResearchPlan.mockResolvedValue(plan(false));
    mockCountSessionsForPlan.mockResolvedValue(3);

    const res = await PATCH(patchRequest({ voiceEnabled: true }), context());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.warning).toBe("voice_mode_changed_mid_study");
    expect(mockCountSessionsForPlan).toHaveBeenCalledWith(ORG_ID, PLAN_ID);
  });

  it("returns no warning when no sessions exist yet", async () => {
    mockGetResearchPlan.mockResolvedValue(plan(false));
    mockCountSessionsForPlan.mockResolvedValue(0);

    const res = await PATCH(patchRequest({ voiceEnabled: true }), context());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.warning).toBeUndefined();
  });

  it("skips the count entirely when voiceEnabled is unchanged", async () => {
    mockGetResearchPlan.mockResolvedValue(plan(true));

    const res = await PATCH(patchRequest({ voiceEnabled: true }), context());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.warning).toBeUndefined();
    expect(mockCountSessionsForPlan).not.toHaveBeenCalled();
  });

  it("skips the count when voiceEnabled is not in the body", async () => {
    mockGetResearchPlan.mockResolvedValue(plan(false));

    const res = await PATCH(patchRequest({ title: "Neuer Titel" }), context());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.warning).toBeUndefined();
    expect(mockCountSessionsForPlan).not.toHaveBeenCalled();
  });

  it("fails open (no warning) when the session count errors", async () => {
    mockGetResearchPlan.mockResolvedValue(plan(false));
    mockCountSessionsForPlan.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ voiceEnabled: true }), context());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.warning).toBeUndefined();
  });
});

describe("PATCH /api/research/plans/[id] — stimulus schema hardening", () => {
  beforeEach(() => {
    mockGetResearchPlan.mockResolvedValue(plan(true));
  });

  it("rejects javascript: URLs in stimulusUrl (stored-XSS guard)", async () => {
    const res = await PATCH(
      patchRequest({
        stimulusType: "link",
        stimulusUrl: "javascript:alert(document.cookie)",
      }),
      context(),
    );

    expect(res.status).toBe(400);
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });

  it("rejects data: URLs in stimulusUrl", async () => {
    const res = await PATCH(
      patchRequest({ stimulusUrl: "data:text/html,<script>1</script>" }),
      context(),
    );

    expect(res.status).toBe(400);
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });

  it("rejects unknown stimulusType values", async () => {
    const res = await PATCH(
      patchRequest({ stimulusType: "iframe" }),
      context(),
    );

    expect(res.status).toBe(400);
    expect(mockUpdateResearchPlan).not.toHaveBeenCalled();
  });

  it("accepts a valid https stimulus update", async () => {
    const res = await PATCH(
      patchRequest({
        stimulusType: "link",
        stimulusUrl: "https://example.com/prototype",
      }),
      context(),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      expect.objectContaining({
        stimulusType: "link",
        stimulusUrl: "https://example.com/prototype",
      }),
    );
  });

  it("keeps the legacy empty-string→null clearing behavior", async () => {
    const res = await PATCH(
      patchRequest({ stimulusUrl: "", stimulusType: "" }),
      context(),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateResearchPlan).toHaveBeenCalledWith(
      ORG_ID,
      PLAN_ID,
      expect.objectContaining({ stimulusUrl: null, stimulusType: null }),
    );
  });
});
