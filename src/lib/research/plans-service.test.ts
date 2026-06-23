import { describe, expect, it } from "vitest";

import {
  coerceConversation,
  planToAgentContext,
  resolveStimulusSet,
  type ResearchPlanRecord,
  type ResearchPlanStimulusRecord,
} from "./plans-service";
import type { StimulusAnalysisPayload } from "./stimulus-analysis";

const PAYLOAD: StimulusAnalysisPayload = {
  version: 1,
  model: "claude-opus-4-7",
  generatedAt: "2026-06-10T12:00:00.000Z",
  analysis: {
    layout: "Zentrierte Headline",
    farbwelt: "Blau-dominant",
    bildelemente: ["Produktbild"],
    textImBild: [],
    claimBotschaft: "Schnell startklar",
    gestaltungsentscheidungen: [],
    frageansaetze: [
      "Was fällt Ihnen zuerst auf?",
      "Was verstehen Sie unter der Headline?",
      "Welche Rolle spielt das Produktbild?",
    ],
  },
  textBlock: "Layout/Aufbau: Zentrierte Headline",
};

function plan(overrides: Partial<ResearchPlanRecord>): ResearchPlanRecord {
  return {
    id: "p1",
    orgId: "o1",
    title: "Creative-Test",
    objective: "Verständlichkeit prüfen",
    topics: [],
    persona: null,
    sampleTarget: null,
    status: "draft",
    visualCaptureEnabled: false,
    eventTrackingEnabled: false,
    voiceEnabled: false,
    ttsEnabled: false,
    signalsEnabled: false,
    useCase: "creative_test",
    audienceType: "b2b",
    stimulusUrl: "https://storage.example/stimulus.png",
    stimulusType: "image",
    stimulusDescription: "Anzeige mit blauem CTA",
    stimulusAnalysis: null,
    stimulusAnalysisStatus: null,
    screeningQuestions: [],
    studyType: "market_research",
    language: "de",
    maxRounds: null,
    maxDurationSeconds: null,
    interviewDepth: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("planToAgentContext — stimulus analysis gating", () => {
  it("forwards ONLY the textBlock when the analysis is done", () => {
    const ctx = planToAgentContext(
      plan({ stimulusAnalysis: PAYLOAD, stimulusAnalysisStatus: "done" }),
    );

    expect(ctx.stimulusAnalysis).toBe("Layout/Aufbau: Zentrierte Headline");
    // The raw envelope never reaches the agent context / dealContext snapshot.
    expect(JSON.stringify(ctx)).not.toContain("generatedAt");
    expect(JSON.stringify(ctx)).not.toContain("frageansaetze");
  });

  it.each(["pending", "failed", null] as const)(
    "maps status %s to a null analysis (prompt identical to today)",
    (status) => {
      const ctx = planToAgentContext(
        plan({ stimulusAnalysis: PAYLOAD, stimulusAnalysisStatus: status }),
      );
      expect(ctx.stimulusAnalysis).toBeNull();
    },
  );

  it("maps done-without-payload (defensive) to null", () => {
    const ctx = planToAgentContext(
      plan({ stimulusAnalysis: null, stimulusAnalysisStatus: "done" }),
    );
    expect(ctx.stimulusAnalysis).toBeNull();
  });

  it("keeps every stimulus field out of a product_discovery context", () => {
    const ctx = planToAgentContext(
      plan({
        studyType: "product_discovery",
        stimulusAnalysis: PAYLOAD,
        stimulusAnalysisStatus: "done",
      }),
    );

    expect("stimulusAnalysis" in ctx).toBe(false);
    expect("stimulusDescription" in ctx).toBe(false);
  });
});

describe("planToAgentContext — maxRounds snapshot gating (Paket 1)", () => {
  it("carries maxRounds for a study WITHOUT a stimulus set", () => {
    const ctx = planToAgentContext(plan({ maxRounds: 10 }));
    expect(ctx.maxRounds).toBe(10);
  });

  it("OMITS maxRounds when a stimulus set is present (set ceiling wins)", () => {
    const ctx = planToAgentContext(plan({ maxRounds: 10 }), [
      stimulus({}),
      stimulus({ id: "s2", position: 2, label: "Variante B" }),
    ]);
    // Decision 4: stimulus-set studies keep stimulusSetCeiling, so the manual
    // length must never reach their snapshot.
    expect("maxRounds" in ctx).toBe(false);
  });

  it("omits maxRounds when unset (system-default length)", () => {
    const ctx = planToAgentContext(plan({ maxRounds: null }));
    expect("maxRounds" in ctx).toBe(false);
  });
});

describe("planToAgentContext — interview depth snapshot (Tiefe)", () => {
  const TWO_TOPICS = [
    { topic: "A", intent: "ia" },
    { topic: "B", intent: "ib" },
  ];

  it("carries depth + a topic-aware effective ceiling for a non-set study", () => {
    const ctx = planToAgentContext(
      plan({ interviewDepth: "tief", topics: TWO_TOPICS }),
    );
    expect(ctx.depth).toBe("tief");
    // tief = 4 layers × 2 topics = 8 expected, + 2 buffer = 10 ceiling.
    expect(ctx.maxRounds).toBe(10);
  });

  it("lets an explicit expert maxRounds win over the depth-derived ceiling", () => {
    const ctx = planToAgentContext(
      plan({ interviewDepth: "tief", maxRounds: 5, topics: TWO_TOPICS }),
    );
    expect(ctx.depth).toBe("tief");
    expect(ctx.maxRounds).toBe(5);
  });

  it("omits BOTH depth and maxRounds for a legacy study (null/null → byte-identical)", () => {
    const ctx = planToAgentContext(
      plan({ interviewDepth: null, maxRounds: null, topics: TWO_TOPICS }),
    );
    expect("depth" in ctx).toBe(false);
    expect("maxRounds" in ctx).toBe(false);
  });

  it("OMITS depth (and maxRounds) when a stimulus set is present", () => {
    const ctx = planToAgentContext(
      plan({ interviewDepth: "tief", topics: TWO_TOPICS }),
      [stimulus({}), stimulus({ id: "s2", position: 2, label: "B" })],
    );
    expect("depth" in ctx).toBe(false);
    expect("maxRounds" in ctx).toBe(false);
  });
});

describe("planToAgentContext — maxDurationSeconds snapshot (Paket 2)", () => {
  it("carries maxDurationSeconds for a study WITHOUT a stimulus set", () => {
    const ctx = planToAgentContext(plan({ maxDurationSeconds: 600 }));
    expect(ctx.maxDurationSeconds).toBe(600);
  });

  it("STILL carries maxDurationSeconds WITH a stimulus set (time cap applies to all)", () => {
    const ctx = planToAgentContext(plan({ maxDurationSeconds: 600 }), [
      stimulus({}),
      stimulus({ id: "s2", position: 2, label: "Variante B" }),
    ]);
    // Unlike maxRounds, the time limit is NOT suppressed for set-studies.
    expect(ctx.maxDurationSeconds).toBe(600);
  });

  it("omits maxDurationSeconds when unset (no limit)", () => {
    const ctx = planToAgentContext(plan({ maxDurationSeconds: null }));
    expect("maxDurationSeconds" in ctx).toBe(false);
  });
});

function stimulus(
  overrides: Partial<ResearchPlanStimulusRecord>,
): ResearchPlanStimulusRecord {
  return {
    id: "s1",
    planId: "p1",
    orgId: "o1",
    position: 1,
    stimulusType: "image",
    url: "https://storage.example/s1.png",
    storagePath: "o1/p1/s1.png",
    label: "Variante A",
    description: "Blaues Packaging",
    analysis: null,
    analysisStatus: null,
    createdAt: "2026-06-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("planToAgentContext — Multi-Stimulus-Set (E1)", () => {
  it("is byte-identical with omitted and with empty stimuli (legacy parity)", () => {
    const record = plan({});
    const withoutParam = planToAgentContext(record);
    const withEmpty = planToAgentContext(record, []);

    expect("stimuli" in withoutParam).toBe(false);
    expect(JSON.stringify(withEmpty)).toBe(JSON.stringify(withoutParam));
  });

  it("emits the set in canonical position order with analysis gated on done", () => {
    const ctx = planToAgentContext(plan({}), [
      stimulus({
        id: "s2",
        position: 2,
        label: "Variante B",
        analysis: PAYLOAD,
        analysisStatus: "done",
      }),
      stimulus({ id: "s1", position: 1, analysisStatus: "pending" }),
    ]);

    expect(ctx.stimuli?.map((s) => s.position)).toEqual([1, 2]);
    expect(ctx.stimuli?.[0]).toEqual({
      position: 1,
      type: "image",
      url: "https://storage.example/s1.png",
      label: "Variante A",
      description: "Blaues Packaging",
      analysis: null,
    });
    // done → NUR der textBlock, nie das Roh-Envelope.
    expect(ctx.stimuli?.[1].analysis).toBe(
      "Layout/Aufbau: Zentrierte Headline",
    );
    expect(JSON.stringify(ctx.stimuli)).not.toContain("frageansaetze");
    // Storage-Pfad und DB-Identität bleiben aus dem Agent-Kontext draußen.
    expect(JSON.stringify(ctx.stimuli)).not.toContain("storagePath");
    expect(JSON.stringify(ctx.stimuli)).not.toContain('"id"');
  });

  it("keeps the set out of a product_discovery context", () => {
    const ctx = planToAgentContext(plan({ studyType: "product_discovery" }), [
      stimulus({}),
    ]);
    expect("stimuli" in ctx).toBe(false);
  });
});

describe("resolveStimulusSet — Dual-Read (D1)", () => {
  it("table rows win over the legacy columns, canonically sorted", () => {
    const set = resolveStimulusSet(plan({}), [
      stimulus({ id: "b", position: 2 }),
      // Positions-Duplikat (transient nach Crash) → Tie-Break created_at, id.
      stimulus({ id: "c", position: 1, createdAt: "2026-06-12T11:00:00.000Z" }),
      stimulus({ id: "a", position: 1 }),
    ]);
    expect(set.map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("synthesizes the legacy single asset as a 1-element set", () => {
    const set = resolveStimulusSet(plan({ id: "p9" }), []);
    expect(set).toHaveLength(1);
    expect(set[0]).toMatchObject({
      id: "legacy:p9",
      position: 1,
      stimulusType: "image",
      url: "https://storage.example/stimulus.png",
      description: "Anzeige mit blauem CTA",
      label: null,
      storagePath: null,
    });
  });

  it("does NOT synthesize from a description-only legacy plan (O3)", () => {
    const set = resolveStimulusSet(
      plan({ stimulusUrl: null, stimulusType: null }),
      [],
    );
    expect(set).toEqual([]);
  });

  it("returns an empty set when there is nothing anywhere", () => {
    const set = resolveStimulusSet(
      plan({
        stimulusUrl: null,
        stimulusType: null,
        stimulusDescription: null,
      }),
      [],
    );
    expect(set).toEqual([]);
  });
});

describe("coerceConversation — shownStimulusPosition (E4 Reveal-Marker)", () => {
  it("carries valid markers on agent turns and drops everything else", () => {
    const conversation = coerceConversation([
      { role: "agent", text: "F1?", shownStimulusPosition: 1 },
      { role: "customer", text: "A.", shownStimulusPosition: 2 },
      { role: "agent", text: "F2?", shownStimulusPosition: 0 },
      { role: "agent", text: "F3?", shownStimulusPosition: 2.5 },
      { role: "agent", text: "F4?", why: "x", shownStimulusPosition: 2 },
    ]);
    expect(conversation).toEqual([
      { role: "agent", text: "F1?", shownStimulusPosition: 1 },
      { role: "customer", text: "A." },
      { role: "agent", text: "F2?" },
      { role: "agent", text: "F3?" },
      { role: "agent", text: "F4?", why: "x", shownStimulusPosition: 2 },
    ]);
  });
});

describe("coerceConversation — why-Feld (E3 Frage-Rationale, Forscher-Lesepfad)", () => {
  it("carries why on agent turns and drops it everywhere else", () => {
    const conversation = coerceConversation([
      { role: "agent", text: "Frage?", why: "Einstieg ins leichteste Thema" },
      { role: "customer", text: "Antwort.", why: "darf hier nicht stehen" },
      { role: "agent", text: "Nachfrage?", why: "   " },
      { role: "agent", text: "Dritte Frage?", why: 42 },
      { role: "agent", text: "Vierte Frage?" },
    ]);
    expect(conversation).toEqual([
      { role: "agent", text: "Frage?", why: "Einstieg ins leichteste Thema" },
      { role: "customer", text: "Antwort." },
      { role: "agent", text: "Nachfrage?" },
      { role: "agent", text: "Dritte Frage?" },
      { role: "agent", text: "Vierte Frage?" },
    ]);
  });
});
