import { beforeAll, afterAll, describe, expect, it } from "vitest";
import chalk from "chalk";
import { config } from "dotenv";
import {
  analyzeDealRiskLLM,
  ANALYSIS_MODEL,
  LLMUnavailableError,
} from "@/lib/risk/llm-classifier";
import type { Deal, DealStage } from "@/lib/deals/types";
import type { CallForPrompt } from "@/lib/risk/prompts";
import { EVAL_CASES } from "./dataset";
import type { EvalCase, EvalReport, EvalResult } from "./types";

config({ path: ".env.local" });

const COST_PER_CALL_USD = 0.02;
// Eval measures the pure LLM path (no heuristic fallback). Model is overridable
// via EVAL_MODEL for cheap tuning (e.g. Haiku/Sonnet); defaults to the
// production ANALYSIS_MODEL (Opus).
const ACTIVE_MODEL = process.env.EVAL_MODEL ?? ANALYSIS_MODEL;
const results: EvalResult[] = [];
const startTime = Date.now();

beforeAll(() => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set. Cannot run evals.");
  }

  console.log(chalk.cyan("\n... Findr Eval Suite ..."));
  console.log(chalk.gray(`Running eval with model: ${ACTIVE_MODEL}`));
  console.log(
    chalk.gray(
      `Running ${EVAL_CASES.length} cases (~$${(
        EVAL_CASES.length * COST_PER_CALL_USD
      ).toFixed(2)} total)\n`,
    ),
  );
});

afterAll(() => {
  const report = buildReport(results, Date.now() - startTime);
  printReport(report);
});

describe("Risk Classifier Eval Suite", () => {
  EVAL_CASES.forEach((evalCase) => {
    it(`${evalCase.id}: ${evalCase.description}`, async () => {
      const caseStart = Date.now();
      const errors: string[] = [];
      let errored = false;
      let actual: EvalResult["actual"] = {
        riskScore: 0,
        riskLevel: "unknown",
        detectedSignals: [],
      };

      try {
        // Pure LLM path — NO heuristic fallback. If the LLM call fails, the
        // case is flagged as errored so a broken model surfaces loudly instead
        // of being silently scored against heuristic output.
        const result = await analyzeDealRiskLLM(
          toClassifierDeal(evalCase),
          toClassifierCalls(evalCase),
          ACTIVE_MODEL,
        );

        actual = {
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          detectedSignals: result.signals.map((signal) => signal.type),
        };

        const scoreInRange =
          result.riskScore >= evalCase.expected.scoreRangeMin &&
          result.riskScore <= evalCase.expected.scoreRangeMax;
        if (!scoreInRange) {
          errors.push(
            `Score ${result.riskScore} out of range [${evalCase.expected.scoreRangeMin}-${evalCase.expected.scoreRangeMax}]`,
          );
        }

        if (result.riskLevel !== evalCase.expected.riskLevel) {
          errors.push(
            `Level ${result.riskLevel} != expected ${evalCase.expected.riskLevel}`,
          );
        }

        for (const required of evalCase.expected.requiredSignals) {
          if (!actual.detectedSignals.includes(required)) {
            errors.push(`Missing required signal: ${required}`);
          }
        }

        for (const forbidden of evalCase.expected.forbiddenSignals ?? []) {
          if (actual.detectedSignals.includes(forbidden)) {
            errors.push(`Detected forbidden signal: ${forbidden}`);
          }
        }
      } catch (err) {
        errored = true;
        const detail =
          err instanceof LLMUnavailableError
            ? `${err.message}${err.cause instanceof Error ? `: ${err.cause.message}` : ""}`
            : err instanceof Error
              ? err.message
              : "unknown error";
        errors.push(`LLM ERROR (analysis did not run): ${detail}`);
      }

      const evalResult: EvalResult = {
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
        errors.forEach((error) => console.log(chalk.red(`    - ${error}`)));
      } else if (errors.length > 0) {
        console.log(chalk.red(`  x ${evalCase.id}: ${errors.length} error(s)`));
        errors.forEach((error) => console.log(chalk.gray(`    - ${error}`)));
      } else {
        console.log(chalk.green(`  ok ${evalCase.id}`));
      }

      expect.soft(errors).toEqual([]);
    });
  });
});

function toClassifierDeal(evalCase: EvalCase): Deal {
  const lastActivityDate = new Date(evalCase.deal.lastActivity);
  const daysSinceLastActivity = Number.isNaN(lastActivityDate.getTime())
    ? 0
    : Math.max(
        0,
        Math.floor((Date.now() - lastActivityDate.getTime()) / 86_400_000),
      );
  const closeDate = new Date(lastActivityDate);
  closeDate.setDate(closeDate.getDate() + 30);

  return {
    id: evalCase.deal.id,
    name: evalCase.deal.name,
    companyName: evalCase.deal.company,
    amount: evalCase.deal.amount,
    currency:
      evalCase.deal.company.endsWith("Inc.") || evalCase.deal.company.endsWith("Inc")
        ? "USD"
        : "EUR",
    stage: toDealStage(evalCase.deal.stage),
    ownerName: evalCase.deal.ownerName,
    championName: "Primary Champion",
    championTitle: "Revenue Operations",
    daysSinceLastActivity,
    callsCompleted: evalCase.calls.length,
    emailsSent: Math.max(2, evalCase.calls.length * 3),
    stakeholdersCount: countStakeholders(evalCase),
    competitorsMentioned: inferCompetitors(evalCase),
    closeDate: Number.isNaN(closeDate.getTime())
      ? new Date().toISOString()
      : closeDate.toISOString(),
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

function toClassifierCalls(evalCase: EvalCase): CallForPrompt[] {
  return evalCase.calls.map((call) => ({
    call_type: call.title,
    duration_seconds: call.duration_seconds,
    recorded_at: call.recorded_at,
    transcript_summary: call.title,
    transcript: call.transcript_segments
      .map((segment) => `${segment.speaker_role}: ${segment.content}`)
      .join("\n"),
  }));
}

function toDealStage(stage: string): DealStage {
  if (
    stage === "qualified" ||
    stage === "demo" ||
    stage === "proposal_sent" ||
    stage === "negotiation" ||
    stage === "verbal_commit" ||
    stage === "closed_won" ||
    stage === "closed_lost"
  ) {
    return stage;
  }

  return "qualified";
}

function countStakeholders(evalCase: EvalCase): number {
  return new Set(
    evalCase.calls.flatMap((call) =>
      call.transcript_segments.map((segment) => segment.speaker_role),
    ),
  ).size;
}

function inferCompetitors(evalCase: EvalCase): string[] {
  const text = evalCase.calls
    .flatMap((call) => call.transcript_segments.map((segment) => segment.content))
    .join(" ")
    .toLowerCase();
  const competitors = ["salesforce", "gong", "clari", "chorus", "hubspot"];

  return competitors.filter((competitor) => text.includes(competitor));
}

function buildReport(results: EvalResult[], totalDurationMs: number): EvalReport {
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  let totalDetected = 0;
  let totalExpected = 0;
  let correctlyDetected = 0;
  let falsePositiveSignals = 0;

  for (const result of results) {
    const detected = new Set(result.actual.detectedSignals);
    const expected = new Set(result.expected.requiredSignals);

    totalDetected += detected.size;
    totalExpected += expected.size;

    for (const signal of detected) {
      if (expected.has(signal)) {
        correctlyDetected++;
      } else {
        falsePositiveSignals++;
      }
    }
  }

  const signalPrecision =
    totalDetected > 0 ? correctlyDetected / totalDetected : 0;
  const signalRecall = totalExpected > 0 ? correctlyDetected / totalExpected : 0;
  const falsePositiveRate =
    totalDetected > 0 ? falsePositiveSignals / totalDetected : 0;
  const levelMatches = results.filter(
    (result) => result.actual.riskLevel === result.expected.riskLevel,
  ).length;
  const levelAccuracy = results.length > 0 ? levelMatches / results.length : 0;
  const perCategoryAccuracy: Record<string, { passed: number; total: number }> =
    {};

  for (const result of results) {
    const category = result.expected.riskLevel;
    perCategoryAccuracy[category] ??= { passed: 0, total: 0 };
    perCategoryAccuracy[category].total++;
    if (result.passed) perCategoryAccuracy[category].passed++;
  }

  return {
    totalCases: results.length,
    passedCases: passed,
    failedCases: failed,
    accuracyPct: results.length > 0 ? (passed / results.length) * 100 : 0,
    signalPrecision,
    signalRecall,
    falsePositiveRate,
    levelAccuracy,
    totalDurationMs,
    estimatedCostUsd: results.length * COST_PER_CALL_USD,
    perCategoryAccuracy,
    failures: results.filter((result) => !result.passed),
  };
}

function printReport(report: EvalReport) {
  console.log(chalk.cyan("\n... Eval Report ...\n"));

  const erroredCases = report.failures.filter((failure) => failure.errored);
  if (erroredCases.length > 0) {
    console.log(
      chalk.bgRed.white(
        `  LLM ERRORS: ${erroredCases.length}/${report.totalCases} cases — the model did not run. Metrics below are NOT trustworthy.`,
      ),
    );
    for (const errored of erroredCases.slice(0, 5)) {
      console.log(chalk.red(`    ${errored.caseId}: ${errored.errors[0] ?? ""}`));
    }
    console.log("");
  }

  console.log(chalk.bold("Overall:"));
  console.log(`  Total cases:      ${report.totalCases}`);
  console.log(`  LLM errors:       ${chalk.red(erroredCases.length)}`);
  console.log(
    `  Passed:           ${chalk.green(report.passedCases)} (${report.accuracyPct.toFixed(1)}%)`,
  );
  console.log(`  Failed:           ${chalk.red(report.failedCases)}`);
  console.log(`  Duration:         ${(report.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Estimated cost:   $${report.estimatedCostUsd.toFixed(2)}`);

  console.log(chalk.bold("\nSignal Metrics:"));
  console.log(
    `  Precision:        ${(report.signalPrecision * 100).toFixed(1)}% (of detected signals, how many correct)`,
  );
  console.log(
    `  Recall:           ${(report.signalRecall * 100).toFixed(1)}% (of expected signals, how many detected)`,
  );
  console.log(
    `  False positives:  ${(report.falsePositiveRate * 100).toFixed(1)}% (of detected signals, how many extra)`,
  );
  console.log(
    `  Level accuracy:   ${(report.levelAccuracy * 100).toFixed(1)}% (riskLevel matched)`,
  );

  console.log(chalk.bold("\nPer Category:"));
  for (const [category, stats] of Object.entries(report.perCategoryAccuracy)) {
    const pct = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
    const color = pct >= 80 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
    console.log(
      `  ${category.padEnd(10)}: ${color(`${stats.passed}/${stats.total}`)} (${pct.toFixed(0)}%)`,
    );
  }

  if (report.failures.length > 0) {
    console.log(chalk.bold("\nFailures:"));
    for (const failure of report.failures.slice(0, 10)) {
      console.log(chalk.red(`\n  ${failure.caseId}:`));
      console.log(
        `    Expected: ${failure.expected.riskLevel} (${failure.expected.scoreRangeMin}-${failure.expected.scoreRangeMax})`,
      );
      console.log(
        `    Actual:   ${failure.actual.riskLevel} (${failure.actual.riskScore})`,
      );
      console.log(
        `    Signals:  ${failure.actual.detectedSignals.join(", ") || "none"}`,
      );
      for (const error of failure.errors) {
        console.log(chalk.gray(`    - ${error}`));
      }
    }
    if (report.failures.length > 10) {
      console.log(
        chalk.gray(`\n  ... and ${report.failures.length - 10} more failures`),
      );
    }
  }

  console.log(chalk.cyan("\n....................\n"));
}
