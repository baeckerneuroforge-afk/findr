import { describe, expect, it, vi } from "vitest";

import {
  buildGuideUserPrompt,
  buildStimulusContext,
  STIMULUS_CONTEXT_MAX_CHARS,
} from "./guide-generator";

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

  it("hängt den Unternehmens-Kontext (E1) an, wenn businessContext gesetzt ist", () => {
    const withCtx = buildGuideUserPrompt({
      ...base,
      businessContext:
        "Wir sind Klymeo, ein Shop für Bio-Naturkosmetik. Neu: Express-Checkout ohne Kundenkonto.",
    });
    expect(withCtx).toContain("KONTEXT (Unternehmen/Produkt/Idee");
    expect(withCtx).toContain("Express-Checkout ohne Kundenkonto");

    // Ohne / mit leerem Kontext bleibt der Prompt byte-identisch zum Vor-Verhalten.
    const without = buildGuideUserPrompt({ ...base });
    expect(without).not.toContain("KONTEXT");
    expect(buildGuideUserPrompt({ ...base, businessContext: "   " })).toEqual(
      without,
    );
  });

  it("hängt die Stimulus-Analyse (E2) an, wenn stimulusContext gesetzt ist", () => {
    const withMat = buildGuideUserPrompt({
      ...base,
      stimulusContext:
        "— Material 1 (Plakat A) —\nLayout/Aufbau: zentriertes Produktbild\nClaim/Botschaft: Natürlich schnell.",
    });
    expect(withMat).toContain("MATERIAL (Analyse dessen");
    expect(withMat).toContain("Natürlich schnell.");

    const without = buildGuideUserPrompt({ ...base });
    expect(without).not.toContain("MATERIAL");
    expect(buildGuideUserPrompt({ ...base, stimulusContext: "" })).toEqual(
      without,
    );
  });

  it("buildStimulusContext: nur done-Analysen, nummeriert, Label optional", () => {
    const ctx = buildStimulusContext([
      {
        label: "Plakat A",
        analysisStatus: "done",
        analysis: { textBlock: "Claim: Natürlich schnell." },
      },
      { label: "Plakat B", analysisStatus: "pending", analysis: null },
      { label: null, analysisStatus: "done", analysis: { textBlock: "Zweiter Block" } },
    ]);
    expect(ctx).toContain("— Material 1 (Plakat A) —");
    expect(ctx).toContain("Claim: Natürlich schnell.");
    // Nummerierung zählt nur ANALYSIERTE Blöcke (B übersprungen → 2, ohne Label).
    expect(ctx).toContain("— Material 2 —");
    expect(ctx).not.toContain("Plakat B");
    // Kein analysiertes Asset → undefined (kein MATERIAL-Block im Prompt).
    expect(buildStimulusContext([])).toBeUndefined();
    expect(
      buildStimulusContext([{ label: "X", analysisStatus: "pending", analysis: null }]),
    ).toBeUndefined();
  });

  it("buildStimulusContext: Cap arbeitet BLOCK-weise — kein abgeschnittener Halbsatz", () => {
    // Erster Block füllt den Cap bis auf einen Rest, der für den zweiten
    // Block sicher NICHT reicht (Header ~20 + Text ~40 + Joiner 2 > 30).
    const big = "B".repeat(STIMULUS_CONTEXT_MAX_CHARS - 50);
    const ctx = buildStimulusContext([
      { label: "A", analysisStatus: "done", analysis: { textBlock: big } },
      {
        label: "Opfer",
        analysisStatus: "done",
        analysis: { textBlock: "Dieser Block passt nicht mehr ganz rein." },
      },
    ]);
    expect(ctx).toBeDefined();
    expect(ctx!.length).toBeLessThanOrEqual(STIMULUS_CONTEXT_MAX_CHARS);
    // Der zweite Block wird VERWORFEN, nicht angeschnitten.
    expect(ctx).not.toContain("Opfer");
    expect(ctx).not.toContain("Dieser Block");
  });

  it("buildStimulusContext: Verwerfen ist pro Block (spätere passen noch) und warnt laut", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const big = "B".repeat(STIMULUS_CONTEXT_MAX_CHARS - 50);
      const ctx = buildStimulusContext([
        { label: "A", analysisStatus: "done", analysis: { textBlock: big } },
        {
          label: "Riese",
          analysisStatus: "done",
          analysis: { textBlock: "R".repeat(200) },
        },
        { label: "Zwerg", analysisStatus: "done", analysis: { textBlock: "ok" } },
      ]);
      // Der Riese passt nicht → einzeln verworfen; der kleine Zwerg danach
      // passt in den Rest-Budget-Raum noch hinein.
      expect(ctx).not.toContain("Riese");
      expect(ctx).toContain("Zwerg");
      expect(ctx!.length).toBeLessThanOrEqual(STIMULUS_CONTEXT_MAX_CHARS);
      // Stiller Cutoff ist verboten: genau eine Warnung über 1 verworfenes Asset.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0][0])).toContain("1 von 3");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("kombiniert alle Setup-Signale in einem Prompt", () => {
    const prompt = buildGuideUserPrompt({
      goal: "Ein neues Self-Service-Reporting-Konzept testen",
      who: "Fachanwender:innen (Business Analysts)",
      audienceType: "b2b",
      useCase: "concept_test",
      interviewDepth: "tief",
      businessContext: "Wir sind ein BI-SaaS für Mittelständler.",
      stimulusContext: "— Material 1 —\nKonzept-Mockup des Report-Builders.",
    });
    expect(prompt).toContain("ZIELGRUPPE");
    expect(prompt).toContain("ART DER STUDIE");
    expect(prompt).toContain("INTERVIEWTIEFE: tief");
    expect(prompt).toContain("ANREDE: Sie");
    expect(prompt).toContain("KONTEXT (Unternehmen/Produkt/Idee");
    expect(prompt).toContain("MATERIAL (Analyse dessen");
  });
});
