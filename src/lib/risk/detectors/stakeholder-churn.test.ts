import { describe, expect, it } from "vitest";
import { StakeholderChurnDetector } from "./stakeholder-churn";
import { makeCall, makeInput } from "./test-helpers";

describe("StakeholderChurnDetector", () => {
  const detector = new StakeholderChurnDetector();

  it("detects explicit owner change", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Tom ist nicht mehr zustaendig, Lisa uebernimmt als Nachfolgerin." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("high");
  });

  it("detects reorg and new leadership", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Durch die Reorg gibt es eine neue Leitung und einen interim Owner." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });

  it("detects disappearance of an early key stakeholder", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "marc", text: "Ich bin dabei." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "marc", text: "Ich pruefe das intern." },
        ]),
        makeCall("call_3", "2026-04-15T10:00:00.000Z", [
          { speaker_id: "julia", text: "Marc ist heute nicht dabei." },
        ]),
        makeCall("call_4", "2026-04-22T10:00:00.000Z", [
          { speaker_id: "julia", text: "Wir machen hier weiter." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("medium");
  });

  it("does not flag an additional stakeholder joining", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "marc", text: "Ich bin euer Ansprechpartner." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "marc", text: "Ich bringe Lisa aus Legal dazu." },
          { speaker_id: "lisa", text: "Ich schaue nur auf den Vertrag." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });
});

