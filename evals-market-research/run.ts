/**
 * Method-aware Market Research Extraction Eval Runner
 * ----------------------------------------------------
 * Runs Stage-1 extraction over the hand-crafted dataset and hard-checks:
 *   (a) expected categories dominate,
 *   (b) categories with expected zero stay empty,
 *   (c) every finding has verbatim transcript evidence.
 *
 * Default model matches evals-synthesis: Sonnet for repeatable iteration.
 */

import { config } from "dotenv";
import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import type {
  MarketFinding,
  MarketFindingCategory,
  MarketResearchResult,
} from "@/lib/schemas/market-research";
import {
  MARKET_RESEARCH_EVAL_CASES,
  type MarketResearchEvalCase,
} from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.MARKET_RESEARCH_MODEL ?? CLAUDE_MODELS.sonnet;

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

interface Check {
  ok: boolean;
  note: string;
}

interface CheckTally {
  passed: number;
  failed: number;
}

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

function categoryCounts(
  findings: MarketFinding[],
): Map<MarketFindingCategory, number> {
  const counts = new Map<MarketFindingCategory, number>();
  for (const finding of findings) {
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
  }
  return counts;
}

function checkDominance(
  testCase: MarketResearchEvalCase,
  findings: MarketFinding[],
): Check {
  const expected = new Set(testCase.expected.dominantCategories);
  const counts = categoryCounts(findings);
  const missing = testCase.expected.dominantCategories.filter(
    (category) => (counts.get(category) ?? 0) === 0,
  );
  const expectedCount = findings.filter((finding) =>
    expected.has(finding.category),
  ).length;
  const unexpectedCount = findings.length - expectedCount;

  if (missing.length > 0) {
    return {
      ok: false,
      note: `missing expected categories: ${missing.join(", ")}`,
    };
  }
  if (expectedCount <= unexpectedCount) {
    return {
      ok: false,
      note: `expected=${expectedCount}, unexpected=${unexpectedCount}; expected categories do not dominate`,
    };
  }
  return {
    ok: true,
    note: `expected=${expectedCount}, unexpected=${unexpectedCount}; all expected categories present`,
  };
}

function checkZeroCategories(
  testCase: MarketResearchEvalCase,
  findings: MarketFinding[],
): Check {
  const zero = new Set(testCase.expected.zeroCategories);
  const leaked = findings.filter((finding) => zero.has(finding.category));
  if (leaked.length > 0) {
    return {
      ok: false,
      note: `${leaked.length} leaked finding(s): ${leaked
        .map((finding) => finding.category)
        .join(", ")}`,
    };
  }
  return {
    ok: true,
    note: `zero preserved for ${testCase.expected.zeroCategories.join(", ")}`,
  };
}

function checkAnchored(
  transcript: string,
  findings: MarketFinding[],
): Check {
  const foldedTranscript = fold(transcript);
  const violations: string[] = [];

  findings.forEach((finding, findingIndex) => {
    if (finding.evidence.length === 0) {
      violations.push(`finding[${findingIndex}] has no evidence`);
      return;
    }
    finding.evidence.forEach((quote, quoteIndex) => {
      if (!foldedTranscript.includes(fold(quote))) {
        violations.push(
          `finding[${findingIndex}].evidence[${quoteIndex}] is not verbatim`,
        );
      }
    });
  });

  if (violations.length > 0) {
    return {
      ok: false,
      note: violations.join("; "),
    };
  }
  return {
    ok: true,
    note: `${findings.length} finding(s), all evidence verbatim and non-empty`,
  };
}

function printCheck(label: string, check: Check, tally: CheckTally): void {
  if (check.ok) {
    tally.passed += 1;
    console.log(`  ${C.green}PASS${C.reset} ${label}: ${check.note}`);
    return;
  }
  tally.failed += 1;
  console.log(`  ${C.red}FAIL${C.reset} ${label}: ${check.note}`);
}

function printFinding(finding: MarketFinding, index: number): void {
  console.log(
    `\n  ${C.bold}Finding ${index + 1}${C.reset} [${finding.category}] intensity=${finding.intensity} conf=${finding.confidence.toFixed(2)}`,
  );
  console.log(`  ${finding.title}`);
  console.log(`  ${C.dim}${finding.description}${C.reset}`);
  finding.evidence.forEach((quote) => {
    console.log(`  ${C.dim}quote: "${quote}"${C.reset}`);
  });
}

function printCase(
  testCase: MarketResearchEvalCase,
  result: MarketResearchResult,
  tally: CheckTally,
): void {
  console.log(`\n${"=".repeat(78)}`);
  console.log(
    `${C.bold}${testCase.id}${C.reset} [${testCase.input.useCase}] — ${testCase.description}`,
  );
  console.log(`${C.dim}${testCase.rationale}${C.reset}`);
  console.log(
    `expected dominant: ${testCase.expected.dominantCategories.join(", ")}`,
  );
  console.log(`expected zero: ${testCase.expected.zeroCategories.join(", ")}`);
  console.log(`\nSUMMARY: ${result.summary}`);

  result.findings.forEach(printFinding);
  if (result.findings.length === 0) {
    console.log("\n  (no findings)");
  }

  console.log("\nCHECKS");
  printCheck(
    "category-dominance",
    checkDominance(testCase, result.findings),
    tally,
  );
  printCheck(
    "no-fabrication",
    checkZeroCategories(testCase, result.findings),
    tally,
  );
  printCheck(
    "anchored",
    checkAnchored(testCase.input.transcript, result.findings),
    tally,
  );
}

async function loadClassifier() {
  try {
    return await import("@/lib/market-research/classifier");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Client Component|server-only/i.test(message)) {
      console.error(
        "\nThis runner imports a server-only module. Re-run with:\n" +
          "  env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-market-research/run.ts\n",
      );
      process.exit(1);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Ensure .env.local has it and run with env -u ANTHROPIC_API_KEY.",
    );
  }

  const { analyzeMarketResearch } = await loadClassifier();
  const tally: CheckTally = { passed: 0, failed: 0 };

  console.log(
    `${C.bold}Market Research Extraction Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${MARKET_RESEARCH_EVAL_CASES.length}`,
  );

  for (const testCase of MARKET_RESEARCH_EVAL_CASES) {
    try {
      const result = await analyzeMarketResearch(testCase.input, MODEL);
      printCase(testCase, result, tally);
    } catch (err) {
      tally.failed += 1;
      console.log(`\n${"=".repeat(78)}`);
      console.log(`${C.bold}${testCase.id}${C.reset}`);
      console.log(
        `  ${C.red}ERROR${C.reset} ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${tally.passed}${C.reset}  ${C.red}failed=${tally.failed}${C.reset}`,
  );
  if (tally.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
