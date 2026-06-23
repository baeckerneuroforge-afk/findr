import "server-only";

import { createResearchSupabase } from "@/lib/research/db";
import { coerceTaskResult } from "@/lib/schemas/task-result";
import { coerceTaskSuccessJudgment } from "@/lib/schemas/task-success";
import {
  INTERACTION_SUMMARY_VERSION,
  MIN_INTERACTION_SESSIONS,
  type InteractionSummary,
} from "@/lib/schemas/synthesis-interaction";

/**
 * Phase D — per-STUDY usability aggregate for the synthesis. SERVER-
 * DETERMINISTIC (pure arithmetic over the completed sessions' task_result;
 * never the LLM), mirroring loadSynthesisSignalInputs: fail-open (any read
 * error → null, core synthesis unchanged), aggregate-only, min-N gated.
 *
 * AGGREGATE-ONLY (Art. 22): only study-level numbers, never a per-participant
 * row. Below MIN_INTERACTION_SESSIONS the summary is null so a single
 * respondent can never be singled out.
 */

const INTERACTION_SESSION_LIMIT = 2000;

interface InteractionRow {
  success: boolean | null;
  timeOnTaskSeconds: number | null;
  clickCount: number;
  frictionCount: number;
  /** Phase C judge verdict for this session, or null when not judged. */
  verdict: "success" | "partial" | "failure" | null;
}

/** Pure aggregation — separately unit-testable. `rows` are the sessions that
 *  carry a task_result. Returns null below the min-N gate. */
export function aggregateInteractionSessions(
  rows: InteractionRow[],
): InteractionSummary | null {
  const n = rows.length;
  if (n < MIN_INTERACTION_SESSIONS) return null;

  // Success rate over sessions with a DETERMINATE outcome (success !== null).
  const determinate = rows.filter((r) => r.success !== null);
  const successRate =
    determinate.length > 0
      ? determinate.filter((r) => r.success === true).length /
        determinate.length
      : null;

  const timed = rows.filter(
    (r): r is InteractionRow & { timeOnTaskSeconds: number } =>
      r.timeOnTaskSeconds !== null,
  );
  const avgTimeSeconds =
    timed.length > 0
      ? Math.round(
          timed.reduce((s, r) => s + r.timeOnTaskSeconds, 0) / timed.length,
        )
      : null;

  const avgClicks =
    Math.round((rows.reduce((s, r) => s + r.clickCount, 0) / n) * 10) / 10;

  const frictionRate = rows.filter((r) => r.frictionCount > 0).length / n;

  // Judge agreement: only over sessions that have BOTH a determinate behavioural
  // outcome AND a verdict. Agreement = the binary behavioural success matches the
  // verdict's clear pole (success↔success, failure↔failure); 'partial' never
  // counts as agreement with a binary signal. Aggregate share only.
  const judged = rows.filter((r) => r.verdict !== null && r.success !== null);
  const judgeAgreement =
    judged.length > 0
      ? judged.filter(
          (r) =>
            (r.success === true && r.verdict === "success") ||
            (r.success === false && r.verdict === "failure"),
        ).length / judged.length
      : null;

  return {
    version: INTERACTION_SUMMARY_VERSION,
    sessionsWithResults: n,
    successRate,
    avgTimeSeconds,
    avgClicks,
    frictionRate,
    judgeAgreement,
  };
}

/** Loads + aggregates the completed research sessions' task_result (+ Phase-C
 *  verdicts) for one study. Fail-open: any error → null. */
export async function loadSynthesisInteractionSummary(
  orgId: string,
  planId: string,
): Promise<InteractionSummary | null> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("task_result, task_success_judgment")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .eq("kind", "research")
      .eq("status", "completed")
      .limit(INTERACTION_SESSION_LIMIT);
    if (error || !data) {
      if (error) {
        console.warn(
          `[synthesis-interaction] session read failed (continuing without usability aggregate): ${error.message}`,
        );
      }
      return null;
    }
    const rows: InteractionRow[] = [];
    for (const row of data) {
      const tr = coerceTaskResult((row as { task_result?: unknown }).task_result);
      if (!tr) continue; // only sessions WITH a task_result count
      const judgment = coerceTaskSuccessJudgment(
        (row as { task_success_judgment?: unknown }).task_success_judgment,
      );
      rows.push({
        success: tr.success,
        timeOnTaskSeconds: tr.time_on_task_seconds,
        clickCount: tr.click_count,
        frictionCount: tr.friction_events.length,
        verdict: judgment?.verdict ?? null,
      });
    }
    return aggregateInteractionSessions(rows);
  } catch (err) {
    console.warn(
      "[synthesis-interaction] loader failed (continuing without usability aggregate):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
