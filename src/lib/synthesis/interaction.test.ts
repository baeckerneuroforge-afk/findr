import { describe, it, expect } from "vitest";
import { aggregateInteractionSessions } from "./interaction";

/** Phase D — pure usability aggregation. Server-deterministic, min-N gated,
 *  aggregate-only. */
describe("aggregateInteractionSessions", () => {
  const row = (
    over: Partial<{
      success: boolean | null;
      timeOnTaskSeconds: number | null;
      clickCount: number;
      frictionCount: number;
      verdict: "success" | "partial" | "failure" | null;
    }> = {},
  ) => ({
    success: true,
    timeOnTaskSeconds: 60,
    clickCount: 10,
    frictionCount: 0,
    verdict: null,
    ...over,
  });

  it("returns null below the min-N gate (Art. 22 / no single-respondent)", () => {
    expect(aggregateInteractionSessions([row(), row()])).toBeNull();
  });

  it("computes success rate over DETERMINATE outcomes only", () => {
    const s = aggregateInteractionSessions([
      row({ success: true }),
      row({ success: false }),
      row({ success: null }), // excluded from the rate denominator
    ]);
    expect(s).not.toBeNull();
    expect(s!.sessionsWithResults).toBe(3);
    expect(s!.successRate).toBe(0.5); // 1 of 2 determinate
  });

  it("averages time (rounded) and clicks (1 decimal), and rates friction", () => {
    const s = aggregateInteractionSessions([
      row({ timeOnTaskSeconds: 30, clickCount: 5, frictionCount: 1 }),
      row({ timeOnTaskSeconds: 60, clickCount: 10, frictionCount: 0 }),
      row({ timeOnTaskSeconds: null, clickCount: 12, frictionCount: 2 }),
    ]);
    expect(s!.avgTimeSeconds).toBe(45); // (30+60)/2 rounded, null excluded
    expect(s!.avgClicks).toBe(9); // (5+10+12)/3 = 9
    expect(s!.frictionRate).toBeCloseTo(2 / 3); // 2 of 3 had >=1 friction
  });

  it("judge agreement: share where behavioural and verdict clearly align", () => {
    const s = aggregateInteractionSessions([
      row({ success: true, verdict: "success" }), // agree
      row({ success: false, verdict: "success" }), // disagree
      row({ success: true, verdict: "partial" }), // partial ≠ binary agree
      row({ success: null, verdict: "failure" }), // excluded (no determinate)
    ]);
    // judged = 3 (those with verdict AND determinate success); 1 agrees
    expect(s!.judgeAgreement).toBeCloseTo(1 / 3);
  });

  it("judge agreement null when no session carries a verdict", () => {
    const s = aggregateInteractionSessions([row(), row(), row()]);
    expect(s!.judgeAgreement).toBeNull();
  });
});
