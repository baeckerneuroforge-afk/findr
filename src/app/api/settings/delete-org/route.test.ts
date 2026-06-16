import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { deleteOrganizationData } from "@/lib/settings/delete-org";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/settings/server-auth", () => ({
  requireSettingsAdminOrError: vi.fn(),
}));

vi.mock("@/lib/settings/delete-org", () => ({
  deleteOrganizationData: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockRequireSettingsAdminOrError = vi.mocked(requireSettingsAdminOrError);
const mockDeleteOrganizationData = vi.mocked(deleteOrganizationData);
const mockCreateAdminSupabaseClient = vi.mocked(createAdminSupabaseClient);

function mockOrganizationLookup(name = "Acme GmbH") {
  const single = vi.fn().mockResolvedValue({
    data: { name },
    error: null,
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  mockCreateAdminSupabaseClient.mockReturnValue({ from } as never);
  return { from, select, eq, single };
}

describe("settings delete-org route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin requests before reading organization data", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      error: Response.json(
        { success: false, error: "Only organization admins can do this" },
        { status: 403 },
      ),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/settings/delete-org", {
        method: "POST",
        body: JSON.stringify({ confirmationName: "Acme GmbH" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
    expect(mockDeleteOrganizationData).not.toHaveBeenCalled();
  });

  it("rejects missing confirmation text", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      orgId: "org_1",
      clerkOrgId: "org_clerk_1",
      userId: "user_1",
      orgRole: "org:admin",
    });

    const response = await POST(
      new Request("http://localhost/api/settings/delete-org", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCreateAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("deletes org-scoped data when confirmation matches", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      orgId: "org_1",
      clerkOrgId: "org_clerk_1",
      userId: "user_1",
      orgRole: "org:admin",
    });
    mockOrganizationLookup("Acme GmbH");
    mockDeleteOrganizationData.mockResolvedValue({
      org_data_deleted: true,
      clerk_org_deleted: true,
      storage_objects_removed: 3,
    });

    const response = await POST(
      new Request("http://localhost/api/settings/delete-org", {
        method: "POST",
        body: JSON.stringify({ confirmationName: "Acme GmbH" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      org_data_deleted: true,
      clerk_org_deleted: true,
      storage_objects_removed: 3,
    });
    expect(mockDeleteOrganizationData).toHaveBeenCalledWith({
      orgId: "org_1",
      clerkOrgId: "org_clerk_1",
      organizationName: "Acme GmbH",
      confirmationName: "Acme GmbH",
    });
  });

  it("rejects a confirmation mismatch in-route with a localized 400", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      orgId: "org_1",
      clerkOrgId: "org_clerk_1",
      userId: "user_1",
      orgRole: "org:admin",
    });
    mockOrganizationLookup("Acme GmbH");

    const response = await POST(
      new Request("http://localhost/api/settings/delete-org", {
        method: "POST",
        body: JSON.stringify({ confirmationName: "Wrong Org" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("settings.invalidConfirmation");
    // Mismatch is caught before any destructive work runs, and the raw service
    // Error message never reaches the client.
    expect(mockDeleteOrganizationData).not.toHaveBeenCalled();
  });
});
