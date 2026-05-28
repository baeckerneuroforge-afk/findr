/**
 * Bridge CS→Research Eval Runner
 * ------------------------------
 * Runs deriveResearchGoalFromCluster() over BRIDGE_EVAL_CASES (EXACTLY 6),
 * applies DETERMINISTIC property checks (no LLM-judge), prints a table.
 *
 * Checks per case:
 *   (a) derivable-match  — result.derivable === expected.derivable
 *                          (anti-hallu gate on the MIXED case).
 *   (b) goal-non-empty   — bei derivable=true: goal nicht null + ≥8 Zeichen.
 *                          Bei derivable=false: goal === null (hart, Engine
 *                          downgrade-Regel; Schema-Engine setzt das schon
 *                          deterministisch).
 *   (c) anchored         — bei derivable=true: das goal enthält MINDESTENS
 *                          EINEN der erwarteten anchorTerms (Cluster-Grund
 *                          semantisch referenziert).
 *   (d) caution-on-thin  — bei dünnen Clustern (expected.cautionTerms
 *                          gesetzt): das goal enthält mindestens ein
 *                          Vorsichtswort. Sonst ist die kleine Fallzahl im
 *                          Goal nicht reflektiert.
 *   (e) no-hallucinations — Strings in expected.forbiddenTerms dürfen NICHT
 *                           im goal vorkommen.
 *   (f) language-german  — goal ist auf Deutsch (lexikalische Markers).
 *
 * Default model: Sonnet. Approval run: BRIDGE_MODEL=claude-opus-4-7.
 * Pflicht: `env -u ANTHROPIC_API_KEY`:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals/bridge-cs-research/run.ts
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  deriveResearchGoalFromCluster,
  type DerivedGoal,
} from "@/lib/bridge/cs-to-research";

import { BRIDGE_EVAL_CASES, type BridgeEvalCase } from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.BRIDGE_MODEL ?? CLAUDE_MODELS.sonnet;

// ── pretty-print helpers ───────────────────────────────────────────────────

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

// ── normalize (mirror of synthesis/chat/guide eval normalize) ──────────────

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/ä/g, "ae")
    .replace(/Ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/Ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const GERMAN_MARKERS = [
  " der ",
  " die ",
  " das ",
  " sie ",
  " und ",
  " mit ",
  " ist ",
  " ihr ",
  " ihre ",
  " was ",
  " wie ",
  " wo ",
  " wann ",
  " wenn ",
  " warum ",
  " auf ",
  " bei ",
  " von ",
  " den ",
];

function isLikelyGerman(corpus: string): boolean {
  const n = " " + normalize(corpus) + " "; // pad so " der " matches at edges
  let hits = 0;
  for (const m of GERMAN_MARKERS) {
    if (n.includes(m)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

// ── per-case checks ───────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
  derivableMatch: boolean;
  anchored: boolean | null;
  germanLang: boolean;
  hallucinations: string[];
}

function runChecks(
  testCase: BridgeEvalCase,
  result: DerivedGoal,
): CheckResult {
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) derivable-match
  const derivableMatch = result.derivable === testCase.expected.derivable;
  if (derivableMatch) {
    ok(
      `derivable-match — got ${result.derivable}, expected ${testCase.expected.derivable}`,
    );
    passed++;
  } else {
    bad(
      `derivable-match — got ${result.derivable}, expected ${testCase.expected.derivable}`,
    );
    failed++;
  }

  // (b) goal shape
  if (testCase.expected.derivable === true) {
    if (
      result.goal !== null &&
      typeof result.goal === "string" &&
      result.goal.trim().length >= 8
    ) {
      ok(`goal-non-empty — ${result.goal.length} Zeichen`);
      passed++;
    } else {
      bad(
        `goal-non-empty — erwartet >=8 Zeichen, got ${result.goal === null ? "null" : `"${result.goal}"`}`,
      );
      failed++;
    }
  } else {
    if (result.goal === null) {
      ok("goal-null-on-refuse — goal ist null bei derivable=false");
      passed++;
    } else {
      bad(
        `goal-null-on-refuse — erwartet null bei derivable=false, got "${result.goal}"`,
      );
      failed++;
    }
  }

  // (c) anchored — only meaningful when goal exists
  let anchored: boolean | null = null;
  if (
    testCase.expected.derivable === true &&
    testCase.expected.anchorTerms &&
    testCase.expected.anchorTerms.length > 0 &&
    result.goal
  ) {
    const folded = normalize(result.goal);
    const matchedTerm = testCase.expected.anchorTerms.find((t) =>
      folded.includes(normalize(t)),
    );
    if (matchedTerm) {
      ok(`anchored — goal referenziert "${matchedTerm}" (aus anchorTerms)`);
      passed++;
      anchored = true;
    } else {
      bad(
        `anchored — goal enthält keinen der erwarteten anchorTerms [${testCase.expected.anchorTerms.join(", ")}]`,
      );
      failed++;
      anchored = false;
    }
  }

  // (d) caution-on-thin — only when cautionTerms set
  if (
    testCase.expected.derivable === true &&
    testCase.expected.cautionTerms &&
    testCase.expected.cautionTerms.length > 0 &&
    result.goal
  ) {
    const folded = normalize(result.goal);
    const matchedCaution = testCase.expected.cautionTerms.find((t) =>
      folded.includes(normalize(t)),
    );
    if (matchedCaution) {
      ok(`caution-on-thin — goal enthält "${matchedCaution}" (Vorsicht reflektiert)`);
      passed++;
    } else {
      bad(
        `caution-on-thin — goal reflektiert die kleine Fallzahl nicht (keiner der erwarteten cautionTerms [${testCase.expected.cautionTerms.join(", ")}] gefunden)`,
      );
      failed++;
    }
  }

  // (e) no-hallucinations — forbiddenTerms must NOT appear
  let hallucinations: string[] = [];
  if (
    testCase.expected.forbiddenTerms &&
    testCase.expected.forbiddenTerms.length > 0 &&
    result.goal
  ) {
    const folded = normalize(result.goal);
    hallucinations = testCase.expected.forbiddenTerms.filter((t) =>
      folded.includes(normalize(t)),
    );
    if (hallucinations.length === 0) {
      ok("no-hallucinations — keine verbotenen Spezifika im goal");
      passed++;
    } else {
      bad(`no-hallucinations — verbotene Begriffe gefunden: ${hallucinations.join(", ")}`);
      failed++;
    }
  }

  // (f) language-german — only when goal exists
  let germanLang = true; // n/a for refusal cases
  if (result.goal) {
    germanLang = isLikelyGerman(result.goal);
    if (germanLang) {
      ok("language — Deutsch erkannt (lexikalische Markers)");
      passed++;
    } else {
      bad("language — keine starken Deutsch-Markers im goal gefunden");
      failed++;
    }
  }

  return { passed, warned, failed, derivableMatch, anchored, germanLang, hallucinations };
}

// ── runner ────────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  expected: boolean;
  got: boolean;
  goalLen: number;
  anchored: string;
  hallucinated: boolean;
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Bridge CS→Research Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${BRIDGE_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;
  const rows: CaseRow[] = [];

  for (const c of BRIDGE_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(
      `input: signalType=${c.input.signalType}, accountCount=${c.input.accountCount}${
        c.input.segment ? `, segment="${c.input.segment}"` : ""
      }${c.input.windowDays !== undefined ? `, windowDays=${c.input.windowDays}` : ""}${
        c.input.signalNotes ? `, signalNotes="${c.input.signalNotes}"` : ""
      }`,
    );
    dim(
      `expected: derivable=${c.expected.derivable}${
        c.expected.anchorTerms
          ? `, anchorTerms=[${c.expected.anchorTerms.join("|")}]`
          : ""
      }${
        c.expected.cautionTerms
          ? `, cautionTerms=[${c.expected.cautionTerms.join("|")}]`
          : ""
      }`,
    );

    let result: DerivedGoal;
    try {
      result = await deriveResearchGoalFromCluster(c.input, MODEL);
    } catch (err) {
      bad(
        `engine call failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      totalFailed++;
      rows.push({
        id: c.id,
        expected: c.expected.derivable,
        got: false,
        goalLen: 0,
        anchored: "n/a",
        hallucinated: false,
      });
      continue;
    }

    // Echo the result so the human can judge content quality.
    console.log(
      `\n  ${C.bold}RESULT${C.reset}  ${C.magenta}derivable=${result.derivable}${C.reset}`,
    );
    if (result.goal) {
      dim(`  goal: ${result.goal}`);
    } else {
      dim(`  goal: (null — refusal)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, result);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
    rows.push({
      id: c.id,
      expected: c.expected.derivable,
      got: result.derivable,
      goalLen: result.goal?.length ?? 0,
      anchored:
        checks.anchored === null
          ? "n/a"
          : checks.anchored
            ? "yes"
            : "no",
      hallucinated: checks.hallucinations.length > 0,
    });
  }

  // ── summary table ──────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══ RESULTS TABLE ═══${C.reset}`);
  console.log(
    `${C.dim}${"id".padEnd(36)} ${"expected".padEnd(10)} ${"got".padEnd(8)} ${"goalLen".padStart(7)} ${"anchored".padEnd(9)} hallucinated${C.reset}`,
  );
  for (const r of rows) {
    const mark = r.expected === r.got ? `${C.green}✓` : `${C.red}✗`;
    const anchored =
      r.anchored === "n/a"
        ? `${C.dim}n/a${C.reset}`
        : r.anchored === "yes"
          ? `${C.green}yes${C.reset}`
          : `${C.red}no${C.reset}`;
    const hallucinated = r.hallucinated
      ? `${C.red}YES${C.reset}`
      : `${C.green}no${C.reset}`;
    console.log(
      `  ${r.id.padEnd(36)} ${String(r.expected).padEnd(10)} ${mark} ${String(r.got).padEnd(6)}${C.reset} ${String(r.goalLen).padStart(7)} ${anchored.padEnd(18)} ${hallucinated}`,
    );
  }

  // ── aggregate metrics ──────────────────────────────────────────────────
  const total = rows.length;
  const derivableMatches = rows.filter((r) => r.expected === r.got).length;
  const anchoredCount = rows.filter((r) => r.anchored === "yes").length;
  const expectedAnchored = rows.filter((r) => r.anchored !== "n/a").length;
  const hallucinated = rows.filter((r) => r.hallucinated).length;

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}`);
  console.log(
    `  Derivable-Match:        ${derivableMatches}/${total}  (derivable matches expected)`,
  );
  console.log(
    `  Anchored-Quote:         ${anchoredCount}/${expectedAnchored}  (anchorTerm im goal vorhanden, bei Cases mit anchorTerms)`,
  );
  console.log(
    `  Halluzinationen:        ${hallucinated}/${total}  (forbiddenTerms im goal — SOLLTE 0 sein)`,
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
