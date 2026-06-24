import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { deleteOrganizationData } from "./delete-org";

vi.mock("@/lib/supabase/server", () => ({ createAdminSupabaseClient: vi.fn() }));

const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

function makeSupabase(
  opts: {
    rpcError?: unknown;
    listData?: Array<{ name: string; id: string | null }>;
    listError?: unknown;
    removeError?: unknown;
    /** Buckets reported present by listBuckets(). undefined → both org buckets. */
    buckets?: Array<{ id: string; name: string }>;
    listBucketsError?: unknown;
  } = {},
) {
  const remove = vi
    .fn()
    .mockResolvedValue({ error: opts.removeError ?? null });
  const list = vi.fn().mockResolvedValue({
    data: opts.listError ? null : (opts.listData ?? []),
    error: opts.listError ?? null,
  });
  const storageFrom = vi.fn(() => ({ list, remove }));
  const listBuckets = vi.fn().mockResolvedValue({
    data: opts.listBucketsError
      ? null
      : (opts.buckets ?? [
          { id: "research-stimuli", name: "research-stimuli" },
          { id: "org-branding", name: "org-branding" },
        ]),
    error: opts.listBucketsError ?? null,
  });
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: null, error: opts.rpcError ?? null });
  const client = { storage: { from: storageFrom, listBuckets }, rpc } as never;
  return { client, remove, list, listBuckets, storageFrom, rpc };
}

const baseParams = {
  orgId: "uuid-1",
  organizationName: "Acme GmbH",
  confirmationName: "Acme GmbH",
};

describe("deleteOrganizationData", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("throws on confirmation mismatch and touches nothing", async () => {
    const sb = makeSupabase();
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    await expect(
      deleteOrganizationData({ ...baseParams, confirmationName: "Wrong" }),
    ).rejects.toThrow(/confirmation/i);

    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("deletes all org data via the SQL function and reports the outcome", async () => {
    const sb = makeSupabase();
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    const result = await deleteOrganizationData(baseParams);

    expect(sb.rpc).toHaveBeenCalledWith("delete_organization_data", {
      p_org_id: "uuid-1",
    });
    // The Zitadel org is intentionally NOT deleted here.
    expect(result).toEqual({
      org_data_deleted: true,
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

    const result = await deleteOrganizationData(baseParams);

    // Both org-prefixed buckets return the two files → 2 × 2 removed.
    expect(sb.remove).toHaveBeenCalled();
    expect(result.storage_objects_removed).toBe(4);
  });

  it("throws if the data-delete function fails, after the storage wipe", async () => {
    const sb = makeSupabase({ rpcError: new Error("db down") });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    await expect(deleteOrganizationData(baseParams)).rejects.toThrow(/db down/);
  });

  it("fails CLOSED on a storage REMOVE error — DB delete never runs", async () => {
    const sb = makeSupabase({
      listData: [{ name: "a.png", id: "f1" }],
      removeError: { message: "storage 500" },
    });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    await expect(deleteOrganizationData(baseParams)).rejects.toThrow(/remove/i);
    // The owning DB row must NOT be deleted while files might still be stranded.
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it("fails CLOSED on a storage LIST error — DB delete never runs", async () => {
    const sb = makeSupabase({ listError: { message: "list boom" } });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    await expect(deleteOrganizationData(baseParams)).rejects.toThrow(/list/i);
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it("fails CLOSED if buckets cannot be enumerated — DB delete never runs", async () => {
    const sb = makeSupabase({ listBucketsError: { message: "no storage" } });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    await expect(deleteOrganizationData(baseParams)).rejects.toThrow(/bucket/i);
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it("skips a genuinely-absent bucket without failing", async () => {
    // Only research-stimuli is provisioned here (org-branding never applied).
    const sb = makeSupabase({
      buckets: [{ id: "research-stimuli", name: "research-stimuli" }],
      listData: [{ name: "a.png", id: "f1" }],
    });
    mockCreateAdminSupabaseClient.mockReturnValue(sb.client);

    const result = await deleteOrganizationData(baseParams);

    // Only the present bucket is wiped → 1 object; org-branding skipped, no throw.
    expect(result.storage_objects_removed).toBe(1);
    expect(sb.rpc).toHaveBeenCalled();
  });
});
