import { describe, expect, it } from "vitest";

import { buildGuideUserPrompt } from "./guide-generator";

/**
 * Deterministische Verifikation (KEIN LLM-Call), dass die Setup-Signale —
 * Art der Studie, Interviewtiefe, Zielgruppe, Anrede — tatsächlich im
 * Generierungs-Prompt landen. Das ist die Kern-Garantie des Wizard-Umbaus:
 * was im Setup gewählt wird, FORMT den Leitfaden, statt nur davor abgefragt zu
 * werden. buildGuideUserPrompt ist die reine Funktion am Rand der Engine; sie
 * direkt zu prüfen ist robuster als ein LLM-Verhaltens-Check (das macht die
 * separate Eval-Harness).
 */
describe("buildGuideUserPrompt — Setup-Signale landen im Prompt", () => {
  const base = { goal: "Warum brechen Nutzer den Checkout ab?" } as const;

  it("bleibt ohne useCase/Tiefe byte-identisch (keine neuen Zeilen)", () => {
    const prompt = buildGuideUserPrompt({ ...base });
    // Vor-Verhalten unverändert: ohne die neuen Signale keine neuen Blöcke.
    expect(prompt).not.toContain("ART DER STUDIE");
    expect(prompt).not.toContain("INTERVIEWTIEFE");
    // Bestehende Anker bleiben erhalten.
    expect(prompt).toContain("RESEARCH-ZIEL");
    expect(prompt).toContain("ZIEL-TOPIC-COUNT");
  });

  it("hängt den Art-der-Studie-Fokus an, wenn useCase gesetzt ist", () => {
    const brand = buildGuideUserPrompt({ ...base, useCase: "brand_research" });
    expect(brand).toContain("ART DER STUDIE");
    expect(brand).toContain("Markenwahrnehmung");

    const concept = buildGuideUserPrompt({ ...base, useCase: "concept_test" });
    expect(concept).toContain("ART DER STUDIE");
    expect(concept).toContain("Verständnis");

    const usability = buildGuideUserPrompt({
      ...base,
      useCase: "usability_test",
    });
    expect(usability).toContain("task-basiert");

    // Verschiedene Studientypen ⇒ verschiedene Fokus-Texte.
    expect(brand).not.toEqual(concept);
    expect(concept).not.toEqual(usability);
  });

  it("hängt die Tiefe-Vorgabe an, wenn interviewDepth gesetzt ist", () => {
    const flach = buildGuideUserPrompt({ ...base, interviewDepth: "flach" });
    expect(flach).toContain("INTERVIEWTIEFE: flach");
    expect(flach).toContain("knappe Probes");

    const mittel = buildGuideUserPrompt({ ...base, interviewDepth: "mittel" });
    expect(mittel).toContain("INTERVIEWTIEFE: mittel");

    const tief = buildGuideUserPrompt({ ...base, interviewDepth: "tief" });
    expect(tief).toContain("INTERVIEWTIEFE: tief");
    expect(tief).toContain("laddering");

    // flach ⇒ weniger, tief ⇒ mehr Probes: die Texte unterscheiden sich.
    expect(flach).not.toEqual(tief);
  });

  it("trägt Zielgruppe (who) und Anrede (audienceType) in den Prompt", () => {
    const b2c = buildGuideUserPrompt({
      ...base,
      who: "Käufer:innen von Bio-Lebensmitteln",
      audienceType: "b2c",
    });
    expect(b2c).toContain("ZIELGRUPPE");
    expect(b2c).toContain("Käufer:innen von Bio-Lebensmitteln");
    expect(b2c).toContain("ANREDE: du");

    // b2b (bzw. Default) ⇒ formelle Sie-Anrede.
    expect(buildGuideUserPrompt({ ...base, audienceType: "b2b" })).toContain(
      "ANREDE: Sie",
    );
    expect(buildGuideUserPrompt({ ...base })).toContain("ANREDE: Sie");
  });

  it("kombiniert alle Setup-Signale in einem Prompt", () => {
    const prompt = buildGuideUserPrompt({
      goal: "Ein neues Self-Service-Reporting-Konzept testen",
      who: "Fachanwender:innen (Business Analysts)",
      audienceType: "b2b",
      useCase: "concept_test",
      interviewDepth: "tief",
    });
    expect(prompt).toContain("ZIELGRUPPE");
    expect(prompt).toContain("ART DER STUDIE");
    expect(prompt).toContain("INTERVIEWTIEFE: tief");
    expect(prompt).toContain("ANREDE: Sie");
  });
});
