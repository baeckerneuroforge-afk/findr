import { describe, expect, it } from "vitest";

import { sealSynthesisExtras } from "@/lib/synthesis/engine";
import {
  aggregateSignalSessions,
  MIN_SIGNAL_AGGREGATE_SESSIONS,
  normalizeSignalsSummary,
  type SignalSessionRow,
} from "@/lib/synthesis/signals";
import { normalizeMethodology } from "@/lib/schemas/synthesis";
import type { TurnSignalsRecord } from "@/lib/schemas/turn-signals";

/**
 * E4 — Tests der PUREN Synthese-Integrations-Schicht: deterministische
 * Aggregation (Zahlen rechnet der Server, nie das Modell), Mindest-N-Gate,
 * Halluzinations-Guards (sealSynthesisExtras) und die lenienten Read-Mapper.
 */

function record(
  turns: Array<{
    directness: "direct" | "partial" | "evasive" | "declined";
    affect?: "enthusiasm" | "interest" | "neutral" | "uncertainty" | "frustration" | "discomfort";
    unansweredAspect?: string | null;
  }>,
): TurnSignalsRecord {
  return {
    version: 1,
    analyzedAt: "2026-06-11T10:00:00.000Z",
    model: "test",
    turns: turns.map((t, i) => ({
      index: i * 2 + 1,
      affect: t.affect ?? "neutral",
      affectIntensity: "low",
      affectEvidence: null,
      directness: t.directness,
      unansweredAspect: t.unansweredAspect ?? null,
      confidence: 0.8,
    })),
    session: { affectArc: "…", evasiveCount: 0, directCount: 0 },
  };
}

const signalRow = (
  turns: Parameters<typeof record>[0],
  whys: string[] = [],
): SignalSessionRow => ({ turnSignals: record(turns), whys });

describe("aggregateSignalSessions — Mindest-N (Plan §4.7/§7)", () => {
  it("returns no signals block below the minimum session count", () => {
    const rows: SignalSessionRow[] = [
      signalRow([{ directness: "direct" }]),
      signalRow([{ directness: "evasive" }]),
    ];
    expect(rows.length).toBeLessThan(MIN_SIGNAL_AGGREGATE_SESSIONS);
    const result = aggregateSignalSessions(rows);
    expect(result.signals).toBeNull();
  });

  it("keeps rationales independent of the minimum (methodology describes the interviewer, not persons)", () => {
    const result = aggregateSignalSessions([
      signalRow([{ directness: "direct" }], ["Einstieg ins leichteste Thema"]),
    ]);
    expect(result.signals).toBeNull();
    expect(result.rationales).toEqual([
      { sessionLabel: "S1", rationales: ["Einstieg ins leichteste Thema"] },
    ]);
    expect(result.rationaleCoverage).toEqual({
      withRationales: 1,
      totalSessions: 1,
    });
  });
});

describe("aggregateSignalSessions — deterministische Zählung", () => {
  it("counts directness, affects and open aspects across sessions", () => {
    const rows: SignalSessionRow[] = [
      signalRow(
        [
          { directness: "direct", affect: "enthusiasm" },
          { directness: "evasive", affect: "uncertainty", unansweredAspect: "Preisrahmen" },
        ],
        ["Vertiefung Preis"],
      ),
      signalRow([
        { directness: "direct" },
        { directness: "declined", unansweredAspect: "Budget" },
      ]),
      signalRow([{ directness: "partial", affect: "uncertainty", unansweredAspect: "Zeitplan" }]),
      // Session ohne Signal-Befund zählt zur Betrachtungsmenge, nicht zu den Zahlen.
      { turnSignals: null, whys: [] },
    ];
    const { signals, rationaleCoverage } = aggregateSignalSessions(rows);
    expect(signals).not.toBeNull();
    expect(signals?.summary).toMatchObject({
      version: 1,
      totalSessions: 4,
      signalSessions: 3,
      totalAnswers: 5,
      direct: 2,
      partial: 1,
      evasive: 1,
      declined: 1,
      whySessions: 1,
      affects: { enthusiasm: 1, uncertainty: 2 },
    });
    expect(signals?.openAspects).toEqual(["Preisrahmen", "Budget", "Zeitplan"]);
    expect(rationaleCoverage).toEqual({ withRationales: 1, totalSessions: 4 });
  });
});

describe("sealSynthesisExtras — Halluzinations-Guards", () => {
  const base = {
    overview: "…",
    emergent_themes: [],
    tensions: [],
    methodology: {
      summary: "Der Interviewer steuerte …",
      themes: [],
      coverageNote: null,
    },
    signal_observations: ["4 von 12 Antworten wichen aus."],
  };

  it("nulls methodology when no rationales were supplied", () => {
    const sealed = sealSynthesisExtras(base, true, false);
    expect(sealed.methodology).toBeNull();
    expect(sealed.signal_observations).toHaveLength(1);
  });

  it("empties signal_observations when no signals block was supplied", () => {
    const sealed = sealSynthesisExtras(base, false, true);
    expect(sealed.signal_observations).toEqual([]);
    expect(sealed.methodology).not.toBeNull();
  });
});

describe("lenient read-mappers", () => {
  it("normalizeSignalsSummary passes a well-formed v1 and rejects the rest", () => {
    const ok = normalizeSignalsSummary({
      version: 1,
      totalSessions: 4,
      signalSessions: 3,
      totalAnswers: 5,
      direct: 2,
      partial: 1,
      evasive: 1,
      declined: 1,
      affects: { uncertainty: 2, bogus: 9 },
      whySessions: 1,
    });
    expect(ok?.signalSessions).toBe(3);
    expect(ok?.affects).toEqual({ uncertainty: 2 });
    expect(normalizeSignalsSummary(null)).toBeNull();
    expect(normalizeSignalsSummary({ version: 2 })).toBeNull();
    expect(normalizeSignalsSummary("garbage")).toBeNull();
  });

  it("normalizeMethodology keeps well-formed rows and drops malformed themes", () => {
    const ok = normalizeMethodology({
      summary: "Steuerung …",
      themes: [
        { topic: "Preis", rationale: "Erstnennung vertieft" },
        { topic: 42, rationale: "kaputt" },
      ],
      coverageNote: "4 von 9",
    });
    expect(ok?.themes).toEqual([
      { topic: "Preis", rationale: "Erstnennung vertieft" },
    ]);
    expect(ok?.coverageNote).toBe("4 von 9");
    expect(normalizeMethodology(null)).toBeNull();
    expect(normalizeMethodology({ summary: "" })).toBeNull();
    expect(normalizeMethodology([])).toBeNull();
  });
});
