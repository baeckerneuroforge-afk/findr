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

// P3: the propose-action terminal path fires logProposed → createResearchSupabase.
// Fake the research-Supabase so the audit write is captured (and asserts the
// metadata-only contract from the engine side) without touching a real DB.
let auditInserts: Record<string, unknown>[] = [];
vi.mock("@/lib/research/db", () => ({
  createResearchSupabase: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        auditInserts.push(row);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: "audit_test" }, error: null }),
          }),
        };
      },
    }),
  }),
}));

import {
  runKonsoulAgentWith,
  mapCrossStudyToKonsoul,
  buildProposalFromArgs,
  KonsoulAgentUnavailableError,
  KONSOUL_ORCHESTRATOR_MODEL,
  type CrossStudyDelegate,
} from "./engine";
import {
  buildPortfolioFacts,
  buildCalendarFacts,
  formatCalendarFactsForTool,
  pickStudyFacts,
  formatPortfolioFactsForTool,
  resolveHelpTopicKey,
  konsoulToolDefs,
  KONSOUL_TOOL_DEFS,
  GET_CALENDAR_CONTEXT_TOOL,
  PROPOSE_ACTION_TOOL,
  PROPOSE_ACTION_TOOL_NAME,
  KONSOUL_PROPOSE_ACTION_TYPES,
  type KonsoulReadToolset,
} from "./tools";
import { COUNTS_KEY_WHITELIST } from "./action-audit";
import type {
  PortfolioFacts,
  CalendarFacts,
} from "@/lib/schemas/konsoul-agent";

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

/** Fixed PortfolioFacts (+ optional CalendarFacts) → fakes the read-toolset
 *  deterministically. */
function fakeToolset(
  portfolio: PortfolioFacts,
  calendar: CalendarFacts = {
    scope: "calendar",
    studies: [],
    unscheduledDrafts: 0,
    scheduledCount: 0,
    overdueCount: 0,
  },
): KonsoulReadToolset {
  return {
    getPortfolioFacts: async () => portfolio,
    getStudyFacts: async (studyId) => pickStudyFacts(portfolio, studyId),
    getCalendarFacts: async () => calendar,
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
  auditInserts = [];
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
      const portfolio = result.data as PortfolioFacts;
      const p1 = portfolio.studies.find((s) => s.studyId === "p1")!;
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

// ── P3 PII negative test (Review-AUFLAGE 2) — the ACTIVE-flag tool surface ─────
//
// Bei AKTIVEM Aktions-Flag bietet der Loop GENAU die vier read-only Tools PLUS
// `propose_action` an — und NICHTS Teilnehmer-/Geld-/Versand-nahes. Diese Liste
// wird hier exakt festgenagelt (toEqual), der propose_action.actionType-Enum
// exakt auf die vier erlaubten Aktionen, und KEIN Tool-Name/input_schema darf
// einen der verbotenen Verben-Substrings tragen (Name UND Schema geprüft).
describe("konsoulToolDefs(true) — P3 action-tool allowlist (AUFLAGE 2)", () => {
  const activeDefs = konsoulToolDefs(true);

  it("the active-flag surface is EXACTLY the 4 reads + propose_action (toEqual)", () => {
    const names = activeDefs.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "get_portfolio_overview",
        "get_study_status",
        "get_help",
        "delegate_cross_study",
        "propose_action",
      ].sort(),
    );
    // propose_action is the ONE additive tool over the P2 read set.
    expect(names).toHaveLength(5);
    expect(activeDefs).toContain(PROPOSE_ACTION_TOOL);
    expect(PROPOSE_ACTION_TOOL.name).toBe(PROPOSE_ACTION_TOOL_NAME);
  });

  it("propose_action.actionType enum is EXACTLY the 4 allowed actions (toEqual)", () => {
    const schema = PROPOSE_ACTION_TOOL.input_schema as {
      properties?: { actionType?: { enum?: string[] } };
    };
    const actionEnum = schema.properties?.actionType?.enum ?? [];
    expect([...actionEnum].sort()).toEqual(
      ["create_study_draft", "run_synthesis", "run_personas", "run_guide"].sort(),
    );
    // The enum is sourced from the single allowlist constant.
    expect([...actionEnum].sort()).toEqual(
      [...KONSOUL_PROPOSE_ACTION_TYPES].sort(),
    );
    // No forbidden action ever appears in the enum.
    for (const a of actionEnum) {
      expect(a).not.toMatch(
        /publish|invite|pool|open[-_]?link|send|screening|quota|stimulus|share|participant/i,
      );
    }
  });

  it("NO tool NAME carries a forbidden participant/money/send verb, and the action tool's input_schema is clean", () => {
    // The hard red lines: nothing publish/Prolific, invite, invite-from-pool,
    // open-link, pool, send, screening, quota, stimulus, share, participant.
    //
    // Two checks with the right scope:
    //  - NO offered tool may be NAMED with a forbidden verb (the capability never
    //    exists as a tool — fail-closed Whitelist).
    //  - The ACTION tool (propose_action) — the only model-controllable mutation
    //    surface — must carry none of these verbs in its input_schema either
    //    (name AND schema, per AUFLAGE 2). (The read tools' help descriptions may
    //    legitimately *document* how-to topics like 'pool.invite'; that's the P2
    //    read-only surface already guarded by the PII negative test above, and
    //    nothing there is an action.)
    const forbiddenSubstrings = [
      "publish",
      "invite",
      "invite-from-pool",
      "open-link",
      "open_link",
      "openlink",
      "pool",
      "send",
      "screening",
      "quota",
      "stimulus",
      "share",
      "participant",
    ];
    for (const tool of activeDefs) {
      const haystackName = tool.name.toLowerCase();
      for (const bad of forbiddenSubstrings) {
        expect(
          haystackName.includes(bad),
          `tool name '${tool.name}' contains forbidden '${bad}'`,
        ).toBe(false);
      }
    }
    // The action tool's full input_schema is held to the stricter standard.
    const actionSchema = JSON.stringify(
      PROPOSE_ACTION_TOOL.input_schema,
    ).toLowerCase();
    for (const bad of forbiddenSubstrings) {
      expect(
        actionSchema.includes(bad),
        `propose_action input_schema contains forbidden '${bad}'`,
      ).toBe(false);
    }
  });

  it("flag OFF → konsoulToolDefs(false) is byte-identical to the P2 read set (no propose_action)", () => {
    const offDefs = konsoulToolDefs(false);
    expect(offDefs).toEqual(KONSOUL_TOOL_DEFS);
    expect(offDefs.map((t) => t.name)).not.toContain("propose_action");
  });
});

// ── P3 propose_action — engine terminal behavior + studyId validation ─────────

/** A portfolio with a synthesized+personas'd study (p2) and a bare study (p1),
 *  so destructive/precondition can be exercised deterministically. */
const P3_PORTFOLIO: PortfolioFacts = buildPortfolioFacts({
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
  hasPersonasByPlan: new Map([
    ["p1", false],
    ["p2", true],
  ]),
});

describe("buildProposalFromArgs — deterministic, validates studyId, no execution", () => {
  it("create_study_draft → non-destructive, LLM-free, no studyId required", () => {
    const out = buildProposalFromArgs(
      { actionType: "create_study_draft", studyTitle: "Neue Pricing-Studie" },
      P3_PORTFOLIO,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposal.actionType).toBe("create_study_draft");
      expect(out.proposal.destructive).toBe(false);
      expect(out.proposal.costsModel).toBe(false);
      expect(out.proposal.targetTitle).toBe("Neue Pricing-Studie");
      expect(out.proposal.targetStudyId).toBeUndefined();
    }
  });

  it("run_synthesis on a study WITH a synthesis → destructive:true, costs a model run", () => {
    const out = buildProposalFromArgs(
      { actionType: "run_synthesis", studyId: "p2" },
      P3_PORTFOLIO,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposal.destructive).toBe(true); // re-run replaces existing
      expect(out.proposal.costsModel).toBe(true);
      expect(out.proposal.targetStudyId).toBe("p2");
      expect(out.proposal.precondition?.basedOnCount).toBe(12);
    }
  });

  it("run_personas on a study WITHOUT personas → destructive:false (first-time)", () => {
    const out = buildProposalFromArgs(
      { actionType: "run_personas", studyId: "p1" },
      P3_PORTFOLIO,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposal.destructive).toBe(false);
      expect(out.proposal.targetStudyId).toBe("p1");
    }
  });

  it("run_personas on a study WITH personas → destructive:true (re-run replaces them)", () => {
    const out = buildProposalFromArgs(
      { actionType: "run_personas", studyId: "p2" }, // p2 hasPersonas:true
      P3_PORTFOLIO,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.proposal.destructive).toBe(true);
  });

  it("run_personas in PRODUCTION (no hasPersonas flag) but WITH a synthesis → destructive:true (conservative fallback, never a silent overwrite)", () => {
    // Mirrors makeKonsoulReadTools when the persona-presence read fails: the
    // portfolio carries NO hasPersonasByPlan → fact.hasPersonas is undefined. A
    // synthesized study could already have personas, so we must warn strongly
    // rather than show the light first-time card.
    const prodLike = buildPortfolioFacts({
      plans: [makePlan({ id: "s1", title: "Checkout", status: "completed" })],
      syntheses: [makeSynth({ studyId: "s1", basedOnCount: 14 })],
      completedByPlan: new Map([["s1", 14]]),
      poolSize: 0,
      signals: [],
      // NOTE: hasPersonasByPlan deliberately omitted (production read-fail path).
    });
    const out = buildProposalFromArgs(
      { actionType: "run_personas", studyId: "s1" },
      prodLike,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposal.precondition?.hasPersonas).toBeUndefined();
      expect(out.proposal.destructive).toBe(true);
    }
  });

  it("a FOREIGN / hallucinated studyId is rejected → NO proposal, a nudge instead", () => {
    const out = buildProposalFromArgs(
      { actionType: "run_synthesis", studyId: "ghost-from-another-org" },
      P3_PORTFOLIO,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.nudge).toMatch(/Portfolio|get_portfolio_overview/i);
    }
  });

  it("a run_* action with NO studyId is rejected → NO proposal", () => {
    const out = buildProposalFromArgs({ actionType: "run_guide" }, P3_PORTFOLIO);
    expect(out.ok).toBe(false);
  });

  it("an unknown actionType (outside the 4-allowlist) is rejected → NO proposal", () => {
    const out = buildProposalFromArgs(
      { actionType: "publish_prolific", studyId: "p2" },
      P3_PORTFOLIO,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.nudge).toMatch(/create_study_draft/);
  });
});

describe("runKonsoulAgentWith — P3 propose_action is terminal (1 turn, no execute)", () => {
  it("flag ON: get_portfolio_overview then propose_action → kind:proposal, ONE model turn after the read, NO execution", async () => {
    scriptedResponses = [
      toolUseMsg("get_portfolio_overview", {}),
      toolUseMsg("propose_action", {
        actionType: "run_synthesis",
        studyId: "p2",
        rationale: "Pricing hat 12 Interviews — Zeit für die Synthese.",
      }),
      // A never-used response proves the loop terminates at the proposal.
      toolUseMsg("emit_guidance", { answer: "unreachable" }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(
      fakeToolset(P3_PORTFOLIO),
      fn,
      { orgId: "org_1", question: "Starte die Synthese für Pricing." },
      "de",
      KONSOUL_ORCHESTRATOR_MODEL,
      true, // actionsEnabled
    );
    expect(KonsoulResultSchema.safeParse(result).success).toBe(true);
    expect(result.kind).toBe("proposal");
    if (result.kind === "proposal") {
      expect(result.proposal.actionType).toBe("run_synthesis");
      expect(result.proposal.targetStudyId).toBe("p2");
      expect(result.proposal.destructive).toBe(true);
      expect(result.rationale).toContain("Synthese");
      // Belegter Kontext reist mit, aber NIE Zitate (proposal trägt kein citations).
      expect(result.data).toBeDefined();
      expect("citations" in result).toBe(false);
      // Die auditId aus logProposed reist im Envelope mit → der Confirm-/Dismiss-
      // Beacon kann GENAU diese proposed-Zeile auf accepted/ignored setzen.
      expect(result.auditId).toBe("audit_test");
    }
    // Exactly the read turn + the propose turn ran — the 3rd scripted response
    // (emit_guidance 'unreachable') is never consumed → terminal proposal.
    expect(createCalls).toHaveLength(2);
    // Audit-Schreibung #1 happened ('proposed', metadata only) — the engine
    // logs the proposal BEFORE any execution. Execution itself NEVER happens here.
    expect(auditInserts).toHaveLength(1);
    const row = auditInserts[0];
    expect(row.status).toBe("proposed");
    expect(row.action_type).toBe("run_synthesis");
    expect(row.org_id).toBe("org_1");
    // The audit row carries NO free text — only whitelisted count keys.
    const counts = row.counts as Record<string, unknown>;
    for (const k of Object.keys(counts)) {
      expect(COUNTS_KEY_WHITELIST as readonly string[]).toContain(k);
    }
    expect(JSON.stringify(row)).not.toContain("Zeit für die Synthese");
  });

  it("flag ON: a hallucinated studyId → is_error + nudge, NEVER a proposal; the model can then emit an honest guidance", async () => {
    scriptedResponses = [
      toolUseMsg("get_portfolio_overview", {}),
      toolUseMsg("propose_action", {
        actionType: "run_synthesis",
        studyId: "does-not-exist",
        rationale: "Synthese starten.",
      }),
      // After the is_error nudge the model honestly declines via guidance.
      toolUseMsg("emit_guidance", { answer: "Diese Studie kenne ich nicht." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(
      fakeToolset(P3_PORTFOLIO),
      fn,
      { orgId: "org_1", question: "Starte die Synthese für Studie zzz." },
      "de",
      KONSOUL_ORCHESTRATOR_MODEL,
      true,
    );
    // Foreign id NEVER becomes a proposal — it degrades to honest guidance.
    expect(result.kind).toBe("guidance");
    expect(result.kind).not.toBe("proposal");
    // And NOTHING was audited (no proposal was ever built).
    expect(auditInserts).toHaveLength(0);
  });

  it("flag OFF: propose_action is NOT offered → kind is NEVER 'proposal' (P2 read-only behavior)", async () => {
    // Even if the (mis-scripted) model tried propose_action, the engine never
    // offered it and never processes it → it falls into the generic is_error
    // path and the run resolves as guidance, never a proposal.
    scriptedResponses = [
      toolUseMsg("get_portfolio_overview", {}),
      toolUseMsg("emit_guidance", { answer: "Dein Portfolio steht." }),
    ];
    const { fn } = makeDelegate({
      answered: false,
      answer: "x",
      citations: [],
      interpretation: "",
    });
    const result = await runKonsoulAgentWith(
      fakeToolset(P3_PORTFOLIO),
      fn,
      { orgId: "org_1", question: "Wie steht mein Portfolio?" },
      "de",
      KONSOUL_ORCHESTRATOR_MODEL,
      false, // actionsEnabled = OFF
    );
    expect(result.kind).not.toBe("proposal");
    expect(result.kind).toBe("guidance");
    // The offered tool set on every call excluded propose_action.
    for (const call of createCalls) {
      const names = (call.tools ?? []).map((t) => t.name);
      expect(names).not.toContain("propose_action");
    }
    // Nothing was ever audited (no proposal path with the flag off).
    expect(auditInserts).toHaveLength(0);
  });
});

// ── Konsoul im Kalender (get_calendar_context + schedule_activation) ──────────

describe("buildCalendarFacts — deterministic calendar snapshot", () => {
  const NOW = Date.parse("2026-07-01T12:00:00.000Z");

  it("derives per-study activation + counts (unscheduled/scheduled/overdue)", () => {
    const plans = [
      makePlan({ id: "d1", title: "Draft 1", status: "draft", activationState: "none" }),
      makePlan({
        id: "s1",
        title: "Scheduled",
        status: "draft",
        activationState: "scheduled",
        scheduledActivationAt: "2026-07-05T09:00:00.000Z", // future
      }),
      makePlan({
        id: "o1",
        title: "Overdue",
        status: "draft",
        activationState: "scheduled",
        scheduledActivationAt: "2026-06-20T09:00:00.000Z", // past → overdue
      }),
      makePlan({
        id: "a1",
        title: "Live",
        status: "active",
        activationState: "activated",
        activatedAt: "2026-06-25T09:00:00.000Z",
      }),
    ];
    const f = buildCalendarFacts(plans, NOW);
    expect(f.scope).toBe("calendar");
    expect(f.studies).toHaveLength(4);
    expect(f.unscheduledDrafts).toBe(1); // d1
    expect(f.scheduledCount).toBe(2); // s1, o1
    expect(f.overdueCount).toBe(1); // o1 (scheduled date in the past)
    const s1 = f.studies.find((s) => s.studyId === "s1")!;
    expect(s1.activationState).toBe("scheduled");
    expect(s1.scheduledActivationAt).toBe("2026-07-05T09:00:00.000Z");
  });

  it("formatCalendarFactsForTool emits states + the no-invent-date guard", () => {
    const f = buildCalendarFacts([makePlan({ id: "x", title: "X", status: "draft" })], NOW);
    const text = formatCalendarFactsForTool(f);
    expect(text).toContain("KALENDER");
    expect(text).toContain("id=x");
    expect(text).toMatch(/erfinde KEIN Datum/i);
  });
});

describe("konsoulToolDefs — calendar flag gating (inert merge)", () => {
  function enumOf(tool: { input_schema: { properties?: unknown } }): string[] {
    const props = tool.input_schema.properties as Record<
      string,
      { enum?: string[] }
    >;
    return props.actionType.enum ?? [];
  }

  it("offers get_calendar_context ONLY when the calendar flag is on", () => {
    expect(konsoulToolDefs(false, false).map((t) => t.name)).not.toContain(
      GET_CALENDAR_CONTEXT_TOOL.name,
    );
    expect(konsoulToolDefs(false, true).map((t) => t.name)).toContain(
      GET_CALENDAR_CONTEXT_TOOL.name,
    );
  });

  it("includes schedule_activation in propose ONLY when BOTH flags on", () => {
    const aOnly = konsoulToolDefs(true, false).find(
      (t) => t.name === PROPOSE_ACTION_TOOL_NAME,
    )!;
    expect(enumOf(aOnly)).not.toContain("schedule_activation");
    const both = konsoulToolDefs(true, true).find(
      (t) => t.name === PROPOSE_ACTION_TOOL_NAME,
    )!;
    expect(enumOf(both)).toContain("schedule_activation");
  });
});

describe("buildProposalFromArgs — schedule_activation (Kalender)", () => {
  const calendar = buildCalendarFacts(
    [
      makePlan({ id: "draft1", title: "Pricing", status: "draft", activationState: "none" }),
      makePlan({ id: "active1", title: "Live", status: "active", activationState: "activated" }),
    ],
    Date.parse("2026-07-01T12:00:00.000Z"),
  );

  it("builds a non-destructive, cost-free proposal for a DRAFT (no date)", () => {
    const out = buildProposalFromArgs(
      { actionType: "schedule_activation", studyId: "draft1" },
      calendar,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposal.actionType).toBe("schedule_activation");
      expect(out.proposal.targetStudyId).toBe("draft1");
      expect(out.proposal.targetTitle).toBe("Pricing");
      expect(out.proposal.destructive).toBe(false);
      expect(out.proposal.costsModel).toBe(false);
      expect(out.targetStudy).toBeNull(); // no portfolio counts → audit counts {}
    }
  });

  it("nudges (no proposal) for a NON-draft study — never activate", () => {
    const out = buildProposalFromArgs(
      { actionType: "schedule_activation", studyId: "active1" },
      calendar,
    );
    expect(out.ok).toBe(false);
  });

  it("nudges for a foreign/hallucinated studyId", () => {
    const out = buildProposalFromArgs(
      { actionType: "schedule_activation", studyId: "ghost" },
      calendar,
    );
    expect(out.ok).toBe(false);
  });

  it("nudges when data is NOT calendar scope (forces get_calendar_context)", () => {
    const out = buildProposalFromArgs(
      { actionType: "schedule_activation", studyId: "draft1" },
      PORTFOLIO,
    );
    expect(out.ok).toBe(false);
  });

  it("STRUCTURALLY rejects schedule_activation when the calendar flag is off", () => {
    // Even with valid calendar data + a real draft, calendarEnabled=false → no
    // proposal (a hallucinated actionType that bypasses the tool enum is refused).
    const out = buildProposalFromArgs(
      { actionType: "schedule_activation", studyId: "draft1" },
      calendar,
      false,
    );
    expect(out.ok).toBe(false);
  });

  it("nudges for an ALREADY-scheduled draft (only first scheduling)", () => {
    const cal = buildCalendarFacts(
      [
        makePlan({
          id: "sd",
          title: "Scheduled draft",
          status: "draft",
          activationState: "scheduled",
          scheduledActivationAt: "2026-08-01T09:00:00.000Z",
        }),
      ],
      Date.parse("2026-07-01T12:00:00.000Z"),
    );
    const out = buildProposalFromArgs(
      { actionType: "schedule_activation", studyId: "sd" },
      cal,
    );
    expect(out.ok).toBe(false);
  });
});
