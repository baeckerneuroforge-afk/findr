import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isValidSuggestionValue,
  MAX_WIZARD_SUGGESTIONS,
  sanitizeWizardSuggestions,
  WizardAdvisorRawResultSchema,
  type WizardAdvisorRawSuggestion,
} from "./konsoul-wizard";
import { isKonsoulWizardEnabled } from "@/lib/konsoul/wizard-flag";

/**
 * Der sicherheitskritische Kern: `sanitizeWizardSuggestions` ist der EINZIGE Pfad
 * von Modell-Output in den Wizard-State. Diese Tests frieren ein, dass ein
 * halluzinierter/no-op/leerer Vorschlag NIE durchkommt — sonst könnte ein
 * erfundenes useCase den Select sprengen. Plus: Flag default AUS (inerter Merge).
 */

const CURRENT = {
  useCase: "general_survey",
  audienceType: "b2c",
  interviewDepth: "mittel",
} as const;

function sug(
  field: WizardAdvisorRawSuggestion["field"],
  value: string,
  extra?: Partial<WizardAdvisorRawSuggestion>,
): WizardAdvisorRawSuggestion {
  return {
    field,
    value,
    label: extra?.label ?? `Label ${field}`,
    rationale: extra?.rationale ?? `Begründung ${field}`,
  };
}

describe("sanitizeWizardSuggestions", () => {
  it("verwirft ein Enum-useCase mit ungültigem Token (kein kaputter Select)", () => {
    const out = sanitizeWizardSuggestions([sug("useCase", "foobar")], CURRENT);
    expect(out).toHaveLength(0);
  });

  it("behält ein gültiges, abweichendes Enum-useCase", () => {
    const out = sanitizeWizardSuggestions(
      [sug("useCase", "concept_test")],
      CURRENT,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ field: "useCase", value: "concept_test" });
  });

  it("verwirft einen no-op-Vorschlag (value == aktueller Wert)", () => {
    const out = sanitizeWizardSuggestions(
      [
        sug("useCase", "general_survey"), // == current.useCase
        sug("audienceType", "b2c"), // == current.audienceType
        sug("interviewDepth", "mittel"), // == current.interviewDepth
      ],
      CURRENT,
    );
    expect(out).toHaveLength(0);
  });

  it("verwirft ungültiges audienceType und interviewDepth, behält gültige", () => {
    const out = sanitizeWizardSuggestions(
      [
        sug("audienceType", "enterprise"), // ungültig
        sug("interviewDepth", "deep"), // ungültig (kein dt. Token)
        sug("interviewDepth", "tief"), // gültig, abweichend — aber Feld schon „gesehen"
      ],
      CURRENT,
    );
    // audienceType: ungültig → raus. interviewDepth: erster (ungültig) markiert das
    // Feld NICHT als gesehen (continue vor seenFields.add) → der zweite (gültig)
    // kommt durch.
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ field: "interviewDepth", value: "tief" });
  });

  it("kappt überlangen Freitext (briefing) auf den Feld-Cap", () => {
    const long = "x".repeat(5000);
    const out = sanitizeWizardSuggestions([sug("briefing", long)], CURRENT);
    expect(out).toHaveLength(1);
    expect(out[0].value.length).toBeLessThanOrEqual(2000);
  });

  it("erlaubt nur EINEN Vorschlag pro Feld (Dedup)", () => {
    const out = sanitizeWizardSuggestions(
      [
        sug("briefing", "Erstes Ziel", { label: "A" }),
        sug("briefing", "Zweites Ziel", { label: "B" }),
      ],
      CURRENT,
    );
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("A");
  });

  it("schneidet bei MAX_WIZARD_SUGGESTIONS", () => {
    const out = sanitizeWizardSuggestions(
      [
        sug("briefing", "Ziel"),
        sug("persona", "Zielgruppe"),
        sug("title", "Titel"),
        sug("useCase", "concept_test"),
        sug("audienceType", "b2b"),
      ],
      CURRENT,
    );
    expect(out.length).toBe(MAX_WIZARD_SUGGESTIONS);
    expect(MAX_WIZARD_SUGGESTIONS).toBe(4);
  });

  it("verwirft Vorschläge mit leerem value/label/rationale", () => {
    const out = sanitizeWizardSuggestions(
      [
        sug("briefing", "   "), // leer nach trim
        sug("persona", "ok", { label: "  " }), // leeres label
        sug("title", "ok", { rationale: "" }), // leere rationale
      ],
      CURRENT,
    );
    expect(out).toHaveLength(0);
  });

  it("liefert [] für undefined/leer", () => {
    expect(sanitizeWizardSuggestions(undefined, CURRENT)).toEqual([]);
    expect(sanitizeWizardSuggestions([], CURRENT)).toEqual([]);
  });
});

describe("isValidSuggestionValue", () => {
  it("prüft Enum-Mitgliedschaft für Enum-Felder", () => {
    expect(isValidSuggestionValue("useCase", "concept_test")).toBe(true);
    expect(isValidSuggestionValue("useCase", "foobar")).toBe(false);
    expect(isValidSuggestionValue("audienceType", "b2b")).toBe(true);
    expect(isValidSuggestionValue("audienceType", "x")).toBe(false);
    expect(isValidSuggestionValue("interviewDepth", "tief")).toBe(true);
    expect(isValidSuggestionValue("interviewDepth", "deep")).toBe(false);
  });

  it("akzeptiert nicht-leeren Freitext", () => {
    expect(isValidSuggestionValue("briefing", "ein Ziel")).toBe(true);
    expect(isValidSuggestionValue("persona", "   ")).toBe(false);
  });
});

describe("WizardAdvisorRawResultSchema", () => {
  it("akzeptiert answer ohne suggestions", () => {
    const parsed = WizardAdvisorRawResultSchema.safeParse({ answer: "Alles gut." });
    expect(parsed.success).toBe(true);
  });

  it("verwirft ein unbekanntes suggestion-field", () => {
    const parsed = WizardAdvisorRawResultSchema.safeParse({
      answer: "x",
      suggestions: [
        { field: "sampleTarget", value: "10", label: "a", rationale: "b" },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("isKonsoulWizardEnabled (Flag default AUS)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ist false ohne gesetzte Env-Variable", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED", "");
    expect(isKonsoulWizardEnabled()).toBe(false);
  });

  it("ist false bei jedem Wert außer exakt 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED", "false");
    expect(isKonsoulWizardEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED", "1");
    expect(isKonsoulWizardEnabled()).toBe(false);
  });

  it("ist true nur bei exakt 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED", "true");
    expect(isKonsoulWizardEnabled()).toBe(true);
  });
});
