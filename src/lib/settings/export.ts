import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

type Tables = Database["public"]["Tables"];
type OrganizationRow = Tables["organizations"]["Row"];
type AlertHistoryRow = Tables["alert_history"]["Row"];
type CrmConnectionRow = Tables["crm_connections"]["Row"];
type GongIntegrationRow = Tables["gong_integrations"]["Row"];
type HubspotIntegrationRow = Tables["hubspot_integrations"]["Row"];
type SlackIntegrationRow = Tables["slack_integrations"]["Row"];

export interface DataExportRows {
  organization: OrganizationRow;
  users: Tables["users"]["Row"][];
  deals: Tables["deals"]["Row"][];
  calls: Tables["calls"]["Row"][];
  call_speakers: Tables["call_speakers"]["Row"][];
  transcript_segments: Tables["transcript_segments"]["Row"][];
  call_segments: Tables["call_segments"]["Row"][];
  risk_scores: Tables["risk_scores"]["Row"][];
  findings: Tables["findings"]["Row"][];
  interviews: Tables["interviews"]["Row"][];
  loss_reasons: Tables["loss_reasons"]["Row"][];
  loss_reports: Tables["loss_reports"]["Row"][];
  slack_alerts: Tables["slack_alerts"]["Row"][];
  slack_alert_preferences: Tables["slack_alert_preferences"]["Row"][];
  slack_integrations: SlackIntegrationRow[];
  alert_history: AlertHistoryRow[];
  hubspot_integrations: HubspotIntegrationRow[];
  gong_integrations: GongIntegrationRow[];
  gong_users: Tables["gong_users"]["Row"][];
  crm_connections: CrmConnectionRow[];
}

export interface FindrDataExport {
  exported_at: string;
  organization: Pick<
    OrganizationRow,
    "id" | "clerk_org_id" | "name" | "plan" | "created_at" | "updated_at"
  >;
  users: DataExportRows["users"];
  deals: DataExportRows["deals"];
  calls: DataExportRows["calls"];
  call_speakers: DataExportRows["call_speakers"];
  transcript_segments: DataExportRows["transcript_segments"];
  call_segments: DataExportRows["call_segments"];
  risk_scores: DataExportRows["risk_scores"];
  findings: DataExportRows["findings"];
  interviews: DataExportRows["interviews"];
  loss_reasons: DataExportRows["loss_reasons"];
  loss_reports: DataExportRows["loss_reports"];
  slack_alerts: DataExportRows["slack_alerts"];
  slack_alert_preferences: DataExportRows["slack_alert_preferences"];
  integrations: {
    slack: Array<Omit<SlackIntegrationRow, "webhook_url">>;
    hubspot: Array<
      Omit<HubspotIntegrationRow, "access_token" | "refresh_token">
    >;
    gong: Array<Omit<GongIntegrationRow, "access_token" | "refresh_token">>;
    crm_connections: Array<
      Omit<CrmConnectionRow, "access_token" | "refresh_token">
    >;
  };
  alert_history: Array<Omit<AlertHistoryRow, "payload"> & { payload: Json }>;
  gong_users: DataExportRows["gong_users"];
}

function omitKeys<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  keys: K[],
): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function sanitizeAlertPayload(payload: Json): Json {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const copy: Record<string, Json | undefined> = { ...payload };
  delete copy.webhook_url;
  delete copy.webhookUrl;
  delete copy.token;
  delete copy.access_token;
  delete copy.refresh_token;
  delete copy.api_key;
  return copy;
}

export function buildDataExportPayload(
  rows: DataExportRows,
  exportedAt = new Date().toISOString(),
): FindrDataExport {
  return {
    exported_at: exportedAt,
    organization: {
      id: rows.organization.id,
      clerk_org_id: rows.organization.clerk_org_id,
      name: rows.organization.name,
      plan: rows.organization.plan,
      created_at: rows.organization.created_at,
      updated_at: rows.organization.updated_at,
    },
    users: rows.users,
    deals: rows.deals,
    calls: rows.calls,
    call_speakers: rows.call_speakers,
    transcript_segments: rows.transcript_segments,
    call_segments: rows.call_segments,
    risk_scores: rows.risk_scores,
    findings: rows.findings,
    interviews: rows.interviews,
    loss_reasons: rows.loss_reasons,
    loss_reports: rows.loss_reports,
    slack_alerts: rows.slack_alerts,
    slack_alert_preferences: rows.slack_alert_preferences,
    integrations: {
      slack: rows.slack_integrations.map((row) =>
        omitKeys(row, ["webhook_url"]),
      ),
      hubspot: rows.hubspot_integrations.map((row) =>
        omitKeys(row, ["access_token", "refresh_token"]),
      ),
      gong: rows.gong_integrations.map((row) =>
        omitKeys(row, ["access_token", "refresh_token"]),
      ),
      crm_connections: rows.crm_connections.map((row) =>
        omitKeys(row, ["access_token", "refresh_token"]),
      ),
    },
    alert_history: rows.alert_history.map((row) => ({
      ...row,
      payload: sanitizeAlertPayload(row.payload),
    })),
    gong_users: rows.gong_users,
  };
}

async function selectOrgRows<T>(
  table: keyof Tables,
  orgId: string,
): Promise<T[]> {
  const supabase = createAdminSupabaseClient();
  const query = supabase.from(table as never).select("*") as unknown as {
    eq: (
      column: "org_id",
      value: string,
    ) => Promise<{ data: T[] | null; error: Error | null }>;
  };
  const { data, error } = await query.eq("org_id", orgId);
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function buildDataExport(orgId: string): Promise<FindrDataExport> {
  const supabase = createAdminSupabaseClient();
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !organization) {
    throw error ?? new Error("Organization not found");
  }

  const calls = await selectOrgRows<Tables["calls"]["Row"]>("calls", orgId);
  const callIds = calls.map((call) => call.id);

  const [callSpeakers, transcriptSegments] =
    callIds.length === 0
      ? [[], []]
      : await Promise.all([
          supabase
            .from("call_speakers")
            .select("*")
            .in("call_id", callIds)
            .then(({ data, error }) => {
              if (error) throw error;
              return data ?? [];
            }),
          supabase
            .from("transcript_segments")
            .select("*")
            .in("call_id", callIds)
            .then(({ data, error }) => {
              if (error) throw error;
              return data ?? [];
            }),
        ]);

  const [
    users,
    deals,
    callSegments,
    riskScores,
    findings,
    interviews,
    lossReasons,
    lossReports,
    slackAlerts,
    slackAlertPreferences,
    slackIntegrations,
    alertHistory,
    hubspotIntegrations,
    gongIntegrations,
    gongUsers,
    crmConnections,
  ] = await Promise.all([
    selectOrgRows<Tables["users"]["Row"]>("users", orgId),
    selectOrgRows<Tables["deals"]["Row"]>("deals", orgId),
    selectOrgRows<Tables["call_segments"]["Row"]>("call_segments", orgId),
    selectOrgRows<Tables["risk_scores"]["Row"]>("risk_scores", orgId),
    selectOrgRows<Tables["findings"]["Row"]>("findings", orgId),
    selectOrgRows<Tables["interviews"]["Row"]>("interviews", orgId),
    selectOrgRows<Tables["loss_reasons"]["Row"]>("loss_reasons", orgId),
    selectOrgRows<Tables["loss_reports"]["Row"]>("loss_reports", orgId),
    selectOrgRows<Tables["slack_alerts"]["Row"]>("slack_alerts", orgId),
    selectOrgRows<Tables["slack_alert_preferences"]["Row"]>(
      "slack_alert_preferences",
      orgId,
    ),
    selectOrgRows<SlackIntegrationRow>("slack_integrations", orgId),
    selectOrgRows<AlertHistoryRow>("alert_history", orgId),
    selectOrgRows<HubspotIntegrationRow>("hubspot_integrations", orgId),
    selectOrgRows<GongIntegrationRow>("gong_integrations", orgId),
    selectOrgRows<Tables["gong_users"]["Row"]>("gong_users", orgId),
    selectOrgRows<CrmConnectionRow>("crm_connections", orgId),
  ]);

  return buildDataExportPayload({
    organization,
    users,
    deals,
    calls,
    call_speakers: callSpeakers,
    transcript_segments: transcriptSegments,
    call_segments: callSegments,
    risk_scores: riskScores,
    findings,
    interviews,
    loss_reasons: lossReasons,
    loss_reports: lossReports,
    slack_alerts: slackAlerts,
    slack_alert_preferences: slackAlertPreferences,
    slack_integrations: slackIntegrations,
    alert_history: alertHistory,
    hubspot_integrations: hubspotIntegrations,
    gong_integrations: gongIntegrations,
    gong_users: gongUsers,
    crm_connections: crmConnections,
  });
}
