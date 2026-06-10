import { describe, expect, it } from "vitest";

import { planToAgentContext, type ResearchPlanRecord } from "./plans-service";
import type { StimulusAnalysisPayload } from "./stimulus-analysis";

const PAYLOAD: StimulusAnalysisPayload = {
  version: 1,
  model: "claude-opus-4-7",
  generatedAt: "2026-06-10T12:00:00.000Z",
  analysis: {
    layout: "Zentrierte Headline",
    farbwelt: "Blau-dominant",
    bildelemente: ["Produktbild"],
    textImBild: [],
    claimBotschaft: "Schnell startklar",
    gestaltungsentscheidungen: [],
    frageansaetze: [
      "Was fällt Ihnen zuerst auf?",
      "Was verstehen Sie unter der Headline?",
      "Welche Rolle spielt das Produktbild?",
    ],
  },
  textBlock: "Layout/Aufbau: Zentrierte Headline",
};

function plan(overrides: Partial<ResearchPlanRecord>): ResearchPlanRecord {
  return {
    id: "p1",
    orgId: "o1",
    title: "Creative-Test",
    objective: "Verständlichkeit prüfen",
    topics: [],
    persona: null,
    sampleTarget: null,
    status: "draft",
    visualCaptureEnabled: false,
    voiceEnabled: false,
    ttsEnabled: false,
    useCase: "creative_test",
    stimulusUrl: "https://storage.example/stimulus.png",
    stimulusType: "image",
    stimulusDescription: "Anzeige mit blauem CTA",
    stimulusAnalysis: null,
    stimulusAnalysisStatus: null,
    screeningQuestions: [],
    studyType: "market_research",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("planToAgentContext — stimulus analysis gating", () => {
  it("forwards ONLY the textBlock when the analysis is done", () => {
    const ctx = planToAgentContext(
      plan({ stimulusAnalysis: PAYLOAD, stimulusAnalysisStatus: "done" }),
    );

    expect(ctx.stimulusAnalysis).toBe("Layout/Aufbau: Zentrierte Headline");
    // The raw envelope never reaches the agent context / dealContext snapshot.
    expect(JSON.stringify(ctx)).not.toContain("generatedAt");
    expect(JSON.stringify(ctx)).not.toContain("frageansaetze");
  });

  it.each(["pending", "failed", null] as const)(
    "maps status %s to a null analysis (prompt identical to today)",
    (status) => {
      const ctx = planToAgentContext(
        plan({ stimulusAnalysis: PAYLOAD, stimulusAnalysisStatus: status }),
      );
      expect(ctx.stimulusAnalysis).toBeNull();
    },
  );

  it("maps done-without-payload (defensive) to null", () => {
    const ctx = planToAgentContext(
      plan({ stimulusAnalysis: null, stimulusAnalysisStatus: "done" }),
    );
    expect(ctx.stimulusAnalysis).toBeNull();
  });

  it("keeps every stimulus field out of a product_discovery context", () => {
    const ctx = planToAgentContext(
      plan({
        studyType: "product_discovery",
        stimulusAnalysis: PAYLOAD,
        stimulusAnalysisStatus: "done",
      }),
    );

    expect("stimulusAnalysis" in ctx).toBe(false);
    expect("stimulusDescription" in ctx).toBe(false);
  });
});
