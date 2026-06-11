import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDataExport } from "./export";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockCreate = vi.mocked(createAdminSupabaseClient);

function makeSupabase(opts: {
  org: Record<string, unknown> | null;
  rpcData?: unknown;
  rpcError?: unknown;
}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.org,
    error: opts.org ? null : new Error("not found"),
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: opts.rpcData ?? null, error: opts.rpcError ?? null });
  mockCreate.mockReturnValue({ from, rpc } as never);
  return { from, select, eq, single, rpc };
}

const ORG = {
  id: "uuid-1",
  clerk_org_id: "org_clerk_1",
  name: "Acme GmbH",
  plan: "design_partner",
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
  // a column the export must NOT surface in the picked metadata
  some_internal_flag: true,
};

describe("buildDataExport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns picked org metadata plus the dynamic per-table dump", async () => {
    const sb = makeSupabase({
      org: ORG,
      rpcData: {
        deals: [{ id: "deal_1", org_id: "uuid-1" }],
        research_invites: [{ id: "inv_1", org_id: "uuid-1" }],
        interview_sessions: [{ id: "sess_1", conversation: [] }],
      },
    });

    const result = await buildDataExport("uuid-1");

    expect(sb.rpc).toHaveBeenCalledWith("export_organization_data", {
      p_org_id: "uuid-1",
    });
    // Only the six whitelisted org fields — not some_internal_flag.
    expect(result.organization).toEqual({
      id: "uuid-1",
      clerk_org_id: "org_clerk_1",
      name: "Acme GmbH",
      plan: "design_partner",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
    });
    // The research layer that the old curated export silently dropped.
    expect(result.data.research_invites).toHaveLength(1);
    expect(result.data.interview_sessions).toHaveLength(1);
    expect(result.data.deals).toHaveLength(1);
    expect(typeof result.exported_at).toBe("string");
  });

  it("defaults to an empty dump when the function returns nothing", async () => {
    makeSupabase({ org: ORG, rpcData: null });
    const result = await buildDataExport("uuid-1");
    expect(result.data).toEqual({});
  });

  it("throws when the organization is missing", async () => {
    makeSupabase({ org: null });
    await expect(buildDataExport("nope")).rejects.toThrow();
  });

  it("propagates an export-function error", async () => {
    makeSupabase({ org: ORG, rpcData: null, rpcError: new Error("rpc boom") });
    await expect(buildDataExport("uuid-1")).rejects.toThrow(/rpc boom/);
  });
});
