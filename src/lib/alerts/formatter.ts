import type { SlackMessage } from "@/lib/slack/client";
import type { AlertPayload, AlertSeverity } from "./types";

function severityIcon(severity: AlertSeverity): string {
  if (severity === "critical") return ":rotating_light:";
  if (severity === "warning") return ":warning:";
  return ":information_source:";
}

function formatCurrency(amount?: number): string {
  if (!amount) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function appUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}${path}`;
}

function actions(dealId?: string) {
  const dealUrl = dealId
    ? appUrl(`/dashboard/deals/${dealId}`)
    : appUrl("/dashboard/integrations/slack");

  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View Deal" },
        url: dealUrl,
        style: "primary",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Acknowledge" },
        value: dealId ?? "forecast",
        action_id: "acknowledge_alert",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Snooze 24h" },
        value: dealId ?? "forecast",
        action_id: "snooze_alert_24h",
      },
    ],
  };
}

function baseBlocks(payload: AlertPayload, headline: string) {
  const { deal_name, deal_amount, deal_owner } = payload.context;
  const detailLine = deal_name
    ? `*${deal_name}* - ${formatCurrency(deal_amount)}\nOwner: ${deal_owner ?? "Unassigned"}`
    : payload.body;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: headline,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: detailLine,
      },
    },
  ];
}

export function formatSlackMessage(payload: AlertPayload): SlackMessage {
  switch (payload.type) {
    case "risk_spike":
      return formatRiskSpike(payload);
    case "champion_lost":
      return formatChampionLost(payload);
    case "deal_lost":
      return formatDealLost(payload);
    case "forecast_change":
      return formatForecastChange(payload);
  }
}

export function formatRiskSpike(payload: AlertPayload): SlackMessage {
  const metadata = payload.context.metadata ?? {};
  const oldScore = Number(metadata.old_score ?? 0);
  const newScore = Number(metadata.new_score ?? 0);
  const delta = newScore - oldScore;

  return {
    text: `Risk spike: ${payload.context.deal_name ?? "Deal"}`,
    blocks: [
      ...baseBlocks(
        payload,
        `${severityIcon(payload.severity)} Risk Spike Detected`,
      ),
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Previous Score:*\n${oldScore}/100` },
          {
            type: "mrkdwn",
            text: `*Current Score:*\n${newScore}/100 (+${delta})`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top Signal:*\n${String(
            metadata.top_signal_description ?? "Multiple risk signals detected",
          )}`,
        },
      },
      actions(payload.context.deal_id),
    ],
  };
}

export function formatChampionLost(payload: AlertPayload): SlackMessage {
  const metadata = payload.context.metadata ?? {};

  return {
    text: `Champion lost: ${payload.context.deal_name ?? "Deal"}`,
    blocks: [
      ...baseBlocks(
        payload,
        `${severityIcon(payload.severity)} Champion Lost`,
      ),
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Champion:*\n${String(metadata.champion_name ?? "Unknown")}`,
          },
          {
            type: "mrkdwn",
            text: `*Severity:*\n${payload.severity.toUpperCase()}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Evidence:*\n>${String(metadata.evidence ?? payload.body)}`,
        },
      },
      actions(payload.context.deal_id),
    ],
  };
}

export function formatDealLost(payload: AlertPayload): SlackMessage {
  return {
    text: `Deal lost: ${payload.context.deal_name ?? "Deal"}`,
    blocks: [
      ...baseBlocks(payload, `${severityIcon(payload.severity)} Deal Closed-Lost`),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.body,
        },
      },
      actions(payload.context.deal_id),
    ],
  };
}

export function formatForecastChange(payload: AlertPayload): SlackMessage {
  const metadata = payload.context.metadata ?? {};
  const oldValue = Number(metadata.old_value ?? 0);
  const newValue = Number(metadata.new_value ?? 0);
  const pctChange = Number(metadata.pct_change ?? 0);

  return {
    text: `Forecast change: ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%`,
    blocks: [
      ...baseBlocks(
        payload,
        `${severityIcon(payload.severity)} Forecast Change`,
      ),
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Previous Pipeline:*\n${formatCurrency(oldValue)}`,
          },
          {
            type: "mrkdwn",
            text: `*Current Pipeline:*\n${formatCurrency(newValue)}`,
          },
          {
            type: "mrkdwn",
            text: `*Change:*\n${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%`,
          },
        ],
      },
      actions(),
    ],
  };
}
