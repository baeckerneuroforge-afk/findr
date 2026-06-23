import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVisualCaptureToCompletedResearchTranscript,
  resolveVisualCaptureSession,
} from "@/lib/research/transcript-service";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createVisualCaptureFromBrowserFrames } from "@/lib/visual-intelligence/vision";
import { POST } from "./route";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/research/transcript-service", () => ({
  resolveVisualCaptureSession: vi.fn(),
  applyVisualCaptureToCompletedResearchTranscript: vi.fn(),
}));
vi.mock("@/lib/research/plans-service", () => ({ getResearchPlan: vi.fn() }));
vi.mock("@/lib/visual-intelligence/vision", () => ({
  createVisualCaptureFromBrowserFrames: vi.fn(),
  DEFAULT_MAX_VISUAL_FRAMES: 24,
  DEFAULT_SAMPLE_EVERY_SECONDS: 8,
}));

const mockResolve = vi.mocked(resolveVisualCaptureSession);
const mockGetPlan = vi.mocked(getResearchPlan);
const mockCreate = vi.mocked(createVisualCaptureFromBrowserFrames);
const mockApply = vi.mocked(applyVisualCaptureToCompletedResearchTranscript);

const TOKEN = "a".repeat(24);

function makeReq() {
  return new Request(`http://x/api/interview/${TOKEN}/visual-capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frames: [
        {
          index: 0,
          timestampSeconds: 0,
          mediaType: "image/jpeg",
          data: "x".repeat(64),
        },
      ],
    }),
  }) as never;
}
function ctx() {
  return { params: Promise.resolve({ token: TOKEN }) };
}
function session(screenConsentAt: string | null) {
  return {
    id: "s1",
    org_id: "o1",
    kind: "research",
    status: "completed",
    plan_id: "p1",
    invite_id: null,
    conversation: null,
    capture_source: null,
    visual_capture: null,
    screen_consent_at: screenConsentAt,
  };
}

describe("POST /api/interview/[token]/visual-capture (Phase 2a C-A fail-closed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlan.mockResolvedValue({ visualCaptureEnabled: true } as never);
    mockCreate.mockResolvedValue({ frameCount: 1, truncated: false } as never);
    mockApply.mockResolvedValue({
      callId: "c1",
      discoveryRan: true,
      createdCall: false,
    } as never);
  });

  it("403 when screen_consent_at is missing — fail-closed, no vision spend", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session(null),
    } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(403);
    // The expensive path must NOT run without recorded consent.
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("proceeds when the screen-tier consent stamp is present", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-22T00:00:00.000Z"),
    } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
    expect(mockApply).toHaveBeenCalled();
  });
});
