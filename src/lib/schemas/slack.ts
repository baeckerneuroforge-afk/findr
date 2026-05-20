import { z } from "zod";

/**
 * SSRF protection: only Slack incoming-webhook URLs allowed.
 * Format: https://hooks.slack.com/services/T.../B.../xxx
 *
 * Rejects: any other host, http:// (non-TLS), non-/services/ paths.
 */
export const SlackWebhookUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.protocol === "https:" &&
          parsed.hostname === "hooks.slack.com" &&
          parsed.pathname.startsWith("/services/")
        );
      } catch {
        return false;
      }
    },
    {
      message:
        "Webhook URL must be a Slack incoming webhook (https://hooks.slack.com/services/...)",
    },
  );

export const SlackIntegrationConfigSchema = z.object({
  workspace_name: z.string().max(200).optional().nullable(),
  channel_name: z.string().min(1).max(200),
  channel_id: z.string().min(1).max(100),
  webhook_url: SlackWebhookUrlSchema,
  alert_threshold: z.number().int().min(0).max(100).default(70),
  alert_on_critical_only: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type SlackIntegrationConfig = z.infer<typeof SlackIntegrationConfigSchema>;
