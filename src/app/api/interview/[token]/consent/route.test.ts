import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadByToken,
  markSessionConsentByToken,
} from "@/lib/voice-agent/session-service";
import { POST } from "./route";

vi.mock("@/lib/voice-agent/session-service", () => ({
  CONSENT_TEXT_VERSION: "test-version",
  loadByToken: vi.fn(),
  markSessionConsentByToken: vi.fn(async () => {}),
}));

const mockLoad = vi.mocked(loadByToken);
const mockMark = vi.mocked(markSessionConsentByToken);

const TOKEN = "a".repeat(24);

function makeReq(body?: unknown) {
  return new Request(`http://x/api/interview/${TOKEN}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never;
}
function ctx() {
  return { params: Promise.resolve({ token: TOKEN }) };
}

describe("POST /api/interview/[token]/consent (Phase 2a, Arch-6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("base path (no body): stamps the baseline ONLY for an open, unstamped session", async () => {
    mockLoad.mockResolvedValue({
      status: "open",
      consentAcceptedAt: null,
    } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(204);
    expect(mockMark).toHaveBeenCalledTimes(1);
    expect(mockMark).toHaveBeenCalledWith(TOKEN, "test-version");
  });

  it("base path: an already-stamped session is a no-op (byte-identical)", async () => {
    mockLoad.mockResolvedValue({
      status: "open",
      consentAcceptedAt: "2026-06-01T00:00:00.000Z",
    } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(204);
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("purposes path: stamps the tier ALWAYS, even after the baseline accept (Arch-6 fix)", async () => {
    // Baseline already accepted AND status completed — the old guard would have
    // skipped; the fix must still stamp the screen tier.
    mockLoad.mockResolvedValue({
      status: "completed",
      consentAcceptedAt: "2026-06-01T00:00:00.000Z",
    } as never);

    const res = await POST(makeReq({ purposes: ["screen"] }), ctx());

    expect(res.status).toBe(204);
    expect(mockMark).toHaveBeenCalledWith(TOKEN, "test-version", ["screen"]);
  });

  it("rejects an unknown affect-like purpose (red line) → base path, no tier stamp", async () => {
    mockLoad.mockResolvedValue({
      status: "open",
      consentAcceptedAt: null,
    } as never);

    // 'affect' is not a valid tier → Zod drops it → no purposes → base path.
    const res = await POST(makeReq({ purposes: ["affect"] }), ctx());

    expect(res.status).toBe(204);
    expect(mockMark).toHaveBeenCalledWith(TOKEN, "test-version");
  });

  it("404 for an unknown token; nothing is stamped", async () => {
    mockLoad.mockResolvedValue(null as never);

    const res = await POST(makeReq({ purposes: ["screen"] }), ctx());

    expect(res.status).toBe(404);
    expect(mockMark).not.toHaveBeenCalled();
  });
});
