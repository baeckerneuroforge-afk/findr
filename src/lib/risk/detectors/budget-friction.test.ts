import { describe, expect, it } from "vitest";
import { BudgetFrictionDetector } from "./budget-friction";
import { makeCall, makeInput } from "./test-helpers";

describe("BudgetFrictionDetector", () => {
  const detector = new BudgetFrictionDetector();

  it("detects explicit budget freeze", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Unser Budget ist eingefroren, aktuell koennen wir nicht kaufen." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.severity).toBe("high");
  });

  it("detects discount and pricing pressure", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Pricing ist ein Thema. Gibt es einen Rabatt oder Pilotpreis?" },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.confidence).toBeGreaterThan(0.7);
  });

  it("detects CFO approval and ROI proof risk", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir brauchen CFO Freigabe und eine ROI Begruendung vor dem Kauf." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });

  it("does not flag neutral package discussion", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Bitte sendet uns die Paketoptionen fuer 50 und 100 Seats." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });
});

