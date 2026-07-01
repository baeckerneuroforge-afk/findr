import { describe, expect, it } from "vitest";

import {
  filterAnchoredImplications,
  numberFidelityScan,
  type AdvisorySource,
} from "@/lib/synthesis/advisory-checks";

/**
 * Deterministic advisory guards (no LLM). The GATE drops implications whose
 * `basis` names no real finding; the WARN scan flags foreign numbers. These are
 * the parts of the „Beratung"-Schicht that must be mechanically honest before the
 * LLM judge ever advises.
 */

const SOURCE: AdvisorySource = {
  overview: "Setup war eine Huerde. 30 Prozent brachen frueh ab.",
  emergent_themes: [
    {
      title: "Setup-Komplexitaet blockiert den ersten Erfolg",
      summary: "Zu viele Schritte vor dem ersten Nutzen.",
      quotes: ["drei Anlaeufe"],
    },
  ],
  tensions: [
    {
      description: "Automatik gegen manuelle Kontrolle",
      side_a: { label: "Automatik", sourceInsightIds: ["a"], quotes: [] },
      side_b: { label: "Kontrolle", sourceInsightIds: ["b"], quotes: [] },
    },
  ],
};

describe("filterAnchoredImplications — gate on a real finding", () => {
  it("keeps implications whose basis is a real finding, drops invented ones", () => {
    const { kept, dropped } = filterAnchoredImplications(
      [
        {
          basis: "Setup-Komplexitaet blockiert den ersten Erfolg",
          hypothesis: "Ein frueher Nutzen koennte die Abbruchquote senken.",
        },
        {
          basis: "Automatik gegen manuelle Kontrolle",
          hypothesis: "Ein Standard mit Opt-out waere zu pruefen.",
        },
        {
          basis: "Der Preis war zu hoch", // no such finding in SOURCE
          hypothesis: "Ein guenstigeres Abo koennte Churn senken.",
        },
      ],
      SOURCE,
    );
    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].basis).toContain("Preis");
  });
});

describe("numberFidelityScan — WARN on foreign numbers", () => {
  it("flags a number absent from the synthesis, silent on a present one", () => {
    const findings = numberFidelityScan(
      [
        {
          basis: "Setup-Komplexitaet blockiert den ersten Erfolg",
          hypothesis: "Rund 30 Prozent koennten frueh abspringen.", // 30 is in overview
        },
        {
          basis: "Setup-Komplexitaet blockiert den ersten Erfolg",
          hypothesis: "Etwa 75 Prozent waeren betroffen.", // 75 not in synthesis
        },
      ],
      SOURCE,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].index).toBe(1);
  });

  it("ignores enumerations 1 and 2", () => {
    const findings = numberFidelityScan(
      [
        {
          basis: "Setup-Komplexitaet blockiert den ersten Erfolg",
          hypothesis: "Schritt 1 und 2 koennten zusammengelegt werden.",
        },
      ],
      SOURCE,
    );
    expect(findings).toHaveLength(0);
  });
});
