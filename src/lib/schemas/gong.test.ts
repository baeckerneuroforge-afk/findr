import { describe, expect, it } from "vitest";
import {
  GongCallSchema,
  GongTokenResponseSchema,
  GongTranscriptSchema,
  GongUserSchema,
} from "./gong";

describe("GongTokenResponseSchema", () => {
  it("accepts valid OAuth token response", () => {
    const result = GongTokenResponseSchema.safeParse({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 86400,
      token_type: "Bearer",
      scope: "api:calls:read:basic",
      api_base_url_for_customer: "https://company-17.api.gong.io",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing customer API base URL", () => {
    const result = GongTokenResponseSchema.safeParse({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 86400,
    });

    expect(result.success).toBe(false);
  });
});

describe("GongCallSchema", () => {
  it("accepts callId as string or number", () => {
    expect(
      GongCallSchema.safeParse({
        callId: 12345,
        title: "Nordbank demo",
        started: "2026-05-20T08:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("rejects calls without id or callId", () => {
    expect(GongCallSchema.safeParse({ title: "No id" }).success).toBe(false);
  });
});

describe("GongTranscriptSchema", () => {
  it("accepts transcript segments with sentences", () => {
    const result = GongTranscriptSchema.safeParse({
      callId: "12345",
      transcript: [
        {
          speakerId: "u1",
          speakerName: "Sarah Mueller",
          sentences: [
            {
              startTimeSeconds: 12,
              endTimeSeconds: 18,
              text: "Wir müssen das nochmal intern besprechen.",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("GongUserSchema", () => {
  it("accepts Gong user metadata", () => {
    const result = GongUserSchema.safeParse({
      id: 42,
      emailAddress: "sarah@example.com",
      firstName: "Sarah",
      lastName: "Mueller",
      title: "Senior AE",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe("42");
  });
});
