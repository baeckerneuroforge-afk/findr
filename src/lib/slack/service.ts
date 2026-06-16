import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-cipher";
import type { Database } from "@/types/database";
import {
  SlackWebhookUrlSchema,
  type SlackIntegrationConfig,
} from "@/lib/schemas/slack";

export type { SlackIntegrationConfig };

export interface SlackIntegration {
  id: string;
  org_id: string;
  workspace_name: string | null;
  channel_id: string;
  channel_name: string;
  webhook_url: string;
  alert_threshold: number;
  alert_on_critical_only: boolean;
  enabled: boolean;
}

export interface SlackAlertPayload {
  dealName: string;
  dealId: string;
  riskScore: number;
  riskLevel: string;
  topSignals: Array<{ type: string; confidence: number }>;
  overallReasoning: string;
  topRecommendation?: string;
  dashboardUrl: string;
}

type SlackIntegrationRow = Database["public"]["Tables"]["slack_integrations"]["Row"];

function toIntegration(row: SlackIntegrationRow): SlackIntegration {
  return {
    id: row.id,
    org_id: row.org_id,
    workspace_name: row.workspace_name,
    channel_id: row.channel_id,
    channel_name: row.channel_name,
    webhook_url: decryptSecret(row.webhook_url),
    alert_threshold: row.alert_threshold,
    alert_on_critical_only: row.alert_on_critical_only,
    enabled: row.enabled,
  };
}

export async function getSlackIntegration(
  orgId: string,
): Promise<SlackIntegration | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("slack_integrations")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) return null;
  return toIntegration(data);
}

export async function upsertSlackIntegration(
  orgId: string,
  config: SlackIntegrationConfig,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("slack_integrations")
    .upsert(
      {
        org_id: orgId,
        ...config,
        webhook_url: encryptSecret(config.webhook_url),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

const SIGNAL_LABELS: Record<string, string> = {
  CHAMPION_LOSS: "Champion Loss",
  COMPETITOR_PRESSURE: "Competitor Pressure",
  STALLING_PATTERN: "Stalling Pattern",
  BUDGET_FRICTION: "Budget Friction",
  CHAMPION_DISENGAGEMENT: "Champion Disengagement",
  LATE_DECISION_MAKER: "Late Decision Maker",
  STAKEHOLDER_CHURN: "Stakeholder Churn",
  ENGAGEMENT_DROP: "Engagement Drop",
};

function getEmojiForRiskLevel(level: string): string {
  if (level === "critical") return "🚨";
  if (level === "high") return "⚠️";
  if (level === "medium") return "⚡";
  return "✓";
}

type SlackBlock = Record<string, unknown>;

export function buildSlackBlocks(payload: SlackAlertPayload): SlackBlock[] {
  const emoji = getEmojiForRiskLevel(payload.riskLevel);

  const signalLines = payload.topSignals
    .slice(0, 3)
    .map((s) => {
      const label = SIGNAL_LABELS[s.type] ?? s.type;
      const pct = Math.round(s.confidence * 100);
      return `• *${label}* — ${pct}% confidence`;
    })
    .join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${payload.dealName} — Risk ${payload.riskScore}/100`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${payload.riskLevel.toUpperCase()} RISK DETECTED*\n${payload.overallReasoning}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Top Signals:*\n${signalLines}`,
      },
    },
  ];

  if (payload.topRecommendation) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Recommended Action:*\n${payload.topRecommendation}`,
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View in Klymeo", emoji: true },
        url: payload.dashboardUrl,
        style: "primary",
      },
    ],
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Klymeo · Risk analysis from ${new Date().toLocaleString("de-DE")}`,
      },
    ],
  });

  return blocks;
}

export async function sendSlackAlert(
  integration: SlackIntegration,
  payload: SlackAlertPayload,
): Promise<{ success: boolean; error?: string }> {
  // Defense-in-depth: re-validate URL before fetch. Catches rows persisted
  // before this validation existed, or any future bypass of the API layer.
  const urlCheck = SlackWebhookUrlSchema.safeParse(integration.webhook_url);
  if (!urlCheck.success) {
    return {
      success: false,
      error: "Stored webhook URL is invalid (not a Slack webhook URL)",
    };
  }

  const blocks = buildSlackBlocks(payload);

  try {
    const response = await fetch(integration.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks,
        text: `${payload.dealName} — Risk ${payload.riskScore}/100`,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Slack webhook returned ${response.status}: ${text}`,
      };
    }

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { success: false, error: "Slack webhook timeout after 10s" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function logAlert(
  orgId: string,
  dealId: string,
  riskScoreId: string | null,
  alertType: "threshold_crossed" | "critical_signal" | "score_spike",
  channelId: string,
  payload: SlackAlertPayload,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string,
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await supabase.from("alert_history").insert({
    org_id: orgId,
    deal_id: dealId,
    risk_score_id: riskScoreId,
    alert_type: alertType,
    channel_id: channelId,
    payload: payload as unknown as Database["public"]["Tables"]["alert_history"]["Insert"]["payload"],
    status,
    error_message: errorMessage ?? null,
  });
}
