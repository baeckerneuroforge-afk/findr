import "server-only";

import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * General per-org settings. Mirrors the slack_alert_preferences mechanic (one
 * row per org, upserted via the service-role client, org-scoped). Reads return
 * defaults when no row exists yet.
 */

export const OrgSettingsSchema = z.object({
  autoStartPostLossInterview: z.boolean().default(false),
});

export type OrgSettingsInput = z.infer<typeof OrgSettingsSchema>;

export interface OrgSettings {
  autoStartPostLossInterview: boolean;
  /** Product the check-in agent speaks about, in the org's name. Null = unset. */
  productName: string | null;
}

const DEFAULT_ORG_SETTINGS: OrgSettings = {
  autoStartPostLossInterview: false,
  productName: null,
};

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .select("auto_start_post_loss_interview, product_name")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return DEFAULT_ORG_SETTINGS;
  return {
    autoStartPostLossInterview: data.auto_start_post_loss_interview,
    productName: data.product_name ?? null,
  };
}

export async function upsertOrgSettings(
  orgId: string,
  input: OrgSettingsInput,
): Promise<OrgSettings> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .upsert(
      {
        org_id: orgId,
        auto_start_post_loss_interview: input.autoStartPostLossInterview,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("auto_start_post_loss_interview, product_name")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save org settings: ${error?.message ?? "no row returned"}`,
    );
  }
  return {
    autoStartPostLossInterview: data.auto_start_post_loss_interview,
    productName: data.product_name ?? null,
  };
}
