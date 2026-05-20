import { describe, expect, it } from "vitest";
import { ChampionLossDetector } from "./champion-loss";
import { makeCall, makeInput } from "./test-helpers";

describe("ChampionLossDetector", () => {
  const detector = new ChampionLossDetector();

  it("detects explicit champion departure", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          {
            speaker_id: "anna",
            speaker_role: "champion",
            text: "Ich verlasse die Firma am Ende des Monats, mein Nachfolger muss das uebernehmen.",
          },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("critical");
    expect(result.signals[0]?.confidence).toBeGreaterThan(0.8);
  });

  it("detects champion disappearing from recent calls", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "anna", speaker_role: "champion", text: "Ich treibe das intern voran." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "anna", speaker_role: "champion", text: "Procurement ist aligned." },
        ]),
        makeCall("call_3", "2026-04-15T10:00:00.000Z", [
          { speaker_id: "buyer_2", speaker_role: "buyer", text: "Anna ist heute nicht dabei." },
        ]),
        makeCall("call_4", "2026-04-22T10:00:00.000Z", [
          { speaker_id: "buyer_2", speaker_role: "buyer", text: "Wir machen ohne Anna weiter." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("high");
  });

  it("does not false-positive on normal champion busyness", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          {
            speaker_id: "anna",
            speaker_role: "champion",
            text: "Ich bin naechste Woche etwas busy, aber wir bleiben beim Terminplan.",
          },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });

  it("does not detect when champion remains active", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "anna", speaker_role: "champion", text: "Ich bin Sponsor fuer das Thema." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "anna", speaker_role: "champion", text: "Ich habe Legal schon gebrieft." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });
});

