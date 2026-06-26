import { describe, expect, it } from "vitest";

import {
  deriveKonsoulSignals,
  type KonsoulSignal,
  type KonsoulSignalInputs,
} from "@/lib/konsoul/signals";
import {
  MIN_PERSONA_INTERVIEWS,
  PERSONA_QUALITY_HINT_UNTIL,
} from "@/lib/synthesis/audience-personas";
import type { ResearchPlanRecord } from "@/lib/research/plans-service";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import type { EmergentTheme } from "@/lib/schemas/synthesis";

/**
 * SignalEngine — the deterministic, NO-LLM derivation. These tests drive the
 * PURE entry `deriveKonsoulSignals` with hand-built fixtures (the DI seam), so
 * they need no Supabase and no API key. They assert the honesty contract: every
 * emitted count comes from the input, the persona thresholds are exact, the
 * market-research scope guard drops orphaned/out-of-scope syntheses, recurring
 * themes count DISTINCT studies by TITLE only and emit only at ≥2 (grounded),
 * and the priority sort holds (persona_gate > persona_quality > recurring_theme).
 */

/** Minimal-but-complete ResearchPlanRecord — only id/title/status matter to the
 *  engine; the rest are inert defaults so the fixture type-checks. */
function makePlan(
  over: Partial<ResearchPlanRecord> & Pick<ResearchPlanRecord, "id">,
): ResearchPlanRecord {
  return {
    orgId: "org_1",
    title: `Study ${over.id}`,
    objective: "obj",
    topics: [],
    persona: null,
    sampleTarget: null,
    visualCaptureEnabled: false,
    eventTrackingEnabled: false,
    voiceEnabled: false,
    ttsEnabled: false,
    signalsEnabled: false,
    useCase: null,
    audienceType: "b2b",
    stimulusUrl: null,
    stimulusType: null,
    stimulusDescription: null,
    stimulusAnalysis: null,
    stimulusAnalysisStatus: null,
    screeningQuestions: [],
    studyType: "market_research",
    language: "de",
    maxRounds: null,
    maxDurationSeconds: null,
    interviewDepth: null,
    taskDefinition: null,
    activationState: "none",
    activationMode: "manual",
    scheduledActivationAt: null,
    activatedAt: null,
    activationError: null,
    scheduledByUserId: null,
    scheduledByEmail: null,
    activationReminder24hSentAt: null,
    activationReminder1hSentAt: null,
    status: "active",
    createdAt: new Date("2026-06-24T12:00:00.000Z").toISOString(),
    ...over,
  };
}

function makeTheme(title: string, summary = "Zusammenfassung."): EmergentTheme {
  return { title, summary, frequency: 1, sourceInsightIds: ["x"], quotes: [] };
}

function makeSynthesis(
  over: Partial<MissionControlSynthesisInput> &
    Pick<MissionControlSynthesisInput, "studyId" | "basedOnCount">,
): MissionControlSynthesisInput {
  return {
    studyTitle: `Study ${over.studyId}`,
    overview: null,
    emergent_themes: [],
    tensions: [],
    studyType: "market_research",
    ...over,
  };
}

function baseInputs(over: Partial<KonsoulSignalInputs> = {}): KonsoulSignalInputs {
  return { plans: [], syntheses: [], ...over };
}

function byKind(signals: KonsoulSignal[], kind: string): KonsoulSignal[] {
  return signals.filter((s) => s.kind === kind);
}

describe("deriveKonsoulSignals — empty portfolio", () => {
  it("returns no signals when there is nothing to suggest", () => {
    expect(deriveKonsoulSignals(baseInputs())).toEqual([]);
  });
});

describe("persona_gate / persona_quality — exact thresholds", () => {
  it(`below ${MIN_PERSONA_INTERVIEWS} → persona_gate (hard block), carrying the real count`, () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" })],
        syntheses: [makeSynthesis({ studyId: "p1", basedOnCount: 9 })],
      }),
    );
    expect(byKind(signals, "persona_gate")).toHaveLength(1);
    expect(byKind(signals, "persona_quality")).toHaveLength(0);
    const s = byKind(signals, "persona_gate")[0];
    expect(s.count).toBe(9);
    expect(s.grounded).toBe(true);
    expect(s.key).toBe("persona_gate-p1");
    expect(s.evidence).toEqual({
      type: "plan",
      planId: "p1",
      planTitle: "Study p1",
    });
  });

  it(`exactly ${MIN_PERSONA_INTERVIEWS} → persona_quality (10–14 band, not the gate)`, () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" })],
        syntheses: [
          makeSynthesis({ studyId: "p1", basedOnCount: MIN_PERSONA_INTERVIEWS }),
        ],
      }),
    );
    expect(byKind(signals, "persona_gate")).toHaveLength(0);
    expect(byKind(signals, "persona_quality")).toHaveLength(1);
    expect(byKind(signals, "persona_quality")[0].count).toBe(
      MIN_PERSONA_INTERVIEWS,
    );
  });

  it(`exactly ${PERSONA_QUALITY_HINT_UNTIL} → no persona signal (unlocked)`, () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" })],
        syntheses: [
          makeSynthesis({
            studyId: "p1",
            basedOnCount: PERSONA_QUALITY_HINT_UNTIL,
          }),
        ],
      }),
    );
    expect(byKind(signals, "persona_gate")).toHaveLength(0);
    expect(byKind(signals, "persona_quality")).toHaveLength(0);
  });
});

describe("market_research scope guard", () => {
  it("ignores a synthesis whose study is not one of this org's market_research plans", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [], // synthesis references a plan we don't have in scope
        syntheses: [makeSynthesis({ studyId: "ghost", basedOnCount: 3 })],
      }),
    );
    expect(signals).toEqual([]);
  });

  it("out-of-scope syntheses do not contribute to a recurring theme", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" })],
        syntheses: [
          makeSynthesis({
            studyId: "p1",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Onboarding")],
          }),
          // same theme, but its plan is NOT in scope → must NOT lift the count to 2
          makeSynthesis({
            studyId: "ghost",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Onboarding")],
          }),
        ],
      }),
    );
    expect(byKind(signals, "recurring_theme")).toHaveLength(0);
  });
});

describe("recurring_theme — TITLE only, distinct studies, ≥2 grounded", () => {
  it("grounds a theme title present in two studies (case/spelling-folded into one signal)", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" }), makePlan({ id: "p2" })],
        syntheses: [
          makeSynthesis({
            studyId: "p1",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Onboarding-Friction")],
          }),
          makeSynthesis({
            studyId: "p2",
            basedOnCount: 20,
            emergent_themes: [makeTheme("onboarding-friction")],
          }),
        ],
      }),
    );
    const recurring = byKind(signals, "recurring_theme");
    expect(recurring).toHaveLength(1);
    expect(recurring[0].count).toBe(2);
    expect(recurring[0].grounded).toBe(true);
    expect(recurring[0].evidence).toMatchObject({
      type: "theme",
      studyIds: expect.arrayContaining(["p1", "p2"]),
    });
  });

  it("does NOT emit a single-study theme (no false 'recurring' claim)", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" })],
        syntheses: [
          makeSynthesis({
            studyId: "p1",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Pricing-Sensitivity")],
          }),
        ],
      }),
    );
    expect(byKind(signals, "recurring_theme")).toHaveLength(0);
  });

  it("counts a study at most once even if it lists the same theme twice", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "p1" }), makePlan({ id: "p2" })],
        syntheses: [
          makeSynthesis({
            studyId: "p1",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Trust"), makeTheme("trust")],
          }),
          makeSynthesis({
            studyId: "p2",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Trust")],
          }),
        ],
      }),
    );
    const recurring = byKind(signals, "recurring_theme");
    expect(recurring).toHaveLength(1);
    expect(recurring[0].count).toBe(2);
  });
});

describe("priority + sort", () => {
  it("orders persona_gate > persona_quality > recurring_theme and never caps here", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [
          makePlan({ id: "p1" }),
          makePlan({ id: "p2" }),
          makePlan({ id: "p3" }),
          makePlan({ id: "p4" }),
        ],
        syntheses: [
          makeSynthesis({ studyId: "p1", basedOnCount: 6 }), // persona_gate
          makeSynthesis({ studyId: "p2", basedOnCount: 12 }), // persona_quality
          makeSynthesis({
            studyId: "p3",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Speed")],
          }),
          makeSynthesis({
            studyId: "p4",
            basedOnCount: 20,
            emergent_themes: [makeTheme("Speed")],
          }), // recurring_theme (Speed ×2)
        ],
      }),
    );
    const kinds = signals.map((s) => s.kind);
    expect(kinds[0]).toBe("persona_gate");
    expect(kinds[1]).toBe("persona_quality");
    expect(kinds[kinds.length - 1]).toBe("recurring_theme");
    // engine itself does NOT cap — the UI caps to 3
    expect(signals.length).toBe(3);
  });

  it("within persona_gate, a larger interview count sorts first", () => {
    const signals = deriveKonsoulSignals(
      baseInputs({
        plans: [makePlan({ id: "small" }), makePlan({ id: "big" })],
        syntheses: [
          makeSynthesis({ studyId: "small", basedOnCount: 2 }),
          makeSynthesis({ studyId: "big", basedOnCount: 8 }),
        ],
      }),
    );
    const gates = byKind(signals, "persona_gate");
    expect(gates.map((s) => s.count)).toEqual([8, 2]);
  });
});
