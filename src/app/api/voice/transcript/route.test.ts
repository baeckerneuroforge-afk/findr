import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireVoiceAgentAuth } from "@/lib/voice-interview/agent-auth";
import { appendVoiceTurns } from "@/lib/voice-interview/bridge-service";
import { POST } from "./route";

vi.mock("@/lib/voice-interview/agent-auth", () => ({
  requireVoiceAgentAuth: vi.fn(),
}));

vi.mock("@/lib/voice-interview/bridge-service", () => ({
  appendVoiceTurns: vi.fn(),
}));

const mockRequireVoiceAgentAuth = vi.mocked(requireVoiceAgentAuth);
const mockAppendVoiceTurns = vi.mocked(appendVoiceTurns);

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

function request(body: unknown) {
  return new Request("http://localhost/api/voice/transcript", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer secret",
    },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireVoiceAgentAuth.mockReturnValue({ ok: true } as never);
  mockAppendVoiceTurns.mockResolvedValue({
    ok: true,
    appended: 1,
    skipped: 0,
    turnCount: 2,
  });
});

describe("POST /api/voice/transcript — shownStimulusPosition (E6)", () => {
  it("passes the SHOW marker through on agent turns", async () => {
    const response = await POST(
      request({
        sessionId: SESSION_ID,
        turns: [
          {
            index: 1,
            role: "agent",
            content: "Schauen Sie sich bitte das erste Motiv an.",
            why: "Erster Eindruck zu Stimulus 1",
            shownStimulusPosition: 1,
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mockAppendVoiceTurns).toHaveBeenCalledWith(SESSION_ID, [
      {
        index: 1,
        role: "agent",
        text: "Schauen Sie sich bitte das erste Motiv an.",
        why: "Erster Eindruck zu Stimulus 1",
        shownStimulusPosition: 1,
      },
    ]);
  });

  it("drops the marker on customer turns and stays byte-identical without it", async () => {
    const response = await POST(
      request({
        sessionId: SESSION_ID,
        turns: [
          {
            index: 2,
            role: "user",
            content: "Mir gefällt die Farbe.",
            shownStimulusPosition: 2,
          },
          { index: 3, role: "agent", content: "Was genau an der Farbe?" },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mockAppendVoiceTurns).toHaveBeenCalledWith(SESSION_ID, [
      { index: 2, role: "customer", text: "Mir gefällt die Farbe." },
      { index: 3, role: "agent", text: "Was genau an der Farbe?" },
    ]);
  });

  it.each([0, -1, 1.5, 100])(
    "rejects invalid shownStimulusPosition %s with 400",
    async (value) => {
      const response = await POST(
        request({
          sessionId: SESSION_ID,
          turns: [
            {
              index: 1,
              role: "agent",
              content: "Frage",
              shownStimulusPosition: value,
            },
          ],
        }),
      );

      expect(response.status).toBe(400);
      expect(mockAppendVoiceTurns).not.toHaveBeenCalled();
    },
  );

  it("accepts null as 'no marker' (explicit absence)", async () => {
    const response = await POST(
      request({
        sessionId: SESSION_ID,
        turns: [
          {
            index: 1,
            role: "agent",
            content: "Frage",
            shownStimulusPosition: null,
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mockAppendVoiceTurns).toHaveBeenCalledWith(SESSION_ID, [
      { index: 1, role: "agent", text: "Frage" },
    ]);
  });
});
