import { describe, expect, it } from "vitest";
import { deriveOnboardingStatus } from "./status";

describe("deriveOnboardingStatus", () => {
  it("counts completed setup steps from integration, risk analysis, and Slack", () => {
    const status = deriveOnboardingStatus({
      dealCount: 4,
      riskCount: 2,
      hasHubspot: true,
      hasGong: false,
      hasSlack: true,
    });

    expect(status.completed_steps).toBe(3);
    expect(status.total_steps).toBe(3);
    expect(status.is_complete).toBe(true);
    expect(status.next_step).toBeUndefined();
  });

  it("sets connect data as the first next step when no integration exists", () => {
    const status = deriveOnboardingStatus({
      dealCount: 0,
      riskCount: 0,
      hasHubspot: false,
      hasGong: false,
      hasSlack: false,
    });

    expect(status.completed_steps).toBe(0);
    expect(status.next_step?.id).toBe("connect_data");
  });

  it("accepts Gong as a completed data integration", () => {
    const status = deriveOnboardingStatus({
      dealCount: 1,
      riskCount: 0,
      hasHubspot: false,
      hasGong: true,
      hasSlack: false,
    });

    expect(status.has_integration).toBe(true);
    expect(status.completed_steps).toBe(1);
    expect(status.next_step?.id).toBe("first_analysis");
  });

  it("sets first analysis as the next step after CRM connection", () => {
    const status = deriveOnboardingStatus({
      dealCount: 8,
      riskCount: 0,
      hasHubspot: true,
      hasGong: false,
      hasSlack: false,
    });

    expect(status.has_deals).toBe(true);
    expect(status.has_risk_analysis).toBe(false);
    expect(status.next_step?.id).toBe("first_analysis");
  });

  it("sets Slack setup as the next step after risk analysis", () => {
    const status = deriveOnboardingStatus({
      dealCount: 8,
      riskCount: 3,
      hasHubspot: true,
      hasGong: false,
      hasSlack: false,
    });

    expect(status.completed_steps).toBe(2);
    expect(status.next_step?.id).toBe("setup_slack");
  });

  it("derives has_deals and has_risk_analysis from counts", () => {
    const empty = deriveOnboardingStatus({
      dealCount: 0,
      riskCount: 0,
      hasHubspot: false,
      hasGong: false,
      hasSlack: false,
    });
    const populated = deriveOnboardingStatus({
      dealCount: 1,
      riskCount: 1,
      hasHubspot: false,
      hasGong: false,
      hasSlack: false,
    });

    expect(empty.has_deals).toBe(false);
    expect(empty.has_risk_analysis).toBe(false);
    expect(populated.has_deals).toBe(true);
    expect(populated.has_risk_analysis).toBe(true);
  });
});
