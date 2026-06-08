import { describe, expect, it } from "vitest";

import {
  buildResearchPrompt,
  buildResearchSystemPrompt,
  type ResearchInput,
} from "./interviewer";

const BASE_INPUT: ResearchInput = {
  plan: {
    title: "Creative-Test",
    objective: "Verständlichkeit der Kampagne prüfen",
    topics: [
      {
        topic: "Erster Eindruck",
        intent: "Spontane Reaktion verstehen",
        hypotheses: ["Die Headline ist unklar"],
      },
    ],
    useCase: "creative_test",
  },
  brand: null,
};

describe("research stimulus prompt wiring", () => {
  it("adds a user-prompt stimulus block from description/type without the URL", () => {
    const prompt = buildResearchPrompt(
      {
        ...BASE_INPUT,
        plan: {
          ...BASE_INPUT.plan,
          stimulusUrl: "https://figma.example/internal-prototype",
          stimulusType: "link",
          stimulusDescription:
            "Eine Landingpage mit großer Headline und blauem CTA.",
        },
      },
      [],
      "de",
    );

    expect(prompt).toContain(
      "STIMULUS:\nDem Teilnehmer wird gerade gezeigt: Eine Landingpage mit großer Headline und blauem CTA. (Typ: Prototyp-Link). Beziehe deine Fragen darauf.",
    );
    const stimulusBlock = prompt.match(/STIMULUS:[\s\S]*?(?=\n\nTOPICS)/)?.[0];
    expect(stimulusBlock).toBeDefined();
    expect(stimulusBlock).not.toContain(
      "https://figma.example/internal-prototype",
    );
    expect(stimulusBlock).not.toContain("Verständlichkeit der Kampagne prüfen");
    expect(stimulusBlock).not.toContain("Die Headline ist unklar");
  });

  it("omits the stimulus block and every asset reference without a description", () => {
    const userPrompt = buildResearchPrompt(BASE_INPUT, [], "de");
    const systemPrompt = buildResearchSystemPrompt("creative_test", false);

    expect(userPrompt).not.toContain("STIMULUS:");
    expect(systemPrompt).not.toContain("gezeigten Stimulus");
    expect(systemPrompt).not.toContain("gezeigte Asset");
    expect(systemPrompt).not.toContain("Asset-Anzeige folgt später");
  });

  it("uses stimulus-specific creative/concept focus only when a stimulus exists", () => {
    expect(buildResearchSystemPrompt("creative_test", true)).toContain(
      "bezogen auf den gezeigten Stimulus",
    );
    expect(buildResearchSystemPrompt("concept_test", true)).toContain(
      "Verständnis des gezeigten Stimulus",
    );
    expect(buildResearchSystemPrompt("concept_test", false)).not.toContain(
      "gezeigten Stimulus",
    );
  });
});
