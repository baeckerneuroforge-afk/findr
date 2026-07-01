import { describe, expect, it } from "vitest";

import { toParticipantTask, type TaskDefinition } from "./task";

/**
 * B1 (UX-Engine-Fixes 2026-07-02) — kanonische Ableitung des participant-safe
 * Task-Slices. Die Grenze ist sicherheits-/methodenrelevant: successCriterion
 * darf den Teilnehmer nie erreichen (Demand-Effect), und `embed` darf NUR für
 * first_party_iframe MIT targetUrl true sein (sonst rendert die Interview-
 * Seite ein leeres iframe bzw. behauptet Messbarkeit, wo keine ist).
 */

function def(overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    instruction: "Lege ein Produkt in den Warenkorb.",
    successCriterion: "RESEARCHER_ONLY_KRITERIUM",
    targetUrl: "https://prototyp.example",
    prototypeHosting: "first_party_iframe",
    ...overrides,
  };
}

describe("toParticipantTask", () => {
  it("null/fehlende Definition → null", () => {
    expect(toParticipantTask(null)).toBeNull();
    expect(toParticipantTask(undefined)).toBeNull();
    expect(toParticipantTask(def({ instruction: "   " }))).toBeNull();
  });

  it("trägt NIE das successCriterion (Typ- UND Wert-Grenze)", () => {
    const task = toParticipantTask(def());
    expect(task).not.toBeNull();
    expect(Object.keys(task!)).toEqual(["instruction", "targetUrl", "embed"]);
    expect(JSON.stringify(task)).not.toContain("RESEARCHER_ONLY_KRITERIUM");
  });

  it("embed=true nur für first_party_iframe MIT targetUrl", () => {
    expect(toParticipantTask(def())!.embed).toBe(true);
    expect(
      toParticipantTask(def({ prototypeHosting: "external_url" }))!.embed,
    ).toBe(false);
    expect(
      toParticipantTask(def({ prototypeHosting: "screen_share" }))!.embed,
    ).toBe(false);
    expect(toParticipantTask(def({ targetUrl: null }))!.embed).toBe(false);
  });

  it("reicht instruction + targetUrl unverändert durch", () => {
    const task = toParticipantTask(def({ prototypeHosting: "external_url" }))!;
    expect(task.instruction).toBe("Lege ein Produkt in den Warenkorb.");
    expect(task.targetUrl).toBe("https://prototyp.example");
  });
});
