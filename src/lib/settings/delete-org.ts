import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { validateDeleteConfirmation } from "./roles";

export const ORG_DATA_DELETE_TABLES = [
  "call_segments",
  "transcript_segments",
  "call_speakers",
  "slack_alerts",
  "slack_alert_preferences",
  "alert_history",
  "loss_reports",
  "loss_reasons",
  "risk_scores",
  "findings",
  "interviews",
  "calls",
  "gong_users",
  "gong_integrations",
  "hubspot_integrations",
  "slack_integrations",
  "crm_connections",
  "oauth_states",
  "users",
  "deals",
] as const;

export interface DeleteOrgDataResult {
  deleted_tables: string[];
}

export async function deleteOrganizationData(params: {
  orgId: string;
  organizationName: string;
  confirmationName: string;
}): Promise<DeleteOrgDataResult> {
  if (
    !validateDeleteConfirmation(
      params.confirmationName,
      params.organizationName,
    )
  ) {
    throw new Error("Confirmation does not match organization name");
  }

  const supabase = createAdminSupabaseClient();
  const { data: calls, error: callsError } = await supabase
    .from("calls")
    .select("id")
    .eq("org_id", params.orgId);

  if (callsError) throw callsError;

  const callIds = (calls ?? []).map((call) => call.id);

  if (callIds.length > 0) {
    const [{ error: segmentError }, { error: speakerError }] =
      await Promise.all([
        supabase.from("transcript_segments").delete().in("call_id", callIds),
        supabase.from("call_speakers").delete().in("call_id", callIds),
      ]);
    if (segmentError) throw segmentError;
    if (speakerError) throw speakerError;
  }

  const tableDeletes = await Promise.all([
    supabase.from("call_segments").delete().eq("org_id", params.orgId),
    supabase.from("slack_alerts").delete().eq("org_id", params.orgId),
    supabase
      .from("slack_alert_preferences")
      .delete()
      .eq("org_id", params.orgId),
    supabase.from("alert_history").delete().eq("org_id", params.orgId),
    supabase.from("loss_reports").delete().eq("org_id", params.orgId),
    supabase.from("loss_reasons").delete().eq("org_id", params.orgId),
    supabase.from("risk_scores").delete().eq("org_id", params.orgId),
    supabase.from("findings").delete().eq("org_id", params.orgId),
    supabase.from("interviews").delete().eq("org_id", params.orgId),
    supabase.from("calls").delete().eq("org_id", params.orgId),
    supabase.from("gong_users").delete().eq("org_id", params.orgId),
    supabase.from("gong_integrations").delete().eq("org_id", params.orgId),
    supabase.from("hubspot_integrations").delete().eq("org_id", params.orgId),
    supabase.from("slack_integrations").delete().eq("org_id", params.orgId),
    supabase.from("crm_connections").delete().eq("org_id", params.orgId),
    supabase.from("oauth_states").delete().eq("org_id", params.orgId),
    supabase.from("users").delete().eq("org_id", params.orgId),
    supabase.from("deals").delete().eq("org_id", params.orgId),
  ]);

  for (const result of tableDeletes) {
    if (result.error) throw result.error;
  }

  return { deleted_tables: [...ORG_DATA_DELETE_TABLES] };
}
