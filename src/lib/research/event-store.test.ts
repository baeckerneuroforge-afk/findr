import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createResearchSupabase } from "./db";
import {
  computeTaskResult,
  ingestSessionEvents,
  resolveResearchEventSession,
  type ComputeEventInput,
  type EventSessionRow,
} from "./event-store";

vi.mock("./db", () => ({ createResearchSupabase: vi.fn() }));

const mockCreate = vi.mocked(createResearchSupabase);

// ── computeTaskResult: pure, server-authoritative, BEHAVIOURAL ONLY (L8) ──────

describe("computeTaskResult (pure, server-computed metrics — no affect, L8)", () => {
  it("empty event set → everything null/zero, no friction", () => {
    const r = computeTaskResult([]);
    expect(r).toEqual({
      version: 1,
      success: null,
      time_on_task_seconds: null,
      click_count: 0,
      friction_events: [],
    });
  });

  it("STRUCTURAL: the result carries NO affect/emotion field — behavioural keys only", () => {
    const r = computeTaskResult([{ event_type: "task_complete", ts_ms: 1 }]);
    expect(Object.keys(r).sort()).toEqual([
      "click_count",
      "friction_events",
      "success",
      "time_on_task_seconds",
      "version",
    ]);
  });

  it("task_complete → success true; time = start→terminal; counts clicks", () => {
    const events: ComputeEventInput[] = [
      { event_type: "task_start", ts_ms: 1000 },
      { event_type: "click", ts_ms: 2000 },
      { event_type: "click", ts_ms: 3000 },
      { event_type: "task_complete", ts_ms: 5000 },
    ];
    const r = computeTaskResult(events);
    expect(r.success).toBe(true);
    expect(r.time_on_task_seconds).toBe(4);
    expect(r.click_count).toBe(2);
    expect(r.friction_events).toEqual([]);
  });

  it("task_abandon → success false", () => {
    const r = computeTaskResult([
      { event_type: "task_start", ts_ms: 0 },
      { event_type: "task_abandon", ts_ms: 2000 },
    ]);
    expect(r.success).toBe(false);
    expect(r.time_on_task_seconds).toBe(2);
  });

  it("the LAST terminal event decides success (complete then abandon → false)", () => {
    const r = computeTaskResult([
      { event_type: "task_complete", ts_ms: 2000 },
      { event_type: "task_abandon", ts_ms: 4000 },
    ]);
    expect(r.success).toBe(false);
  });

  it("no terminal event → success null; time spans first→last event", () => {
    const r = computeTaskResult([
      { event_type: "click", ts_ms: 1000 },
      { event_type: "click", ts_ms: 4000 },
    ]);
    expect(r.success).toBeNull();
    expect(r.time_on_task_seconds).toBe(3);
    expect(r.click_count).toBe(2);
  });

  it("client ts_ms is untrusted — a negative span clamps to 0", () => {
    const r = computeTaskResult([
      { event_type: "task_start", ts_ms: 5000 },
      { event_type: "task_complete", ts_ms: 1000 },
    ]);
    // sorted by ts → complete@1000 is the terminal, start@5000 is the start.
    expect(r.time_on_task_seconds).toBe(0);
    expect(r.success).toBe(true);
  });

  it("rage-click run (>=3 clicks within 1s) is flagged — behaviour, not emotion", () => {
    const r = computeTaskResult([
      { event_type: "click", ts_ms: 0 },
      { event_type: "click", ts_ms: 100 },
      { event_type: "click", ts_ms: 200 },
      { event_type: "click", ts_ms: 300 },
    ]);
    expect(r.click_count).toBe(4);
    // The 3rd and 4th click each close a >=3 run inside the trailing 1s window.
    expect(r.friction_events).toEqual([
      { type: "rage_click", ts_ms: 200 },
      { type: "rage_click", ts_ms: 300 },
    ]);
  });

  it("clicks spread beyond 1s are NOT rage clicks", () => {
    const r = computeTaskResult([
      { event_type: "click", ts_ms: 0 },
      { event_type: "click", ts_ms: 2000 },
      { event_type: "click", ts_ms: 4000 },
    ]);
    expect(r.friction_events).toEqual([]);
  });

  it("is order-independent (sorts internally by ts_ms)", () => {
    const shuffled: ComputeEventInput[] = [
      { event_type: "task_complete", ts_ms: 5000 },
      { event_type: "task_start", ts_ms: 1000 },
      { event_type: "click", ts_ms: 3000 },
    ];
    expect(computeTaskResult(shuffled)).toEqual(
      computeTaskResult([
        { event_type: "task_start", ts_ms: 1000 },
        { event_type: "click", ts_ms: 3000 },
        { event_type: "task_complete", ts_ms: 5000 },
      ]),
    );
  });
});

// ── resolveResearchEventSession ──────────────────────────────────────────────

function makeResolveSupabase(row: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, from, select, eq, maybeSingle };
}

describe("resolveResearchEventSession", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("not_found when no row matches the token", async () => {
    mockCreate.mockReturnValue(makeResolveSupabase(null).client);
    const res = await resolveResearchEventSession("tok");
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  it("wrong_kind when the session is not a research session", async () => {
    mockCreate.mockReturnValue(
      makeResolveSupabase({ kind: "deal", status: "open" }).client,
    );
    const res = await resolveResearchEventSession("tok");
    expect(res).toEqual({ ok: false, reason: "wrong_kind" });
  });

  it("ineligible for a non-open/non-completed status (e.g. abandoned)", async () => {
    mockCreate.mockReturnValue(
      makeResolveSupabase({ kind: "research", status: "abandoned" }).client,
    );
    const res = await resolveResearchEventSession("tok");
    expect(res).toEqual({ ok: false, reason: "ineligible" });
  });

  it.each(["open", "completed"])(
    "ok for status %s (events stream during the interview)",
    async (status) => {
      mockCreate.mockReturnValue(
        makeResolveSupabase({
          id: "s1",
          org_id: "o1",
          kind: "research",
          status,
          plan_id: "p1",
        }).client,
      );
      const res = await resolveResearchEventSession("tok");
      expect(res.ok).toBe(true);
    },
  );

  it("throws when the read errors (fail loud, never silently open)", async () => {
    mockCreate.mockReturnValue(
      makeResolveSupabase(null, { message: "boom" }).client,
    );
    await expect(resolveResearchEventSession("tok")).rejects.toThrow(/boom/);
  });
});

// ── ingestSessionEvents ──────────────────────────────────────────────────────

function makeIngestSupabase(
  allEvents: { event_type: string; ts_ms: number }[],
) {
  const insert = vi.fn().mockResolvedValue({ error: null });

  const selectEq2 = vi.fn().mockResolvedValue({ data: allEvents, error: null });
  const selectEq1 = vi.fn(() => ({ eq: selectEq2 }));
  const select = vi.fn(() => ({ eq: selectEq1 }));

  const updateEq2 = vi.fn().mockResolvedValue({ error: null });
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));

  const from = vi.fn((table: string) => {
    if (table === "research_session_events") return { insert, select };
    if (table === "interview_sessions") return { update };
    throw new Error(`unexpected table ${table}`);
  });
  return { client: { from } as never, from, insert, select, update };
}

const SESSION: EventSessionRow = {
  id: "s1",
  org_id: "o1",
  kind: "research",
  status: "open",
  plan_id: "p1",
  events_consent_at: "2026-06-23T00:00:00.000Z",
};

describe("ingestSessionEvents", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("persists scoped rows, recomputes from ALL events, writes task_result", async () => {
    const all = [
      { event_type: "task_start", ts_ms: 1000 },
      { event_type: "click", ts_ms: 2000 },
      { event_type: "task_complete", ts_ms: 4000 },
    ];
    const sb = makeIngestSupabase(all);
    mockCreate.mockReturnValue(sb.client);

    const result = await ingestSessionEvents({
      session: SESSION,
      events: [{ event_type: "task_complete", ts_ms: 4000 }],
    });

    // Inserted row is org/session scoped, payload defaulted to {}.
    expect(sb.insert).toHaveBeenCalledWith([
      {
        session_id: "s1",
        org_id: "o1",
        event_type: "task_complete",
        ts_ms: 4000,
        target_selector: null,
        payload: {},
      },
    ]);
    // task_result is computed from the FULL event history, not just the batch.
    const expected = computeTaskResult(all);
    expect(sb.update).toHaveBeenCalledWith({ task_result: expected });
    expect(result).toEqual({ eventCount: 1, taskResult: expected });
  });

  it("throws if the insert fails (fail loud)", async () => {
    const sb = makeIngestSupabase([]);
    sb.insert.mockResolvedValue({ error: { message: "insert boom" } });
    mockCreate.mockReturnValue(sb.client);

    await expect(
      ingestSessionEvents({
        session: SESSION,
        events: [{ event_type: "click", ts_ms: 1 }],
      }),
    ).rejects.toThrow(/insert boom/);
    // task_result must NOT be written when the events did not persist.
    expect(sb.update).not.toHaveBeenCalled();
  });
});
