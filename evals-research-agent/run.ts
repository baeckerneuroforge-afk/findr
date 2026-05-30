/**
 * Research-Agent Eval Runner
 * --------------------------
 * Runs runResearchAgentDiagnostics() over RESEARCH_AGENT_EVAL_CASES and gates
 * the ANTI-HALLUCINATION guarantee. Per case, three HARD checks (anchor-pass,
 * refusal-correct on negative controls, no-impossible-number) plus two SOFT
 * signals (instruction-following, deliverable-non-empty) that inform — but do
 * NOT gate — the Sonnet-vs-Opus model choice.
 *
 * Anti-hallucination is the PRIMARY gate: a research agent that fabricates
 * findings is worthless/dangerous. Better an honest "steht nicht in den Daten"
 * than an invented deliverable.
 *
 * Always calls the LLM. Pick the model via RESEARCH_AGENT_MODEL; default is
 * Sonnet (cheap). Run it yourself, foreground — once per model:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-research-agent/run.ts
 *   RESEARCH_AGENT_MODEL=claude-opus-4-7 env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-research-agent/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` clears an empty/shadowing shell var so dotenv can
 * inject the real key from .env.local.)
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  buildSynthesisAnchorSet,
  fold,
  runResearchAgentDiagnostics,
  type ResearchAgentDiagnostics,
  type SynthesisAnchorSet,
} from "@/lib/research-agent/engine";
import {
  buildResearchInput,
  RESEARCH_AGENT_FIXTURE,
  RESEARCH_AGENT_EVAL_CASES,
  type ResearchAgentEvalCase,
} from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.RESEARCH_AGENT_MODEL ?? CLAUDE_MODELS.sonnet;

// ── tiny ANSI helpers (mirror evals-synthesis) ──────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};
const ok = (m: string) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const warn = (m: string) => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const bad = (m: string) => console.log(`  ${C.red}✗${C.reset} ${m}`);
const dim = (m: string) => console.log(`  ${C.dim}${m}${C.reset}`);
const header = (m: string) =>
  console.log(`\n${C.bold}${m}${C.reset}`);

// ── number-hallucination check ──────────────────────────────────────────────

/** A respondent count can NEVER exceed the study's interview count. Flag any
 *  standalone integer in (basedOnCount, 40] — a plausible-but-impossible
 *  respondent count. (Ceiling 40 avoids years / large numbers; the fixture has
 *  no legitimate integer in that window.) */
function hasImpossibleCount(text: string, basedOnCount: number): boolean {
  const nums = text.match(/\d+/g);
  if (!nums) return false;
  return nums
    .map((n) => Number(n))
    .some((n) => n > basedOnCount && n <= 40);
}

// ── per-case checks ─────────────────────────────────────────────────────────

interface Row {
  id: string;
  expectedFulfilled: boolean;
  gotFulfilled: boolean;
  anchorPass: boolean;
  impossibleNumber: boolean;
  refusalCorrect: boolean | null;
  modelRefusedDirectly: boolean | null;
  instructionMatch: boolean | null;
  rawLeakage: number;
  downgraded: boolean;
}

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
  row: Row;
}

function runChecks(
  testCase: ResearchAgentEvalCase,
  diag: ResearchAgentDiagnostics,
  anchors: SynthesisAnchorSet,
): CheckResult {
  const f = diag.filtered;
  const basedOn = RESEARCH_AGENT_FIXTURE.synthesis.basedOnCount;
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) anchor-pass [HARD] — every SURFACED item has ≥1 anchor and every
  //     surfaced anchor is a real fold-substring of the synthesis. (Refusals
  //     have zero items → vacuously true.)
  const anchorPass = f.items.every(
    (it) =>
      it.themeRefs.length + it.quotes.length > 0 &&
      it.themeRefs.every((r) => anchors.foldedHaystack.includes(fold(r))) &&
      it.quotes.every((q) => anchors.foldedHaystack.includes(fold(q))),
  );
  if (anchorPass) {
    ok("anchor-pass — every surfaced item anchored to real synthesis text");
    passed++;
  } else {
    bad("anchor-pass — a surfaced item is unanchored or cites non-synthesis text");
    failed++;
  }

  // (d) no-impossible-number [HARD] — no surfaced respondent count > based_on.
  const impossibleNumber = f.items.some((it) =>
    hasImpossibleCount(`${it.heading} ${it.text}`, basedOn),
  );
  if (!impossibleNumber) {
    ok(`no-impossible-number — no surfaced respondent count > ${basedOn}`);
    passed++;
  } else {
    bad(`impossible-number — a surfaced count exceeds based_on_count (${basedOn})`);
    failed++;
  }

  let refusalCorrect: boolean | null = null;
  let modelRefusedDirectly: boolean | null = null;
  let instructionMatch: boolean | null = null;

  if (testCase.expected.fulfilled === false) {
    // (c) refusal-correct [HARD] — honest refusal, zero items.
    refusalCorrect = f.fulfilled === false && f.items.length === 0;
    modelRefusedDirectly = diag.raw.fulfilled === false;
    if (refusalCorrect) {
      ok("refusal-correct — fulfilled=false + zero items (honest refusal)");
      passed++;
    } else {
      bad(
        `refusal-correct — expected refusal, got fulfilled=${f.fulfilled} with ${f.items.length} item(s)`,
      );
      failed++;
    }
    dim(
      modelRefusedDirectly
        ? "(model refused directly)"
        : "(model tried to answer — anchor filter downgraded it)",
    );
  } else {
    // (f) deliverable-non-empty [SOFT].
    const minItems = testCase.expected.minItems ?? 1;
    if (f.fulfilled && f.items.length >= minItems) {
      ok(`non-empty — fulfilled=true with ${f.items.length} item(s)`);
      passed++;
    } else {
      warn(
        `non-empty — expected fulfilled=true with ≥${minItems} item(s), got fulfilled=${f.fulfilled} / ${f.items.length}`,
      );
      warned++;
    }
    // (e) instruction-following [SOFT].
    if (testCase.expected.deliverableType) {
      instructionMatch = f.deliverableType === testCase.expected.deliverableType;
      if (instructionMatch) {
        ok(`instruction-following — deliverableType=${f.deliverableType}`);
        passed++;
      } else {
        warn(
          `instruction-following — got ${f.deliverableType}, expected ${testCase.expected.deliverableType}`,
        );
        warned++;
      }
    }
  }

  const rawLeakage =
    diag.strippedQuoteCount + diag.strippedThemeRefCount + diag.droppedItemCount;
  if (rawLeakage > 0) {
    dim(
      `raw model leakage: ${diag.strippedQuoteCount} quote(s) + ${diag.strippedThemeRefCount} themeRef(s) stripped, ${diag.droppedItemCount} item(s) dropped` +
        (diag.downgraded ? " → downgraded to refusal" : ""),
    );
  }

  return {
    passed,
    warned,
    failed,
    row: {
      id: testCase.id,
      expectedFulfilled: testCase.expected.fulfilled,
      gotFulfilled: f.fulfilled,
      anchorPass,
      impossibleNumber,
      refusalCorrect,
      modelRefusedDirectly,
      instructionMatch,
      rawLeakage,
      downgraded: diag.downgraded,
    },
  };
}

// ── reporting ───────────────────────────────────────────────────────────────

function printDeliverable(diag: ResearchAgentDiagnostics): void {
  const f = diag.filtered;
  dim(
    `→ fulfilled=${f.fulfilled} type=${f.deliverableType} items=${f.items.length}` +
      (f.title ? ` title="${f.title}"` : ""),
  );
  if (!f.fulfilled) {
    dim(`  note: ${f.note}`);
    return;
  }
  f.items.forEach((it, i) => {
    const label = it.heading ? `${it.heading}: ` : "";
    dim(`  ${i + 1}. ${label}${it.text}`);
    if (it.themeRefs.length > 0) dim(`     themeRefs: ${it.themeRefs.join(" | ")}`);
    if (it.quotes.length > 0) dim(`     quotes: ${it.quotes.map((q) => `"${q}"`).join(" | ")}`);
  });
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Research-Agent Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${RESEARCH_AGENT_EVAL_CASES.length}`,
  );

  const anchors = buildSynthesisAnchorSet(RESEARCH_AGENT_FIXTURE.synthesis);

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;
  const rows: Row[] = [];

  for (const c of RESEARCH_AGENT_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`instruction: ${c.instruction}`);

    let diag: ResearchAgentDiagnostics;
    try {
      diag = await runResearchAgentDiagnostics(buildResearchInput(c.instruction), MODEL);
    } catch (err) {
      bad(`engine call failed: ${err instanceof Error ? err.message : "unknown"}`);
      totalFailed++;
      rows.push({
        id: c.id,
        expectedFulfilled: c.expected.fulfilled,
        gotFulfilled: false,
        anchorPass: false,
        impossibleNumber: false,
        refusalCorrect: c.expected.fulfilled === false ? false : null,
        modelRefusedDirectly: null,
        instructionMatch: null,
        rawLeakage: 0,
        downgraded: false,
      });
      continue;
    }

    printDeliverable(diag);
    const checks = runChecks(c, diag, anchors);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
    rows.push(checks.row);
  }

  // ── aggregate metrics ──────────────────────────────────────────────────
  const answerable = rows.filter((r) => r.expectedFulfilled === true);
  const negatives = rows.filter((r) => r.expectedFulfilled === false);
  const anchorPassRate = rows.filter((r) => r.anchorPass).length;
  const impossibleNumbers = rows.filter((r) => r.impossibleNumber).length;
  const refusalsCorrect = negatives.filter((r) => r.refusalCorrect === true).length;
  const modelRefusedDirect = negatives.filter(
    (r) => r.modelRefusedDirectly === true,
  ).length;
  const instructionScored = answerable.filter((r) => r.instructionMatch !== null);
  const instructionHits = instructionScored.filter(
    (r) => r.instructionMatch === true,
  ).length;
  const totalLeakage = rows.reduce((acc, r) => acc + r.rawLeakage, 0);
  const downgrades = rows.filter((r) => r.downgraded).length;

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}  (model=${MODEL})`);
  console.log(
    `  Anchor-Pass:               ${anchorPassRate}/${rows.length}  (every surfaced item anchored to real synthesis text)  [GATE]`,
  );
  console.log(
    `  Halluzinierte Zahlen:      ${impossibleNumbers}/${rows.length}  (surfaced respondent count > based_on_count — must be 0)  [GATE]`,
  );
  console.log(
    `  Korrekte-Absage-Quote:     ${refusalsCorrect}/${negatives.length}  (fulfilled=false + 0 items on non-answerable cases)  [GATE]`,
  );
  console.log(
    `  Instruction-Following:     ${instructionHits}/${instructionScored.length}  (deliverableType matched expected)  [soft]`,
  );
  console.log(
    `  Modell-Direktabsage:       ${modelRefusedDirect}/${negatives.length}  (model refused itself, before the anchor filter)  [soft]`,
  );
  console.log(
    `  Raw-Modell-Leakage:        ${totalLeakage}  (anchors/items the filter had to strip/drop — lower = trustworthier model)  [soft]`,
  );
  console.log(
    `  Downgrades:                ${downgrades}  (fulfilled true→false because all items were unanchored)`,
  );

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) {
    console.log(
      `${C.red}${C.bold}GATE: RED${C.reset} — anti-hallucination gate failed (${totalFailed} hard check(s)).`,
    );
    process.exitCode = 1;
  } else {
    console.log(`${C.green}${C.bold}GATE: GREEN${C.reset} — anti-hallucination gate holds.`);
  }
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
