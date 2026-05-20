import { describe, expect, it } from "vitest";
import { SlackIntegrationConfigSchema, SlackWebhookUrlSchema } from "./slack";

const VALID_WEBHOOK_URL = [
  "https://hooks.slack.com",
  "services",
  "T" + "00000000",
  "B" + "00000000",
  "X".repeat(24),
].join("/");

describe("SlackWebhookUrlSchema", () => {
  it("accepts valid Slack webhook URL", () => {
    const result = SlackWebhookUrlSchema.safeParse(VALID_WEBHOOK_URL);

    expect(result.success).toBe(true);
  });

  it("rejects non-https URL", () => {
    const result = SlackWebhookUrlSchema.safeParse(
      "http://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    );

    expect(result.success).toBe(false);
  });

  it("rejects non-Slack domain (SSRF protection)", () => {
    const result = SlackWebhookUrlSchema.safeParse(
      "https://google.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    );

    expect(result.success).toBe(false);
  });

  it("rejects localhost (SSRF protection)", () => {
    const result = SlackWebhookUrlSchema.safeParse(
      "http://localhost:3000/services/T/B/X",
    );

    expect(result.success).toBe(false);
  });

  it("rejects AWS metadata endpoint (SSRF protection)", () => {
    const result = SlackWebhookUrlSchema.safeParse(
      "http://169.254.169.254/latest/meta-data/",
    );

    expect(result.success).toBe(false);
  });

  it("rejects wrong path", () => {
    const result = SlackWebhookUrlSchema.safeParse(
      "https://hooks.slack.com/wrong-path/T/B/X",
    );

    expect(result.success).toBe(false);
  });

  it("rejects malformed URL", () => {
    const result = SlackWebhookUrlSchema.safeParse("not-a-url");

    expect(result.success).toBe(false);
  });
});

describe("SlackIntegrationConfigSchema", () => {
  const validConfig = {
    channel_name: "#sales-alerts",
    channel_id: "C01234ABCDE",
    webhook_url: VALID_WEBHOOK_URL,
  };

  it("accepts minimal valid config with defaults", () => {
    const result = SlackIntegrationConfigSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alert_threshold).toBe(70);
      expect(result.data.alert_on_critical_only).toBe(false);
      expect(result.data.enabled).toBe(true);
    }
  });

  it("rejects threshold > 100", () => {
    const result = SlackIntegrationConfigSchema.safeParse({
      ...validConfig,
      alert_threshold: 150,
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty channel_name", () => {
    const result = SlackIntegrationConfigSchema.safeParse({
      ...validConfig,
      channel_name: "",
    });

    expect(result.success).toBe(false);
  });
});
