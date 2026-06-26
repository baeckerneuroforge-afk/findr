import { describe, expect, it, vi, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

import type { CrossStudyAgentResult } from "@/lib/schemas/cross-study-agent";
import type { ResearchPlanRecord } from "@/lib/research/plans-service";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import { KonsoulResultSchema } from "@/lib/schemas/konsoul-agent";

/**
 * Konsoul-Orchestrator-Engine — Unit-Tests OHNE echtes Supabase/API.
 *
 * Zwei Naht-Stellen werden injiziert (wie signals.test.ts mit Fixtures fährt):
 *  - der Anthropic-Client wird über vi.mock(@/lib/anthropic/client) durch einen
 *    SCRIPTED Fake ersetzt (eine Queue vorgefertigter Message-Antworten), sodass
 *    der Loop deterministisch läuft;
 *  - das Read-Toolset (KonsoulReadToolset) + der CrossStudyDelegate werden direkt
 *    an runKonsoulAgentWith übergeben (DI), sodass kein DB-Read passiert.
 *
 * Geprüft: deterministische Tools (buildPortfolioFacts/pickStudyFacts inkl.
 * null→"—"), kind-Labeling aus dem Tool-Pfad, Opus-Pin (Delegate OHNE model),
 * Zahlen-Guard (data byte-genau, vom Modell-Text unabhängig), fail-closed, und
 * der PII-Negativtest auf die gebundene Tool-Liste.
 */

// ── Scripted Anthropic-Fake ──────────────────────────────────────────────────

/** Queue der Antworten, die der Fake-Client nacheinander zurückgibt. */
let scriptedResponses: Anthropic.Message[] = [];
let createCalls: Anthropic.MessageCreateParamsNonStreaming[] = [];
let createImpl: (() => Anthropic.Message) | null = null;

vi.mock("@/lib/anthropic/client", () => ({
  CLAUDE_MODELS: {
    opus: "claude-opus-4-8",
    sonnet: "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5-20251001",
  },
  DEFAULT_MODEL: "claude-sonnet-4-6",
  getAnthropicClient: () => ({
    messages: {
      create: (params: Anthropic.MessageCreateParamsNonStreaming) => {
        createCalls.push(params);
        if (createImpl) return Promise.resolve(createImpl());
        const next = scriptedResponses.shift();
        if (!next) throw new Error("scripted response queue empty");
        return Promise.resolve(next);
      },
    },
  }),
}));

import {
  runKonsoulAgentWith,
  mapCrossStudyToKonsoul,
  KonsoulAgentUnavailableError,
  KONSOUL_ORCHESTRATOR_MODEL,
  type CrossStudyDelegate,
} from "./engine";
import {
  buildPortfolioFacts,
  pickStudyFacts,
  formatPortfolioFactsForTool,
  resolveHelpTopicKey,
  KONSOUL_TOOL_DEFS,
  type KonsoulReadToolset,
} from "./tools";
import type { PortfolioFacts } from "@/lib/schemas/konsoul-agent";

// ── Message-Bausteine (Anthropic.Message-Form) ───────────────────────────────

let toolUseId = 0;
function toolUseMsg(name: string, input: unknown): Anthropic.Message {
  toolUseId += 1;
  return {
    id: `msg_${toolUseId}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage,
    content: [
      {
        type: "tool_use",
        id: `tu_${toolUseId}`,
        name,
        input: input as Record<string, unknown>,
      },
    ],
  } as Anthropic.Message;
}

function textMsg(text: string): Anthropic.Message {
  toolUseId += 1;
  return {
    id: `msg_${toolUseId}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage,
    content: [{ type: "text", text }],
  } as Anthropic.Message;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makePlan(
  over: Partial<ResearchPlanRecord> & Pick<ResearchPlanRecord, "id" | "title">,
): ResearchPlanRecord {
  return {
    orgId: "org_1",
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
    status: "active",
    createdAt: "2026-06-24T12:00:00.000Z",
    ...over,
  };
}

function makeSynth(
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

/** Fixed PortfolioFacts → fakes the read-toolset deterministically. */
function fakeToolset(portfolio: PortfolioFacts): KonsoulReadToolset {
  return {
    getPortfolioFacts: async () => portfolio,
    getStudyFacts: async (studyId) => pickStudyFacts(portfolio, studyId),
  };
}

const PORTFOLIO: PortfolioFacts = buildPortfolioFacts({
  plans: [
    makePlan({ id: "p1", title: "Onboarding", status: "active" }),
    makePlan({ id: "p2", title: "Pricing", status: "completed" }),
  ],
  syntheses: [makeSynth({ studyId: "p2", basedOnCount: 12 })],
  completedByPlan: new Map([
    ["p1", 3],
    ["p2", 12],
  ]),
  poolSize: 7,
  signals: [],
});

/** A delegate spy whose result is configurable per test. */
function makeDelegate(
  result: CrossStudyAgentResult,
): { fn: CrossStudyDelegate; calls: unknown[] } {
  const calls: unknown[] = [];
  const fn: CrossStudyDelegate = async (args) => {
    calls.push(args);
    return result;
  };
  return { fn, calls };
}

beforeEach(() => {
  scriptedResponses = [];
  createCalls = [];
  createImpl = null;
});

// ── Deterministic tools ──────────────────────────────────────────────────────

describe("buildPortfolioFacts — deterministic, no estimation", () => {
  it("composes per-study status + counts + pool, hasSynthesis flags", () => {
    expect(PORTFOLIO.scope).toBe("portfolio");
    expect(PORTFOLIO.poolSize).toBe(7);
    expect(PORTFOLIO.studies).toHaveLength(2);
    const p1 = PORTFOLIO.studies.find((s) => s.studyId === "p1")!;
    const p2 = PORTFOLIO.studies.find((s) => s.studyId === "p2")!;
    expect(p1.completedSessions).toBe(3);
    expect(p1.hasSynthesis).toBe(false);
    expect(p2.completedSessions).toBe(12);
    expect(p2.hasSynthesis).toBe(true);
    expect(p2.basedOnCount).toBe(12);
  });

  it("completedSessions:null when the batch read failed → renders '—', never 0", () => {
    const facts = buildPortfolioFacts({
      plans: [makePlan({ id: "p1", title: "X" })],
      syntheses: [],
      completedByPlan: null, // read error
      poolSize: 0,
      signals: [],
    });
    expect(facts.studies[0].completedSessions).toBeNull();
    expect(formatPortfolioFactsForTool(facts)).toContain("=—");
    expect(formatPortfolioFactsForTool(facts)).not.toContain("=0");
  });

  it("get_study_status projection carries flags/counts, NO synthesis prose", () => {
    const study = pickStudyFacts(PORTFOLIO, "p2");
    expect(study).not.toBeNull();
    expect(study!.scope).toBe("study");
    expect(study!.studies).toHaveLength(1);
    expect(study!.studies[0].studyId).toBe("p2");
    // The fact block is pure flags/counts — no quote/overview field exists on it.
    expect(JSON.stringify(study)).not.toContain("overview");
    expect(JSON.stringify(study)).not.toContain("quote");
  });

  it("pickStudyFacts returns null for an unknown / foreign-org studyId", () => {
    expect(pickStudyFacts(PORTFOLIO, "nope")).toBeNull();
  });
});

// ── kind-labeling from the cross-study mapping (pure) ─────────────────────────

describe("mapCrossStudyToKonsoul — kind set deterministically from result", () => {
  it("answered:true, interpretation:'' → grounded", () => {
    const r = mapCrossStudyToKonsoul({
      answered: true,
      answer: "A",
      citations: [{ studyId: "p1", quote: "q" }],
      interpretation: "",
    });
    expect(r.kind).toBe("grounded");
    if (r.kind === "grounded") expect(r.citations).toHaveLength(1);
  });

  it("answered:true, interpretation:'x' → interpretation", () => {
    const r = mapCrossStudyToKonsoul({
      answered: true,
      answer: "A",
      citations: [{ studyId: "p1", quote: "q" }],
      interpretation: "soft trend",
    });
    expect(r.kind).toBe("interpretation");
    if (r.kind === "interpretation") expect(r.interpretation).toBe("soft trend");
  });

  it("answered:false → refusal with empty citations", () => {
    const r = mapCrossStudyToKonsoul({
      answered: false,
      answer: "keine Evidenz",
      citations: [],
      interpretation: "",
    });
    expect(r.kind).toBe("refusal");
    if (r.kind === "refusal") expect(r.citations).toEqual([]);
  });
});

// ── Loop: help path → guidance (no citations) ────────────────────────────────

describe("runKonsoulAgentWith — help path emits guidance", () => {
  it("get_help then emit_guidance → kind:guidance, sources set, no citations", async () => {
    scriptedResponses = [
      toolUseMsg("get_help", { topicKey: "synthesis.howto" }),
      toolUseMsg("emit_guidance", { answer: "So erstellst du die Synthese." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(
      fakeToolset(PORTFOLIO),
      fn,
      { orgId: "org_1", question: "Wie erstelle ich eine Synthese?" },
    );
    expect(KonsoulResultSchema.safeParse(result).success).toBe(true);
    expect(result.kind).toBe("guidance");
    if (result.kind === "guidance") {
      expect(result.sources).toEqual(["synthesis.howto"]);
      expect("citations" in result).toBe(false);
      expect(result.data).toBeUndefined();
    }
  });
});

// ── Loop: portfolio path → guidance with deterministic data ──────────────────

describe("runKonsoulAgentWith — portfolio path: number guard", () => {
  it("attaches deterministic data; a wrong model number cannot mutate data", async () => {
    scriptedResponses = [
      toolUseMsg("get_portfolio_overview", {}),
      // Model writes a WRONG number in prose (999) — data must stay truthful.
      toolUseMsg("emit_guidance", { answer: "Du hast 999 Interviews." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(
      fakeToolset(PORTFOLIO),
      fn,
      { orgId: "org_1", question: "Wie steht mein Portfolio?" },
    );
    expect(result.kind).toBe("guidance");
    if (result.kind === "guidance") {
      // data is byte-identical to the tool result, regardless of model prose.
      expect(result.data).toEqual(PORTFOLIO);
      const p1 = result.data!.studies.find((s) => s.studyId === "p1")!;
      expect(p1.completedSessions).toBe(3); // not 999
    }
  });
});

// ── Loop: delegation short-circuit + Opus-pin ────────────────────────────────

describe("runKonsoulAgentWith — delegation is terminal + Opus-pinned", () => {
  it("delegate_cross_study short-circuits to the mapped cross-study result", async () => {
    scriptedResponses = [
      toolUseMsg("delegate_cross_study", { question: "Welche Themen?" }),
      // A second (never-used) response proves we short-circuit (no more turns).
      toolUseMsg("emit_guidance", { answer: "unreachable" }),
    ];
    const { fn, calls } = makeDelegate({
      answered: true,
      answer: "Onboarding dominiert.",
      citations: [{ studyId: "p2", quote: "Onboarding ist hart" }],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(
      fakeToolset(PORTFOLIO),
      fn,
      { orgId: "org_1", question: "Welche Themen tauchen auf?" },
    );
    expect(result.kind).toBe("grounded");
    // Exactly ONE model turn happened before delegation (short-circuit).
    expect(createCalls).toHaveLength(1);
    // The delegate was called with orgId+question, and NO model field exists on
    // the delegate args — the Konsoul Sonnet model is never forwarded → Opus-pin.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      orgId: "org_1",
      question: "Welche Themen?",
      history: undefined,
    });
    expect(Object.keys(calls[0] as object)).not.toContain("model");
    // The single Konsoul model call used Sonnet, never Opus.
    expect(createCalls[0].model).toBe(KONSOUL_ORCHESTRATOR_MODEL);
    expect(createCalls[0].model).toBe("claude-sonnet-4-6");
  });

  it("never sends a temperature param (Opus would 400)", async () => {
    scriptedResponses = [
      toolUseMsg("get_help", { topicKey: "study.create" }),
      toolUseMsg("emit_guidance", { answer: "Lege eine Studie an." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    await runKonsoulAgentWith(fakeToolset(PORTFOLIO), fn, {
      orgId: "org_1",
      question: "Wie lege ich eine Studie an?",
    });
    for (const c of createCalls) {
      expect("temperature" in c).toBe(false);
    }
  });
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

describe("runKonsoulAgentWith — fail-closed", () => {
  it("transport error → KonsoulAgentUnavailableError, never ungrounded content", async () => {
    createImpl = () => {
      throw new Error("network down");
    };
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    await expect(
      runKonsoulAgentWith(fakeToolset(PORTFOLIO), fn, {
        orgId: "org_1",
        question: "Status?",
      }),
    ).rejects.toBeInstanceOf(KonsoulAgentUnavailableError);
  });

  it("delegation transport error → KonsoulAgentUnavailableError", async () => {
    scriptedResponses = [
      toolUseMsg("delegate_cross_study", { question: "Themen?" }),
    ];
    const failing: CrossStudyDelegate = async () => {
      throw new Error("cross-study down");
    };
    await expect(
      runKonsoulAgentWith(fakeToolset(PORTFOLIO), failing, {
        orgId: "org_1",
        question: "Welche Themen?",
      }),
    ).rejects.toBeInstanceOf(KonsoulAgentUnavailableError);
  });
});

// ── Free-text nudge (no scratchpad leak) ─────────────────────────────────────

describe("runKonsoulAgentWith — free text is never the answer", () => {
  it("a free-text turn is nudged back to tools, then a real emit lands", async () => {
    scriptedResponses = [
      textMsg("Ich denke laut nach…"), // free text — must be ignored as answer
      toolUseMsg("get_help", { topicKey: "interview.depth" }),
      toolUseMsg("emit_guidance", { answer: "Die Tiefe steuert die Schichten." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(fakeToolset(PORTFOLIO), fn, {
      orgId: "org_1",
      question: "Was ist Interview-Tiefe?",
    });
    expect(result.kind).toBe("guidance");
    if (result.kind === "guidance") {
      expect(result.answer).not.toContain("Ich denke laut");
      expect(result.sources).toEqual(["interview.depth"]);
    }
  });
});

// ── Budget exhaustion + degraded paths (forced final emit / is_error) ────────

describe("runKonsoulAgentWith — budget exhaustion + degraded reads", () => {
  it("6 read turns without emit → ONE forced final emit, guidance carries the accumulated data", async () => {
    // STEP_BUDGET=6 read-only turns that never emit/delegate → the loop exhausts
    // and forceFinalGuidance forces exactly one closing emit (the 7th model call).
    scriptedResponses = [
      ...Array.from({ length: 6 }, () =>
        toolUseMsg("get_portfolio_overview", {}),
      ),
      toolUseMsg("emit_guidance", { answer: "Hier ist dein Portfolio." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(fakeToolset(PORTFOLIO), fn, {
      orgId: "org_1",
      question: "Status?",
    });
    expect(result.kind).toBe("guidance");
    if (result.kind === "guidance") {
      // The data accumulated across the reads survives the forced emit verbatim.
      expect(result.data).toEqual(PORTFOLIO);
    }
    expect(createCalls).toHaveLength(7); // 6 loop turns + 1 forced final emit
    expect(KonsoulResultSchema.safeParse(result).success).toBe(true);
  });

  it("budget exhausted AND two invalid forced emits → calm refusal (kind:refusal), no data block", async () => {
    scriptedResponses = [
      ...Array.from({ length: 6 }, () =>
        toolUseMsg("get_portfolio_overview", {}),
      ),
      toolUseMsg("emit_guidance", {}), // invalid: no answer
      toolUseMsg("emit_guidance", {}), // invalid again → fixed, calm refusal
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(fakeToolset(PORTFOLIO), fn, {
      orgId: "org_1",
      question: "Status?",
    });
    expect(result.kind).toBe("refusal");
    if (result.kind === "refusal") {
      expect(result.answered).toBe(false);
      expect(result.citations).toEqual([]);
      // A refusal NEVER carries a portfolio data block (consistent tone channel).
      expect("data" in result).toBe(false);
    }
    expect(createCalls).toHaveLength(8); // 6 loop + 2 forced attempts
  });

  it("get_study_status with an unknown id takes the is_error path, then guidance with no data", async () => {
    scriptedResponses = [
      toolUseMsg("get_study_status", { studyId: "ghost" }),
      toolUseMsg("emit_guidance", { answer: "Diese Studie kenne ich nicht." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(fakeToolset(PORTFOLIO), fn, {
      orgId: "org_1",
      question: "Wie steht Studie ghost?",
    });
    expect(result.kind).toBe("guidance");
    if (result.kind === "guidance") {
      // Unknown id → pickStudyFacts null → is_error tool_result; acc.data unset.
      expect(result.data).toBeUndefined();
    }
  });
});

// ── Help-key resolution (deterministic alias/keyword, no model) ──────────────

describe("resolveHelpTopicKey — deterministic alias/keyword resolution", () => {
  it("an exact corpus key resolves to itself", () => {
    expect(resolveHelpTopicKey("synthesis.howto")).toBe("synthesis.howto");
  });

  it("a keyword alias resolves to its topic key (case-insensitive)", () => {
    expect(resolveHelpTopicKey("Synthese")).toBe("synthesis.howto");
    expect(resolveHelpTopicKey("personas")).toBe("personas.howto");
  });

  it("an unknown string resolves to null (the engine then shows the index)", () => {
    expect(resolveHelpTopicKey("voellig-unbekannt-xyz")).toBeNull();
  });

  it("empty / whitespace resolves to null", () => {
    expect(resolveHelpTopicKey("   ")).toBeNull();
  });
});

// ── PII negative test (static assertion on the bound tool list) ───────────────

describe("KONSOUL_TOOL_DEFS — PII negative test", () => {
  it("binds only read-only portfolio/help/delegate tools, NO PII reads", () => {
    const names = KONSOUL_TOOL_DEFS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "delegate_cross_study",
        "get_help",
        "get_portfolio_overview",
        "get_study_status",
      ].sort(),
    );
    // None of the forbidden participant/PII reads may appear as a tool.
    const forbidden = [
      "list_pool_members",
      "get_pool_member",
      "list_sessions",
      "get_session",
      "transcript",
      "invited",
    ];
    for (const tool of KONSOUL_TOOL_DEFS) {
      for (const bad of forbidden) {
        expect(tool.name).not.toContain(bad);
        expect(JSON.stringify(tool.input_schema)).not.toContain(bad);
      }
    }
  });
});
