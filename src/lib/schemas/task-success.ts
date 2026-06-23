import { z } from "zod";

/**
 * Phase C — TASK-SUCCESS JUDGMENT schema. The LLM's ADVISORY second opinion on
 * whether a usability-test participant met the task's successCriterion, judged
 * from the orthographic transcript. Mirrors the turn-signals split: an
 * extraction shape (what the model returns via forced tool-use) and a persisted,
 * versioned record shape (interview_sessions.task_success_judgment jsonb).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RED LINE — DO NOT SOFTEN (EU AI Act, integration plan L8):
 * The judge sees ONLY the transcript wording + the task's instruction/
 * successCriterion + the deterministic behavioural task_result (success/time/
 * clicks/friction). It judges OUTCOME against the criterion. NEVER affect,
 * emotion, personality, health/clinical states, honesty/deception, or any
 * behavioural-biometric pattern. The verdict is ADVISORY: task_result.success
 * stays event-based and authoritative ("Zahlen rechnet der Server, nie das
 * Modell"). Per-session only — never a cross-session / per-participant profile
 * (Art. 22 firebreak). Extending the vocabulary needs a new version + a fresh
 * legal review.
 * ════════════════════════════════════════════════════════════════════════════
 */

export const TASK_SUCCESS_VERDICTS = ["success", "partial", "failure"] as const;
export type TaskSuccessVerdict = (typeof TASK_SUCCESS_VERDICTS)[number];

export const REASONING_MAX_CHARS = 1200;

// ── 1. Model output (forced tool-use input schema) ──────────────────────────

export const TaskSuccessJudgmentExtractionSchema = z.object({
  verdict: z
    .enum(TASK_SUCCESS_VERDICTS)
    .describe(
      "Did the participant meet the task's success criterion, judged ONLY from the transcript? success = the criterion was clearly met; partial = a nameable part was met but not all; failure = the criterion was not met. Judge the OUTCOME against the criterion — never the person, never affect.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Calibrated 0–1 confidence in the verdict. A short/ambiguous transcript or a vague criterion warrants a LOW value. Never overstate.",
    ),
  reasoning: z
    .string()
    .describe(
      "1–3 sentences, in the transcript's language, grounding the verdict in what the participant actually said/did versus the criterion. No speculation about inner states, emotions or character.",
    ),
});
export type TaskSuccessJudgmentExtraction = z.infer<
  typeof TaskSuccessJudgmentExtractionSchema
>;

// ── 2. Persisted form (interview_sessions.task_success_judgment) ────────────

export const TASK_SUCCESS_JUDGMENT_VERSION = 1;

/** Read-schema of the persisted form. `version` is a LITERAL: a future v2 fails
 *  here on purpose and the coercer smooths it to null — a v1 UI then renders no
 *  judgment rather than half-understood data (same discipline as turn_signals). */
export const TaskSuccessJudgmentRecordSchema = z.object({
  version: z.literal(TASK_SUCCESS_JUDGMENT_VERSION),
  judgedAt: z.string(),
  model: z.string(),
  verdict: z.enum(TASK_SUCCESS_VERDICTS),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export interface TaskSuccessJudgmentRecord {
  version: typeof TASK_SUCCESS_JUDGMENT_VERSION;
  /** Server timestamp of the judgment (ISO). */
  judgedAt: string;
  /** The model actually used (traceability / eval comparisons). */
  model: string;
  verdict: TaskSuccessVerdict;
  confidence: number;
  reasoning: string;
}

/**
 * Lenient read-mapper for interview_sessions.task_success_judgment (jsonb) —
 * style coerceTurnSignalsRecord / coerceTaskResult: never throws. Null/undefined
 * (never judged, column absent), foreign versions and any non-conforming row
 * read as "no judgment" → the researcher card stays byte-identical to the
 * judgment-less view.
 */
export function coerceTaskSuccessJudgment(
  raw: unknown,
): TaskSuccessJudgmentRecord | null {
  if (raw === null || raw === undefined) return null;
  const parsed = TaskSuccessJudgmentRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
