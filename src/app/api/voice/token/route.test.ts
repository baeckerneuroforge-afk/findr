import { beforeEach, describe, expect, it, vi } from "vitest";

import { getResearchPlan } from "@/lib/research/plans-service";
import {
  loadByToken,
  markSessionVoiceModeById,
} from "@/lib/voice-agent/session-service";
import {
  getLiveKitVoiceEnv,
  mintParticipantVoiceToken,
} from "@/lib/voice-interview/livekit";
import { POST } from "./route";

/**
 * Pricing-Fundament: Der LiveKit-Token-Mint ist der Agent-Dispatch-Moment
 * (Kosten beginnen) — genau DORT wird die Session als mode='voice'
 * gestempelt. Die Gates davor (voiceEnabled, 503 ohne Env) dürfen NIE
 * stempeln, sonst zählte eine nie gestartete Voice-Session als Voice.
 */

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/research/plans-service", () => ({
  getResearchPlan: vi.fn(),
}));

vi.mock("@/lib/research/scheduling", () => ({
  findInviteByAccessToken: vi.fn(),
}));

vi.mock("@/lib/voice-agent/session-service", () => ({
  getPublicSession: vi.fn(),
  loadByToken: vi.fn(),
  markSessionVoiceModeById: vi.fn(),
}));

vi.mock("@/lib/voice-interview/livekit", () => ({
  getLiveKitVoiceEnv: vi.fn(),
  mintParticipantVoiceToken: vi.fn(),
}));

const mockGetResearchPlan = vi.mocked(getResearchPlan);
const mockLoadByToken = vi.mocked(loadByToken);
const mockMarkVoiceMode = vi.mocked(markSessionVoiceModeById);
const mockGetLiveKitVoiceEnv = vi.mocked(getLiveKitVoiceEnv);
const mockMint = vi.mocked(mintParticipantVoiceToken);

const ACCESS_TOKEN = "tok_0123456789abcdef0123456789abcdef";
const SESSION_ID = "00000000-0000-4000-8000-00000000000a";

const ENV = {
  serverUrl: "wss://livekit.example",
  apiKey: "key",
  apiSecret: "secret",
  agentName: "findr-voice",
};

function tokenRequest() {
  return new Request("http://localhost/api/voice/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: ACCESS_TOKEN }),
  }) as never;
}

function session(status = "open") {
  return {
    id: SESSION_ID,
    orgId: "org-1",
    planId: "plan-1",
    status,
    language: "de",
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadByToken.mockResolvedValue(session());
  mockGetResearchPlan.mockResolvedValue({
    voiceEnabled: true,
    screeningQuestions: [],
  } as never);
  mockGetLiveKitVoiceEnv.mockReturnValue(ENV);
  mockMint.mockResolvedValue({
    serverUrl: ENV.serverUrl,
    roomName: `voice-${SESSION_ID}`,
    token: "jwt",
  });
});

describe("POST /api/voice/token — mode='voice' Stempel", () => {
  it("stamps the session as voice after a successful mint", async () => {
    const res = await POST(tokenRequest());

    expect(res.status).toBe(200);
    expect(mockMint).toHaveBeenCalledWith(ENV, SESSION_ID);
    expect(mockMarkVoiceMode).toHaveBeenCalledWith(SESSION_ID);
  });

  it("does NOT stamp when LiveKit env is missing (503)", async () => {
    mockGetLiveKitVoiceEnv.mockReturnValue(null);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(503);
    expect(mockMarkVoiceMode).not.toHaveBeenCalled();
  });

  it("does NOT stamp when voice is not enabled for the study (403)", async () => {
    mockGetResearchPlan.mockResolvedValue({
      voiceEnabled: false,
      screeningQuestions: [],
    } as never);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(403);
    expect(mockMarkVoiceMode).not.toHaveBeenCalled();
  });

  it("does NOT stamp when the session is no longer open (409)", async () => {
    mockLoadByToken.mockResolvedValue(session("completed"));

    const res = await POST(tokenRequest());

    expect(res.status).toBe(409);
    expect(mockMarkVoiceMode).not.toHaveBeenCalled();
  });
});
