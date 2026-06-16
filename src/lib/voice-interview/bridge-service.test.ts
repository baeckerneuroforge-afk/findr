import { beforeEach, describe, expect, it, vi } from "vitest";

import { createResearchSupabase } from "@/lib/research/db";
import {
  appendVoiceTurns,
  stimulusSetSizeFromContext,
} from "./bridge-service";

vi.mock("next/server", () => ({ after: vi.fn() }));

vi.mock("@/lib/research/db", () => ({
  createResearchSupabase: vi.fn(),
}));

vi.mock("@/lib/research/transcript-service", () => ({
  conversationToTranscript: vi.fn(),
  persistResearchTranscriptAndDiscovery: vi.fn(),
}));

vi.mock("@/lib/research/turn-signals", () => ({
  runTurnSignalsSidecar: vi.fn(),
}));

const mockCreateResearchSupabase = vi.mocked(createResearchSupabase);

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    org_id: "00000000-0000-4000-8000-000000000002",
    kind: "research",
    status: "open",
    language: "de",
    plan_id: "00000000-0000-4000-8000-000000000003",
    invite_id: null,
    conversation: [{ role: "agent", text: "Opening" }],
    deal_context: {
      plan: {
        title: "Studie",
        objective: "Obj",
        topics: [],
        stimuli: [
          { position: 1, type: "image", url: "https://x/1.png", label: "A" },
          { position: 2, type: "image", url: "https://x/2.png", label: "B" },
        ],
      },
      brand: null,
    },
    visual_capture: null,
    ...overrides,
  };
}

/** Captures the conversation payload written by appendVoiceTurns. */
function mockSupabase(row: Record<string, unknown>) {
  const updates: unknown[] = [];
  mockCreateResearchSupabase.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
      update: (payload: unknown) => {
        updates.push(payload);
        // Chainable to mirror the route: .eq("id").eq("status","open")
        // .select("id").maybeSingle() → a row means the status CAS matched.
        const builder = {
          eq: () => builder,
          select: () => builder,
          maybeSingle: async () => ({ data: { id: row.id }, error: null }),
        };
        return builder;
      },
    }),
  } as never);
  return updates;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stimulusSetSizeFromContext (E6)", () => {
  it("reads the snapshot set size", () => {
    expect(
      stimulusSetSizeFromContext(sessionRow().deal_context as never),
    ).toBe(2);
  });

  it.each([null, {}, { plan: null }, { plan: {} }, { plan: { stimuli: "x" } }])(
    "is 0 for context without a set: %j",
    (ctx) => {
      expect(stimulusSetSizeFromContext(ctx as never)).toBe(0);
    },
  );
});

describe("appendVoiceTurns — SHOW marker clamp (E6)", () => {
  it("persists a valid marker on agent turns, exactly like the text path", async () => {
    const updates = mockSupabase(sessionRow());

    const result = await appendVoiceTurns(SESSION_ID, [
      { index: 1, role: "customer", text: "Hallo." },
      {
        index: 2,
        role: "agent",
        text: "Bitte schauen Sie auf das erste Bild.",
        why: "Einstieg Stimulus 1",
        shownStimulusPosition: 1,
      },
    ]);

    expect(result).toMatchObject({ ok: true, appended: 2 });
    const written = (updates[0] as { conversation: unknown[] }).conversation;
    expect(written[1]).toEqual({ role: "customer", text: "Hallo." });
    expect(written[2]).toEqual({
      role: "agent",
      text: "Bitte schauen Sie auf das erste Bild.",
      why: "Einstieg Stimulus 1",
      shownStimulusPosition: 1,
    });
  });

  it.each([0, 3, 99])(
    "drops a marker outside the snapshot set (1..2): %s — turn persists normally",
    async (position) => {
      const updates = mockSupabase(sessionRow());

      const result = await appendVoiceTurns(SESSION_ID, [
        {
          index: 1,
          role: "agent",
          text: "Frage",
          shownStimulusPosition: position,
        },
      ]);

      expect(result).toMatchObject({ ok: true, appended: 1 });
      const written = (updates[0] as { conversation: unknown[] }).conversation;
      expect(written[1]).toEqual({ role: "agent", text: "Frage" });
    },
  );

  it("drops every marker for sessions without a set (legacy single)", async () => {
    const updates = mockSupabase(
      sessionRow({
        deal_context: { plan: { title: "S", objective: "O", topics: [] } },
      }),
    );

    const result = await appendVoiceTurns(SESSION_ID, [
      { index: 1, role: "agent", text: "Frage", shownStimulusPosition: 1 },
    ]);

    expect(result).toMatchObject({ ok: true, appended: 1 });
    const written = (updates[0] as { conversation: unknown[] }).conversation;
    expect(written[1]).toEqual({ role: "agent", text: "Frage" });
  });

  it("drops the append when a concurrent request already left 'open' (status CAS miss)", async () => {
    // The read returns an open row (passes the initial check), but the UPDATE's
    // status CAS matches 0 rows — a concurrent finalize/withdraw flipped the row
    // out of "open". The stale append must be dropped, not clobber the row.
    const updates: unknown[] = [];
    mockCreateResearchSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: sessionRow(), error: null }),
          }),
        }),
        update: (payload: unknown) => {
          updates.push(payload);
          const builder = {
            eq: () => builder,
            select: () => builder,
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        },
      }),
    } as never);

    const result = await appendVoiceTurns(SESSION_ID, [
      { index: 1, role: "customer", text: "Hallo." },
    ]);

    expect(result).toMatchObject({ ok: false, reason: "not_open" });
    expect(updates).toHaveLength(1); // attempted, but the CAS dropped it
  });
});
