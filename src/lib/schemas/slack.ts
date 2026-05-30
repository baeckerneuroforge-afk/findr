import { z } from "zod";

/**
 * SSRF protection: only Slack incoming-webhook URLs allowed.
 * Format: https://hooks.slack.com/services/T.../B.../xxx
 *
 * Rejects: any other host, http:// (non-TLS), non-/services/ paths.
 */
/**
 * i18n NOTE: the validation messages below are stable TRANSLATION KEYS, not
 * end-user prose — resolved client-side via the messageKey->t() pattern (see
 * SlackSettingsForm, mirroring BulkInviteForm's ParseIssue.messageKey). They map
 * to `settings.slack.fieldError.<key>` in the message catalog. The server route
 * (api/integrations/slack) never surfaces these to the user — it returns its own
 * localized `integrations.invalidConfiguration` and the client ignores `details`
 * — and the server-side SSRF guards (slack/service.ts, slack/client.ts) only read
 * `.success`. So the key-as-message is safe across every consumer.
 */
export const SlackWebhookUrlSchema = z
  .string()
  .url("webhookUrlInvalid")
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
    { message: "webhookUrlNotSlack" },
  );

export const SlackIntegrationConfigSchema = z.object({
  workspace_name: z
    .string()
    .max(200, "workspaceNameTooLong")
    .optional()
    .nullable(),
  channel_name: z
    .string()
    .min(1, "channelNameRequired")
    .max(200, "channelNameTooLong"),
  channel_id: z.string().min(1, "channelIdRequired").max(100, "channelIdTooLong"),
  webhook_url: SlackWebhookUrlSchema,
  alert_threshold: z.number().int().min(0).max(100).default(70),
  alert_on_critical_only: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type SlackIntegrationConfig = z.infer<typeof SlackIntegrationConfigSchema>;
