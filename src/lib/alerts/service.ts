import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  AlertPreferencesSchema,
  type AlertHistoryItem,
  type AlertPreferences,
  type AlertPreferencesInput,
} from "./types";

export const DEFAULT_ALERT_PREFERENCES: AlertPreferencesInput = {
  risk_spike_enabled: true,
  risk_spike_threshold: 25,
  champion_lost_enabled: true,
  deal_lost_enabled: true,
  forecast_change_enabled: true,
  forecast_change_threshold: 20,
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: "Europe/Berlin",
};

function stripSeconds(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

function toPreferences(row: {
  org_id: string;
  risk_spike_enabled: boolean;
  risk_spike_threshold: number;
  champion_lost_enabled: boolean;
  deal_lost_enabled: boolean;
  forecast_change_enabled: boolean;
  forecast_change_threshold: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
}): AlertPreferences {
  return {
    org_id: row.org_id,
    risk_spike_enabled: row.risk_spike_enabled,
    risk_spike_threshold: row.risk_spike_threshold,
    champion_lost_enabled: row.champion_lost_enabled,
    deal_lost_enabled: row.deal_lost_enabled,
    forecast_change_enabled: row.forecast_change_enabled,
    forecast_change_threshold: Number(row.forecast_change_threshold),
    quiet_hours_start: stripSeconds(row.quiet_hours_start),
    quiet_hours_end: stripSeconds(row.quiet_hours_end),
    timezone: row.timezone,
  };
}

export function defaultAlertPreferences(orgId: string): AlertPreferences {
  return {
    org_id: orgId,
    ...DEFAULT_ALERT_PREFERENCES,
  };
}

export async function getSlackAlertPreferences(
  orgId: string,
): Promise<AlertPreferences> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("slack_alert_preferences")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return defaultAlertPreferences(orgId);
  return toPreferences(data);
}

export async function ensureSlackAlertPreferences(
  orgId: string,
): Promise<AlertPreferences> {
  const existing = await getSlackAlertPreferences(orgId);
  if (existing.org_id === orgId) {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("slack_alert_preferences")
      .select("org_id")
      .eq("org_id", orgId)
      .maybeSingle();
    if (data) return existing;
  }

  return upsertSlackAlertPreferences(orgId, DEFAULT_ALERT_PREFERENCES);
}

export async function upsertSlackAlertPreferences(
  orgId: string,
  input: AlertPreferencesInput,
): Promise<AlertPreferences> {
  const parsed = AlertPreferencesSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("slack_alert_preferences")
    .upsert(
      {
        org_id: orgId,
        ...parsed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return toPreferences(data);
}

function metadataToRecord(value: Json | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function getSlackAlertHistory(
  orgId: string,
  limit = 20,
): Promise<AlertHistoryItem[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("slack_alerts")
    .select("*")
    .eq("org_id", orgId)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    org_id: row.org_id,
    alert_type: row.alert_type,
    deal_id: row.deal_id,
    severity: row.severity,
    title: row.title,
    body: row.body,
    metadata: metadataToRecord(row.metadata),
    sent_at: row.sent_at,
    acknowledged_at: row.acknowledged_at,
    acknowledged_by: row.acknowledged_by,
    snoozed_until: row.snoozed_until,
  }));
}
