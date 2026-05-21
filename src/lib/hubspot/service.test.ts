import { describe, expect, it } from "vitest";
import { getClosedLostLossHandling, normalizeHubspotStage } from "./service";

describe("normalizeHubspotStage", () => {
  it("normalizes common Hubspot stage names", () => {
    expect({
      closedwon: normalizeHubspotStage("closedwon"),
      closed_lost: normalizeHubspotStage("closed_lost"),
      contractsent: normalizeHubspotStage("contractsent"),
      proposal: normalizeHubspotStage("proposal"),
      negotiation: normalizeHubspotStage("negotiation"),
      decision: normalizeHubspotStage("decisionmakerboughtin"),
      demo: normalizeHubspotStage("demo_scheduled"),
      empty: normalizeHubspotStage(null),
      unknown: normalizeHubspotStage("appointmentscheduled"),
    }).toMatchInlineSnapshot(`
      {
        "closed_lost": "closed_lost",
        "closedwon": "closed_won",
        "contractsent": "verbal_commit",
        "decision": "demo",
        "demo": "demo",
        "empty": "qualified",
        "negotiation": "negotiation",
        "proposal": "proposal_sent",
        "unknown": "qualified",
      }
    `);
  });
});

describe("getClosedLostLossHandling", () => {
  it("analyzes and alerts when an existing deal transitions to closed-lost", () => {
    expect(
      getClosedLostLossHandling({ stage: "negotiation" }, "closed_lost"),
    ).toEqual({
      analyze: true,
      alert: true,
    });
  });

  it("backfills analysis without alerting when a new imported deal is already closed-lost", () => {
    expect(getClosedLostLossHandling(null, "closed_lost")).toEqual({
      analyze: true,
      alert: false,
    });
  });

  it("does not re-analyze deals that were already closed-lost", () => {
    expect(
      getClosedLostLossHandling({ stage: "closed_lost" }, "closed_lost"),
    ).toEqual({
      analyze: false,
      alert: false,
    });
  });

  it("ignores deals that are not closed-lost", () => {
    expect(getClosedLostLossHandling(null, "proposal_sent")).toEqual({
      analyze: false,
      alert: false,
    });
  });
});
