import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto/secret-cipher";
import { sendSlackMessage } from "@/lib/slack/client";
import type { Json } from "@/types/database";
import { formatSlackMessage } from "./formatter";
import { getSlackAlertPreferences } from "./service";
import type { AlertPayload, AlertPreferences, AlertType } from "./types";

const ALERT_ENABLED_FIELD: Record<AlertType, keyof AlertPreferences> = {
  risk_spike: "risk_spike_enabled",
  champion_lost: "champion_lost_enabled",
  deal_lost: "deal_lost_enabled",
  forecast_change: "forecast_change_enabled",
};

export const ALERT_DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000;

export function isAlertTypeEnabled(
  preferences: AlertPreferences,
  type: AlertType,
): boolean {
  return preferences[ALERT_ENABLED_FIELD[type]] === true;
}

export function getDedupWindowStart(now = new Date()): string {
  return new Date(now.getTime() - ALERT_DEDUP_WINDOW_MS).toISOString();
}

function minutesFromTime(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function isInQuietHours(
  preferences: Pick<
    AlertPreferences,
    "quiet_hours_start" | "quiet_hours_end" | "timezone"
  >,
  now = new Date(),
): boolean {
  if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: preferences.timezone || "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const current = minutesFromTime(formatter.format(now));
  const start = minutesFromTime(preferences.quiet_hours_start);
  const end = minutesFromTime(preferences.quiet_hours_end);

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export async function dispatchAlert(
  payload: AlertPayload,
): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createAdminSupabaseClient();
  const preferences = await getSlackAlertPreferences(payload.context.org_id);

  if (!isAlertTypeEnabled(preferences, payload.type)) {
    return { sent: false, reason: "alert_type_disabled" };
  }

  if (isInQuietHours(preferences)) {
    return { sent: false, reason: "quiet_hours" };
  }

  const fourHoursAgo = getDedupWindowStart();
  let dedupQuery = supabase
    .from("slack_alerts")
    .select("id")
    .eq("org_id", payload.context.org_id)
    .eq("alert_type", payload.type)
    .gte("sent_at", fourHoursAgo)
    .limit(1);

  if (payload.context.deal_id) {
    dedupQuery = dedupQuery.eq("deal_id", payload.context.deal_id);
  } else {
    dedupQuery = dedupQuery.is("deal_id", null);
  }

  const { data: recent } = await dedupQuery;
  if (recent && recent.length > 0) {
    return { sent: false, reason: "duplicate_within_4h" };
  }

  let snoozeQuery = supabase
    .from("slack_alerts")
    .select("id")
    .eq("org_id", payload.context.org_id)
    .eq("alert_type", payload.type)
    .gt("snoozed_until", new Date().toISOString())
    .limit(1);

  if (payload.context.deal_id) {
    snoozeQuery = snoozeQuery.eq("deal_id", payload.context.deal_id);
  } else {
    snoozeQuery = snoozeQuery.is("deal_id", null);
  }

  const { data: snoozed } = await snoozeQuery;
  if (snoozed && snoozed.length > 0) {
    return { sent: false, reason: "snoozed" };
  }

  const { data: integration } = await supabase
    .from("slack_integrations")
    .select("webhook_url")
    .eq("org_id", payload.context.org_id)
    .eq("enabled", true)
    .maybeSingle();

  if (!integration?.webhook_url) {
    return { sent: false, reason: "slack_not_connected" };
  }

  try {
    await sendSlackMessage(
      decryptSecret(integration.webhook_url),
      formatSlackMessage(payload),
    );

    const { error: logError } = await supabase.from("slack_alerts").insert({
      org_id: payload.context.org_id,
      alert_type: payload.type,
      deal_id: payload.context.deal_id ?? null,
      severity: payload.severity,
      title: payload.title,
      body: payload.body,
      metadata: (payload.context.metadata ?? {}) as Json,
    });
    if (logError) {
      console.error("Failed to log Slack alert:", logError.message);
    }

    return { sent: true };
  } catch (err) {
    console.error("Slack alert failed:", err);
    return { sent: false, reason: "slack_api_error" };
  }
}
