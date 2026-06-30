import { describe, expect, it } from "vitest";

import { faceStateFor } from "./KonsoulWizardCompanion";

/**
 * Ehrlichkeits-Vertrag des Begleiters: Die Mimik-Ableitung darf NIE das grüne
 * „belegt"/answer-Gesicht zeigen — ein Berater-Output ist nie belegt, sondern
 * Vorschlag (propose) oder neutrale Hilfe (guidance). Diese Tests nageln das
 * fest (Review-Befund: faceStateFor war ungetestet, obwohl genau hier die
 * Honesty-Garantie hängt) + die Vorrang-Reihenfolge.
 */

describe("faceStateFor", () => {
  it("Vorrang: loading schlägt alles", () => {
    expect(
      faceStateFor({
        loading: true,
        error: true,
        hasSuggestions: true,
        hasAnswer: true,
      }),
    ).toBe("research");
  });

  it("error schlägt Vorschläge/Antwort (aber nicht loading)", () => {
    expect(
      faceStateFor({
        loading: false,
        error: true,
        hasSuggestions: true,
        hasAnswer: true,
      }),
    ).toBe("refuse");
  });

  it("Vorschläge → propose (neutrale Handlungs-Einladung, kein belegt)", () => {
    expect(
      faceStateFor({
        loading: false,
        error: false,
        hasSuggestions: true,
        hasAnswer: true,
      }),
    ).toBe("propose");
  });

  it("nur Antwort → guidance (neutral, nicht grün)", () => {
    expect(
      faceStateFor({
        loading: false,
        error: false,
        hasSuggestions: false,
        hasAnswer: true,
      }),
    ).toBe("guidance");
  });

  it("Ruhezustand → idle", () => {
    expect(
      faceStateFor({
        loading: false,
        error: false,
        hasSuggestions: false,
        hasAnswer: false,
      }),
    ).toBe("idle");
  });

  it("liefert für JEDE der 16 Eingabe-Kombinationen NIE das grüne answer-Gesicht", () => {
    const bools = [false, true];
    for (const loading of bools) {
      for (const error of bools) {
        for (const hasSuggestions of bools) {
          for (const hasAnswer of bools) {
            const state = faceStateFor({
              loading,
              error,
              hasSuggestions,
              hasAnswer,
            });
            expect(state).not.toBe("answer");
            expect(["research", "refuse", "propose", "guidance", "idle"]).toContain(
              state,
            );
          }
        }
      }
    }
  });
});
