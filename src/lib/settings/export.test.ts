import { describe, expect, it } from "vitest";
import { buildDataExportPayload, type DataExportRows } from "./export";

function createRows(
  overrides: Partial<Record<keyof DataExportRows, unknown>> = {},
): DataExportRows {
  return {
    organization: {
      id: "org_1",
      clerk_org_id: "org_clerk_1",
      name: "Acme GmbH",
      plan: "design_partner",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
    },
    users: [],
    deals: [],
    calls: [],
    call_speakers: [],
    transcript_segments: [],
    call_segments: [],
    risk_scores: [],
    findings: [],
    interviews: [],
    loss_reasons: [],
    loss_reports: [],
    slack_alerts: [],
    slack_alert_preferences: [],
    slack_integrations: [],
    alert_history: [],
    hubspot_integrations: [],
    gong_integrations: [],
    gong_users: [],
    crm_connections: [],
    ...overrides,
  } as unknown as DataExportRows;
}

describe("buildDataExportPayload", () => {
  it("exports organization metadata and org-scoped business data", () => {
    const payload = buildDataExportPayload(
      createRows({
        deals: [
          {
            id: "deal_1",
            org_id: "org_1",
            name: "Nordbank Expansion",
            amount: 120000,
          },
        ],
        risk_scores: [
          {
            id: "risk_1",
            org_id: "org_1",
            deal_id: "deal_1",
            risk_score: 72,
          },
        ],
      }),
      "2026-05-21T10:00:00.000Z",
    );

    expect(payload.exported_at).toBe("2026-05-21T10:00:00.000Z");
    expect(payload.organization).toEqual({
      id: "org_1",
      clerk_org_id: "org_clerk_1",
      name: "Acme GmbH",
      plan: "design_partner",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
    });
    expect(payload.deals).toHaveLength(1);
    expect(payload.risk_scores).toHaveLength(1);
  });

  it("removes Slack webhook URLs from integration exports", () => {
    const payload = buildDataExportPayload(
      createRows({
        slack_integrations: [
          {
            id: "slack_1",
            org_id: "org_1",
            webhook_url: "https://hooks.slack.com/services/T/B/SECRET",
            channel_name: "#sales",
          },
        ],
      }),
    );

    expect(payload.integrations.slack[0]).toEqual({
      id: "slack_1",
      org_id: "org_1",
      channel_name: "#sales",
    });
    expect(payload.integrations.slack[0]).not.toHaveProperty("webhook_url");
  });

  it("removes OAuth tokens from Hubspot, Gong, and CRM connection exports", () => {
    const payload = buildDataExportPayload(
      createRows({
        hubspot_integrations: [
          {
            id: "hubspot_1",
            org_id: "org_1",
            access_token: "hubspot_access",
            refresh_token: "hubspot_refresh",
            portal_id: "123",
          },
        ],
        gong_integrations: [
          {
            id: "gong_1",
            org_id: "org_1",
            access_token: "gong_access",
            refresh_token: "gong_refresh",
            instance_url: "https://api.gong.io",
          },
        ],
        crm_connections: [
          {
            id: "crm_1",
            org_id: "org_1",
            provider: "hubspot",
            access_token: "crm_access",
            refresh_token: "crm_refresh",
          },
        ],
      }),
    );

    expect(payload.integrations.hubspot[0]).not.toHaveProperty("access_token");
    expect(payload.integrations.hubspot[0]).not.toHaveProperty("refresh_token");
    expect(payload.integrations.gong[0]).not.toHaveProperty("access_token");
    expect(payload.integrations.gong[0]).not.toHaveProperty("refresh_token");
    expect(payload.integrations.crm_connections[0]).not.toHaveProperty(
      "access_token",
    );
    expect(payload.integrations.crm_connections[0]).not.toHaveProperty(
      "refresh_token",
    );
  });

  it("sanitizes secrets from alert history payloads", () => {
    const payload = buildDataExportPayload(
      createRows({
        alert_history: [
          {
            id: "alert_1",
            org_id: "org_1",
            payload: {
              visible: "keep",
              webhook_url: "https://hooks.slack.com/services/T/B/SECRET",
              token: "secret",
              api_key: "secret",
              access_token: "secret",
              refresh_token: "secret",
            },
          },
        ],
      }),
    );

    expect(payload.alert_history[0].payload).toEqual({ visible: "keep" });
  });
});
