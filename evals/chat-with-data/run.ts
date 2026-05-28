/**
 * Chat-with-data Eval Runner
 * --------------------------
 * Runs chatWithDataFromInputs() over CHAT_EVAL_CASES, applies four
 * property checks per case, and prints a results table for manual
 * review. Same posture as evals-synthesis/run.ts and
 * evals-product-discovery/run.ts: the heuristic checks are pass/warn
 * signals, the MANUAL read of each answer + citations is the primary
 * acceptance gate.
 *
 * Checks per case:
 *   (a) answered-match — result.answered === expected.answered.
 *                        For non-answerable cases this is the
 *                        anti-hallucination gate: a false-positive here
 *                        means the engine fabricated an answer.
 *
 *   (b) anchored-ids   — every citation.interviewId is in the input
 *                        insight-id set. Engine's filter should drop
 *                        unknown ids; surfacing here means schema
 *                        allowed something through.
 *
 *   (c) anchored-quote — every citation.quote is a fold-substring of
 *                        the input verdichtungen + synthesis text.
 *                        Same fold logic as the engine (NFKC + umlaut
 *                        transliteration + smart-quote normalization).
 *
 *   (d) refusal-empty  — for non-answerable cases, citations MUST be
 *                        empty. The engine's downgrade logic should
 *                        enforce this — a fail here is a regression.
 *
 *   (e) min-citations  — for answerable cases, at least N citations
 *                        (default 1). Soft signal (WARN, not FAIL).
 *
 *   (f) answer-contains — soft substring check on the answer text
 *                         (WARN, not FAIL).
 *
 * Default model: Sonnet (cheap, for iteration). Approval runs:
 *   CHAT_WITH_DATA_MODEL=claude-opus-4-7
 *
 * Invocation (always with `env -u ANTHROPIC_API_KEY` so an exported
 * shadow key doesn't ghost-override .env.local):
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals/chat-with-data/run.ts
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  chatWithDataFromInputs,
  type ChatWithDataResult,
} from "@/lib/research/chat-with-data";

import { CHAT_EVAL_CASES, type ChatEvalCase } from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.CHAT_WITH_DATA_MODEL ?? CLAUDE_MODELS.sonnet;

// ── pretty-print helpers (matches evals-synthesis style) ───────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function header(s: string): void {
  console.log(`\n${C.bold}${C.cyan}═══ ${s} ═══${C.reset}`);
}
function ok(s: string): void {
  console.log(`  ${C.green}✓${C.reset} ${s}`);
}
function warn(s: string): void {
  console.log(`  ${C.yellow}!${C.reset} ${s}`);
}
function bad(s: string): void {
  console.log(`  ${C.red}✗${C.reset} ${s}`);
}
function dim(s: string): void {
  console.log(`  ${C.dim}${s}${C.reset}`);
}

// ── fold (mirrors engine fold) ─────────────────────────────────────────────

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

function collectStrings(value: unknown, sink: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, sink);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, sink);
    }
  }
}

function buildHaystack(input: ReturnType<ChatEvalCase["buildInput"]>): {
  ids: Set<string>;
  foldedHaystack: string;
} {
  const ids = new Set<string>();
  const parts: string[] = [];
  for (const ins of input.insights) {
    ids.add(ins.id);
    if (ins.summary) parts.push(ins.summary);
    collectStrings(ins.featureRequests, parts);
    collectStrings(ins.painPoints, parts);
    collectStrings(ins.themes, parts);
  }
  if (input.synthesis) {
    if (input.synthesis.overview) parts.push(input.synthesis.overview);
    collectStrings(input.synthesis.emergent_themes, parts);
    collectStrings(input.synthesis.tensions, parts);
  }
  return { ids, foldedHaystack: fold(parts.join(" \n ")) };
}

// ── per-case checks ────────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
  /** Aggregable counters fed into the final summary table. */
  answeredMatch: boolean;
  refusalCorrectIfApplicable: boolean | null;
  anchoredAllCitations: boolean;
  citationCount: number;
}

function runChecks(
  testCase: ChatEvalCase,
  result: ChatWithDataResult,
): CheckResult {
  const input = testCase.buildInput();
  const { ids, foldedHaystack } = buildHaystack(input);
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) answered-match
  const answeredMatch = result.answered === testCase.expected.answered;
  if (answeredMatch) {
    ok(
      `answered-match — got ${result.answered}, expected ${testCase.expected.answered}`,
    );
    passed++;
  } else {
    bad(
      `answered-match — got ${result.answered}, expected ${testCase.expected.answered}`,
    );
    failed++;
  }

  // (b) anchored-ids — every citation interviewId is in the input set
  const unknownIds = result.citations
    .map((c) => c.interviewId)
    .filter((id) => !ids.has(id));
  if (unknownIds.length === 0) {
    ok("anchored-ids — every citation interviewId is in the input set");
    passed++;
  } else {
    bad(
      `anchored-ids — ${unknownIds.length} unknown id(s): ${unknownIds.slice(0, 3).join(", ")}`,
    );
    failed++;
  }

  // (c) anchored-quote — every citation quote is a fold-substring
  const paraphrased = result.citations.filter(
    (c) => !foldedHaystack.includes(fold(c.quote)),
  );
  if (paraphrased.length === 0) {
    ok("anchored-quote — every citation quote is a verbatim substring");
    passed++;
  } else {
    bad(
      `anchored-quote — ${paraphrased.length} paraphrased quote(s): ${paraphrased
        .slice(0, 2)
        .map((c) => `"${c.quote.slice(0, 60)}…"`)
        .join("; ")}`,
    );
    failed++;
  }

  // (d) refusal-empty — non-answerable cases must have zero citations
  let refusalCorrectIfApplicable: boolean | null = null;
  if (testCase.expected.answered === false) {
    const empty = result.citations.length === 0 && result.answered === false;
    refusalCorrectIfApplicable = empty;
    if (empty) {
      ok("refusal-empty — answered=false with zero citations (correct refusal)");
      passed++;
    } else {
      bad(
        `refusal-empty — expected a clean refusal but got answered=${result.answered} with ${result.citations.length} citation(s)`,
      );
      failed++;
    }
  }

  // (e) min-citations — soft signal for answerable cases
  if (testCase.expected.answered === true) {
    const min = testCase.expected.minCitations ?? 1;
    if (result.citations.length >= min) {
      ok(`min-citations — got ${result.citations.length} ≥ ${min}`);
      passed++;
    } else {
      warn(
        `min-citations — got ${result.citations.length}, expected ≥ ${min} (soft)`,
      );
      warned++;
    }
  }

  // (f) answer-contains — soft substring check
  if (testCase.expected.answerContains) {
    const folded = fold(result.answer);
    const needle = fold(testCase.expected.answerContains);
    if (folded.includes(needle)) {
      ok(`answer-contains — answer mentions "${testCase.expected.answerContains}"`);
      passed++;
    } else {
      warn(
        `answer-contains — answer doesn't mention "${testCase.expected.answerContains}" (soft)`,
      );
      warned++;
    }
  }

  return {
    passed,
    warned,
    failed,
    answeredMatch,
    refusalCorrectIfApplicable,
    anchoredAllCitations:
      unknownIds.length === 0 && paraphrased.length === 0,
    citationCount: result.citations.length,
  };
}

// ── runner ─────────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  expected: boolean;
  got: boolean;
  citations: number;
  anchored: boolean;
  refusalCorrect: boolean | null;
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Chat-with-data Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${CHAT_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;
  const rows: CaseRow[] = [];

  for (const c of CHAT_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(`Q: ${c.question}`);
    dim(
      `expected: answered=${c.expected.answered}${
        c.expected.answerContains
          ? `, answer~"${c.expected.answerContains}"`
          : ""
      }${
        c.expected.minCitations !== undefined
          ? `, ≥${c.expected.minCitations} citations`
          : ""
      }`,
    );

    let result: ChatWithDataResult;
    try {
      const baseInput = c.buildInput();
      result = await chatWithDataFromInputs(
        { ...baseInput, question: c.question },
        MODEL,
      );
    } catch (err) {
      bad(
        `engine call failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      totalFailed++;
      rows.push({
        id: c.id,
        expected: c.expected.answered,
        got: false,
        citations: 0,
        anchored: false,
        refusalCorrect: c.expected.answered === false ? false : null,
      });
      continue;
    }

    // Print the actual answer + citations so the human can judge content
    // quality at a glance.
    console.log(
      `\n  ${C.bold}ANSWER${C.reset}  ${C.magenta}answered=${result.answered}${C.reset}`,
    );
    dim(`  ${result.answer}`);
    if (result.citations.length > 0) {
      console.log(`\n  ${C.bold}CITATIONS (${result.citations.length})${C.reset}`);
      for (const cite of result.citations) {
        dim(`  • [${cite.interviewId}] "${cite.quote}"`);
      }
    } else {
      dim(`\n  (no citations)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, result);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
    rows.push({
      id: c.id,
      expected: c.expected.answered,
      got: result.answered,
      citations: checks.citationCount,
      anchored: checks.anchoredAllCitations,
      refusalCorrect: checks.refusalCorrectIfApplicable,
    });
  }

  // ── summary table ────────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══ RESULTS TABLE ═══${C.reset}`);
  console.log(
    `${C.dim}${"id".padEnd(28)} ${"expected".padEnd(10)} ${"got".padEnd(8)} ${"cites".padStart(5)} ${"anchored".padEnd(9)} refusal${C.reset}`,
  );
  for (const r of rows) {
    const mark = r.expected === r.got ? `${C.green}✓` : `${C.red}✗`;
    const anchored = r.anchored ? `${C.green}yes` : `${C.red}no`;
    const refusal =
      r.refusalCorrect === null
        ? `${C.dim}n/a`
        : r.refusalCorrect
          ? `${C.green}ok`
          : `${C.red}fail`;
    console.log(
      `  ${r.id.padEnd(28)} ${String(r.expected).padEnd(10)} ${mark} ${String(r.got).padEnd(6)}${C.reset} ${String(r.citations).padStart(5)} ${anchored.padEnd(18)}${C.reset} ${refusal}${C.reset}`,
    );
  }

  // ── aggregate metrics ────────────────────────────────────────────────────
  const total = rows.length;
  const answerableTotal = rows.filter((r) => r.expected === true).length;
  const nonAnswerableTotal = rows.filter((r) => r.expected === false).length;
  const answeredHits = rows.filter((r) => r.expected === r.got).length;
  const citationsTotal = rows.reduce((acc, r) => acc + r.citations, 0);
  const anchoredAll = rows.filter((r) => r.anchored).length;
  const refusalsCorrect = rows.filter((r) => r.refusalCorrect === true).length;

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}`);
  console.log(
    `  Antwort-Treffer:           ${answeredHits}/${total}  (answered matches expected)`,
  );
  console.log(
    `  Verankerungs-Quote:        ${anchoredAll}/${total}  (every citation has valid id + verbatim quote)`,
  );
  console.log(
    `  Korrekte-Absage-Quote:     ${refusalsCorrect}/${nonAnswerableTotal}  (answered=false + 0 citations on non-answerable cases)`,
  );
  console.log(
    `  Antwortbare-Cases:         ${answerableTotal}, davon mit ≥1 Citation: ${rows
      .filter((r) => r.expected === true && r.citations >= 1)
      .length}/${answerableTotal}`,
  );
  console.log(
    `  Citations gesamt:          ${citationsTotal}  (Summe über alle Cases)`,
  );

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
