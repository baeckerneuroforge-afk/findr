import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";
import { coerceTaskResult } from "@/lib/schemas/task-result";
import {
  REASONING_MAX_CHARS,
  TASK_SUCCESS_JUDGMENT_VERSION,
  TaskSuccessJudgmentExtractionSchema,
  type TaskSuccessJudgmentExtraction,
  type TaskSuccessJudgmentRecord,
} from "@/lib/schemas/task-success";
import type {
  InterviewLanguage,
  InterviewTurn,
} from "@/lib/voice-agent/interviewer";
import type { Json } from "@/types/database";

/**
 * Phase C — Task-Success-Judge. An ADVISORY second opinion at session end on
 * whether a usability-test participant met the task's successCriterion, judged
 * from the orthographic transcript. Mirrors the turn-signals sidecar exactly:
 * forced tool-use via callClaudeStructured, Zod validation, typed error, NO
 * heuristic fallback. Runs as an after()-sidecar BEHIND the completion response
 * — never in the interview path, never latency-bearing; errors are logged and
 * NEVER thrown.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RECHTSANKER — DO NOT SOFTEN (EU AI Act, integration plan L8 / §3.1):
 * The judge sees ONLY the orthographic transcript (`conversation[].text`), the
 * task instruction + successCriterion, and the deterministic behavioural
 * task_result (success/time/clicks/friction) as CONTEXT. It judges the OUTCOME
 * against the criterion. NEVER: affect/emotion, personality, health/clinical
 * states, honesty/deception, voice/prosody/latency or any behavioural-biometric
 * pattern. The verdict is ADVISORY and lives in its OWN column — task_result.
 * success stays event-based and authoritative ("Zahlen rechnet der Server, nie
 * das Modell"). Per-session only, never a cross-session/per-participant profile
 * (Art. 22 firebreak).
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Gate chain (all must hold, else silent skip):
 *   kind === 'research' AND planId present AND task_success_judgment still null
 *   (idempotency) AND plan.useCase === 'usability_test' AND a task with a
 *   non-empty successCriterion exists (nothing to judge otherwise) AND
 *   consent_accepted_at set (E0-coupling, identical to turn-signals: no analysis
 *   without documented consent; pre-E0/pre-migration sessions are never judged
 *   — the no-backfill promise).
 *
 * Model: Haiku by default (a single bounded verdict). Override via
 * TASK_SUCCESS_MODEL — pattern resolveSignalsModel.
 */

export const DEFAULT_TASK_SUCCESS_MODEL = CLAUDE_MODELS.haiku;

export function resolveTaskSuccessModel(): string {
  return process.env.TASK_SUCCESS_MODEL ?? DEFAULT_TASK_SUCCESS_MODEL;
}

export class TaskSuccessJudgeUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TaskSuccessJudgeUnavailableError";
  }
}

export interface TaskSuccessJudgeInput {
  /** The full transcript in conversation order — role + text ONLY. */
  conversation: InterviewTurn[];
  language: InterviewLanguage;
  /** The task the participant was asked to do. */
  instruction: string;
  /** The researcher's success criterion the verdict is measured against. */
  successCriterion: string;
  /** Deterministic behavioural outcome as CONTEXT (never the basis for numbers):
   *  the event-based success flag + time/clicks/friction. Null when no events. */
  behavioural: {
    success: boolean | null;
    timeOnTaskSeconds: number | null;
    clickCount: number;
    frictionCount: number;
  } | null;
  /** Study title as analysis context; null ok. */
  planTitle: string | null;
}

const SYSTEM_PROMPT = `You judge whether a usability-test participant completed a task, measured against the researcher's success criterion. You are an outcome-assessment tool, not a judge of people.

YOUR INPUT IS THE TRANSCRIPT WORDING plus the task's instruction and success criterion. You may use the supplied behavioural summary (did they finish, time, clicks, friction) only as CONTEXT — never recompute or contradict those numbers, and never treat them as the verdict by themselves.

Return exactly one verdict for the WHOLE session:
- success: the success criterion was clearly met per the transcript.
- partial: a real, nameable part of the criterion was met, but not all of it.
- failure: the criterion was not met.

Plus a calibrated confidence (0–1) and a short reasoning (1–3 sentences, in the transcript's language) that grounds the verdict in what the participant actually said or did versus the criterion.

HARD RULES — these define what you are:
- Judge ONLY task completion against the criterion. NEVER infer or mention emotion, affect, frustration, personality, health/clinical states, intelligence, or honesty/deception. Not in the verdict, not in the reasoning.
- Ground the reasoning in the transcript. If the transcript is too thin or the criterion too vague to tell, choose the closest verdict with LOW confidence — never invent evidence.
- The participant declining or struggling is a legitimate research finding, never a judgment of the person.
- A short transcript can still be a clear success or failure; brevity is not failure.`;

function behaviouralLine(input: TaskSuccessJudgeInput): string {
  if (!input.behavioural) {
    return "BEHAVIOURAL CONTEXT: (none recorded)";
  }
  const b = input.behavioural;
  const outcome =
    b.success === true
      ? "participant marked the task completed"
      : b.success === false
        ? "participant marked the task not completed"
        : "no explicit completion marker";
  const time =
    b.timeOnTaskSeconds != null ? `${b.timeOnTaskSeconds}s on task` : "no timing";
  return `BEHAVIOURAL CONTEXT (for orientation only — do NOT recompute): ${outcome}; ${time}; ${b.clickCount} clicks; ${b.frictionCount} friction event(s).`;
}

export function buildTaskSuccessUserPrompt(input: TaskSuccessJudgeInput): string {
  const context = input.planTitle
    ? `STUDY CONTEXT: usability study "${input.planTitle}"`
    : "STUDY CONTEXT: (none provided)";
  const language = input.language === "de" ? "German" : "English";
  const transcript = input.conversation
    .map(
      (turn, i) =>
        `[${i}] ${turn.role === "agent" ? "INTERVIEWER" : "PARTICIPANT"}: ${turn.text}`,
    )
    .join("\n");
  return `${context}
TRANSCRIPT LANGUAGE: ${language} (write the reasoning in this language)

TASK INSTRUCTION (what the participant was asked to do):
${input.instruction}

SUCCESS CRITERION (judge the outcome against THIS):
${input.successCriterion}

${behaviouralLine(input)}

TRANSCRIPT:
${transcript}`;
}

/**
 * One LLM call per session over the whole transcript. Fail-closed — throws
 * TaskSuccessJudgeUnavailableError; the sidecar catches and logs.
 */
export async function judgeTaskSuccess(
  input: TaskSuccessJudgeInput,
  model: string = resolveTaskSuccessModel(),
): Promise<TaskSuccessJudgmentExtraction> {
  try {
    return await callClaudeStructured({
      schema: TaskSuccessJudgmentExtractionSchema,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildTaskSuccessUserPrompt(input) },
      ],
      model,
      maxTokens: 1024,
      timeoutMs: 120_000,
      toolName: "emit_task_success_judgment",
      toolDescription:
        "Return one task-success verdict (success | partial | failure) for the whole session, judged against the success criterion, with calibrated confidence and a short transcript-grounded reasoning. Call exactly once.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "[task-success-judge] structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new TaskSuccessJudgeUnavailableError(
        "Claude task-success judgment returned invalid output twice",
        err,
      );
    }
    throw new TaskSuccessJudgeUnavailableError(
      "Claude task-success judgment failed",
      err,
    );
  }
}

/** Wrap the model verdict into the persistable, versioned record (+ server
 *  metadata, reasoning capped). The verdict is the model's; no server-derived
 *  numbers live here — the deterministic metrics stay in task_result. */
export function sealTaskSuccessJudgment(
  extraction: TaskSuccessJudgmentExtraction,
  model: string,
): TaskSuccessJudgmentRecord {
  return {
    version: TASK_SUCCESS_JUDGMENT_VERSION,
    judgedAt: new Date().toISOString(),
    model,
    verdict: extraction.verdict,
    confidence: extraction.confidence,
    reasoning: extraction.reasoning.trim().slice(0, REASONING_MAX_CHARS),
  };
}

// ── Sidecar (called from both completion paths via after()) ─────────────────

/**
 * Post-completion task-success judgment for ONE session. Runs as an after()-
 * sidecar (pattern runTurnSignalsSidecar) — the participant response is long
 * gone; errors are logged and NEVER thrown. Loads the session fresh by id.
 *
 * Pre-migration behaviour (20260723000005 not applied): select("*") omits
 * task_success_judgment → the IS NULL write-guard simply no-ops on a column the
 * read can't see; the gate chain ends silently regardless. No log spam.
 */
export async function runTaskSuccessJudgeSidecar(
  sessionId: string,
): Promise<void> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) {
      console.error(
        `[task-success-judge] session read failed (sidecar skipped): ${error.message}`,
      );
      return;
    }
    if (!data) return;

    if (data.kind !== "research" || !data.plan_id) return;

    // Idempotency pre-check (saves the LLM call on a double-complete); the
    // UPDATE below carries the at-most-once guarantee (… IS NULL).
    const existing =
      (data as { task_success_judgment?: unknown }).task_success_judgment ??
      null;
    if (existing !== null) return;

    // E0-coupling: judge only with documented consent (consent_accepted_at).
    // Sessions without a stamp (pre-E0/pre-migration) are never judged — the
    // no-backfill promise, identical to turn-signals.
    const consentAcceptedAt =
      (data as { consent_accepted_at?: string | null }).consent_accepted_at ??
      null;
    if (consentAcceptedAt === null) return;

    const plan = await getResearchPlan(data.org_id, data.plan_id);
    if (!plan || plan.useCase !== "usability_test") return;
    const task = plan.taskDefinition;
    const successCriterion = task?.successCriterion?.trim() || null;
    // Nothing to judge against → skip (observational tasks have no criterion).
    if (!task || !successCriterion) return;

    const conversation =
      (data as unknown as { conversation?: InterviewTurn[] }).conversation ?? [];
    if (!conversation.some((t) => t.role === "customer")) return;

    const result = coerceTaskResult(
      (data as { task_result?: unknown }).task_result,
    );
    const behavioural = result
      ? {
          success: result.success,
          timeOnTaskSeconds: result.time_on_task_seconds,
          clickCount: result.click_count,
          frictionCount: result.friction_events.length,
        }
      : null;

    const model = resolveTaskSuccessModel();
    const extraction = await judgeTaskSuccess(
      {
        conversation,
        language: data.language,
        instruction: task.instruction,
        successCriterion,
        behavioural,
        planTitle: plan.title?.trim() || null,
      },
      model,
    );
    const record = sealTaskSuccessJudgment(extraction, model);

    const { error: writeError } = await supabase
      .from("interview_sessions")
      .update({ task_success_judgment: record as unknown as Json })
      .eq("id", sessionId)
      .is("task_success_judgment", null);
    if (writeError) {
      console.error(
        `[task-success-judge] persist failed (session unaffected): ${writeError.message}`,
      );
    }
  } catch (err) {
    console.error(
      "[task-success-judge] sidecar failed (session unaffected):",
      err instanceof Error ? err.message : err,
    );
  }
}
