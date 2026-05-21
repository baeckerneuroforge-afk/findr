import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { buildDataExport } from "@/lib/settings/export";

vi.mock("@/lib/settings/server-auth", () => ({
  requireSettingsAdminOrError: vi.fn(),
}));

vi.mock("@/lib/settings/export", () => ({
  buildDataExport: vi.fn(),
}));

const mockRequireSettingsAdminOrError = vi.mocked(requireSettingsAdminOrError);
const mockBuildDataExport = vi.mocked(buildDataExport);

describe("settings export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin requests before building an export", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      error: Response.json(
        { success: false, error: "Only organization admins can do this" },
        { status: 403 },
      ),
    } as never);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mockBuildDataExport).not.toHaveBeenCalled();
  });

  it("returns a JSON attachment for organization admins", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      orgId: "org_1",
      clerkOrgId: "org_clerk_1",
      userId: "user_1",
      orgRole: "org:admin",
    });
    mockBuildDataExport.mockResolvedValue({
      exported_at: "2026-05-21T10:00:00.000Z",
      organization: { id: "org_1", name: "Acme GmbH" },
      deals: [],
    } as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="findr-export-org_1-',
    );
    expect(body.organization.name).toBe("Acme GmbH");
    expect(mockBuildDataExport).toHaveBeenCalledWith("org_1");
  });

  it("returns a clear server error when export generation fails", async () => {
    mockRequireSettingsAdminOrError.mockResolvedValue({
      orgId: "org_1",
      clerkOrgId: "org_clerk_1",
      userId: "user_1",
      orgRole: "org:admin",
    });
    mockBuildDataExport.mockRejectedValue(new Error("Supabase unavailable"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Supabase unavailable");
  });
});
