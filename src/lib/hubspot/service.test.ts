import { describe, expect, it } from "vitest";
import { normalizeHubspotStage } from "./service";

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
