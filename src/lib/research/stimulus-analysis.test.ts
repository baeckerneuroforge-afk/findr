import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callClaudeStructured } from "@/lib/anthropic/structured";
import {
  analyzeStimulusImage,
  analyzeStimulusVideo,
  coerceStimulusAnalysis,
  coerceStimulusAnalysisStatus,
  DEFAULT_STIMULUS_ANALYSIS_MODEL,
  MAX_TEXT_BLOCK_CHARS,
  renderStimulusAnalysisTextBlock,
  type StimulusAnalysis,
  type StimulusVideoFrameInput,
} from "./stimulus-analysis";

vi.mock("@/lib/anthropic/structured", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/anthropic/structured")>();
  return { ...original, callClaudeStructured: vi.fn() };
});

const mockCallClaudeStructured = vi.mocked(callClaudeStructured);

const ANALYSIS: StimulusAnalysis = {
  layout: "Zentrierte Headline über großem Produktbild, CTA unten rechts",
  farbwelt: "Blau-dominant mit gelbem Akzent, hoher Kontrast",
  bildelemente: ["Produktverpackung", "CTA-Button", "Logo oben links"],
  textImBild: ["Jetzt testen", "30 Tage gratis"],
  claimBotschaft: "Schnell und ohne Risiko startklar",
  gestaltungsentscheidungen: ["Sehr großer Weißraum", "Serifenlose Headline"],
  frageansaetze: [
    "Was fällt Ihnen an der Anzeige zuerst auf?",
    "Was verstehen Sie unter der Headline?",
    "Welche Rolle spielt das Produktbild für Sie?",
  ],
};

const STUDY = {
  title: "Creative-Test Kampagne Q3",
  objective: "Verständlichkeit der Kampagne prüfen",
  topics: [{ topic: "Erster Eindruck", intent: "Spontane Reaktion verstehen" }],
  useCase: "creative_test",
  stimulusDescription: "Anzeige mit blauem CTA",
};

describe("renderStimulusAnalysisTextBlock", () => {
  it("renders every section including the numbered question angles", () => {
    const block = renderStimulusAnalysisTextBlock(ANALYSIS);

    expect(block).toContain("Layout/Aufbau: Zentrierte Headline");
    expect(block).toContain("Farbwelt: Blau-dominant");
    expect(block).toContain(
      "Bildelemente: Produktverpackung; CTA-Button; Logo oben links",
    );
    expect(block).toContain(
      'Text im Bild (wörtlich): "Jetzt testen" | "30 Tage gratis"',
    );
    expect(block).toContain("Claim/Botschaft: Schnell und ohne Risiko");
    expect(block).toContain(
      "Auffällige Gestaltungsentscheidungen: Sehr großer Weißraum; Serifenlose Headline",
    );
    expect(block).toContain("Mögliche Frageansätze (neutral, optional");
    expect(block).toContain("1. Was fällt Ihnen an der Anzeige zuerst auf?");
    expect(block).toContain("3. Welche Rolle spielt das Produktbild für Sie?");
  });

  it("omits the text-in-image line when the stimulus carries no text", () => {
    const block = renderStimulusAnalysisTextBlock({
      ...ANALYSIS,
      textImBild: [],
    });
    expect(block).not.toContain("Text im Bild");
  });

  it("renders verlauf before and szenen AFTER the question angles (cap-safe order, O2)", () => {
    const block = renderStimulusAnalysisTextBlock({
      ...ANALYSIS,
      verlauf: "Beginnt mit Produkt-Close-up, endet auf Logo mit Claim.",
      szenen: [
        { zeit: "00:02", beschreibung: "Close-up der Verpackung" },
        { zeit: "00:14", beschreibung: "Logo auf weißem Grund mit Claim" },
      ],
    });

    expect(block).toContain(
      "Zeitlicher Verlauf: Beginnt mit Produkt-Close-up",
    );
    expect(block).toContain("Szenen (Zeitverlauf):");
    expect(block).toContain("[00:02] Close-up der Verpackung");
    // Frageansätze stehen VOR den Szenen: die End-Kappung darf im Grenzfall
    // Szenen-Detail fressen, nie die Frageansätze.
    expect(block.indexOf("Mögliche Frageansätze")).toBeLessThan(
      block.indexOf("Szenen (Zeitverlauf):"),
    );
    expect(block.indexOf("Zeitlicher Verlauf:")).toBeLessThan(
      block.indexOf("Mögliche Frageansätze"),
    );
  });

  it("renders an image analysis (no verlauf/szenen) byte-identical to the pre-video format", () => {
    const block = renderStimulusAnalysisTextBlock(ANALYSIS);
    expect(block).not.toContain("Zeitlicher Verlauf");
    expect(block).not.toContain("Szenen (Zeitverlauf)");
    // Frageansätze bleiben die letzte Sektion.
    expect(block.trimEnd().endsWith(ANALYSIS.frageansaetze[2])).toBe(true);
  });

  it("hard-caps the rendered block at MAX_TEXT_BLOCK_CHARS", () => {
    const block = renderStimulusAnalysisTextBlock({
      ...ANALYSIS,
      layout: "x".repeat(600),
      farbwelt: "y".repeat(400),
      bildelemente: Array.from({ length: 10 }, () => "z".repeat(200)),
      textImBild: Array.from({ length: 15 }, () => "t".repeat(200)),
      gestaltungsentscheidungen: Array.from({ length: 8 }, () =>
        "g".repeat(300),
      ),
    });

    expect(block.length).toBeLessThanOrEqual(MAX_TEXT_BLOCK_CHARS);
    expect(block.endsWith("…")).toBe(true);
  });
});

describe("coerceStimulusAnalysis (fail-open read mapper)", () => {
  const payload = {
    version: 1,
    model: "claude-opus-4-7",
    generatedAt: "2026-06-10T12:00:00.000Z",
    analysis: ANALYSIS,
    textBlock: "Layout/Aufbau: …",
  };

  it("accepts a well-formed envelope", () => {
    expect(coerceStimulusAnalysis(payload)).toEqual(payload);
  });

  it("accepts a video envelope carrying the additive verlauf/szenen fields", () => {
    const video = {
      ...payload,
      analysis: {
        ...ANALYSIS,
        verlauf: "Vom Close-up zum Logo.",
        szenen: [
          { zeit: "00:02", beschreibung: "Close-up" },
          { zeit: "00:14", beschreibung: "Logo mit Claim" },
        ],
      },
    };
    expect(coerceStimulusAnalysis(video)).toEqual(video);
  });

  it.each([
    ["undefined (pre-migration read)", undefined],
    ["null", null],
    ["a string", "kaputt"],
    ["a wrong version", { ...payload, version: 2 }],
    ["a missing analysis", { ...payload, analysis: undefined }],
    [
      "a malformed analysis field",
      { ...payload, analysis: { ...ANALYSIS, frageansaetze: "keine Liste" } },
    ],
  ])("reads %s as null instead of throwing", (_label, raw) => {
    expect(coerceStimulusAnalysis(raw)).toBeNull();
  });
});

describe("coerceStimulusAnalysisStatus", () => {
  it.each(["pending", "done", "failed"] as const)("passes %s through", (s) => {
    expect(coerceStimulusAnalysisStatus(s)).toBe(s);
  });

  it.each([undefined, null, "", "running", 1])("maps %s to null", (raw) => {
    expect(coerceStimulusAnalysisStatus(raw)).toBeNull();
  });
});

describe("analyzeStimulusImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallClaudeStructured.mockResolvedValue(ANALYSIS);
  });

  afterEach(() => {
    delete process.env.STIMULUS_ANALYSIS_MODEL;
  });

  it("sends study context plus the base64 image block and wraps the result in the envelope", async () => {
    const payload = await analyzeStimulusImage({
      imageBase64: "aGFsbG8=",
      mediaType: "image/png",
      study: STUDY,
    });

    expect(mockCallClaudeStructured).toHaveBeenCalledTimes(1);
    const call = mockCallClaudeStructured.mock.calls[0][0];
    expect(call.model).toBe(DEFAULT_STIMULUS_ANALYSIS_MODEL);
    expect(call.maxTokens).toBe(2000);
    expect(call.toolName).toBe("emit_stimulus_analysis");

    const content = call.messages[0].content as unknown as Array<
      Record<string, unknown>
    >;
    expect(content[0]).toMatchObject({ type: "text" });
    expect(String(content[0].text)).toContain("Creative-Test Kampagne Q3");
    expect(String(content[0].text)).toContain("Erster Eindruck");
    expect(String(content[0].text)).toContain("Anzeige mit blauem CTA");
    expect(content[1]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "aGFsbG8=",
      },
    });

    expect(payload.version).toBe(1);
    expect(payload.model).toBe(DEFAULT_STIMULUS_ANALYSIS_MODEL);
    expect(payload.analysis).toEqual(ANALYSIS);
    expect(payload.textBlock).toBe(renderStimulusAnalysisTextBlock(ANALYSIS));
  });

  it("honors the STIMULUS_ANALYSIS_MODEL env override", async () => {
    process.env.STIMULUS_ANALYSIS_MODEL = "claude-sonnet-5";

    const payload = await analyzeStimulusImage({
      imageBase64: "aGFsbG8=",
      mediaType: "image/webp",
      study: STUDY,
    });

    expect(mockCallClaudeStructured.mock.calls[0][0].model).toBe(
      "claude-sonnet-5",
    );
    expect(payload.model).toBe("claude-sonnet-5");
  });

  it("propagates analyzer failures to the caller (the route maps them to 'failed')", async () => {
    mockCallClaudeStructured.mockRejectedValue(new Error("transport down"));

    await expect(
      analyzeStimulusImage({
        imageBase64: "aGFsbG8=",
        mediaType: "image/jpeg",
        study: STUDY,
      }),
    ).rejects.toThrow("transport down");
  });
});

describe("analyzeStimulusVideo", () => {
  const VIDEO_ANALYSIS: StimulusAnalysis = {
    ...ANALYSIS,
    verlauf: "Beginnt mit Produkt-Close-up, endet auf Logo mit Claim.",
    szenen: [
      { zeit: "00:02", beschreibung: "Close-up der Verpackung" },
      { zeit: "00:14", beschreibung: "Logo auf weißem Grund" },
    ],
  };

  const FRAMES: StimulusVideoFrameInput[] = [
    {
      index: 0,
      timestampSeconds: 2.5,
      mediaType: "image/jpeg",
      data: "aGFsbG8=",
    },
    {
      index: 1,
      timestampSeconds: 74,
      mediaType: "image/jpeg",
      data: "d2VsdDIy",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallClaudeStructured.mockResolvedValue(VIDEO_ANALYSIS);
  });

  afterEach(() => {
    delete process.env.STIMULUS_ANALYSIS_MODEL;
  });

  it("sends the study context plus one timestamped text+image pair per frame", async () => {
    const payload = await analyzeStimulusVideo({
      frames: FRAMES,
      study: STUDY,
    });

    expect(mockCallClaudeStructured).toHaveBeenCalledTimes(1);
    const call = mockCallClaudeStructured.mock.calls[0][0];
    expect(call.model).toBe(DEFAULT_STIMULUS_ANALYSIS_MODEL);
    expect(call.maxTokens).toBe(3000);
    expect(call.toolName).toBe("emit_stimulus_analysis");

    const content = call.messages[0].content as unknown as Array<
      Record<string, unknown>
    >;
    // 1 Studienkontext + 2 × (Zeitstempel-Text + Bild).
    expect(content).toHaveLength(5);
    expect(String(content[0].text)).toContain("Creative-Test Kampagne Q3");
    expect(String(content[0].text)).toContain("Stimulus-Video");
    expect(content[1]).toEqual({ type: "text", text: "Frame 1, ca. [00:02]" });
    expect(content[2]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "aGFsbG8=",
      },
    });
    expect(content[3]).toEqual({ type: "text", text: "Frame 2, ca. [01:14]" });

    expect(payload.version).toBe(1);
    expect(payload.analysis).toEqual(VIDEO_ANALYSIS);
    expect(payload.textBlock).toBe(
      renderStimulusAnalysisTextBlock(VIDEO_ANALYSIS),
    );
  });

  it("honors the STIMULUS_ANALYSIS_MODEL env override", async () => {
    process.env.STIMULUS_ANALYSIS_MODEL = "claude-sonnet-5";

    const payload = await analyzeStimulusVideo({
      frames: FRAMES,
      study: STUDY,
    });

    expect(mockCallClaudeStructured.mock.calls[0][0].model).toBe(
      "claude-sonnet-5",
    );
    expect(payload.model).toBe("claude-sonnet-5");
  });

  it("rejects an empty frame list before any model call", async () => {
    await expect(
      analyzeStimulusVideo({ frames: [], study: STUDY }),
    ).rejects.toThrow("at least one frame");
    expect(mockCallClaudeStructured).not.toHaveBeenCalled();
  });

  it("propagates analyzer failures to the caller (the route maps them to 'failed')", async () => {
    mockCallClaudeStructured.mockRejectedValue(new Error("transport down"));

    await expect(
      analyzeStimulusVideo({ frames: FRAMES, study: STUDY }),
    ).rejects.toThrow("transport down");
  });
});
