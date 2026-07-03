import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createResearchSupabase } from "@/lib/research/db";
import {
  CONSENT_TEXT_VERSION,
  consentTextVersion,
  markSessionConsentByToken,
  withdrawSessionByToken,
} from "./session-service";
import { invalidateInteractionSummary } from "@/lib/synthesis/interaction";

vi.mock("@/lib/research/db", () => ({ createResearchSupabase: vi.fn() }));
vi.mock("@/lib/synthesis/interaction", () => ({
  invalidateInteractionSummary: vi.fn(),
}));

const mockCreate = vi.mocked(createResearchSupabase);

/** Chainable stub for `.from(...).update(...).eq(...).is(...)` (awaited). The
 *  shared update/eq/is mocks capture every call across the base + tier writes. */
function makeSupabase(isError: unknown = null) {
  const is = vi.fn().mockResolvedValue({ error: isError });
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { client: { from } as never, from, update, eq, is };
}

describe("consentTextVersion (Konsoul-aware DSGVO Art. 7(1) stamp)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("flag OFF (unset/empty): returns the unchanged base CONSENT_TEXT_VERSION", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "");
    expect(consentTextVersion()).toBe(CONSENT_TEXT_VERSION);
  });

  it("flag ON: stamps a DISTINCT Konsoul version (so the proof matches the shown wording)", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "true");
    expect(consentTextVersion()).not.toBe(CONSENT_TEXT_VERSION);
    expect(consentTextVersion()).toMatch(/konsoul/);
  });
});

describe("markSessionConsentByToken (Phase 2a tier stamps, L4)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("base path (no purposes): one idempotent E0 stamp, no tier writes (byte-identical)", async () => {
    const sb = makeSupabase();
    mockCreate.mockReturnValue(sb.client);

    await markSessionConsentByToken("tok", "v1");

    expect(sb.update).toHaveBeenCalledTimes(1);
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ consent_version: "v1" }),
    );
    // Idempotency guard: only the FIRST accept writes.
    expect(sb.is).toHaveBeenCalledWith("consent_accepted_at", null);
  });

  it("with purposes: stamps each tier on its OWN column, idempotent per tier", async () => {
    const sb = makeSupabase();
    mockCreate.mockReturnValue(sb.client);

    await markSessionConsentByToken("tok", "v2", ["screen", "events"]);

    // Base E0 stamp + one update per tier.
    expect(sb.update).toHaveBeenCalledTimes(3);
    // Each tier guarded on its OWN column → can be granted after the baseline.
    expect(sb.is).toHaveBeenCalledWith("consent_accepted_at", null);
    expect(sb.is).toHaveBeenCalledWith("screen_consent_at", null);
    expect(sb.is).toHaveBeenCalledWith("events_consent_at", null);
    // Tier writes pin the instrumentation version (Art. 7(1)).
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        screen_consent_at: expect.any(String),
        instrumentation_consent_version: "v2",
      }),
    );
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        events_consent_at: expect.any(String),
        instrumentation_consent_version: "v2",
      }),
    );
    // Red line: a tier write never touches the (now-removed, reserved) replay
    // column — it isn't a tier anymore and must never be stamped implicitly.
    expect(sb.is).not.toHaveBeenCalledWith("replay_consent_at", null);
  });

  it("is best-effort: a tier-stamp DB error is logged, not thrown", async () => {
    const sb = makeSupabase({ message: "column does not exist" });
    mockCreate.mockReturnValue(sb.client);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      markSessionConsentByToken("tok", "v3", ["screen"]),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe("withdrawSessionByToken (DSGVO Art. 17 — Session + calls-Transkriptkopie)", () => {
  beforeEach(() => vi.clearAllMocks());

  const SESSION = {
    id: "sess-1",
    org_id: "org-1",
    plan_id: "plan-1",
    kind: "research",
  };

  /**
   * Chainable, awaitable Stub für die drei Withdraw-Queries:
   *   from("interview_sessions").select().eq().maybeSingle()   → Session-Lookup
   *   from("calls").delete().eq().eq().eq()                     → await (thenable)
   *   from("interview_sessions").delete().eq().select().maybeSingle()
   * callOrder protokolliert die Reihenfolge (calls-Delete MUSS vor Session-Delete).
   */
  function makeWithdrawSupabase(opts: {
    session?: typeof SESSION | null;
    callsError?: { message: string } | null;
  }) {
    const callOrder: string[] = [];
    const callsFilterArgs: unknown[][] = [];

    const client = {
      from: vi.fn((table: string) => {
        if (table === "calls") {
          const builder = {
            delete: () => {
              callOrder.push("calls.delete");
              return builder;
            },
            eq: (...args: unknown[]) => {
              callsFilterArgs.push(["eq", ...args]);
              return builder;
            },
            contains: (...args: unknown[]) => {
              callsFilterArgs.push(["contains", ...args]);
              return builder;
            },
            then: (
              resolve: (v: { error: unknown }) => unknown,
              reject?: (e: unknown) => unknown,
            ) =>
              Promise.resolve({ error: opts.callsError ?? null }).then(
                resolve,
                reject,
              ),
          };
          return builder;
        }
        // interview_sessions
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.session ?? null,
                error: null,
              }),
            }),
          }),
          delete: () => {
            callOrder.push("session.delete");
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: opts.session ? { id: opts.session.id } : null,
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }),
    };
    return { client: client as never, callOrder, callsFilterArgs };
  }

  it("research: löscht die calls-Kopie VOR der Session (retry-fähig) mit org/type/session-Filtern", async () => {
    const sb = makeWithdrawSupabase({ session: SESSION });
    mockCreate.mockReturnValue(sb.client);

    const result = await withdrawSessionByToken("tok-123");

    expect(result).toEqual({ deleted: true });
    expect(sb.callOrder).toEqual(["calls.delete", "session.delete"]);
    // Nicht-spoofbare Scope-Filter: org + call_type + participants-Stempel
    // (JSONB-Containment, gleicher Match wie applyVisualCapture…).
    expect(sb.callsFilterArgs).toEqual([
      ["eq", "org_id", "org-1"],
      ["eq", "call_type", "research_interview"],
      ["contains", "participants", { session_id: "sess-1" }],
    ]);
    expect(invalidateInteractionSummary).toHaveBeenCalledWith("org-1", "plan-1");
  });

  it("idempotent: keine Session (mehr) → deleted:false, keine Deletes", async () => {
    const sb = makeWithdrawSupabase({ session: null });
    mockCreate.mockReturnValue(sb.client);

    const result = await withdrawSessionByToken("tok-unknown");

    expect(result).toEqual({ deleted: false });
    expect(sb.callOrder).toEqual([]);
    expect(invalidateInteractionSummary).not.toHaveBeenCalled();
  });

  it("calls-Delete-Fehler → wirft, Session bleibt bestehen (Retry möglich)", async () => {
    const sb = makeWithdrawSupabase({
      session: SESSION,
      callsError: { message: "boom" },
    });
    mockCreate.mockReturnValue(sb.client);

    await expect(withdrawSessionByToken("tok-123")).rejects.toBeTruthy();
    expect(sb.callOrder).toEqual(["calls.delete"]);
    expect(invalidateInteractionSummary).not.toHaveBeenCalled();
  });

  it("non-research (checkin/post_loss): keine calls-Kopie im Scope → nur Session-Delete", async () => {
    const sb = makeWithdrawSupabase({
      session: { ...SESSION, kind: "checkin" },
    });
    mockCreate.mockReturnValue(sb.client);

    const result = await withdrawSessionByToken("tok-123");

    expect(result).toEqual({ deleted: true });
    expect(sb.callOrder).toEqual(["session.delete"]);
    expect(invalidateInteractionSummary).not.toHaveBeenCalled();
  });
});
