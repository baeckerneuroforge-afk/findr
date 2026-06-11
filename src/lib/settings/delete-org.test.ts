import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clerkClient } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { deleteOrganizationData } from "./delete-org";

vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminSupabaseClient: vi.fn() }));

const mockClerkClient = vi.mocked(clerkClient);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

function makeSupabase(
  opts: {
    orgDeleteError?: unknown;
    listData?: Array<{ name: string; id: string | null }>;
  } = {},
) {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const list = vi
    .fn()
    .mockResolvedValue({ data: opts.listData ?? [], error: null });
  const storageFrom = vi.fn(() => ({ list, remove }));
  const eq = vi.fn().mockResolvedValue({ error: opts.orgDeleteError ?? null });
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  const client = { storage: { from: storageFrom }, from } as never;
  return { client, remove, list, storageFrom, eq, del, from };
}

function makeClerk() {
  const deleteOrganization = vi.fn().mockResolvedValue(undefined);
  mockClerkClient.mockResolvedValue({
    organizations: { deleteOrganization },
  } as never);
  return { deleteOrganization };
}

const baseParams = {
  orgId: "uuid-1",
  clerkOrgId: "org_clerk_1",
  organizationName: "Acme GmbH",
  confirmationName: "Acme GmbH",
};

describe("deleteOrganizationData", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("throws on confirmation mismatch and touches nothing", async () => {
    const sb = makeSupabase();
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);
    makeClerk();

    await expect(
      deleteOrganizationData({ ...baseParams, confirmationName: "Wrong" }),
    ).rejects.toThrow(/confirmation/i);

    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
    expect(mockClerkClient).not.toHaveBeenCalled();
  });

  it("deletes the organizations row then the Clerk org, and reports the outcome", async () => {
    const sb = makeSupabase();
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);
    const clerk = makeClerk();

    const result = await deleteOrganizationData(baseParams);

    expect(sb.from).toHaveBeenCalledWith("organizations");
    expect(sb.eq).toHaveBeenCalledWith("id", "uuid-1");
    expect(clerk.deleteOrganization).toHaveBeenCalledWith("org_clerk_1");
    expect(result).toEqual({
      org_data_deleted: true,
      clerk_org_deleted: true,
      storage_objects_removed: 0,
    });
  });

  it("removes org-prefixed storage objects across buckets and counts them", async () => {
    const sb = makeSupabase({
      listData: [
        { name: "a.png", id: "f1" },
        { name: "b.png", id: "f2" },
      ],
    });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);
    makeClerk();

    const result = await deleteOrganizationData(baseParams);

    // Both org-prefixed buckets return the two files → 2 × 2 removed.
    expect(sb.remove).toHaveBeenCalled();
    expect(result.storage_objects_removed).toBe(4);
  });

  it("treats a Clerk failure as non-fatal — data is already gone", async () => {
    const sb = makeSupabase();
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);
    const deleteOrganization = vi
      .fn()
      .mockRejectedValue(new Error("clerk down"));
    mockClerkClient.mockResolvedValue({
      organizations: { deleteOrganization },
    } as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await deleteOrganizationData(baseParams);

    expect(result.org_data_deleted).toBe(true);
    expect(result.clerk_org_deleted).toBe(false);
    errorSpy.mockRestore();
  });

  it("throws if the org-row delete fails, before touching Clerk", async () => {
    const sb = makeSupabase({ orgDeleteError: new Error("db down") });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);
    const clerk = makeClerk();

    await expect(deleteOrganizationData(baseParams)).rejects.toThrow(/db down/);
    expect(clerk.deleteOrganization).not.toHaveBeenCalled();
  });
});
