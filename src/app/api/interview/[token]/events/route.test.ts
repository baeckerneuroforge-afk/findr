import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ingestSessionEvents,
  resolveResearchEventSession,
} from "@/lib/research/event-store";
import { getResearchPlan } from "@/lib/research/plans-service";
import { POST } from "./route";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/research/event-store", () => ({
  resolveResearchEventSession: vi.fn(),
  ingestSessionEvents: vi.fn(),
}));
vi.mock("@/lib/research/plans-service", () => ({ getResearchPlan: vi.fn() }));

const mockResolve = vi.mocked(resolveResearchEventSession);
const mockGetPlan = vi.mocked(getResearchPlan);
const mockIngest = vi.mocked(ingestSessionEvents);

const TOKEN = "a".repeat(24);

function makeReq(body?: unknown) {
  return new Request(`http://x/api/interview/${TOKEN}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      body ?? { events: [{ event_type: "click", ts_ms: 1000 }] },
    ),
  }) as never;
}
function ctx() {
  return { params: Promise.resolve({ token: TOKEN }) };
}
function session(eventsConsentAt: string | null) {
  return {
    id: "s1",
    org_id: "o1",
    kind: "research",
    status: "open",
    plan_id: "p1",
    events_consent_at: eventsConsentAt,
  };
}

describe("POST /api/interview/[token]/events (Phase 2b gate-before-spend, fail-closed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlan.mockResolvedValue({ eventTrackingEnabled: true } as never);
    mockIngest.mockResolvedValue({
      eventCount: 1,
      taskResult: {
        version: 1,
        success: null,
        time_on_task_seconds: null,
        click_count: 1,
        friction_events: [],
      },
    });
  });

  it("403 when events_consent_at is missing — fail-closed, no persistence", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session(null),
    } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(403);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("403 when the study has not enabled event tracking — no persistence", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);
    mockGetPlan.mockResolvedValue({ eventTrackingEnabled: false } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(403);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("404 when the token resolves to nothing", async () => {
    mockResolve.mockResolvedValue({ ok: false, reason: "not_found" } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(404);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("200 and ingests when the events-tier consent stamp is present", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);

    const res = await POST(makeReq(), ctx());

    expect(res.status).toBe(200);
    expect(mockIngest).toHaveBeenCalledTimes(1);
  });

  it("400 and never resolves when a payload smuggles a raw input value", async () => {
    const res = await POST(
      makeReq({
        events: [
          {
            event_type: "input_focus",
            ts_ms: 1000,
            payload: { value: "secret typing" },
          },
        ],
      }),
      ctx(),
    );

    expect(res.status).toBe(400);
    // Data minimisation is enforced at the schema, before any session lookup.
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("passes a legitimate structural selector through unchanged", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);

    await POST(
      makeReq({
        events: [
          { event_type: "click", ts_ms: 1000, target_selector: "button#submit" },
          { event_type: "input_focus", ts_ms: 1100, target_selector: "input.field" },
        ],
      }),
      ctx(),
    );

    expect(mockIngest).toHaveBeenCalledTimes(1);
    const { events } = mockIngest.mock.calls[0][0] as {
      events: { target_selector?: string }[];
    };
    expect(events[0].target_selector).toBe("button#submit");
    expect(events[1].target_selector).toBe("input.field");
  });

  it("neutralises a PII-bearing selector (id smuggling an email) before persistence", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);

    const res = await POST(
      makeReq({
        events: [
          {
            event_type: "click",
            ts_ms: 1000,
            target_selector: "input#email-max@firma.de",
          },
        ],
      }),
      ctx(),
    );

    // Not a 400: the batch is accepted and ingested, but the "@" is gone.
    expect(res.status).toBe(200);
    const { events } = mockIngest.mock.calls[0][0] as {
      events: { target_selector?: string }[];
    };
    expect(events[0].target_selector).toBe("input#email-maxfirma.de");
    expect(events[0].target_selector).not.toContain("@");
  });

  it("strips quotes/brackets/values from an attribute-style selector", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);

    await POST(
      makeReq({
        events: [
          {
            event_type: "click",
            ts_ms: 1000,
            target_selector: 'input[value="john.doe@x.com"]',
          },
        ],
      }),
      ctx(),
    );

    const { events } = mockIngest.mock.calls[0][0] as {
      events: { target_selector?: string }[];
    };
    expect(events[0].target_selector).not.toMatch(/[@"'[\]=]/);
    expect(events[0].target_selector).toBe("inputvaluejohn.doex.com");
  });

  it("caps an oversized (but schema-valid) selector at 120 chars", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);

    const long = "div." + "x".repeat(400); // 404 chars, all whitelisted, < 512
    await POST(
      makeReq({
        events: [{ event_type: "click", ts_ms: 1000, target_selector: long }],
      }),
      ctx(),
    );

    const { events } = mockIngest.mock.calls[0][0] as {
      events: { target_selector?: string }[];
    };
    expect(events[0].target_selector).toHaveLength(120);
  });

  it("drops a selector with no structural content left -> undefined", async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      session: session("2026-06-23T00:00:00.000Z"),
    } as never);

    await POST(
      makeReq({
        events: [{ event_type: "click", ts_ms: 1000, target_selector: "@@@!!!()" }],
      }),
      ctx(),
    );

    const { events } = mockIngest.mock.calls[0][0] as {
      events: { target_selector?: string }[];
    };
    expect(events[0].target_selector).toBeUndefined();
  });

  it("400s on a selector longer than schema max (512), before session lookup", async () => {
    const res = await POST(
      makeReq({
        events: [
          { event_type: "click", ts_ms: 1000, target_selector: "x".repeat(600) },
        ],
      }),
      ctx(),
    );

    expect(res.status).toBe(400);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
