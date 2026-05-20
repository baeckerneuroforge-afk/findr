import { describe, expect, it } from "vitest";
import { CompetitorPressureDetector } from "./competitor-pressure";
import { makeCall, makeInput } from "./test-helpers";

describe("CompetitorPressureDetector", () => {
  const detector = new CompetitorPressureDetector();

  it("detects explicit competitor evaluation", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir evaluieren parallel Salesforce und wollen euch im finalen Vergleich sehen." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.type).toBe("competitor_pressure");
  });

  it("raises severity for repeated competitor evidence", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Gong ist preislich aggressiver." },
          { text: "Wir sind in einem competitive bid mit Clari." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("high");
  });

  it("does not flag generic market research", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wie positioniert ihr euch generell im Markt?" },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });

  it("detects existing vendor replacement pressure", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Unser bestehender Anbieter Hubspot CRM wird auch noch mit in den Vergleich genommen." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });
});

