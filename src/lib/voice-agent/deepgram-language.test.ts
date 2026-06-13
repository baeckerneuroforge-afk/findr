import { afterEach, describe, expect, it } from "vitest";

import { sttLanguageCode, ttsModelForLanguage } from "./deepgram-language";

describe("sttLanguageCode", () => {
  it("maps en to en", () => {
    expect(sttLanguageCode("en")).toBe("en");
  });
  it("maps de to de", () => {
    expect(sttLanguageCode("de")).toBe("de");
  });
  it("falls back to de for unknown/empty languages", () => {
    expect(sttLanguageCode("fr")).toBe("de");
    expect(sttLanguageCode("")).toBe("de");
  });
});

describe("ttsModelForLanguage", () => {
  const originalDe = process.env.DEEPGRAM_TTS_MODEL_DE;
  const originalEn = process.env.DEEPGRAM_TTS_MODEL_EN;

  afterEach(() => {
    if (originalDe === undefined) delete process.env.DEEPGRAM_TTS_MODEL_DE;
    else process.env.DEEPGRAM_TTS_MODEL_DE = originalDe;
    if (originalEn === undefined) delete process.env.DEEPGRAM_TTS_MODEL_EN;
    else process.env.DEEPGRAM_TTS_MODEL_EN = originalEn;
  });

  it("uses the English Aura-2 voice for en", () => {
    delete process.env.DEEPGRAM_TTS_MODEL_EN;
    expect(ttsModelForLanguage("en")).toBe("aura-2-thalia-en");
  });

  it("uses the German Aura-2 voice for de", () => {
    delete process.env.DEEPGRAM_TTS_MODEL_DE;
    expect(ttsModelForLanguage("de")).toBe("aura-2-aurelia-de");
  });

  it("falls back to the German voice for unknown languages", () => {
    delete process.env.DEEPGRAM_TTS_MODEL_DE;
    expect(ttsModelForLanguage("fr")).toBe("aura-2-aurelia-de");
    expect(ttsModelForLanguage("")).toBe("aura-2-aurelia-de");
  });

  it("honours the env override (no-deploy voice swap)", () => {
    process.env.DEEPGRAM_TTS_MODEL_EN = "aura-2-zeus-en";
    expect(ttsModelForLanguage("en")).toBe("aura-2-zeus-en");
  });
});
