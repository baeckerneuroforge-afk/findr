/**
 * Shared status helpers for the daily cron routes.
 *
 * Crons accumulate per-item failures into an `errors[]` array but historically
 * always returned HTTP 200 (`success: true`), so a fully-failed run still showed
 * up GREEN in the Vercel cron dashboard. These predicates decide when a run must
 * instead return a non-2xx status — the signal Vercel uses to mark an invocation
 * as failed, and the hook a future error-monitor can alert on.
 */

/**
 * Strict policy — for DSGVO-critical sweeps (e.g. the retention deletion sweep):
 * the run failed if it recorded ANY error. A single un-deleted PII row must be
 * visible, so there is no tolerance threshold.
 */
export function cronHadAnyError(errorCount: number): boolean {
  return errorCount > 0;
}

/**
 * Threshold policy — for per-item-tolerant sweeps (e.g. reanalyze,
 * account-checkins): the run failed only on a TOTAL failure — nothing it
 * attempted succeeded AND at least one error was recorded. A single bad
 * deal/account must not flap the whole daily run, so a partially-successful run
 * stays 200 with its per-item errors carried in the response body.
 */
export function cronIsTotalFailure(
  succeeded: number,
  errorCount: number,
): boolean {
  return succeeded === 0 && errorCount > 0;
}
