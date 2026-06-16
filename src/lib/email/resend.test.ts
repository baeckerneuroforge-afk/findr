import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultFrom, EmailError } from "./resend";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("defaultFrom", () => {
  it("returns the configured sender when INTERVIEW_FROM_EMAIL is set", () => {
    vi.stubEnv("INTERVIEW_FROM_EMAIL", "Klymeo <noreply@klymeo.example>");
    expect(defaultFrom()).toBe("Klymeo <noreply@klymeo.example>");
  });

  it("falls back to the Resend sandbox sender outside production", () => {
    vi.stubEnv("INTERVIEW_FROM_EMAIL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(defaultFrom()).toBe("onboarding@resend.dev");
  });

  it("refuses the sandbox sender in production (fail loud)", () => {
    vi.stubEnv("INTERVIEW_FROM_EMAIL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => defaultFrom()).toThrow(EmailError);
  });
});
