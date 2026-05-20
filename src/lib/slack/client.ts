import { z } from "zod";
import { SlackWebhookUrlSchema } from "@/lib/schemas/slack";

const SlackBlockSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

export interface SlackMessage {
  text: string;
  blocks: z.infer<typeof SlackBlockSchema>[];
}

export async function sendSlackMessage(
  webhookUrl: string,
  message: SlackMessage,
): Promise<void> {
  const validatedUrl = SlackWebhookUrlSchema.parse(webhookUrl);
  const blocks = z.array(SlackBlockSchema).parse(message.blocks);

  const response = await fetch(validatedUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message.text,
      blocks,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack API error: ${response.status} ${text}`);
  }
}
