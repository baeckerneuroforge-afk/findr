import { describe, expect, it } from "vitest";

import {
  buildResearchContext,
  buildResearchSystemPrompt,
  buildTurnMessages,
  createDoneHeaderParser,
  type InterviewTurn,
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
    const prompt = buildResearchContext(
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
    const userPrompt = buildResearchContext(BASE_INPUT, "de");
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

  it("keeps the JSON output contract on the exported (voice-bridge) prompt", () => {
    // The LiveKit voice bridge ships this prompt verbatim to its agent — the
    // B1 plain-text turn contract must never leak into the exported flavor.
    const prompt = buildResearchSystemPrompt("creative_test", false);
    expect(prompt).toContain("OUTPUT — return ONLY this JSON object");
    expect(prompt).not.toContain("DONE: false");
  });
});

describe("done-header stream parser (B1 plain-text turn contract)", () => {
  it("parses header + message and emits only message chars", () => {
    const parser = createDoneHeaderParser();
    const emitted = [
      parser.push("DONE:"),
      parser.push(" false\n"),
      parser.push("\n"),
      parser.push("Hallo! Wie "),
      parser.push("geht es Ihnen?"),
    ].join("");
    expect(emitted).toBe("Hallo! Wie geht es Ihnen?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Hallo! Wie geht es Ihnen?",
    });
  });

  it("parses done: true case-insensitively and with a single newline", () => {
    const parser = createDoneHeaderParser();
    parser.push("done: TRUE\nDanke für das Gespräch!");
    expect(parser.finish()).toEqual({
      done: true,
      message: "Danke für das Gespräch!",
    });
  });

  it("fails open when the model ignores the contract", () => {
    const parser = createDoneHeaderParser();
    const first = parser.push("Vielen Dank für Ihre Zeit — eine Frage noch:");
    // The whole chunk must become visible the moment it can't be a header.
    expect(first).toBe("Vielen Dank für Ihre Zeit — eine Frage noch:");
    parser.push(" Was war der Auslöser?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Vielen Dank für Ihre Zeit — eine Frage noch: Was war der Auslöser?",
    });
  });

  it("fails open on a header-like but invalid first line", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: maybe\nText");
    expect(parser.finish().done).toBe(false);
    expect(parser.finish().message).toContain("DONE: maybe");
  });

  it("handles a bare DONE header with no message as empty (caller retries)", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: true");
    expect(parser.finish()).toEqual({ done: true, message: "" });
  });

  it("tolerates blank lines BEFORE the header (review finding)", () => {
    const parser = createDoneHeaderParser();
    parser.push("\n");
    parser.push("\nDONE: true\n\nDanke!");
    expect(parser.finish()).toEqual({ done: true, message: "Danke!" });
  });

  it("emits nothing for the header even when everything arrives in one chunk", () => {
    const parser = createDoneHeaderParser();
    const emitted = parser.push("DONE: true\n\nAuf Wiedersehen!");
    expect(emitted).toBe("Auf Wiedersehen!");
    expect(parser.finish()).toEqual({ done: true, message: "Auf Wiedersehen!" });
  });
});

describe("buildTurnMessages (B4 messages-list + caching layout)", () => {
  const HISTORY: InterviewTurn[] = [
    { role: "agent", text: "Erste Frage?" },
    { role: "customer", text: "Erste Antwort." },
    { role: "agent", text: "Zweite Frage?" },
    { role: "customer", text: "Zweite Antwort." },
  ];

  it("maps history to alternating roles with context first and tail last", () => {
    const messages = buildTurnMessages("KONTEXT", HISTORY, "TAIL");
    expect(messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    const last = messages[messages.length - 1]
      .content as Array<{ type: "text"; text: string }>;
    // Participant answer and volatile tail are SEPARATE blocks on one message.
    expect(last.map((b) => b.text)).toEqual(["Zweite Antwort.", "TAIL"]);
  });

  it("puts the cache breakpoint on the last stable (pre-tail) message", () => {
    const messages = buildTurnMessages("KONTEXT", HISTORY, "TAIL");
    const stable = messages[messages.length - 2]
      .content as Array<{ cache_control?: { type: string } }>;
    expect(stable[stable.length - 1].cache_control).toEqual({
      type: "ephemeral",
    });
    const last = messages[messages.length - 1]
      .content as Array<{ cache_control?: { type: string } }>;
    expect(last.every((b) => b.cache_control === undefined)).toBe(true);
  });

  it("merges consecutive same-role turns to keep strict alternation", () => {
    const messages = buildTurnMessages(
      "KONTEXT",
      [
        { role: "customer", text: "Antwort A." },
        { role: "customer", text: "Antwort B." },
      ],
      "TAIL",
    );
    // context(user) + merged customer turns + tail all collapse to ONE user
    // message — roles stay strictly alternating for the API.
    expect(messages).toHaveLength(1);
    const blocks = messages[0].content as Array<{ text: string }>;
    expect(blocks.map((b) => b.text)).toEqual([
      "KONTEXT",
      "Antwort A.",
      "Antwort B.",
      "TAIL",
    ]);
  });

  it("attaches the tail to the context message on an empty history (opening)", () => {
    const messages = buildTurnMessages("KONTEXT", [], "TAIL");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const blocks = messages[0].content as Array<{ text: string }>;
    expect(blocks.map((b) => b.text)).toEqual(["KONTEXT", "TAIL"]);
  });

  it("skips empty-text turns the API would reject", () => {
    const messages = buildTurnMessages(
      "KONTEXT",
      [
        { role: "agent", text: "   " },
        { role: "customer", text: "Echte Antwort." },
      ],
      "TAIL",
    );
    expect(messages.map((m) => m.role)).toEqual(["user"]);
  });
});
