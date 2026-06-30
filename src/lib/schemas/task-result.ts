import { z } from "zod";

/**
 * Phase 2c — shared schema + lenient read-mapper for the per-session usability
 * `task_result` (interview_sessions.task_result jsonb, written by the Phase-2b
 * event-store's computeTaskResult). Lives here (not in the server-only
 * event-store) so both the write side (event-store) and the read side
 * (plans-service / the researcher card) share ONE source of truth without
 * dragging `server-only` into a component import.
 *
 * STRUCTURAL RED LINE (integration plan L8): behavioural fields only — outcome,
 * timing, click count, and rage-click runs. There is deliberately NO
 * affect/emotion field. Do not add one.
 */

export const TaskResultFrictionEventSchema = z.object({
  type: z.literal("rage_click"),
  ts_ms: z.number().int(),
});
export type TaskResultFrictionEvent = z.infer<
  typeof TaskResultFrictionEventSchema
>;

export const TaskResultSchema = z.object({
  version: z.literal(1),
  success: z.boolean().nullable(),
  // Producer (computeTaskResult) clamps to >= 0 via Math.max(0, …); match it
  // here so the read-mapper is no laxer than its only writer (mirrors
  // synthesis-interaction.ts avgTimeSeconds). A negative legacy value coerces
  // to null ("no result"), never a negative number.
  time_on_task_seconds: z.number().min(0).nullable(),
  click_count: z.number().int().min(0),
  friction_events: z.array(TaskResultFrictionEventSchema),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

/**
 * Lenient read-mapper, same discipline as coerceTurnSignalsRecord: never throws.
 * Null/undefined (never computed, column absent pre-migration), foreign versions
 * and any non-conforming row read as "no result" → the researcher card does not
 * render and the view stays byte-identical to the result-less view.
 */
export function coerceTaskResult(raw: unknown): TaskResult | null {
  if (raw === null || raw === undefined) return null;
  const parsed = TaskResultSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
