import { z } from "zod";

/**
 * Phase D — per-STUDY usability aggregate (study_synthesis.interaction_summary).
 * SERVER-DETERMINISTIC numbers only (the synthesis engine computes them from the
 * completed sessions' task_result; never the LLM), mirroring the E4 signals_
 * summary discipline.
 *
 * AGGREGATE-ONLY (Art. 22 firebreak): study-level numbers, never a per-
 * participant slice. Gated on MIN_INTERACTION_SESSIONS so a single respondent
 * can never be singled out — below that the aggregate is not produced (null).
 */

export const INTERACTION_SUMMARY_VERSION = 1;

/** Minimum completed sessions WITH task_result before an aggregate is produced.
 *  Mirrors the signals/stimulus min-N (3) so the study-level number can never
 *  expose a single participant. */
export const MIN_INTERACTION_SESSIONS = 3;

export const InteractionSummarySchema = z.object({
  version: z.literal(INTERACTION_SUMMARY_VERSION),
  /** Completed sessions that carry a task_result — the denominator for the rates. */
  sessionsWithResults: z.number().int().min(0),
  /** Share with task_result.success === true, 0–1. Null if no session had a
   *  determinate outcome. */
  successRate: z.number().min(0).max(1).nullable(),
  /** Mean time_on_task_seconds over sessions that reported it; null if none did. */
  avgTimeSeconds: z.number().min(0).nullable(),
  /** Mean click_count across the sessions. */
  avgClicks: z.number().min(0),
  /** Share with >= 1 friction (rage-click) event, 0–1. Always computable at
   *  n >= MIN_INTERACTION_SESSIONS (every session carries a friction count), so
   *  non-nullable — unlike successRate/avgTime which can lack a basis. */
  frictionRate: z.number().min(0).max(1),
  /** Phase C: share where the behavioural success and the judge verdict AGREE,
   *  0–1, over sessions that have BOTH. Null if no judged sessions. Aggregate
   *  only — never a per-participant agreement score. */
  judgeAgreement: z.number().min(0).max(1).nullable(),
});

export type InteractionSummary = z.infer<typeof InteractionSummarySchema>;

/** Lenient read-mapper (never throws). Null/undefined/foreign-version/malformed
 *  → null → the synthesis page renders no usability card (byte-identical). */
export function coerceInteractionSummary(
  raw: unknown,
): InteractionSummary | null {
  if (raw === null || raw === undefined) return null;
  const parsed = InteractionSummarySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
