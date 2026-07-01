import { describe, expect, it } from "vitest";

import { applyMetaSynthesisAnchorFilter } from "@/lib/meta-synthesis/engine";
import { buildMissionControlAnchorSet } from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import type { MetaSynthesisResult } from "@/lib/schemas/meta-synthesis";

/**
 * PER-STUDY anchoring for the meta-synthesis, deterministic (no LLM / API key):
 * drives applyMetaSynthesisAnchorFilter directly against a fixed 3-study anchor
 * set. The filter is the cross-study trust guarantee — it must
 *  - drop a citation whose quote isn't verbatim in its CITED study,
 *  - demote a "convergent" theme that only anchors in ONE study,
 *  - drop a divergence that loses a side (fewer than 2 positions over 2 studies),
 *  - strip a cross-study citation from a single-study contribution,
 *  - override study_frequency to the honest distinct-study count,
 *  - and be a NO-OP on already-clean input.
 */

// Plain ASCII so folding (lowercase + whitespace-collapse) is predictable.
const QUOTE_A = "Ich brauchte drei Anlaeufe bis das Admin-Setup stand";
const QUOTE_B = "Zu viele Felder vor dem ersten Aha Moment";
const QUOTE_C = "Die Enterprise Konfiguration war ohne Support nicht machbar";
const NOT_PRESENT = "Dieses Zitat kommt in keiner Studie vor";

function theme(quote: string) {
  return {
    title: "Setup-Huerde",
    summary: "Die Einrichtung kostet zu viel Muehe.",
    frequency: 1,
    sourceInsightIds: ["i1"],
    quotes: [quote],
  };
}

const STUDIES: MissionControlSynthesisInput[] = [
  {
    studyId: "study-a",
    studyTitle: "Admin-Onboarding",
    overview: "Onboarding war fuer viele eine Huerde.",
    emergent_themes: [theme(QUOTE_A)],
    tensions: [],
    basedOnCount: 12,
  },
  {
    studyId: "study-b",
    studyTitle: "Self-Serve Signup",
    overview: null,
    emergent_themes: [theme(QUOTE_B)],
    tensions: [],
    basedOnCount: 18,
  },
  {
    studyId: "study-c",
    studyTitle: "Enterprise Setup",
    overview: null,
    emergent_themes: [theme(QUOTE_C)],
    tensions: [],
    basedOnCount: 12,
  },
];

const ANCHORS = buildMissionControlAnchorSet(STUDIES);

/** Minimal valid MetaSynthesisResult with per-section overrides. */
function makeRaw(over: Partial<MetaSynthesisResult>): MetaSynthesisResult {
  return {
    overview: "Studienuebergreifende Uebersicht.",
    convergent_themes: [],
    divergences: [],
    study_contributions: [],
    interpretation: "",
    ...over,
  };
}

describe("applyMetaSynthesisAnchorFilter — convergent themes", () => {
  it("keeps a theme anchored in 2 studies and overrides study_frequency", () => {
    const raw = makeRaw({
      convergent_themes: [
        {
          title: "Setup-Komplexitaet",
          summary: "Mehrere Studien nennen die Einrichtung als Huerde.",
          study_frequency: 9, // wrong on purpose — must be overridden to 2
          citations: [
            { studyId: "study-a", quote: QUOTE_A },
            { studyId: "study-b", quote: QUOTE_B },
          ],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.convergent_themes).toHaveLength(1);
    expect(out.convergent_themes[0].study_frequency).toBe(2);
    expect(out.convergent_themes[0].citations).toHaveLength(2);
  });

  it("drops a theme that collapses to a single study after filtering", () => {
    const raw = makeRaw({
      convergent_themes: [
        {
          title: "Setup-Komplexitaet",
          summary: "Angeblich in zwei Studien.",
          study_frequency: 2,
          citations: [
            { studyId: "study-a", quote: QUOTE_A },
            { studyId: "study-b", quote: NOT_PRESENT }, // paraphrase → dropped
          ],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.convergent_themes).toHaveLength(0);
  });

  it("drops a wrong-study citation but keeps the theme on its 2 valid studies", () => {
    const raw = makeRaw({
      convergent_themes: [
        {
          title: "Setup-Komplexitaet",
          summary: "In A und B belegt, plus eine falsch attribuierte Zeile.",
          study_frequency: 3,
          citations: [
            { studyId: "study-a", quote: QUOTE_A },
            { studyId: "study-b", quote: QUOTE_B },
            { studyId: "study-a", quote: QUOTE_B }, // B's quote under A → dropped
          ],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.convergent_themes).toHaveLength(1);
    expect(out.convergent_themes[0].citations).toHaveLength(2);
    expect(out.convergent_themes[0].study_frequency).toBe(2);
  });
});

describe("applyMetaSynthesisAnchorFilter — divergences", () => {
  it("keeps a divergence with 2 positions over 2 studies", () => {
    const raw = makeRaw({
      divergences: [
        {
          description: "Automatisierung vs. Kontrolle.",
          positions: [
            {
              label: "will Automatisierung",
              studyIds: ["study-a"],
              citations: [{ studyId: "study-a", quote: QUOTE_A }],
            },
            {
              label: "will manuelle Kontrolle",
              studyIds: ["study-c"],
              citations: [{ studyId: "study-c", quote: QUOTE_C }],
            },
          ],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.divergences).toHaveLength(1);
    expect(out.divergences[0].positions).toHaveLength(2);
  });

  it("drops a divergence that loses a side (fewer than 2 positions survive)", () => {
    const raw = makeRaw({
      divergences: [
        {
          description: "Nur eine Seite ist belegt.",
          positions: [
            {
              label: "will Automatisierung",
              studyIds: ["study-a"],
              citations: [{ studyId: "study-a", quote: QUOTE_A }],
            },
            {
              label: "will Kontrolle",
              studyIds: ["study-c"],
              citations: [{ studyId: "study-c", quote: NOT_PRESENT }], // dropped
            },
          ],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.divergences).toHaveLength(0);
  });
});

describe("applyMetaSynthesisAnchorFilter — study contributions", () => {
  it("strips a cross-study citation from a single-study contribution", () => {
    const raw = makeRaw({
      study_contributions: [
        {
          studyId: "study-c",
          summary: "Nur diese Studie nennt den Support-Bedarf.",
          citations: [
            { studyId: "study-c", quote: QUOTE_C },
            { studyId: "study-a", quote: QUOTE_A }, // valid quote, wrong study
          ],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.study_contributions).toHaveLength(1);
    expect(out.study_contributions[0].citations).toHaveLength(1);
    expect(out.study_contributions[0].citations[0].studyId).toBe("study-c");
  });

  it("drops a contribution whose only citation is cross-study", () => {
    const raw = makeRaw({
      study_contributions: [
        {
          studyId: "study-c",
          summary: "Angeblich einzigartig, aber falsch attribuiert.",
          citations: [{ studyId: "study-a", quote: QUOTE_A }],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.study_contributions).toHaveLength(0);
  });
});

describe("applyMetaSynthesisAnchorFilter — prose + no-op", () => {
  it("preserves overview and interpretation verbatim", () => {
    const raw = makeRaw({
      overview: "Eine sorgfaeltige Uebersicht.",
      interpretation: "Eine weiche, nicht belegte Beobachtung.",
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.overview).toBe("Eine sorgfaeltige Uebersicht.");
    expect(out.interpretation).toBe("Eine weiche, nicht belegte Beobachtung.");
  });

  it("is a no-op on already-clean input", () => {
    const raw = makeRaw({
      convergent_themes: [
        {
          title: "Setup-Komplexitaet",
          summary: "Sauber belegt.",
          study_frequency: 2,
          citations: [
            { studyId: "study-a", quote: QUOTE_A },
            { studyId: "study-b", quote: QUOTE_B },
          ],
        },
      ],
      study_contributions: [
        {
          studyId: "study-c",
          summary: "Einzigartiger Support-Bedarf.",
          citations: [{ studyId: "study-c", quote: QUOTE_C }],
        },
      ],
    });
    const out = applyMetaSynthesisAnchorFilter(raw, ANCHORS);
    expect(out.convergent_themes).toHaveLength(1);
    expect(out.convergent_themes[0].citations).toHaveLength(2);
    expect(out.study_contributions).toHaveLength(1);
  });
});
