import { describe, expect, it } from "vitest";
import {
  planParticipationGate,
  isDueForActivation,
  effectivePlanStatus,
} from "./participation-gate";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");
const PAST = "2026-06-30T12:00:00.000Z";
const FUTURE = "2026-07-02T12:00:00.000Z";

/** Minimal-Shape für die seiteneffektfreien Gates (Pick der drei gelesenen Felder). */
function plan(
  over: Partial<{
    status: "draft" | "active" | "completed" | "archived";
    activationState:
      | "none"
      | "scheduled"
      | "activating"
      | "activated"
      | "failed";
    scheduledActivationAt: string | null;
  }> = {},
) {
  return {
    status: "draft" as const,
    activationState: "none" as const,
    scheduledActivationAt: null as string | null,
    ...over,
  };
}

describe("planParticipationGate", () => {
  it("opens ONLY for active", () => {
    expect(planParticipationGate({ status: "active" })).toEqual({ open: true });
  });
  it("draft (incl. scheduled, which stays draft) → not_yet_active", () => {
    expect(planParticipationGate({ status: "draft" })).toEqual({
      open: false,
      reason: "not_yet_active",
    });
  });
  it("completed → ended", () => {
    expect(planParticipationGate({ status: "completed" })).toEqual({
      open: false,
      reason: "ended",
    });
  });
  it("archived → ended", () => {
    expect(planParticipationGate({ status: "archived" })).toEqual({
      open: false,
      reason: "ended",
    });
  });
});

describe("isDueForActivation", () => {
  it("true for a scheduled draft whose time has passed", () => {
    expect(
      isDueForActivation(
        plan({
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: PAST,
        }),
        NOW,
      ),
    ).toBe(true);
  });
  it("false before the scheduled time", () => {
    expect(
      isDueForActivation(
        plan({
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: FUTURE,
        }),
        NOW,
      ),
    ).toBe(false);
  });
  it("false when not scheduled (activation_state 'none')", () => {
    expect(
      isDueForActivation(
        plan({
          status: "draft",
          activationState: "none",
          scheduledActivationAt: PAST,
        }),
        NOW,
      ),
    ).toBe(false);
  });
  it("false when there is no scheduled timestamp", () => {
    expect(
      isDueForActivation(
        plan({
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: null,
        }),
        NOW,
      ),
    ).toBe(false);
  });
  it("false when already past draft (status 'active')", () => {
    expect(
      isDueForActivation(
        plan({
          status: "active",
          activationState: "scheduled",
          scheduledActivationAt: PAST,
        }),
        NOW,
      ),
    ).toBe(false);
  });
  it("fail-closed on an unparseable timestamp (NaN comparison)", () => {
    expect(
      isDueForActivation(
        plan({
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: "not-a-date",
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("effectivePlanStatus", () => {
  it("active stays active regardless of scheduling", () => {
    expect(effectivePlanStatus(plan({ status: "active" }), NOW)).toBe("active");
  });
  it("a DUE scheduled draft reads as active (link goes live without a cron)", () => {
    expect(
      effectivePlanStatus(
        plan({
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: PAST,
        }),
        NOW,
      ),
    ).toBe("active");
  });
  it("a not-yet-due scheduled draft stays draft", () => {
    expect(
      effectivePlanStatus(
        plan({
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: FUTURE,
        }),
        NOW,
      ),
    ).toBe("draft");
  });
  it("an unscheduled draft stays draft", () => {
    expect(effectivePlanStatus(plan({ status: "draft" }), NOW)).toBe("draft");
  });
  it("completed/archived are returned as-is (never resurrected by scheduling)", () => {
    expect(effectivePlanStatus(plan({ status: "completed" }), NOW)).toBe(
      "completed",
    );
    expect(
      effectivePlanStatus(
        plan({
          status: "archived",
          activationState: "scheduled",
          scheduledActivationAt: PAST,
        }),
        NOW,
      ),
    ).toBe("archived");
  });
});

describe("gate ∘ effectivePlanStatus (wie die Resolver es konsumieren)", () => {
  it("a DUE scheduled draft is open", () => {
    const p = plan({
      status: "draft",
      activationState: "scheduled",
      scheduledActivationAt: PAST,
    });
    expect(
      planParticipationGate({ status: effectivePlanStatus(p, NOW) }),
    ).toEqual({ open: true });
  });
  it("a PENDING scheduled draft is closed as not_yet_active", () => {
    const p = plan({
      status: "draft",
      activationState: "scheduled",
      scheduledActivationAt: FUTURE,
    });
    expect(
      planParticipationGate({ status: effectivePlanStatus(p, NOW) }),
    ).toEqual({ open: false, reason: "not_yet_active" });
  });
});
