import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createResearchSupabase } from "@/lib/research/db";

vi.mock("@/lib/auth/org", () => ({ requireOrgIdOrError: vi.fn() }));
vi.mock("@/lib/research/plans-service", () => ({ getResearchPlan: vi.fn() }));
vi.mock("@/lib/research/db", () => ({ createResearchSupabase: vi.fn() }));

const mockRequireOrg = vi.mocked(requireOrgIdOrError);
const mockGetPlan = vi.mocked(getResearchPlan);
const mockCreateSupabase = vi.mocked(createResearchSupabase);

function makeSupabase(opts: {
  invite?: { id: string } | null;
  inviteError?: unknown;
  sessions?: Array<{ id: string }>;
  sessionsError?: unknown;
}) {
  const inviteMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.invite ?? null,
    error: opts.inviteError ?? null,
  });
  const inviteChain: Record<string, unknown> = {
    maybeSingle: inviteMaybeSingle,
  };
  inviteChain.eq = () => inviteChain;
  inviteChain.select = () => inviteChain;
  const inviteDelete = vi.fn(() => inviteChain);

  const sessionsSelect = vi.fn().mockResolvedValue({
    data: opts.sessions ?? [],
    error: opts.sessionsError ?? null,
  });
  const sessionsChain: Record<string, unknown> = { select: sessionsSelect };
  sessionsChain.eq = () => sessionsChain;
  const sessionsDelete = vi.fn(() => sessionsChain);

  const from = vi.fn((table: string) => {
    if (table === "research_invites") return { delete: inviteDelete };
    if (table === "interview_sessions") return { delete: sessionsDelete };
    throw new Error(`unexpected table ${table}`);
  });
  mockCreateSupabase.mockReturnValue({ from } as never);
  return { from, inviteDelete, sessionsDelete, sessionsSelect };
}

function makeRequest(erase = false) {
  const url = `http://localhost/api/research/plans/plan_1/participants/inv_1${
    erase ? "?erase=true" : ""
  }`;
  return new Request(url, { method: "DELETE" }) as never;
}

const params = () => Promise.resolve({ id: "plan_1", participantId: "inv_1" });

describe("DELETE participant — remove vs. GDPR erase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ orgId: "org_1" } as never);
    mockGetPlan.mockResolvedValue({ id: "plan_1" } as never);
  });

  it("default mode deletes the invite and leaves sessions untouched", async () => {
    const sb = makeSupabase({ invite: { id: "inv_1" } });

    const res = await DELETE(makeRequest(false), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      participantId: "inv_1",
      erased: false,
      sessionsDeleted: 0,
    });
    expect(sb.sessionsDelete).not.toHaveBeenCalled();
    expect(sb.inviteDelete).toHaveBeenCalled();
  });

  it("erase mode wipes the sessions before deleting the invite", async () => {
    const sb = makeSupabase({
      invite: { id: "inv_1" },
      sessions: [{ id: "s1" }, { id: "s2" }],
    });

    const res = await DELETE(makeRequest(true), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      erased: true,
      sessionsDeleted: 2,
    });
    expect(sb.sessionsDelete).toHaveBeenCalled();
    expect(sb.inviteDelete).toHaveBeenCalled();
  });

  it("returns 404 for a plan the org does not own (before any delete)", async () => {
    mockGetPlan.mockResolvedValue(null as never);
    const sb = makeSupabase({ invite: { id: "inv_1" } });

    const res = await DELETE(makeRequest(true), { params: params() });

    expect(res.status).toBe(404);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("returns 404 when the invite does not exist", async () => {
    makeSupabase({ invite: null });

    const res = await DELETE(makeRequest(false), { params: params() });

    expect(res.status).toBe(404);
  });

  it("surfaces a session-erase failure as 500 without deleting the invite", async () => {
    const sb = makeSupabase({ sessionsError: new Error("boom") });

    const res = await DELETE(makeRequest(true), { params: params() });

    expect(res.status).toBe(500);
    expect(sb.inviteDelete).not.toHaveBeenCalled();
  });
});
