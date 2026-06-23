import { describe, it, expect } from "vitest";
import {
  buildTaskSuccessUserPrompt,
  sealTaskSuccessJudgment,
} from "./task-success-judge";
import { REASONING_MAX_CHARS } from "@/lib/schemas/task-success";

describe("sealTaskSuccessJudgment", () => {
  it("wraps the verdict with server metadata and caps the reasoning", () => {
    const rec = sealTaskSuccessJudgment(
      { verdict: "success", confidence: 0.83, reasoning: "x".repeat(5000) },
      "claude-haiku-test",
    );
    expect(rec.version).toBe(1);
    expect(rec.verdict).toBe("success");
    expect(rec.confidence).toBe(0.83);
    expect(rec.model).toBe("claude-haiku-test");
    expect(rec.reasoning.length).toBe(REASONING_MAX_CHARS);
    expect(typeof rec.judgedAt).toBe("string");
    expect(Number.isNaN(Date.parse(rec.judgedAt))).toBe(false);
  });
});

describe("buildTaskSuccessUserPrompt", () => {
  const base = {
    conversation: [
      { role: "agent" as const, text: "Wie gehst du vor?" },
      { role: "customer" as const, text: "Ich klicke oben rechts." },
    ],
    language: "de" as const,
    instruction: "Finde die Einstellungen.",
    successCriterion: "Teilnehmer öffnet die Einstellungen.",
    behavioural: {
      success: true,
      timeOnTaskSeconds: 42,
      clickCount: 7,
      frictionCount: 1,
    },
    planTitle: "Settings-Test",
  };

  it("includes the criterion, instruction and transcript", () => {
    const p = buildTaskSuccessUserPrompt(base);
    expect(p).toContain("Teilnehmer öffnet die Einstellungen.");
    expect(p).toContain("Finde die Einstellungen.");
    expect(p).toContain("PARTICIPANT: Ich klicke oben rechts.");
    expect(p).toContain("German");
    // behavioural context is present but flagged as orientation only
    expect(p).toContain("do NOT recompute");
  });

  it("degrades gracefully without behavioural data", () => {
    const p = buildTaskSuccessUserPrompt({ ...base, behavioural: null });
    expect(p).toContain("(none recorded)");
  });
});
