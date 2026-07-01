import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { __resetHealthDbMemoForTests } from "./db-memo";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

const mockClient = vi.mocked(createAdminSupabaseClient);

function mockHeadCount(error: unknown) {
  mockClient.mockReturnValue({
    from: () => ({
      select: async () => ({ error }),
    }),
  } as never);
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Das 10s-DB-Check-Memo der Route würde sonst den Zustand des vorherigen
    // Testfalls weitertragen (geteilte Modulinstanz).
    __resetHealthDbMemoForTests();
  });

  it("returns 200 ok when the DB round-trip succeeds", async () => {
    mockHeadCount(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", db: "up" });
  });

  it("returns 503 degraded when the DB read errors, leaking no internals", async () => {
    mockHeadCount({ message: "connection refused to db.internal:5432" });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: "degraded", db: "down" });
    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("returns 503 when creating the client throws", async () => {
    mockClient.mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
