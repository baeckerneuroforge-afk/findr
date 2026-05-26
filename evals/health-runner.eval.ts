import { beforeAll, afterAll, describe, expect, it } from "vitest";
import chalk from "chalk";
import { config } from "dotenv";
import {
  analyzeHealth,
  DEFAULT_HEALTH_MODEL,
  HealthUnavailableError,
} from "@/lib/health/classifier";
import { aggregateHealth } from "@/lib/health/aggregate";
import {
  HEALTH_AXIS_KEYS,
  type HealthAxisKey,
  type HealthLevel,
} from "@/lib/schemas/health";
import { HEALTH_CASES } from "./health-dataset";
import type {
  AxisReport,
  HealthEvalReport,
  HealthEvalResult,
} from "./health-types";

config({ path: ".env.local" });

// Opus is the production model; cost-per-call is higher than the Risk eval.
const COST_PER_CALL_USD = 0.05;

// Model resolution (eval > env > default), mirrors the Risk eval. EVAL_MODEL
// stays the universal cheap-override knob; HEALTH_MODEL targets only this eval.
const ACTIVE_MODEL =
  process.env.EVAL_MODEL ??
  process.env.HEALTH_MODEL ??
  DEFAULT_HEALTH_MODEL;

const results: HealthEvalResult[] = [];
const startTime = Date.now();

beforeAll(() => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set. Cannot run health evals.");
  }
  console.log(chalk.cyan("\n... CS Health Eval Suite ..."));
  console.log(chalk.gray(`Running eval with model: ${ACTIVE_MODEL}`));
  console.log(
    chalk.gray(
      `Running ${HEALTH_CASES.length} cases (~$${(
        HEALTH_CASES.length * COST_PER_CALL_USD
      ).toFixed(2)} total)\n`,
    ),
  );
});

afterAll(() => {
  const report = buildReport(results, Date.now() - startTime);
  printReport(report);
});

describe("CS Health Classifier Eval Suite", () => {
  HEALTH_CASES.forEach((evalCase) => {
    it(`${evalCase.id}: ${evalCase.description}`, async () => {
      const caseStart = Date.now();
      const errors: string[] = [];
      let errored = false;

      const emptyAxesReport: Record<HealthAxisKey, AxisReport> = {
        product: { score: 0, confidence: 0, evidenceCount: 0, evidenceOrphans: 0 },
        relationship: { score: 0, confidence: 0, evidenceCount: 0, evidenceOrphans: 0 },
        valueRealization: { score: 0, confidence: 0, evidenceCount: 0, evidenceOrphans: 0 },
        engagement: { score: 0, confidence: 0, evidenceCount: 0, evidenceOrphans: 0 },
      };
      let actual: HealthEvalResult["actual"] = {
        healthScore: 0,
        healthLevel: "unknown",
        rawHealthScore: 0,
        rawHealthLevel: "unknown",
        axes: emptyAxesReport,
        acuteSignals: [],
        signalEvidenceOrphans: 0,
      };

      try {
        const result = await analyzeHealth(
          {
            transcript: evalCase.call.transcript,
            account: evalCase.account,
            recordedAt: evalCase.call.recordedAt,
          },
          ACTIVE_MODEL,
        );

        // Deterministic recomputation — that's the score we score against.
        const aggregated = aggregateHealth(
          result.satisfactionAxes,
          result.acuteSignals,
        );

        const transcript = evalCase.call.transcript;
        const axesReport = HEALTH_AXIS_KEYS.reduce(
          (acc, key) => {
            const axis = result.satisfactionAxes[key];
            const orphans = axis.evidence.filter((q) => {
              if (isVerbatim(q, transcript)) return false;
              logOrphan(evalCase.id, `axis:${key}`, q, transcript);
              return true;
            }).length;
            acc[key] = {
              score: axis.score,
              confidence: axis.confidence,
              evidenceCount: axis.evidence.length,
              evidenceOrphans: orphans,
            };
            return acc;
          },
          {} as Record<HealthAxisKey, AxisReport>,
        );

        const signalEvidenceOrphans = result.acuteSignals.reduce(
          (sum, s) =>
            sum +
            s.evidence.filter((q) => {
              if (isVerbatim(q, transcript)) return false;
              logOrphan(evalCase.id, `signal:${s.type}`, q, transcript);
              return true;
            }).length,
          0,
        );

        actual = {
          healthScore: aggregated.healthScore,
          healthLevel: aggregated.healthLevel,
          rawHealthScore: result.healthScore,
          rawHealthLevel: result.healthLevel,
          axes: axesReport,
          acuteSignals: result.acuteSignals.map((s) => s.type),
          signalEvidenceOrphans,
        };

        // ── Assertions ───────────────────────────────────────────────────
        if (
          aggregated.healthScore < evalCase.expected.scoreRangeMin ||
          aggregated.healthScore > evalCase.expected.scoreRangeMax
        ) {
          errors.push(
            `Score ${aggregated.healthScore} out of range [${evalCase.expected.scoreRangeMin}-${evalCase.expected.scoreRangeMax}]`,
          );
        }
        if (aggregated.healthLevel !== evalCase.expected.healthLevel) {
          errors.push(
            `Level ${aggregated.healthLevel} != expected ${evalCase.expected.healthLevel}`,
          );
        }

        for (const required of evalCase.expected.requiredAcuteSignals ?? []) {
          if (!actual.acuteSignals.includes(required)) {
            errors.push(`Missing required acute signal: ${required}`);
          }
        }
        for (const forbidden of evalCase.expected.forbiddenAcuteSignals ?? []) {
          if (actual.acuteSignals.includes(forbidden)) {
            errors.push(`Detected forbidden acute signal: ${forbidden}`);
          }
        }

        for (const lowAxis of evalCase.expected.lowConfidenceAxes ?? []) {
          const conf = result.satisfactionAxes[lowAxis].confidence;
          if (conf >= 0.3) {
            errors.push(
              `Expected low confidence on '${lowAxis}' but got ${conf.toFixed(2)}`,
            );
          }
        }

        // Verbatim evidence (anti-hallucination): any orphan entry fails the case.
        const totalEvidenceOrphans =
          (Object.values(axesReport) as AxisReport[]).reduce(
            (sum, a) => sum + a.evidenceOrphans,
            0,
          ) + signalEvidenceOrphans;
        if (totalEvidenceOrphans > 0) {
          errors.push(
            `${totalEvidenceOrphans} non-verbatim evidence entr${totalEvidenceOrphans === 1 ? "y" : "ies"} (hallucination)`,
          );
        }
      } catch (err) {
        errored = true;
        const detail =
          err instanceof HealthUnavailableError
            ? `${err.message}${err.cause instanceof Error ? `: ${err.cause.message}` : ""}`
            : err instanceof Error
              ? err.message
              : "unknown error";
        errors.push(`LLM ERROR (analysis did not run): ${detail}`);
      }

      const evalResult: HealthEvalResult = {
        caseId: evalCase.id,
        passed: errors.length === 0,
        errored,
        actual,
        expected: evalCase.expected,
        errors,
        durationMs: Date.now() - caseStart,
      };
      results.push(evalResult);

      if (errored) {
        console.log(chalk.bgRed.white(`  ERR ${evalCase.id}: LLM did not run`));
        errors.forEach((e) => console.log(chalk.red(`    - ${e}`)));
      } else if (errors.length > 0) {
        console.log(chalk.red(`  x ${evalCase.id}: ${errors.length} error(s)`));
        errors.forEach((e) => console.log(chalk.gray(`    - ${e}`)));
      } else {
        console.log(chalk.green(`  ok ${evalCase.id}`));
      }
      expect.soft(errors).toEqual([]);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Folds Unicode + DE typography variants so substring checks treat smart
 * quotes, en/em-dashes, umlauts, and ß as their ASCII equivalents. Hoisted
 * to module level so isVerbatim + findClosestPassage share ONE normalization.
 *
 * Normalization:
 *  - NFKC (compose composed/decomposed forms, normalize compatibility chars)
 *  - DE umlauts folded to ASCII pairs (ü→ue, ä→ae, ö→oe, ß→ss). Both sides
 *    are folded, so transcript "ü" matches quote "ue" (and vice versa).
 *  - ALL quote varieties — ASCII " and ', typographic doubles („ “ ” « »),
 *    typographic singles (‘ ’ ‚ ‹ ›) — fold to a single character ("). The
 *    classifier sometimes wraps a quoted-inside-quote with single quotes
 *    where the transcript has doubles (or vice versa); after this collapse
 *    they match regardless of wrapper style. Quote chars carry no
 *    content-bearing signal for verbatim checks.
 *  - En-/em-dashes (– —) → ASCII -.
 *  - Whitespace collapsed, trimmed, lowercased.
 */
function fold(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/Ä/g, "Ae")
    .replace(/ä/g, "ae")
    .replace(/Ö/g, "Oe")
    .replace(/ö/g, "oe")
    .replace(/Ü/g, "Ue")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/["'„“”«»‘’‚‹›]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Substring check after folding. Strict on content (paraphrases fail),
 * forgiving on whitespace + typography. The classifier prompt says
 * "verbatim only"; orphans here mean hallucinated/paraphrased quotes the
 * fold can't rescue.
 */
function isVerbatim(quote: string, transcript: string): boolean {
  if (!quote.trim()) return true; // empty evidence is fine (default [])
  return fold(transcript).includes(fold(quote));
}

/**
 * Diagnostic for orphans: finds the longest contiguous substring of the
 * folded quote that DOES appear in the folded transcript, returns a
 * ~60-char window around it. Lets us see at-a-glance whether an orphan is
 * a one-character typography miss vs. a real paraphrase / hallucination.
 *
 * O(n²) on quote length, but only invoked on orphans (rare).
 */
function findClosestPassage(quote: string, transcript: string): string {
  const fq = fold(quote);
  const ft = fold(transcript);
  if (!fq || !ft) return "(empty)";
  const minLen = Math.min(8, fq.length);
  for (let len = fq.length; len >= minLen; len--) {
    for (let start = 0; start + len <= fq.length; start++) {
      const slice = fq.slice(start, start + len);
      const idx = ft.indexOf(slice);
      if (idx >= 0) {
        const winStart = Math.max(0, idx - 30);
        const winEnd = Math.min(ft.length, idx + len + 30);
        const before = winStart > 0 ? "…" : "";
        const after = winEnd < ft.length ? "…" : "";
        return `${before}${ft.slice(winStart, winEnd)}${after}`;
      }
    }
  }
  return "(no substantial overlap)";
}

/**
 * One-line warning per non-verbatim evidence entry. Triggered from the
 * eval runner's orphan-detection branches so we can spot whether residual
 * orphans are one-character typography misses or real paraphrases.
 * Logging-only — no logic change.
 */
function logOrphan(
  caseId: string,
  source: string,
  quote: string,
  transcript: string,
): void {
  console.warn(chalk.yellow(`  [orphan] ${caseId} ${source}`));
  console.warn(chalk.yellow(`    quote:   ${JSON.stringify(quote)}`));
  console.warn(
    chalk.gray(
      `    nearest: ${JSON.stringify(findClosestPassage(quote, transcript))}`,
    ),
  );
}

function buildReport(
  rs: HealthEvalResult[],
  totalDurationMs: number,
): HealthEvalReport {
  const passed = rs.filter((r) => r.passed).length;
  const failed = rs.length - passed;
  const errored = rs.filter((r) => r.errored).length;

  // Level + score-in-band rates
  const levelMatches = rs.filter(
    (r) => r.actual.healthLevel === r.expected.healthLevel,
  ).length;
  const scoreInBand = rs.filter(
    (r) =>
      r.actual.healthScore >= r.expected.scoreRangeMin &&
      r.actual.healthScore <= r.expected.scoreRangeMax,
  ).length;

  // Verbatim evidence rate (total non-orphan entries / total entries).
  let evidenceTotal = 0;
  let evidenceVerbatim = 0;
  for (const r of rs) {
    for (const axis of Object.values(r.actual.axes)) {
      evidenceTotal += axis.evidenceCount;
      evidenceVerbatim += axis.evidenceCount - axis.evidenceOrphans;
    }
    // signal evidence counts not tracked per-signal; we use the aggregate orphan
    // count and don't subtract from total here. To compute a clean rate, only
    // axes evidence is used (signals contribute via orphan errors per case).
  }

  // Low-confidence honesty rate
  let lowConfExpected = 0;
  let lowConfHonored = 0;
  for (const r of rs) {
    const expectations = r.expected.lowConfidenceAxes ?? [];
    for (const key of expectations) {
      lowConfExpected++;
      if (r.actual.axes[key].confidence < 0.3) lowConfHonored++;
    }
  }

  const perCategoryAccuracy: Record<string, { passed: number; total: number }> =
    {};
  for (const r of rs) {
    const c = (r.expected.healthLevel as HealthLevel | "lukewarm") ?? "unknown";
    perCategoryAccuracy[c] ??= { passed: 0, total: 0 };
    perCategoryAccuracy[c].total++;
    if (r.passed) perCategoryAccuracy[c].passed++;
  }

  return {
    totalCases: rs.length,
    passedCases: passed,
    failedCases: failed,
    erroredCases: errored,
    accuracyPct: rs.length > 0 ? (passed / rs.length) * 100 : 0,
    levelAccuracy: rs.length > 0 ? levelMatches / rs.length : 0,
    scoreInBandRate: rs.length > 0 ? scoreInBand / rs.length : 0,
    evidenceVerbatimRate: evidenceTotal > 0 ? evidenceVerbatim / evidenceTotal : 1,
    lowConfidenceHonestyRate:
      lowConfExpected > 0 ? lowConfHonored / lowConfExpected : 1,
    totalDurationMs,
    estimatedCostUsd: rs.length * COST_PER_CALL_USD,
    perCategoryAccuracy,
    failures: rs.filter((r) => !r.passed),
  };
}

function printReport(report: HealthEvalReport) {
  console.log(chalk.cyan("\n... CS Health Eval Report ...\n"));

  if (report.erroredCases > 0) {
    console.log(
      chalk.bgRed.white(
        `  LLM ERRORS: ${report.erroredCases}/${report.totalCases} cases — the model did not run. Metrics below are NOT trustworthy.`,
      ),
    );
    console.log("");
  }

  console.log(chalk.bold("Overall:"));
  console.log(`  Total cases:           ${report.totalCases}`);
  console.log(`  LLM errors:            ${chalk.red(report.erroredCases)}`);
  console.log(
    `  Passed:                ${chalk.green(report.passedCases)} (${report.accuracyPct.toFixed(1)}%)`,
  );
  console.log(`  Failed:                ${chalk.red(report.failedCases)}`);
  console.log(`  Duration:              ${(report.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Estimated cost:        $${report.estimatedCostUsd.toFixed(2)}`);

  console.log(chalk.bold("\nHealth Metrics:"));
  console.log(
    `  Level accuracy:        ${(report.levelAccuracy * 100).toFixed(1)}% (healthLevel matched)`,
  );
  console.log(
    `  Score in band:         ${(report.scoreInBandRate * 100).toFixed(1)}% (aggregated score within expected band)`,
  );
  console.log(
    `  Evidence verbatim:     ${(report.evidenceVerbatimRate * 100).toFixed(1)}% (of axis evidence, share quoted verbatim from transcript)`,
  );
  console.log(
    `  Low-conf honesty:      ${(report.lowConfidenceHonestyRate * 100).toFixed(1)}% (of axes expected thin, share rated confidence < 0.3)`,
  );

  console.log(chalk.bold("\nPer Expected Level:"));
  for (const [level, stats] of Object.entries(report.perCategoryAccuracy)) {
    const pct = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
    const color = pct >= 80 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
    console.log(
      `  ${level.padEnd(10)}: ${color(`${stats.passed}/${stats.total}`)} (${pct.toFixed(0)}%)`,
    );
  }

  if (report.failures.length > 0) {
    console.log(chalk.bold("\nFailures:"));
    for (const failure of report.failures.slice(0, 12)) {
      console.log(chalk.red(`\n  ${failure.caseId}:`));
      console.log(
        `    Expected: ${failure.expected.healthLevel} (${failure.expected.scoreRangeMin}-${failure.expected.scoreRangeMax})`,
      );
      console.log(
        `    Actual:   ${failure.actual.healthLevel} (agg ${failure.actual.healthScore}, raw ${failure.actual.rawHealthScore})`,
      );
      console.log(
        `    Signals:  ${failure.actual.acuteSignals.join(", ") || "none"}`,
      );
      for (const error of failure.errors) {
        console.log(chalk.gray(`    - ${error}`));
      }
    }
    if (report.failures.length > 12) {
      console.log(
        chalk.gray(`\n  ... and ${report.failures.length - 12} more failures`),
      );
    }
  }

  console.log(chalk.cyan("\n....................\n"));
}

