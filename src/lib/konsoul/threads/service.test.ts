import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Konsoul P5 — thread persistence. Tests the pure sanitizer (no DB) and the
 * org-scoped save/load contract against a captured Supabase mock:
 *  - turns are reduced to {role, content} ONLY (no citations/result/extra fields),
 *    capped in count + length;
 *  - every write/read is scoped by org_id (no cross-org);
 *  - a stale/foreign threadId on update falls through to a fresh insert.
 */

interface CapturedCall {
  table: string;
  op: "insert" | "update" | "delete" | "select" | null;
  row?: Record<string, unknown>;
  filters: [string, unknown][];
}

let captured: CapturedCall[] = [];
let responses: { data: unknown; error: unknown }[] = [];

function nextResponse(): { data: unknown; error: unknown } {
  return responses.shift() ?? { data: null, error: null };
}

vi.mock("@/lib/research/db", () => ({
  createResearchSupabase: () => ({
    from: (table: string) => {
      const rec: CapturedCall = { table, op: null, filters: [] };
      const builder: Record<string, unknown> = {
        insert(row: Record<string, unknown>) {
          rec.op = "insert";
          rec.row = row;
          return builder;
        },
        update(row: Record<string, unknown>) {
          rec.op = "update";
          rec.row = row;
          return builder;
        },
        delete() {
          rec.op = "delete";
          return builder;
        },
        select() {
          if (!rec.op) rec.op = "select";
          return builder;
        },
        eq(col: string, val: unknown) {
          rec.filters.push([col, val]);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          captured.push(rec);
          return Promise.resolve(nextResponse());
        },
        single() {
          captured.push(rec);
          return Promise.resolve(nextResponse());
        },
        maybeSingle() {
          captured.push(rec);
          return Promise.resolve(nextResponse());
        },
        then(
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) {
          captured.push(rec);
          return Promise.resolve(nextResponse()).then(resolve, reject);
        },
      };
      return builder;
    },
  }),
}));

import {
  sanitizeTurns,
  saveThread,
  loadThread,
  MAX_THREAD_TURNS,
  MAX_TURN_CONTENT,
} from "./service";

beforeEach(() => {
  captured = [];
  responses = [];
});

// ── sanitizeTurns (pure) ─────────────────────────────────────────────────────

describe("sanitizeTurns", () => {
  it("keeps only {role, content} and drops extra fields (no citations/result)", () => {
    const out = sanitizeTurns([
      { role: "user", content: "Hi", id: 7, result: { kind: "grounded" } },
      {
        role: "assistant",
        content: "Hello",
        citations: [{ studyId: "s", quote: "q" }],
      },
    ]);
    expect(out).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("drops invalid roles, empty/whitespace, and non-string content", () => {
    expect(
      sanitizeTurns([
        { role: "system", content: "x" },
        { role: "user", content: "   " },
        { role: "assistant", content: 42 },
        { role: "user", content: "ok" },
        null,
        "nope",
      ]),
    ).toEqual([{ role: "user", content: "ok" }]);
  });

  it("caps content length and keeps only the most recent turns", () => {
    const many = Array.from({ length: MAX_THREAD_TURNS + 5 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "c".repeat(MAX_TURN_CONTENT + 50),
    }));
    const out = sanitizeTurns(many);
    expect(out.length).toBe(MAX_THREAD_TURNS);
    expect(out[0].content.length).toBe(MAX_TURN_CONTENT);
  });

  it("returns [] for non-array input", () => {
    expect(sanitizeTurns(null)).toEqual([]);
    expect(sanitizeTurns({})).toEqual([]);
  });
});

// ── saveThread / loadThread (org-scoped, mocked DB) ──────────────────────────

describe("saveThread", () => {
  it("inserts a NEW thread org-scoped, derives title, stores only role/content", async () => {
    responses = [{ data: { id: "thread_new" }, error: null }];
    const res = await saveThread({
      orgId: "org_1",
      turns: [
        { role: "user", content: "First question", junk: "x" },
        { role: "assistant", content: "An answer", citations: [1] },
      ],
    });
    expect(res).toEqual({ threadId: "thread_new", created: true, turnCount: 2 });
    const insert = captured.find((c) => c.op === "insert");
    expect(insert?.row?.org_id).toBe("org_1");
    expect(insert?.row?.title).toBe("First question");
    // turns carry ONLY {role, content} — no junk, no citations.
    expect(insert?.row?.turns).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: "An answer" },
    ]);
  });

  it("UPDATES an existing thread scoped by BOTH id and org_id", async () => {
    responses = [{ data: { id: "thread_1" }, error: null }];
    const res = await saveThread({
      orgId: "org_1",
      threadId: "thread_1",
      turns: [{ role: "user", content: "hi" }],
    });
    expect(res).toEqual({ threadId: "thread_1", created: false, turnCount: 1 });
    const update = captured.find((c) => c.op === "update");
    expect(update?.filters).toContainEqual(["id", "thread_1"]);
    expect(update?.filters).toContainEqual(["org_id", "org_1"]);
  });

  it("falls through to a fresh insert when the threadId matches no org row", async () => {
    // update → no row (foreign/stale id), then insert → new id.
    responses = [
      { data: null, error: null },
      { data: { id: "thread_fresh" }, error: null },
    ];
    const res = await saveThread({
      orgId: "org_1",
      threadId: "00000000-0000-0000-0000-000000000000",
      turns: [{ role: "user", content: "hi" }],
    });
    expect(res).toEqual({ threadId: "thread_fresh", created: true, turnCount: 1 });
    expect(captured.some((c) => c.op === "update")).toBe(true);
    expect(captured.some((c) => c.op === "insert")).toBe(true);
  });

  it("does not write when the sanitized history is empty", async () => {
    const res = await saveThread({ orgId: "org_1", turns: [{ role: "x", content: "" }] });
    expect(res).toEqual({ threadId: null, created: false, turnCount: 0 });
    expect(captured.length).toBe(0);
  });
});

describe("loadThread", () => {
  it("reads scoped by id + org_id and returns sanitized turns", async () => {
    responses = [
      {
        data: {
          turns: [
            { role: "user", content: "q", extra: 1 },
            { role: "assistant", content: "a" },
          ],
        },
        error: null,
      },
    ];
    const turns = await loadThread("org_1", "thread_1");
    expect(turns).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ]);
    const read = captured[0];
    expect(read.filters).toContainEqual(["id", "thread_1"]);
    expect(read.filters).toContainEqual(["org_id", "org_1"]);
  });

  it("returns null when the thread is absent (foreign/deleted)", async () => {
    responses = [{ data: null, error: null }];
    expect(await loadThread("org_1", "missing")).toBeNull();
  });
});
