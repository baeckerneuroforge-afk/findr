import { describe, expect, it } from "vitest";
import { EngagementDropDetector } from "./engagement-drop";
import { makeCall, makeInput } from "./test-helpers";

describe("EngagementDropDetector", () => {
  const detector = new EngagementDropDetector();

  it("detects explicit engagement drop language", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Es gab etwas Funkstille und das Thema ist nicht mehr ganz oben." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.type).toBe("engagement_drop");
  });

  it("detects cadence deceleration", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [{ text: "Kickoff." }]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [{ text: "Naechster Schritt." }]),
        makeCall("call_3", "2026-05-01T10:00:00.000Z", [{ text: "Wir sind noch dabei." }]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.evidence[0]?.quote).toContain("increased");
  });

  it("detects attendance drop", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "a", text: "Hallo." },
          { speaker_id: "b", text: "Hallo." },
          { speaker_id: "c", text: "Hallo." },
          { speaker_id: "d", text: "Hallo." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "a", text: "Nur wir zwei heute." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });

  it("does not flag a normal busy week", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Diese Woche ist voll, aber der Termin naechsten Dienstag steht." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });
});

