import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import { runCrossStudyAgent } from "@/lib/cross-study-agent/engine";
import type { CrossStudyAgentResult } from "@/lib/schemas/cross-study-agent";
import type { MissionControlHistoryTurn } from "@/lib/schemas/mission-control";
import {
  KonsoulResultSchema,
  type KonsoulAgentRequest,
  type KonsoulResult,
  type PortfolioFacts,
} from "@/lib/schemas/konsoul-agent";
import {
  KONSOUL_TOOL_DEFS,
  GET_PORTFOLIO_OVERVIEW_TOOL,
  GET_STUDY_STATUS_TOOL,
  GET_HELP_TOOL,
  DELEGATE_CROSS_STUDY_TOOL,
  makeKonsoulReadTools,
  formatPortfolioFactsForTool,
  formatHelpTopicForTool,
  formatHelpIndexForTool,
  lookupHelpTopic,
  resolveHelpTopicKey,
  type KonsoulReadToolset,
  type HelpLocale,
} from "./tools";
import { KONSOUL_AGENT_SYSTEM_PROMPT } from "./prompts";

/**
 * Konsoul-Orchestrator (P2) — 'ein Gehirn, mehrere Türen', STRIKT read-only.
 *
 * Der Loop routet eine Nutzerfrage über DREI Türen und setzt den `kind`-Ton
 * DETERMINISTISCH aus dem tatsächlich gelaufenen Tool-Pfad (NICHT aus Modell-
 * Output — das Modell wählt den Ton nie):
 *
 *  1. THEME → delegate_cross_study ruft den UNVERÄNDERTEN Cross-Study-Agenten
 *     (Opus, OHNE model-Override) und mappt sein Result verbatim auf
 *     grounded/interpretation/refusal. Byte-Gleichheit zu heute garantiert.
 *  2. PORTFOLIO/STATUS → get_portfolio_overview / get_study_status liefern den
 *     deterministischen `PortfolioFacts`-Block; das Modell formuliert die Prosa,
 *     der Block reist strukturiert in `data` → kind:'guidance'.
 *  3. HILFE → get_help liefert kuratierten How-to-Text → kind:'guidance' mit
 *     `sources` (Korpus-Key). Keine Zitate, kein grüner Pip.
 *
 * Modell-Split: der Orchestrator-Loop läuft auf SONNET (Routing/Read/Guidance/
 * Emit). Die delegierte Cross-Study bleibt OPUS — runCrossStudyAgent wird OHNE
 * model-Argument aufgerufen, damit dessen Opus-Default greift (Regression-Schutz,
 * vom Test festgenagelt). KEIN temperature-Param.
 *
 * Zahlen-Guard (Burggraben): alle harten Zahlen kommen aus den Read-Tools und
 * reisen in `data`. Der System-Prompt verbietet eigenes Schätzen/Runden/
 * Aggregieren. Selbst wenn das Modell in `answer` eine falsche Zahl schriebe,
 * steht die wahre Zahl deterministisch daneben in `data`.
 *
 * Fail-closed: jeder Transportfehler, oder ein Emit, der nach einem erzwungenen
 * Retry nicht validiert, wirft KonsoulAgentUnavailableError — nie ungeerdeter
 * Inhalt.
 */

export const KONSOUL_ORCHESTRATOR_MODEL = CLAUDE_MODELS.sonnet;

/** Flacher als Cross-Study: Routing→1 Tool→Emit reicht meist 2–3 Turns; 6 mit
 *  Reserve. Überlauf → ein erzwungener Final-Emit, sonst fail-closed. */
const STEP_BUDGET = 6;
const MAX_TOKENS = 1500;
const EMIT_TOOL_NAME = "emit_guidance";

/** Ruhige, ehrliche Ablehnung, wenn kein Tool verwertbare Evidenz lieferte und
 *  das Modell nichts ehrlich formulieren kann. Nie rot. */
const KONSOUL_REFUSAL =
  "Dazu habe ich gerade keine belegbare oder hilfreiche Antwort für dich.";

export class KonsoulAgentUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "KonsoulAgentUnavailableError";
  }
}

/**
 * FAIL-CLOSED-Schleuse für JEDEN finalen Emit: validiert das Result zur LAUFZEIT
 * gegen den discriminated-union-Vertrag (KonsoulResultSchema). Bricht ein Builder
 * (heute oder nach einem künftigen Refactor) den Vertrag, wirft das hier
 * KonsoulAgentUnavailableError → die Route antwortet 500, NIE mit ungeerdetem/
 * ungültigem Inhalt. Macht die Route-Garantie 'schema-validated inside the engine'
 * real statt nur TS-typisiert. */
function assertKonsoulResult(result: KonsoulResult): KonsoulResult {
  const parsed = KonsoulResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new KonsoulAgentUnavailableError(
      "Konsoul result failed schema validation",
      parsed.error,
    );
  }
  return parsed.data;
}

// ── Delegations-Seam (DI, damit der Test ohne Supabase/API fährt) ────────────

/** Die delegierte Cross-Study-Funktion. Produktion bindet runCrossStudyAgent
 *  (Opus, OHNE model-Arg); der Test injiziert ein Fake. Signatur bewusst eng:
 *  KEIN model-Parameter — der Konsoul-Sonnet-`model` darf NIE durchgereicht
 *  werden. */
export type CrossStudyDelegate = (args: {
  orgId: string;
  question: string;
  history?: MissionControlHistoryTurn[];
}) => Promise<CrossStudyAgentResult>;

/** Produktions-Delegate: ruft den UNVERÄNDERTEN Cross-Study-Agenten OHNE
 *  model-Argument auf → dessen eigener Opus-Default greift. */
const productionCrossStudyDelegate: CrossStudyDelegate = ({
  orgId,
  question,
  history,
}) => runCrossStudyAgent({ orgId, question, history });

// ── kind-Mapping (deterministisch, ENGINE setzt kind, nicht das Modell) ──────

/** Mappt das verbatim durchgereichte Cross-Study-Result auf den Konsoul-Envelope.
 *  answered && interpretation!=='' → interpretation; answered → grounded;
 *  !answered → refusal. Der grounded/interpretation-Teil (inkl. anker-überlebter
 *  Zitate) bleibt unverändert. */
export function mapCrossStudyToKonsoul(
  result: CrossStudyAgentResult,
): KonsoulResult {
  if (result.answered && result.interpretation.trim() !== "") {
    return assertKonsoulResult({
      kind: "interpretation",
      answered: true,
      answer: result.answer,
      citations: result.citations,
      interpretation: result.interpretation,
    });
  }
  if (result.answered) {
    return assertKonsoulResult({
      kind: "grounded",
      answered: true,
      answer: result.answer,
      citations: result.citations,
    });
  }
  return assertKonsoulResult({
    kind: "refusal",
    answered: false,
    answer: result.answer,
    citations: [],
  });
}

/** Baut eine guidance-Antwort aus der Modell-Prosa + den deterministischen
 *  Anhängen (data aus Portfolio-Reads, sources aus Help-Keys). */
function buildGuidance(
  answer: string,
  attach: { data?: PortfolioFacts; sources?: string[] },
): KonsoulResult {
  return assertKonsoulResult({
    kind: "guidance",
    answered: true,
    answer,
    ...(attach.sources && attach.sources.length > 0
      ? { sources: attach.sources }
      : {}),
    ...(attach.data ? { data: attach.data } : {}),
  });
}

// ── Emit-Tool (NUR für den guidance-Pfad — die Prosa) ────────────────────────

/** Das erzwungene Emit-Tool für guidance. Das Modell liefert NUR die Prosa
 *  (`answer`); `data`/`sources` hängt die Engine deterministisch aus den Tool-
 *  Results an — das Modell kann sie nicht setzen. Es trägt KEINE Zitate und
 *  KEIN `kind` (die Engine setzt kind:'guidance'). */
const EMIT_GUIDANCE_TOOL: Anthropic.Tool = {
  name: EMIT_TOOL_NAME,
  description:
    "Gib die finale HILFE-/STATUS-Antwort als kurze, neutrale deutsche Prosa zurück. NUR `answer`. Diese Antwort ist HILFE/STATUS — NICHT belegt: keine Zitate. Nenne ausschließlich Zahlen, die ein Tool dir wörtlich geliefert hat; schätze/runde/addiere NIE selbst. Liegt keine Zahl vor, sag es. Rufe genau einmal auf, wenn du genug weißt.",
  input_schema: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description:
          "Die kurze, neutrale deutsche Antwort. Nur tool-gelieferte Zahlen, keine Zitate.",
      },
    },
    required: ["answer"],
  },
};

// ── Tool-Result-Akkumulator (sammelt data/sources über den Loop) ─────────────

interface Accumulator {
  /** Letzter geladener Fakten-Block (portfolio oder study) — wird an guidance
   *  gehängt. */
  data?: PortfolioFacts;
  /** Help-Korpus-Keys, deren Text dem Modell geliefert wurde. */
  sources: string[];
}

function readStringArg(input: unknown, key: string): string | null {
  if (input && typeof input === "object" && key in input) {
    const v = (input as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return null;
}

// ── Pure Loop-Treiber (DI: Toolset + Delegate injiziert) ─────────────────────

/**
 * Treibt den Orchestrator-Loop mit injiziertem Toolset + Delegate. KEIN Supabase
 * hier (das Toolset besitzt den Datenzugriff), KEIN direkter Cross-Study-Aufruf
 * (der Delegate kapselt ihn), damit der Test deterministisch fährt.
 *
 * Short-Circuit: ruft das Modell delegate_cross_study, wird sofort delegiert und
 * das gemappte Cross-Study-Result zurückgegeben (terminal — der Loop endet, kein
 * weiterer Sonnet-Turn). So bleibt der Theme-Pfad ein reiner Durchreicher.
 */
export async function runKonsoulAgentWith(
  toolset: KonsoulReadToolset,
  delegate: CrossStudyDelegate,
  request: KonsoulAgentRequest,
  locale: HelpLocale = "de",
  model: string = KONSOUL_ORCHESTRATOR_MODEL,
): Promise<KonsoulResult> {
  const client = getAnthropicClient();

  const messages: Anthropic.MessageParam[] = [
    ...(request.history ?? []).map((h) => ({
      role: h.role,
      content: h.content,
    })),
    { role: "user" as const, content: request.question },
  ];

  const acc: Accumulator = { sources: [] };

  for (let step = 0; step < STEP_BUDGET; step++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          system: KONSOUL_AGENT_SYSTEM_PROMPT,
          messages,
          tools: [...KONSOUL_TOOL_DEFS, EMIT_GUIDANCE_TOOL],
          // Erster Turn: irgendein Tool erzwingen (handeln, nicht freitexten);
          // danach auto, damit das Modell entscheidet, wann es delegiert/emittet.
          tool_choice: step === 0 ? { type: "any" } : { type: "auto" },
        },
        { timeout: 120_000, maxRetries: 1 },
      );
    } catch (err) {
      throw new KonsoulAgentUnavailableError(
        "Konsoul orchestrator call failed",
        err,
      );
    }

    messages.push({
      role: "assistant",
      content: response.content as Anthropic.ContentBlockParam[],
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      // Freitext statt Tool → NIE als Antwort nutzen (kein Scratchpad-Leak).
      messages.push({
        role: "user",
        content:
          "Bitte rufe ein Tool auf — get_portfolio_overview, get_study_status, get_help, delegate_cross_study oder emit_guidance. Gib keine Freitext-Antwort.",
      });
      continue;
    }

    // SHORT-CIRCUIT: Delegation an den Cross-Study-Agenten ist terminal. Wenn das
    // Modell delegate_cross_study aufruft, reichen wir die inhaltliche Frage 1:1
    // an den UNVERÄNDERTEN Opus-Agenten und mappen sein Result — kein weiterer
    // Sonnet-Turn, byte-gleich zu heute.
    const delegateUse = toolUses.find(
      (tu) => tu.name === DELEGATE_CROSS_STUDY_TOOL.name,
    );
    if (delegateUse) {
      const themeQuestion =
        readStringArg(delegateUse.input, "question") ?? request.question;
      let csResult: CrossStudyAgentResult;
      try {
        csResult = await delegate({
          orgId: request.orgId,
          question: themeQuestion,
          history: request.history,
        });
      } catch (err) {
        throw new KonsoulAgentUnavailableError(
          "Konsoul cross-study delegation failed",
          err,
        );
      }
      return mapCrossStudyToKonsoul(csResult);
    }

    // EMIT (guidance) — das Modell hat genug; Engine setzt kind:'guidance' und
    // hängt die deterministischen Fakten/Quellen an. Terminal.
    const emitUse = toolUses.find((tu) => tu.name === EMIT_TOOL_NAME);
    if (emitUse) {
      const answer = readStringArg(emitUse.input, "answer");
      if (answer) {
        return buildGuidance(answer, {
          data: acc.data,
          sources: acc.sources,
        });
      }
      // Ungültiger Emit (kein answer) → nudge, weiterlaufen lassen (Budget bremst).
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: emitUse.id,
            content:
              "emit_guidance braucht ein nicht-leeres `answer` (kurze deutsche Prosa).",
            is_error: true,
          },
        ],
      });
      continue;
    }

    // Read-/Help-Tools — Ergebnisse in den Akkumulator + als tool_result zurück.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.name === GET_PORTFOLIO_OVERVIEW_TOOL.name) {
        const facts = await toolset.getPortfolioFacts();
        acc.data = facts;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: formatPortfolioFactsForTool(facts),
        });
      } else if (tu.name === GET_STUDY_STATUS_TOOL.name) {
        const studyId = readStringArg(tu.input, "studyId");
        const facts = studyId
          ? await toolset.getStudyFacts(studyId)
          : null;
        if (facts) {
          acc.data = facts;
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: formatPortfolioFactsForTool(facts),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `STUDY id=${studyId ?? "?"}: in dieser Organisation nicht gefunden. Rufe ggf. get_portfolio_overview für die echten ids.`,
            is_error: true,
          });
        }
      } else if (tu.name === GET_HELP_TOOL.name) {
        const rawKey = readStringArg(tu.input, "topicKey");
        // Deterministisch: exakter Key, sonst Alias/Stichwort (kein Modell).
        const resolved = rawKey ? resolveHelpTopicKey(rawKey) : null;
        const topic = resolved ? lookupHelpTopic(resolved, locale) : null;
        if (topic) {
          if (!acc.sources.includes(topic.key)) acc.sources.push(topic.key);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: formatHelpTopicForTool(topic),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: formatHelpIndexForTool(),
            is_error: true,
          });
        }
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unbekanntes Tool: ${tu.name}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Budget erschöpft ohne Emit/Delegation → EIN erzwungener guidance-Final-Emit,
  // geerdet NUR in dem, was schon geladen wurde. Sonst fail-closed.
  return forceFinalGuidance(client, model, messages, acc);
}

/**
 * Erzwungener guidance-Final-Emit. Das Modell MUSS jetzt antworten, geerdet nur
 * in den bereits geladenen Fakten/Hilfetexten. Ein Schema-Retry, dann eine
 * ehrliche Refusal-guidance (nie ungeerdeter Inhalt, nie Crash bei 'nichts zu
 * sagen").
 */
async function forceFinalGuidance(
  client: Anthropic,
  model: string,
  baseMessages: Anthropic.MessageParam[],
  acc: Accumulator,
): Promise<KonsoulResult> {
  const messages: Anthropic.MessageParam[] = [
    ...baseMessages,
    {
      role: "user",
      content:
        "Beende jetzt. Rufe emit_guidance genau einmal mit einer kurzen deutschen Antwort auf — nutze ausschließlich bereits gelieferte Tool-Daten. Weißt du nichts Belegbares/Hilfreiches, sag das ehrlich.",
    },
  ];

  for (let attempt = 0; attempt <= 1; attempt++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          system: KONSOUL_AGENT_SYSTEM_PROMPT,
          messages,
          tools: [EMIT_GUIDANCE_TOOL],
          tool_choice: { type: "tool", name: EMIT_TOOL_NAME },
        },
        { timeout: 120_000, maxRetries: 1 },
      );
    } catch (err) {
      throw new KonsoulAgentUnavailableError(
        "Konsoul orchestrator final-emit call failed",
        err,
      );
    }
    const tu = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const answer = tu ? readStringArg(tu.input, "answer") : null;
    if (answer) {
      return buildGuidance(answer, { data: acc.data, sources: acc.sources });
    }
    messages.push({
      role: "assistant",
      content: response.content as Anthropic.ContentBlockParam[],
    });
    messages.push({
      role: "user",
      content:
        "emit_guidance war ungültig. Rufe es erneut mit { answer: string } auf.",
    });
  }

  // Zweimal ungültig → ECHTE, ruhige Ablehnung (kind:'refusal') statt eine als
  // guidance getarnte Absage. Konsistenter Ton-Kanal, und KEIN Faktenblock wird an
  // eine Ablehnung gehängt. Feste Refusal-Prosa → KEIN ungeerdeter Inhalt, kein
  // fail-closed-Wurf (wir haben legitime Tool-Daten gesehen, nur nicht formuliert).
  return assertKonsoulResult({
    kind: "refusal",
    answered: false,
    answer: KONSOUL_REFUSAL,
    citations: [],
  });
}

/**
 * Org-Einstieg (Produktion) — bindet das org-scoped Read-Toolset per CLOSURE und
 * den Opus-Cross-Study-Delegate, treibt dann den Loop. STRIKT read-only.
 *
 * AUTH-VERTRAG: der Aufrufer (Route) MUSS die orgId via requireOrgIdOrError
 * authentifiziert haben — makeKonsoulReadTools(orgId) ist eine org-scoped
 * Vertrauensgrenze, und die `orgId` ist die EINZIGE Quelle (nie aus dem Client).
 */
export async function runKonsoulAgent(
  request: KonsoulAgentRequest,
  locale: HelpLocale = "de",
  model?: string,
): Promise<KonsoulResult> {
  const toolset = makeKonsoulReadTools(request.orgId);
  return runKonsoulAgentWith(
    toolset,
    productionCrossStudyDelegate,
    request,
    locale,
    model ?? KONSOUL_ORCHESTRATOR_MODEL,
  );
}
