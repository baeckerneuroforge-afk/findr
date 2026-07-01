import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import {
  cachedSystem,
  withCacheBreakpointOnLastMessage,
} from "@/lib/anthropic/cache";
import { runCrossStudyAgent } from "@/lib/cross-study-agent/engine";
import type { CrossStudyAgentResult } from "@/lib/schemas/cross-study-agent";
import type { MissionControlHistoryTurn } from "@/lib/schemas/mission-control";
import {
  KonsoulResultSchema,
  KonsoulActionTypeSchema,
  type KonsoulAgentRequest,
  type KonsoulResult,
  type KonsoulProposal,
  type KonsoulProposalActionType,
  type KonsoulProposalPrecondition,
  type PortfolioStudyFact,
  type KonsoulFacts,
} from "@/lib/schemas/konsoul-agent";
import {
  GET_PORTFOLIO_OVERVIEW_TOOL,
  GET_STUDY_STATUS_TOOL,
  GET_CALENDAR_CONTEXT_TOOL,
  GET_HELP_TOOL,
  DELEGATE_CROSS_STUDY_TOOL,
  PROPOSE_ACTION_TOOL_NAME,
  konsoulToolDefs,
  makeKonsoulReadTools,
  formatPortfolioFactsForTool,
  formatCalendarFactsForTool,
  formatHelpTopicForTool,
  formatHelpIndexForTool,
  lookupHelpTopic,
  resolveHelpTopicKey,
  type KonsoulReadToolset,
  type HelpLocale,
} from "./tools";
import { KONSOUL_AGENT_SYSTEM_PROMPT } from "./prompts";
import { isKonsoulActionsEnabled } from "@/lib/konsoul/actions-flag";
import { isKonsoulCalendarEnabled } from "@/lib/konsoul/calendar-flag";
import {
  logProposed,
  type KonsoulCountsKey,
} from "./action-audit";

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

/** Prompt-/Vertrags-Version, die ins Audit (`model_version`) wandert. KEIN
 *  Modell-Output — ein statischer Bezeichner für Reproduzierbarkeit. */
const KONSOUL_PROMPT_VERSION = "konsoul-p3.1";

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
  attach: { data?: KonsoulFacts; sources?: string[] },
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

// ── propose_action (P3 — TERMINAL, deterministischer Vorschlags-Builder) ──────

/** Aktionen mit Opus-Lauf (Kosten). create_study_draft ist LLM-frei. */
const COSTS_MODEL_ACTIONS = new Set<KonsoulProposalActionType>([
  "run_synthesis",
  "run_personas",
  "run_guide",
]);

/** Aktionen, die zwingend eine bestehende Zielstudie (studyId) brauchen.
 *  create_study_draft legt eine NEUE Zeile an → kein studyId. */
const STUDY_TARGET_ACTIONS = new Set<KonsoulProposalActionType>([
  "run_synthesis",
  "run_personas",
  "run_guide",
]);

/** Das vom Builder zurückgegebene Ergebnis: entweder ein fertiger, deterministisch
 *  gebauter Vorschlag — oder ein strukturierter Fehler mit Nudge-Text fürs Modell
 *  (fremde/halluzinierte studyId, fehlende studyId, unbekannter actionType). NIE
 *  ein Vorschlag bei ungültigem Input. */
type BuildProposalOutcome =
  | { ok: true; proposal: KonsoulProposal; targetStudy: PortfolioStudyFact | null }
  | { ok: false; nudge: string };

/**
 * Baut den Aktions-Vorschlag DETERMINISTISCH aus den Modell-Args + dem bereits
 * geladenen `acc.data` (PortfolioFacts). KEINE Ausführung. Das Modell liefert nur
 * actionType/studyId/Titel; precondition/destructive/costsModel kommen
 * AUSSCHLIESSLICH aus acc.data bzw. dem actionType — nie aus Modell-Prosa.
 *
 * Org-Grenzschutz VOR dem Klick: eine studyId, die nicht im org-gefilterten
 * PortfolioFacts steht (fremd/halluziniert), führt zu `{ ok:false }` → is_error +
 * Nudge, NIE zu einem Vorschlag.
 */
export function buildProposalFromArgs(
  input: unknown,
  data: KonsoulFacts | undefined,
  // Strukturell: ohne Kalender-Flag wird schedule_activation hart abgelehnt —
  // selbst ein halluzinierter actionType (der den Tool-Enum umgeht) baut dann nie
  // einen Termin-Vorschlag. Default true, weil der Produktions-Aufrufer das echte
  // Flag durchreicht; portfolio-/create-Tests berührt es nicht.
  calendarEnabled = true,
): BuildProposalOutcome {
  // actionType deterministisch gegen die 4er-Allowlist validieren (Backstop zum
  // Tool-Enum; ein halluzinierter Wert wird hier hart abgewiesen).
  const rawAction = readStringArg(input, "actionType");
  const parsedAction = KonsoulActionTypeSchema.safeParse(rawAction);
  if (!parsedAction.success) {
    return {
      ok: false,
      nudge: `Unbekannter actionType '${rawAction ?? "?"}'. Erlaubt sind genau: create_study_draft, run_synthesis, run_personas, run_guide. Für jede andere Aktion hast du kein Tool — lehne sie über emit_guidance ehrlich ab.`,
    };
  }
  const actionType = parsedAction.data;
  const costsModel = COSTS_MODEL_ACTIONS.has(actionType);

  // create_study_draft: NEUE Zeile, kein studyId, nicht-destruktiv, LLM-frei.
  if (actionType === "create_study_draft") {
    const studyTitle = readStringArg(input, "studyTitle");
    const proposal: KonsoulProposal = {
      actionType,
      destructive: false,
      costsModel,
      ...(studyTitle ? { targetTitle: studyTitle } : {}),
    };
    return { ok: true, proposal, targetStudy: null };
  }

  // schedule_activation (Kalender): einen ENTWURF terminieren. Braucht den
  // KALENDER-Fakten-Block (scope:'calendar') — nur darin steht der draft-Status
  // + activationState. Der Confirm öffnet den Picker (kein Datum vom Modell);
  // verschickt NICHTS. Nur Entwürfe sind terminierbar.
  if (actionType === "schedule_activation") {
    if (!calendarEnabled) {
      // Kalender-Flag aus → es gibt keine Terminierungs-Aktion. Ehrliche Ablehnung
      // (defense-in-depth zum nicht-angebotenen Tool + dem gegateten Read-Handler).
      return {
        ok: false,
        nudge:
          "Für eine Terminierung hast du gerade kein Tool — lehne sie über emit_guidance ehrlich ab.",
      };
    }
    if (!data || data.scope !== "calendar") {
      return {
        ok: false,
        nudge:
          "Für eine Terminierung brauche ich zuerst den Kalender-Stand. Rufe get_calendar_context und übergib eine echte studyId eines Entwurfs.",
      };
    }
    const studyId = readStringArg(input, "studyId");
    if (!studyId) {
      return {
        ok: false,
        nudge:
          "schedule_activation braucht die studyId eines ENTWURFS aus get_calendar_context.",
      };
    }
    const study = data.studies.find((s) => s.studyId === studyId);
    if (!study) {
      return {
        ok: false,
        nudge: `Studie id='${studyId}' steht nicht im Kalender dieser Organisation. Nutze ausschließlich ids aus get_calendar_context — erfinde keine.`,
      };
    }
    if (study.status !== "draft") {
      return {
        ok: false,
        nudge: `Nur ENTWÜRFE sind terminierbar — Studie "${study.title}" ist '${study.status}'. Aktivieren/Live-Schalten kannst du nicht; verweise ehrlich auf den manuellen Kalender.`,
      };
    }
    if (study.activationState !== "none") {
      // Schon terminiert (oder im Aktivierungs-/Fehler-Zustand). Konsoul schlägt
      // NUR die ERSTE Terminierung ungeplanter Entwürfe vor — so trifft jeder
      // Vorschlag genau den Picker-Pool der Kalender-Seite (sonst öffnet der
      // Confirm einen Dialog, der den schon-terminierten Entwurf nicht führt).
      return {
        ok: false,
        nudge: `Studie "${study.title}" ist bereits terminiert ('${study.activationState}'). Zum Umterminieren öffne den Kalender manuell — ich schlage nur die erste Terminierung ungeplanter Entwürfe vor.`,
      };
    }
    const proposal: KonsoulProposal = {
      actionType,
      targetStudyId: studyId,
      targetTitle: study.title,
      destructive: false,
      costsModel: false,
      precondition: { activationState: study.activationState },
    };
    return { ok: true, proposal, targetStudy: null };
  }

  // run_*: braucht eine BESTEHENDE Studie. studyId deterministisch gegen den
  // org-gefilterten PortfolioFacts validieren. (Kalender-Fakten taugen hier nicht
  // — sie tragen keine completedSessions/Synthese-Flags.)
  if (STUDY_TARGET_ACTIONS.has(actionType)) {
    if (data && data.scope === "calendar") {
      return {
        ok: false,
        nudge: `${actionType} braucht den Portfolio-Stand (abgeschlossene Interviews, Synthese-Flags). Rufe zuerst get_portfolio_overview und übergib eine echte studyId.`,
      };
    }
    const studyId = readStringArg(input, "studyId");
    if (!studyId) {
      return {
        ok: false,
        nudge: `${actionType} braucht eine studyId einer BESTEHENDEN Studie. Rufe zuerst get_portfolio_overview und übergib eine echte id.`,
      };
    }
    const study = (data?.studies ?? []).find((s) => s.studyId === studyId);
    if (!study) {
      // Fremde/halluzinierte id → NIE ein Vorschlag (erster Org-Grenzschutz).
      return {
        ok: false,
        nudge: `Studie id='${studyId}' gehört nicht zum Portfolio dieser Organisation. Nutze ausschließlich ids aus get_portfolio_overview — erfinde keine. Für unbekannte Studien hast du keinen Vorschlag.`,
      };
    }

    // destructive NUR aus acc.data: run_synthesis/run_personas ersetzen ein
    // bestehendes Artefakt, wenn es schon existiert (upsert onConflict). run_guide
    // überschreibt topic_script — dessen Befüll-Stand trägt PortfolioFacts nicht,
    // darum hier konservativ NICHT als destructive markiert (die stärkere Guide-
    // Warnung ist P3.3 und braucht ein topic_script-Flag, das hier fehlt).
    //
    // run_personas: hasPersonas wird im Prod-Pfad deterministisch geladen (true =
    // Personas existieren bereits → Re-Run ersetzt sie, stark warnen; false =
    // erstmalig, leichte Karte). KONSERVATIVER FALLBACK: schlug der hasPersonas-
    // Read fehl (undefined) UND existiert eine Synthese (Personas leiten sich aus
    // ihr ab, könnten also schon da sein) → lieber als destruktiv markieren als
    // still zu überschreiben.
    const destructive =
      actionType === "run_synthesis"
        ? study.hasSynthesis
        : actionType === "run_personas"
          ? study.hasPersonas === true ||
            (study.hasPersonas === undefined && study.hasSynthesis === true)
          : false;

    const precondition: KonsoulProposalPrecondition = {
      completedSessions: study.completedSessions,
      hasSynthesis: study.hasSynthesis,
      ...(study.hasPersonas !== undefined
        ? { hasPersonas: study.hasPersonas }
        : {}),
      ...(study.basedOnCount !== undefined
        ? { basedOnCount: study.basedOnCount }
        : {}),
    };

    const proposal: KonsoulProposal = {
      actionType,
      targetStudyId: studyId,
      destructive,
      costsModel,
      precondition,
    };
    return { ok: true, proposal, targetStudy: study };
  }

  // Unerreichbar (alle 4 Typen oben behandelt) — fail-closed.
  return {
    ok: false,
    nudge: `actionType '${actionType}' wird nicht unterstützt.`,
  };
}

/** Sammelt die whitelisted Audit-Counts aus dem Ziel-Studienfaktum. Nur Zahlen,
 *  die das Audit-Schema (COUNTS_KEY_WHITELIST) zulässt — sanitizeCounts ist der
 *  zweite Filter. Kein Synthese-/Persona-Inhalt, keine Prosa. */
function auditCountsFor(
  study: PortfolioStudyFact | null,
): Partial<Record<KonsoulCountsKey, number>> {
  if (!study) return {};
  const counts: Partial<Record<KonsoulCountsKey, number>> = {};
  if (study.completedSessions !== null)
    counts.completed_sessions = study.completedSessions;
  if (study.basedOnCount !== undefined)
    counts.based_on_count = study.basedOnCount;
  return counts;
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
  /** Letzter geladener Fakten-Block (portfolio / study / calendar) — wird an
   *  guidance bzw. proposal gehängt. */
  data?: KonsoulFacts;
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
  // P3-Flag (default aus der Env-Quelle). Ist es aus, wird `propose_action` dem
  // Modell NICHT angeboten → Konsoul bleibt exakt das P2-read-only-Verhalten
  // (byte-gleich). Der Test injiziert true/false explizit.
  actionsEnabled: boolean = isKonsoulActionsEnabled(),
  // Kalender-Flag (default aus der Env-Quelle). Ist es aus, wird weder
  // get_calendar_context noch die schedule_activation-Aktion angeboten → Konsoul
  // bleibt byte-gleich. Stapelt auf actionsEnabled (Termin-Vorschlag braucht beide).
  calendarEnabled: boolean = isKonsoulCalendarEnabled(),
): Promise<KonsoulResult> {
  const client = getAnthropicClient();

  // Bei aktivem Flag bietet der Loop zusätzlich propose_action an; sonst exakt das
  // heutige P2-Toolset. Bei aktivem Kalender-Flag zusätzlich get_calendar_context
  // (+ schedule_activation im propose-Enum). Das Emit-Tool mischt die Engine separat.
  const offeredTools = [
    ...konsoulToolDefs(actionsEnabled, calendarEnabled),
    EMIT_GUIDANCE_TOOL,
  ];

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
          // Prompt-Caching (Muster interviewer.ts / cross-study-agent):
          // Breakpoint auf System (deckt die Tool-Defs davor mit) + auf der
          // letzten stabilen Message — jeder Step verlängert den gecachten
          // Präfix statt den wachsenden Kontext jede Runde voll zu bezahlen.
          system: cachedSystem(KONSOUL_AGENT_SYSTEM_PROMPT),
          messages: withCacheBreakpointOnLastMessage(messages),
          tools: offeredTools,
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

    // PROPOSE_ACTION (P3 — terminal, wie delegate/emit). NUR bei aktivem Flag
    // verarbeitet; sonst wurde das Tool gar nicht angeboten und ein etwaiger
    // Aufruf fällt in den generischen 'Unbekanntes Tool'-is_error-Pfad unten
    // (defense-in-depth: die Engine baut OHNE Flag NIE einen Vorschlag).
    const proposeUse = actionsEnabled
      ? toolUses.find((tu) => tu.name === PROPOSE_ACTION_TOOL_NAME)
      : undefined;
    if (proposeUse) {
      const outcome = buildProposalFromArgs(
        proposeUse.input,
        acc.data,
        calendarEnabled,
      );
      if (!outcome.ok) {
        // Fremde/halluzinierte studyId, fehlende studyId oder unbekannter
        // actionType → is_error + Nudge, NIE ein Vorschlag. Weiterlaufen lassen
        // (Budget bremst), das Modell kann korrigieren oder ehrlich ablehnen.
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: proposeUse.id,
              content: outcome.nudge,
              is_error: true,
            },
          ],
        });
        continue;
      }

      // Deterministischer Vorschlag steht. Das Modell liefert NUR die rationale-
      // Prosa fürs UI — sie wird NIE persistiert (das Audit trägt kein Freitext-
      // Feld). Falls leer, eine neutrale Default-Zeile, damit der Vertrag hält.
      const rationale =
        readStringArg(proposeUse.input, "rationale") ??
        "Vorgeschlagene Aktion auf Basis deines Portfolios.";

      // Audit-Schreibung #1 ('proposed', VOR jeder Ausführung). Fail-open: ein
      // Schreibfehler darf den Vorschlag nicht kippen (logProposed loggt + gibt
      // auditId:null zurück). Nur whitelisted Metadaten reisen mit; sanitizeCounts
      // ist der zweite Filter im Audit-Writer. Die auditId reist im Envelope mit,
      // damit der spätere Confirm-/Dismiss-Beacon GENAU diese Zeile auf accepted/
      // ignored setzen kann (Audit-Schreibung #2).
      const { auditId } = await logProposed({
        orgId: request.orgId,
        actionType: outcome.proposal.actionType,
        planId: outcome.proposal.targetStudyId ?? null,
        model,
        modelVersion: KONSOUL_PROMPT_VERSION,
        counts: auditCountsFor(outcome.targetStudy),
      });

      return assertKonsoulResult({
        kind: "proposal",
        answered: true,
        rationale,
        proposal: outcome.proposal,
        ...(auditId ? { auditId } : {}),
        ...(acc.data ? { data: acc.data } : {}),
      });
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
      } else if (tu.name === GET_CALENDAR_CONTEXT_TOOL.name && calendarEnabled) {
        // STRUKTURELL flag-gated: ohne Kalender-Flag wird das Tool gar nicht
        // angeboten — ein HALLUZINIERTER get_calendar_context-Aufruf fällt dann
        // in den 'Unbekanntes Tool'-Pfad unten und schreibt NIE scope:'calendar'
        // in acc.data (kein Daten-Leck, kein schedule_activation-Schlupfloch).
        const facts = await toolset.getCalendarFacts();
        acc.data = facts;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: formatCalendarFactsForTool(facts),
        });
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
  return forceFinalGuidance(client, model, messages, acc, offeredTools);
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
  offeredTools: Anthropic.Tool[],
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
          system: cachedSystem(KONSOUL_AGENT_SYSTEM_PROMPT),
          messages: withCacheBreakpointOnLastMessage(messages),
          // DIESELBE Tool-Liste wie im Loop: tool_choice erzwingt den Emit
          // ohnehin; die frühere geschrumpfte Liste ([EMIT_GUIDANCE_TOOL])
          // brach nur den gecachten Präfix aller Loop-Steps (Cache-Reihenfolge:
          // tools → system → messages).
          tools: offeredTools,
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
