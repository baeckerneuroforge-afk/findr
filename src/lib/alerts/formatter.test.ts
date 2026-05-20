import { describe, expect, it } from "vitest";
import { formatSlackMessage } from "./formatter";
import type { AlertPayload } from "./types";

function payload(overrides: Partial<AlertPayload>): AlertPayload {
  return {
    type: "risk_spike",
    severity: "warning",
    title: "Risk spike on Nordbank",
    body: "Risk score moved materially.",
    context: {
      org_id: "org_1",
      deal_id: "deal_1",
      deal_name: "Nordbank Enterprise",
      deal_amount: 120000,
      deal_owner: "Sarah Mueller",
      metadata: {
        old_score: 45,
        new_score: 78,
        top_signal_description: "Repeated stalling language",
      },
    },
    ...overrides,
  };
}

describe("formatSlackMessage", () => {
  it("formats risk-spike Block Kit message", () => {
    const message = formatSlackMessage(payload({ type: "risk_spike" }));

    expect(message.text).toContain("Risk spike");
    expect(message.blocks.some((block) => block.type === "header")).toBe(true);
    expect(message.blocks.some((block) => block.type === "actions")).toBe(true);
  });

  it("formats champion-lost message with evidence", () => {
    const message = formatSlackMessage(
      payload({
        type: "champion_lost",
        severity: "critical",
        context: {
          org_id: "org_1",
          deal_id: "deal_1",
          deal_name: "Nordbank Enterprise",
          metadata: {
            champion_name: "Anna Becker",
            evidence: "Ich verlasse die Firma Ende des Monats.",
          },
        },
      }),
    );

    expect(JSON.stringify(message.blocks)).toContain("Anna Becker");
    expect(JSON.stringify(message.blocks)).toContain("Evidence");
  });

  it("formats deal-lost message", () => {
    const message = formatSlackMessage(
      payload({
        type: "deal_lost",
        severity: "warning",
        title: "Deal lost: Nordbank",
      }),
    );

    expect(message.text).toContain("Deal lost");
    expect(JSON.stringify(message.blocks)).toContain("Closed-Lost");
  });

  it("formats forecast-change message", () => {
    const message = formatSlackMessage(
      payload({
        type: "forecast_change",
        severity: "critical",
        context: {
          org_id: "org_1",
          metadata: {
            old_value: 500000,
            new_value: 350000,
            pct_change: -30,
          },
        },
      }),
    );

    expect(message.text).toContain("Forecast change");
    expect(JSON.stringify(message.blocks)).toContain("-30.0%");
  });

  it("includes action buttons on alert cards", () => {
    const message = formatSlackMessage(payload({ type: "risk_spike" }));
    const actions = message.blocks.find((block) => block.type === "actions");

    expect(JSON.stringify(actions)).toContain("View Deal");
    expect(JSON.stringify(actions)).toContain("Acknowledge");
    expect(JSON.stringify(actions)).toContain("Snooze 24h");
  });
});
