import { afterEach, describe, expect, it, vi } from "vitest";

import { createResearchSupabase } from "./db";
import { getResearchPlan } from "./plans-service";
import { listInvitesForPlan, type ResearchInviteRecord } from "./scheduling";
import { sendResearchInvite } from "./invite-orchestration";
import {
  activatePlanNow,
  releasePreparedInvites,
  schedulePlanActivation,
} from "./scheduler";

vi.mock("./db", () => ({ createResearchSupabase: vi.fn() }));
vi.mock("./plans-service", () => ({ getResearchPlan: vi.fn() }));
vi.mock("./scheduling", () => ({ listInvitesForPlan: vi.fn() }));
vi.mock("./invite-orchestration", () => ({ sendResearchInvite: vi.fn() }));

const mockCreate = vi.mocked(createResearchSupabase);
const mockGetPlan = vi.mocked(getResearchPlan);
const mockListInvites = vi.mocked(listInvitesForPlan);
const mockSend = vi.mocked(sendResearchInvite);

/** Chainable supabase mock: from/update/eq/select all return the same builder;
 *  maybeSingle resolves the configured {data,error}. Mirrors the real
 *  .from().update().eq().eq().eq().select().maybeSingle() CAS chain. */
function casChain(result: { data: unknown; error: unknown }) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["from", "update", "eq", "select"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  return b;
}

function inv(
  id: string,
  invited_at: string | null,
): ResearchInviteRecord {
  return {
    id,
    org_id: "o1",
    plan_id: "p1",
    contact_label: "X",
    contact_email: "x@example.com",
    scheduled_at: null,
    mode_preference: "text",
    access_token: "tok",
    invited_at,
    reminder_24h_sent_at: null,
    reminder_1h_sent_at: null,
    language: "de",
    status: "pending",
  };
}

function sendResult(
  status: "sent" | "missing_schedule" | "missing_contact" | "error",
) {
  return {
    status,
    sentTo: null,
    invitedAt: null,
    accessToken: null,
    message: null,
  };
}

afterEach(() => vi.clearAllMocks());

describe("releasePreparedInvites — classifies each send, skips already-sent", () => {
  it("only sends invites with invited_at === null and tallies by outcome", async () => {
    mockListInvites.mockResolvedValue([
      inv("i1", null), // → sent
      inv("i2", "2026-07-01T10:00:00.000Z"), // already sent → skipped
      inv("i3", null), // → missing_schedule
      inv("i4", null), // → error
    ]);
    mockSend.mockImplementation(async (_org: string, id: string) =>
      sendResult(
        id === "i1" ? "sent" : id === "i3" ? "missing_schedule" : "error",
      ),
    );

    const summary = await releasePreparedInvites("o1", "p1");

    // i2 (already sent) is never re-sent — idempotency at the invite level.
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockSend).not.toHaveBeenCalledWith("o1", "i2");
    expect(summary).toEqual({
      total: 3,
      sent: 1,
      needsSchedule: 1,
      needsContact: 0,
      failed: 1,
    });
  });

  it("no prepared invites → empty summary, no sends", async () => {
    mockListInvites.mockResolvedValue([inv("i1", "2026-07-01T10:00:00.000Z")]);
    const summary = await releasePreparedInvites("o1", "p1");
    expect(mockSend).not.toHaveBeenCalled();
    expect(summary).toEqual({
      total: 0,
      sent: 0,
      needsSchedule: 0,
      needsContact: 0,
      failed: 0,
    });
  });
});

describe("activatePlanNow — compare-and-set on status='draft'", () => {
  it("CAS wins → flips active, releases invites, returns summary", async () => {
    const chain = casChain({ data: { id: "p1" }, error: null });
    mockCreate.mockReturnValue(chain as never);
    mockListInvites.mockResolvedValue([]);
    mockGetPlan.mockResolvedValue({ id: "p1", status: "active" } as never);

    const result = await activatePlanNow("o1", "p1");

    expect(result.ok).toBe(true);
    expect(result.invites).toEqual({
      total: 0,
      sent: 0,
      needsSchedule: 0,
      needsContact: 0,
      failed: 0,
    });
    // The CAS predicate must include status='draft' (the at-most-once guard).
    expect(chain.eq).toHaveBeenCalledWith("status", "draft");
  });

  it("CAS loses (0 rows) → no-op, and NO invites are sent", async () => {
    mockCreate.mockReturnValue(casChain({ data: null, error: null }) as never);

    const result = await activatePlanNow("o1", "p1");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_found_or_not_draft");
    // Critical: a lost race must not release the pool (no double-activation).
    expect(mockListInvites).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("schedulePlanActivation — only a draft can be scheduled", () => {
  it("CAS wins → ok with the refreshed plan", async () => {
    mockCreate.mockReturnValue(
      casChain({ data: { id: "p1" }, error: null }) as never,
    );
    mockGetPlan.mockResolvedValue({ id: "p1" } as never);

    const result = await schedulePlanActivation("o1", "p1", {
      scheduledAt: new Date("2026-07-01T10:00:00.000Z"),
      mode: "manual",
      userId: "u1",
      email: "u@example.com",
    });

    expect(result.ok).toBe(true);
  });

  it("non-draft (0 rows) → ok:false, plan untouched", async () => {
    mockCreate.mockReturnValue(casChain({ data: null, error: null }) as never);

    const result = await schedulePlanActivation("o1", "p1", {
      scheduledAt: new Date("2026-07-01T10:00:00.000Z"),
      mode: "manual",
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_found_or_not_draft");
    expect(mockGetPlan).not.toHaveBeenCalled();
  });
});
