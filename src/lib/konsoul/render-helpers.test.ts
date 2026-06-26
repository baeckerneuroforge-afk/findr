import { describe, expect, it } from "vitest";

import { chipToneForKind, hydrateThreadTurns } from "./render-helpers";

/**
 * Konsoul P5 — freezes the two client-side honesty-grammar rules: a RESTORED
 * thread answer renders neutrally (never re-grounded), and the inline chip is
 * green ONLY for a live grounded answer.
 */

describe("hydrateThreadTurns", () => {
  it("returns [] for undefined", () => {
    expect(hydrateThreadTurns(undefined)).toEqual([]);
  });

  it("gives every restored ASSISTANT turn a NEUTRAL guidance result (never grounded)", () => {
    const out = hydrateThreadTurns([
      { role: "user", content: "How many interviews?" },
      { role: "assistant", content: "Study X has some completed interviews." },
    ]);
    expect(out[0]).toEqual({
      id: 1,
      role: "user",
      content: "How many interviews?",
      result: undefined,
    });
    expect(out[1].result).toEqual({
      kind: "guidance",
      answered: true,
      answer: "Study X has some completed interviews.",
    });
    // The load-bearing rule: a restored assistant turn is NEVER 'grounded'.
    for (const turn of out) {
      if (turn.role === "assistant") {
        expect(turn.result?.kind).toBe("guidance");
        expect(turn.result?.kind).not.toBe("grounded");
      }
    }
  });

  it("assigns sequential ids starting at 1", () => {
    const out = hydrateThreadTurns([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ]);
    expect(out.map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

describe("chipToneForKind", () => {
  it("is GREEN only for live grounded", () => {
    expect(chipToneForKind("grounded")).toBe("grounded");
  });
  it("is amber (soft) for interpretation", () => {
    expect(chipToneForKind("interpretation")).toBe("soft");
  });
  it("is null (no chip) for guidance / refusal / proposal", () => {
    expect(chipToneForKind("guidance")).toBeNull();
    expect(chipToneForKind("refusal")).toBeNull();
    expect(chipToneForKind("proposal")).toBeNull();
  });
});
