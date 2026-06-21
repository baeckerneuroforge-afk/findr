import { describe, expect, it } from "vitest";

import type {
  AudiencePersona,
  AudiencePersonasResult,
  PersonaEvidenceField,
} from "@/lib/schemas/synthesis";
import type { SynthesisInsightInput } from "@/lib/synthesis/prompts";
import { buildAnchorSet } from "@/lib/synthesis/engine";

import {
  applyPersonaAnchoredFilter,
  enforcePartition,
  enrichPersonas,
} from "./audience-personas";

/**
 * Deterministische Tests (kein LLM): treiben den Persona-Anker-Filter, die
 * Partition und die Server-Anreicherung direkt. Belegen die Vertrauens-Layer-
 * Garantien aus der Spec — keine Persona aus n=1, pro-Feld-Belegpflicht (sonst
 * Feld unterdrückt), Cross-Respondent-Block, strikte Partition, ehrliche
 * share% + Coverage.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

function mkInsight(
  id: string,
  opts: {
    evidence?: string[];
    role?: string | null;
    segment?: string | null;
    sentiment?: SynthesisInsightInput["sentiment"];
  } = {},
): SynthesisInsightInput {
  return {
    id,
    summary: null,
    featureRequests: (opts.evidence ?? []).map((e) => ({ evidence: e })),
    painPoints: [],
    themes: [],
    respondentRole: opts.role ?? null,
    respondentSegment: opts.segment ?? null,
    sentiment: opts.sentiment ?? null,
  };
}

function ev(field: PersonaEvidenceField, text: string, ids: string[]) {
  return { field, text, sourceInsightIds: ids };
}

function rawPersona(over: Partial<AudiencePersona>): AudiencePersona {
  return {
    name: "Segment",
    shareCount: 2,
    goals: ["Ziel"],
    pains: ["Schmerz"],
    behavior: ["Verhalten"],
    motivation: "Motiv",
    leadQuote: "leitzitat",
    sourceInsightIds: ["a", "b"],
    evidence: [],
    ...over,
  };
}

const insights = [
  mkInsight("a", {
    evidence: ["quote a one", "quote a two", "quote a three"],
    role: "PM",
    segment: "Enterprise",
    sentiment: "positive",
  }),
  mkInsight("b", {
    evidence: ["quote b one"],
    role: "PM",
    segment: "SMB",
    sentiment: "neutral",
  }),
  mkInsight("c", {
    evidence: ["quote c one"],
    role: "Eng",
    segment: "Enterprise",
    sentiment: "negative",
  }),
];
const anchors = buildAnchorSet(insights);

// ── applyPersonaAnchoredFilter ──────────────────────────────────────────────

describe("applyPersonaAnchoredFilter", () => {
  it("behält belegte Felder und UNTERDRÜCKT Felder ohne verankerte Evidence", () => {
    const raw: AudiencePersonasResult = {
      personas: [
        rawPersona({
          sourceInsightIds: ["a", "b"],
          leadQuote: "quote a three",
          evidence: [
            ev("goal", "quote a one", ["a"]),
            ev("pain", "quote b one", ["b"]),
            // kein behavior-/motivation-Beleg → diese Felder werden unterdrückt
          ],
        }),
      ],
    };
    const [p] = applyPersonaAnchoredFilter(raw, anchors);
    expect(p).toBeDefined();
    expect(p.goals).toEqual(["Ziel"]);
    expect(p.pains).toEqual(["Schmerz"]);
    expect(p.behavior).toEqual([]); // unterdrückt
    expect(p.motivation).toBe(""); // unterdrückt
    expect(p.leadQuote).toBe("quote a three");
    expect(p.sourceInsightIds).toEqual(["a", "b"]);
  });

  it("verwirft eine Persona aus n=1 (Mindest-Mitglieder 2)", () => {
    const raw: AudiencePersonasResult = {
      personas: [
        rawPersona({
          sourceInsightIds: ["a"],
          evidence: [ev("goal", "quote a one", ["a"])],
        }),
      ],
    };
    expect(applyPersonaAnchoredFilter(raw, anchors)).toEqual([]);
  });

  it("entfernt unbekannte IDs; fällt die Persona dadurch unter 2 Mitglieder, wird sie verworfen", () => {
    const raw: AudiencePersonasResult = {
      personas: [
        rawPersona({
          sourceInsightIds: ["a", "zzz"],
          evidence: [ev("goal", "quote a one", ["a"])],
        }),
      ],
    };
    expect(applyPersonaAnchoredFilter(raw, anchors)).toEqual([]);
  });

  it("blockt Cross-Respondent-Zitate und verwirft die Persona bei < 2 Zitaten", () => {
    const raw: AudiencePersonasResult = {
      personas: [
        rawPersona({
          sourceInsightIds: ["a", "b"],
          goals: ["Ziel"],
          pains: [],
          behavior: [],
          motivation: "",
          leadQuote: "quote a one",
          // b's Zitat unter a zitiert → nicht verankert → Evidence fällt →
          // goal-Feld unterdrückt; nur leadQuote bleibt (1 Zitat) → < 2 → weg
          evidence: [ev("goal", "quote b one", ["a"])],
        }),
      ],
    };
    expect(applyPersonaAnchoredFilter(raw, anchors)).toEqual([]);
  });
});

// ── enforcePartition ────────────────────────────────────────────────────────

describe("enforcePartition", () => {
  it("weist eine geteilte Befragte:r der Persona mit stärkerer Evidence zu und verwirft die andere bei Unterschreitung", () => {
    const raw: AudiencePersonasResult = {
      personas: [
        rawPersona({
          name: "P1 (schwächere Evidence für a)",
          sourceInsightIds: ["a", "b"],
          behavior: [],
          motivation: "",
          leadQuote: "quote a one",
          evidence: [
            ev("goal", "quote a one", ["a"]),
            ev("pain", "quote b one", ["b"]),
          ],
        }),
        rawPersona({
          name: "P2 (stärkere Evidence für a)",
          sourceInsightIds: ["a", "c"],
          pains: [],
          motivation: "",
          leadQuote: "quote a two",
          evidence: [
            ev("goal", "quote a two", ["a"]),
            ev("behavior", "quote a three", ["a"]),
          ],
        }),
      ],
    };
    const anchored = applyPersonaAnchoredFilter(raw, anchors);
    expect(anchored).toHaveLength(2); // beide überleben den ersten Filter
    const partitioned = enforcePartition(anchored, anchors);
    // a geht an P2 (2 Evidenzen für a > 1); P1 behält nur b → < 2 → verworfen.
    expect(partitioned).toHaveLength(1);
    expect(partitioned[0].name).toContain("P2");
    expect(partitioned[0].sourceInsightIds.sort()).toEqual(["a", "c"]);
  });
});

// ── enrichPersonas ──────────────────────────────────────────────────────────

describe("enrichPersonas", () => {
  it("erzwingt shareCount, rechnet share% gegen den Live-Count und leitet Labels/Sentiment server-seitig ab", () => {
    const personas: AudiencePersona[] = [
      rawPersona({
        name: "X",
        sourceInsightIds: ["a", "b"],
        evidence: [ev("goal", "quote a one", ["a"])],
      }),
    ];
    const { personas: enriched, summary } = enrichPersonas(
      personas,
      insights,
      10,
    );
    const p = enriched[0];
    expect(p.shareCount).toBe(2);
    expect(p.sharePercent).toBe(20); // 2 / 10
    expect(p.roleLabel).toBe("PM"); // a=PM, b=PM
    expect(p.sentimentDistribution).toEqual({
      positive: 1,
      neutral: 1,
      negative: 0,
      mixed: 0,
      unknown: 0,
    });
    expect(summary).toEqual({
      version: 1,
      totalInsights: 10,
      assigned: 2,
      unassigned: 8,
      qualityHint: true, // 10 < 15
    });
  });
});
