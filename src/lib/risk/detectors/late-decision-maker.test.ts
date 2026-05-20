import { describe, expect, it } from "vitest";
import { LateDecisionMakerDetector } from "./late-decision-maker";
import { makeCall, makeInput } from "./test-helpers";

describe("LateDecisionMakerDetector", () => {
  const detector = new LateDecisionMakerDetector();

  it("detects late CFO entry", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "buyer_1", text: "Team ist aligned." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          {
            speaker_id: "cfo_1",
            speaker_role: "decision_maker",
            text: "Ich bin der CFO und muss das final freigeben.",
          },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.type).toBe("late_decision_maker");
  });

  it("detects late legal veto language", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "buyer_1", text: "Scope passt." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          {
            speaker_id: "legal_1",
            speaker_role: "buyer_team",
            text: "Legal war bisher gar nicht im Prozess und kann das noch blocken.",
          },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });

  it("does not detect senior stakeholder named from the start", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "buyer_1", text: "Unser CEO war von Anfang an informiert." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });

  it("does not flag normal sign-off without new stakeholder", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "buyer_1", text: "Der normale Sign-off laeuft ueber den bestehenden Prozess." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "buyer_1", text: "Wir reichen das jetzt ein, keine neuen Anforderungen." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });
});

