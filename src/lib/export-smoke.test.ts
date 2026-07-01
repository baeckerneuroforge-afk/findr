import { describe, expect, it } from "vitest";

import {
  buildSynthesisPdf,
  type SynthesisPdfInput,
} from "@/lib/pdf/synthesis-report";
import { buildSynthesisPptx } from "@/lib/pptx/synthesis-deck";
import {
  buildMetaSynthesisPdf,
  type MetaSynthesisPdfInput,
} from "@/lib/pdf/meta-synthesis-report";
import { buildMetaSynthesisPptx } from "@/lib/pptx/meta-synthesis-deck";

/**
 * Export smoke tests — these actually RUN the pdfkit / pptxgenjs builders end to
 * end (no preview possible for binary output), so a runtime error in the newly
 * added chart-drawing or narrative-rendering code fails here instead of 500-ing a
 * live export route. We assert the builders return non-empty bytes; content
 * fidelity is covered by the (deterministic) chart/anchor unit tests + a human
 * hands-on check. Rich fixtures exercise: >=2-bar charts (theme/convergent/
 * interviews), the executive narrative section/slide, tensions and divergences.
 */

const SYNTHESIS_INPUT: SynthesisPdfInput = {
  plan: {
    title: "FinFlow – Onboarding-Studie",
    objective: "Verstehen, wo Neukund:innen abspringen.",
    persona: "Neukund:innen",
  },
  synthesis: {
    overview: "Über 22 Interviews zeigt sich ein klares Bild.",
    emergent_themes: [
      {
        title: "Setup-Komplexität blockiert den ersten Erfolg",
        summary: "Zu viele Schritte vor dem ersten Nutzen.",
        frequency: 14,
        sourceInsightIds: ["a", "b"],
        quotes: ["Ich brauchte drei Anläufe, bis mein Konto verknüpft war."],
      },
      {
        title: "Fehlende Guidance im ersten Flow",
        summary: "Kein klarer nächster Schritt.",
        frequency: 8,
        sourceInsightIds: ["c"],
        quotes: ["Niemand hat mir gesagt, was der nächste Schritt ist."],
      },
    ],
    tensions: [
      {
        description: "Automatik vs. Kontrolle.",
        side_a: { label: "Automatik", sourceInsightIds: ["a"], quotes: ["Warum nicht automatisch?"] },
        side_b: { label: "Kontrolle", sourceInsightIds: ["c"], quotes: ["Ich will es selbst prüfen."] },
      },
    ],
    based_on_count: 22,
    synthesized_at: "2026-07-01T10:00:00.000Z",
    model: "claude-opus-4-8",
    executive_narrative:
      "Die Reibung kumuliert über den gesamten Einrichtungspfad und der erste sichtbare Nutzen kommt zu spät.",
  },
  orgName: "Test-Org",
  locale: "de",
};

const META_INPUT: MetaSynthesisPdfInput = {
  title: "Meta-Synthese · FinFlow über 3 Studien",
  createdAt: "2026-07-01T10:00:00.000Z",
  model: "claude-opus-4-8",
  totalStudies: 3,
  totalInterviews: 57,
  studies: [
    { studyId: "s1", studyTitle: "Onboarding", basedOnCount: 22 },
    { studyId: "s2", studyTitle: "Power-User", basedOnCount: 16 },
    { studyId: "s3", studyTitle: "Kündiger", basedOnCount: 19 },
  ],
  result: {
    overview: "Studienübergreifend dominiert die Setup-Komplexität.",
    convergent_themes: [
      {
        title: "Setup-Komplexität",
        summary: "In allen drei Studien belegt.",
        study_frequency: 3,
        citations: [{ studyId: "s1", quote: "drei Anläufe" }],
      },
      {
        title: "Fehlende Guidance",
        summary: "In zwei Studien belegt.",
        study_frequency: 2,
        citations: [{ studyId: "s1", quote: "nächster Schritt" }],
      },
    ],
    divergences: [
      {
        description: "Automatisierung vs. Kontrolle.",
        positions: [
          { label: "Automatik", studyIds: ["s1"], citations: [{ studyId: "s1", quote: "automatisch" }] },
          { label: "Kontrolle", studyIds: ["s2"], citations: [{ studyId: "s2", quote: "selbst prüfen" }] },
        ],
      },
    ],
    study_contributions: [
      { studyId: "s3", summary: "Preis-Leistung.", citations: [{ studyId: "s3", quote: "zu teuer" }] },
    ],
    executive_narrative:
      "Über die Studien hinweg verschiebt sich die Erwartung an Automatisierung.",
    interpretation: "",
  },
  orgName: "Test-Org",
  locale: "de",
};

describe("export smoke — builders run without throwing", () => {
  it("buildSynthesisPdf produces bytes (charts + narrative)", async () => {
    const pdf = await buildSynthesisPdf(SYNTHESIS_INPUT);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("buildSynthesisPptx produces bytes (chart slide + narrative slide)", async () => {
    const pptx = await buildSynthesisPptx(SYNTHESIS_INPUT);
    expect(pptx.length).toBeGreaterThan(1000);
  });

  it("buildMetaSynthesisPdf produces bytes (2 charts + narrative)", async () => {
    const pdf = await buildMetaSynthesisPdf(META_INPUT);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("buildMetaSynthesisPptx produces bytes (2 chart slides + narrative)", async () => {
    const pptx = await buildMetaSynthesisPptx(META_INPUT);
    expect(pptx.length).toBeGreaterThan(1000);
  });

  it("standard mode (empty narrative, single theme → no chart) still builds", async () => {
    const pdf = await buildSynthesisPdf({
      ...SYNTHESIS_INPUT,
      synthesis: {
        ...SYNTHESIS_INPUT.synthesis,
        emergent_themes: SYNTHESIS_INPUT.synthesis.emergent_themes.slice(0, 1),
        executive_narrative: null,
      },
    });
    expect(pdf.length).toBeGreaterThan(500);
  });
});
