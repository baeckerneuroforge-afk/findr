import { describe, expect, it } from "vitest";

import { applyAnchoredFilter, buildAnchorSet } from "@/lib/synthesis/engine";
import type { SynthesisInsightInput } from "@/lib/synthesis/prompts";
import type { StudySynthesisResult } from "@/lib/schemas/synthesis";

/**
 * PER-INSIGHT quote anchoring (Tier-1 fix). The engine's quote check used to
 * accept a quote that appeared ANYWHERE in the combined material of all
 * insights (one global haystack). It now requires a quote to be verbatim in at
 * least one of the sourceInsightIds the theme / tension-side ACTUALLY cites —
 * blocking cross-respondent attribution (a quote from respondent B hung on a
 * theme that only cites A).
 *
 * These tests are deterministic (no LLM / API key): they drive buildAnchorSet
 * + applyAnchoredFilter directly. The key case (`drops a cross-attributed
 * quote …`) is exactly the negative the LLM dataset cannot express — it
 * asserts BOTH that the OLD global check would have accepted the quote (it is
 * present in the global haystack) AND that the NEW per-insight check drops it.
 */

// Plain ASCII so the folded form is predictable (fold lowercases + trims).
const QUOTE_A = "Wir brauchen unbedingt eine Mobile App fuer den Aussendienst";
const QUOTE_B = "Der Browser reicht uns vollkommen aus";
const FOLDED_B = "der browser reicht uns vollkommen aus";

function makeInsight(id: string, evidence: string[]): SynthesisInsightInput {
  return {
    id,
    summary: null,
    featureRequests: [
      {
        category: "MOBILE",
        title: "Befund",
        description: "Beschreibung",
        intensity: "high",
        confidence: 0.9,
        evidence,
      },
    ],
    painPoints: [],
    themes: [],
    respondentRole: null,
    respondentSegment: null,
    sentiment: null,
  };
}

const INSIGHT_A = makeInsight("call_A", [QUOTE_A]);
const INSIGHT_B = makeInsight("call_B", [QUOTE_B]);

/** A minimal raw Stage-2 result with one theme; caller overrides the theme. */
function rawWithTheme(
  sourceInsightIds: string[],
  quotes: string[],
): StudySynthesisResult {
  return {
    overview: "Übersicht.",
    emergent_themes: [
      {
        title: "Mobile vs. Browser",
        summary: "Geteilte Sicht auf die Mobile-App.",
        frequency: sourceInsightIds.length,
        sourceInsightIds,
        quotes,
      },
    ],
    tensions: [],
    methodology: null,
    signal_observations: [],
    stimulus_sections: [],
    stimulus_comparison: null,
  };
}

describe("applyAnchoredFilter — per-insight quote anchoring", () => {
  it("drops a quote attributed to a non-cited insight, keeps the theme via its valid id", () => {
    const anchors = buildAnchorSet([INSIGHT_A, INSIGHT_B]);

    // OLD logic: the global haystack DOES contain B's quote, so the previous
    // global-substring check would have accepted it on a theme citing only A.
    expect(anchors.foldedHaystack.includes(FOLDED_B)).toBe(true);

    // Theme cites only call_A but quotes B's line (cross-attribution) + A's line.
    const filtered = applyAnchoredFilter(rawWithTheme(["call_A"], [QUOTE_B, QUOTE_A]), anchors);

    // NEW logic: B's quote is dropped (not in call_A's material); A's is kept.
    expect(filtered.emergent_themes).toHaveLength(1);
    const theme = filtered.emergent_themes[0];
    expect(theme.quotes).toEqual([QUOTE_A]);
    expect(theme.quotes).not.toContain(QUOTE_B);

    // Survival rule unchanged: theme stays via its valid id, frequency intact.
    expect(theme.sourceInsightIds).toEqual(["call_A"]);
    expect(theme.frequency).toBe(1);
  });

  it("keeps a quote that is verbatim in one of the theme's cited ids", () => {
    const anchors = buildAnchorSet([INSIGHT_A, INSIGHT_B]);
    const filtered = applyAnchoredFilter(rawWithTheme(["call_A", "call_B"], [QUOTE_A, QUOTE_B]), anchors);

    // Both quotes belong to a cited id (A→call_A, B→call_B), so both survive.
    expect(filtered.emergent_themes[0].quotes).toEqual([QUOTE_A, QUOTE_B]);
    expect(filtered.emergent_themes[0].frequency).toBe(2);
  });

  it("drops a quote whose cited id does not exist in the input set", () => {
    const anchors = buildAnchorSet([INSIGHT_A]);
    // Theme cites call_A (valid) but the only quote belongs to call_B, which is
    // not even in the input. Quote dropped; theme survives via call_A.
    const filtered = applyAnchoredFilter(rawWithTheme(["call_A"], [QUOTE_B]), anchors);
    expect(filtered.emergent_themes).toHaveLength(1);
    expect(filtered.emergent_themes[0].quotes).toEqual([]);
  });

  it("applies per-insight anchoring to tension sides too", () => {
    const anchors = buildAnchorSet([INSIGHT_A, INSIGHT_B]);
    const raw: StudySynthesisResult = {
      overview: "Übersicht.",
      emergent_themes: [],
      tensions: [
        {
          description: "Mobile-App nötig vs. Browser reicht.",
          // side_a cites call_A but mis-quotes B's line → quote must drop.
          side_a: { label: "will Mobile App", sourceInsightIds: ["call_A"], quotes: [QUOTE_B, QUOTE_A] },
          // side_b cites call_B and quotes B's line correctly → quote kept.
          side_b: { label: "Browser reicht", sourceInsightIds: ["call_B"], quotes: [QUOTE_B] },
        },
      ],
      methodology: null,
      signal_observations: [],
      stimulus_sections: [],
      stimulus_comparison: null,
    };

    const filtered = applyAnchoredFilter(raw, anchors);

    // Sides are disjoint (A vs B) so the tension survives.
    expect(filtered.tensions).toHaveLength(1);
    const tension = filtered.tensions[0];
    // side_a: B's misattributed quote dropped, A's kept.
    expect(tension.side_a.quotes).toEqual([QUOTE_A]);
    // side_b: correctly-attributed quote kept.
    expect(tension.side_b.quotes).toEqual([QUOTE_B]);
  });

  it("drops empty / whitespace-only quotes (would otherwise match everything)", () => {
    const anchors = buildAnchorSet([INSIGHT_A]);
    const filtered = applyAnchoredFilter(rawWithTheme(["call_A"], ["   ", QUOTE_A]), anchors);
    expect(filtered.emergent_themes[0].quotes).toEqual([QUOTE_A]);
  });
});
