import { describe, expect, it } from "vitest";
import { StallingDetector } from "./stalling";
import { makeCall, makeInput } from "./test-helpers";

describe("StallingDetector", () => {
  const detector = new StallingDetector();

  it("detects repeated vague internal alignment", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir muessen das intern nochmal besprechen und melden uns." },
          { text: "Lass uns noch eine interne Runde drehen." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("high");
  });

  it("does not flag one internal discussion with concrete next step", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir besprechen das intern, der Owner ist Julia und bis Montag bekommt ihr Feedback." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });

  it("detects material call cadence gaps", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [{ text: "Guter Auftakt." }]),
        makeCall("call_2", "2026-05-01T10:00:00.000Z", [{ text: "Wir sind noch nicht weiter." }]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.evidence[0]?.quote).toContain("30 days");
  });

  it("detects explicit quarter pushout", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Vor Juni geht nichts, vielleicht schauen wir im Q3 nochmal drauf." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("high");
  });
});

