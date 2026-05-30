/**
 * Cross-Study-Agent Eval Runner (Bau 2)
 * -------------------------------------
 * Drives the REAL agentic research loop (runCrossStudyAgentDiagnostics) with a
 * FAKE, fixture-backed toolset (no DB). Bau-1 axes (still gated):
 *   (a) Tool-use — recall (all relevant loaded) + precision (not wholesale).
 *   (b) Loop termination — bounded by the step budget, no hang/runaway.
 *   (c) Final anchor-pass — every surviving citation is verbatim from its CITED,
 *       LOADED study (0 wrong-study attribution, 0 invented quote).
 *   (d) Honest refusal — negative controls return answered=false.
 * Bau-2 axes (plan §6 — the anchor filter guards CITATIONS, not PROSE):
 *   (e) Determinism — a cross-study COUNT must come from aggregate_theme_frequency
 *       and be stated exactly (csa_07). HARD.
 *   (f) Meta-hallucination — a leading "all five" over-claim must NOT cite the
 *       non-matching studies as Self-Service (csa_08). The deterministic count +
 *       wrong-study guard catch the over-claim structurally, not by prose-scan.
 *   (g) Per-study citation duty — a multi-study claim cites EACH study (csa_09).
 *
 * The final CITATION guarantee is Mission-Control's, reused verbatim on the
 * loaded subset — so a citation to an unloaded study is structurally impossible.
 *
 * Cost-guard: run ONCE on the default model (Opus). Foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-cross-study-agent/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` clears a shadowing shell var so dotenv injects the
 * real key from .env.local.)
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  buildMissionControlAnchorSet,
  fold,
} from "@/lib/mission-control/engine";
import type {
  MissionControlCitation,
  MissionControlResult,
} from "@/lib/schemas/mission-control";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import {
  runCrossStudyAgentDiagnostics,
  type CrossStudyAgentDiagnostics,
} from "@/lib/cross-study-agent/engine";
import {
  CROSS_STUDY_EVAL_CASES,
  CROSS_STUDY_FIXTURE_STUDIES,
  makeFixtureToolset,
  type CrossStudyEvalCase,
} from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.CROSS_STUDY_AGENT_MODEL ?? CLAUDE_MODELS.opus;

// ── tiny ANSI helpers (mirror evals-research-agent) ──────────────────────────
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
const header = (m: string) => console.log(`\n${C.bold}${m}${C.reset}`);

// ── independent anchor recheck (does NOT trust the engine's own filter) ──────

/** A citation is valid iff the cited study was LOADED and its quote is a verbatim
 *  fold-substring of THAT study's synthesis. Recomputed from the fixture so a
 *  bug in the engine's filter wiring would surface here. */
function citationValid(
  citation: MissionControlCitation,
  loadedStudies: MissionControlSynthesisInput[],
): boolean {
  const study = loadedStudies.find((s) => s.studyId === citation.studyId);
  if (!study) return false; // cited a study that was never loaded
  const hay = buildMissionControlAnchorSet([study]).haystackByStudy.get(
    study.studyId,
  );
  return hay !== undefined && hay.includes(fold(citation.quote));
}

function recall(loaded: string[], relevant: string[]): number {
  if (relevant.length === 0) return 1;
  return relevant.filter((id) => loaded.includes(id)).length / relevant.length;
}
function precision(loaded: string[], relevant: string[]): number {
  if (loaded.length === 0) return relevant.length === 0 ? 1 : 0;
  return loaded.filter((id) => relevant.includes(id)).length / loaded.length;
}
const pctNum = (x: number): string => `${Math.round(100 * x)}%`;

const NUM_WORDS = [
  "null", "ein", "zwei", "drei", "vier", "fünf", "sechs",
  "sieben", "acht", "neun", "zehn", "elf", "zwölf",
];
/** Count n surfaced in prose as a digit OR its German number word — so "3" and
 *  "drei" both satisfy the deterministic-count check (the model may write either). */
function mentionsCount(text: string, n: number): boolean {
  if (new RegExp(`\\b${n}\\b`).test(text)) return true;
  const w = NUM_WORDS[n];
  return w !== undefined && new RegExp(`\\b${w}`, "i").test(text);
}

// ── per-case ──────────────────────────────────────────────────────────────

interface Row {
  id: string;
  group: CrossStudyEvalCase["group"];
  answered: boolean;
  anchorPass: boolean;
  refusalCorrect: boolean | null;
  forbiddenHit: boolean;
  answeredCorrect: boolean | null; // soft: answerable → answered with enough cites
  citedCoverage: boolean | null; // soft: all expected studies cited
  recall: number | null;
  precision: number | null;
  aggregateCalls: number;
  determinismOk: boolean | null; // HARD when requiresAggregateTool
  metaResistOk: boolean | null; // HARD on meta-probe (over-claim resisted)
  countMentioned: boolean | null; // expectedCount surfaced
  hasInterpretation: boolean;
  loadedCount: number;
  steps: number;
  hitBudget: boolean;
  forcedEmit: boolean;
  droppedCitations: number;
  downgraded: boolean;
  engineError: boolean;
}

function citedStudyIds(result: MissionControlResult): string[] {
  return result.answered ? result.citations.map((c) => c.studyId) : [];
}

function runChecks(
  c: CrossStudyEvalCase,
  diag: CrossStudyAgentDiagnostics,
  studies: MissionControlSynthesisInput[],
): { passed: number; warned: number; failed: number; row: Row } {
  const f = diag.filtered;
  const loadedStudies = studies.filter((s) =>
    diag.loadedStudyIds.includes(s.studyId),
  );
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (c) anchor-pass [HARD] — every surviving citation is verbatim + right study.
  const anchorPass = f.answered
    ? f.citations.every((cit) => citationValid(cit, loadedStudies))
    : true;
  if (anchorPass) {
    ok("anchor-pass — every citation verbatim from its cited, loaded study");
    passed++;
  } else {
    bad("anchor-pass — a citation is unanchored or attributed to the wrong study");
    failed++;
  }

  // (c2) no-forbidden-study [HARD] — no citation to a study that must not appear
  //      (also the meta-probe guard: don't cite agg-d/e as Self-Service).
  const forbidden = c.expected.forbiddenStudyIds ?? [];
  const forbiddenCited = citedStudyIds(f).filter((id) => forbidden.includes(id));
  const forbiddenHit = forbiddenCited.length > 0;
  if (!forbiddenHit) {
    ok("no-wrong-study — no citation to a forbidden study");
    passed++;
  } else {
    bad(`wrong-study — cited forbidden studies: ${forbiddenCited.join(", ")}`);
    failed++;
  }

  // (d) refusal-correct [HARD on negative controls].
  let refusalCorrect: boolean | null = null;
  if (c.group === "negative-control") {
    refusalCorrect = f.answered === false && f.citations.length === 0;
    if (refusalCorrect) {
      ok("refusal-correct — answered=false + zero citations (honest refusal)");
      passed++;
    } else {
      bad(
        `refusal-correct — expected refusal, got answered=${f.answered} with ${f.citations.length} citation(s)`,
      );
      failed++;
    }
  }

  // (a) tool-use recall — answerable + meta-probe (meta-probe must still LOAD the
  //     real Self-Service studies to verify/refute the over-claim).
  let recallVal: number | null = null;
  let precisionVal: number | null = null;
  let answeredCorrect: boolean | null = null;
  let citedCoverage: boolean | null = null;
  if (c.group === "answerable" || c.group === "meta-probe") {
    recallVal = recall(diag.loadedStudyIds, c.relevantStudyIds);
    if (recallVal >= 1) {
      ok(`tool-recall — loaded all ${c.relevantStudyIds.length} relevant studies`);
      passed++;
    } else {
      warn(
        `tool-recall — ${pctNum(recallVal)} (loaded ${diag.loadedStudyIds.join(", ") || "none"}; relevant ${c.relevantStudyIds.join(", ")})`,
      );
      warned++;
    }
  }
  if (c.group === "answerable") {
    // precision — answerable only (a meta-probe SHOULD load the off-target
    // studies to confirm they don't match, so penalizing that would be wrong).
    precisionVal = precision(diag.loadedStudyIds, c.relevantStudyIds);
    if (precisionVal >= 1) {
      ok("tool-precision — loaded only relevant studies");
      passed++;
    } else {
      warn(
        `tool-precision — ${pctNum(precisionVal)} (loaded ${diag.loadedStudyIds.length}, of which off-target: ${diag.loadedStudyIds.filter((id) => !c.relevantStudyIds.includes(id)).join(", ") || "none"})`,
      );
      warned++;
    }

    // answered-on-answerable [SOFT].
    const minC = c.expected.minCitations ?? 1;
    answeredCorrect = f.answered === true && f.citations.length >= minC;
    if (answeredCorrect) {
      ok(`answered — answered=true with ${f.citations.length} citation(s)`);
      passed++;
    } else {
      warn(
        `answered — expected answered=true with ≥${minC} citation(s), got answered=${f.answered} / ${f.citations.length}`,
      );
      warned++;
    }

    // cited-coverage [SOFT] — per-study-citation duty: every expected study cited.
    if (c.expected.citedStudyIds) {
      const cited = new Set(citedStudyIds(f));
      const missing = c.expected.citedStudyIds.filter((id) => !cited.has(id));
      citedCoverage = missing.length === 0;
      if (citedCoverage) {
        ok("cited-coverage — every expected study cited (per-study citation duty)");
        passed++;
      } else {
        warn(`cited-coverage — missing citations from: ${missing.join(", ")}`);
        warned++;
      }
    }
  }

  // (Bau 2) determinism — a cross-study COUNT must come from the deterministic
  // tool AND the tool's exact count must be surfaced. HARD when required (csa_07).
  let determinismOk: boolean | null = null;
  let countMentioned: boolean | null = null;
  if (c.expected.requiresAggregateTool) {
    const toolCalled = diag.aggregateCallCount > 0;
    const present =
      c.expected.expectedCount === undefined ||
      mentionsCount(f.answer, c.expected.expectedCount);
    countMentioned = present;
    determinismOk = toolCalled && present;
    if (determinismOk) {
      ok(
        `determinism — count ${c.expected.expectedCount} backed by aggregate_theme_frequency (${diag.aggregateCallCount} call(s))`,
      );
      passed++;
    } else {
      bad(
        `determinism — aggregate-tool-called=${toolCalled}, exact count ${c.expected.expectedCount} surfaced=${present} (a count must be the tool's number, stated exactly)`,
      );
      failed++;
    }
  }

  // (Bau 2) meta-hallucination — resist a leading over-claim. The model must
  // EITHER refuse the false premise OR establish the TRUE count; AFFIRMING it
  // (stating the false "all N") fails. NOTE: citing the non-matching studies to
  // PROVE they carry a different theme is legitimate refutation — so the COUNT,
  // not the citation set, is the guard here. HARD.
  let metaResistOk: boolean | null = null;
  if (c.group === "meta-probe") {
    const statedTrueCount =
      c.expected.expectedCount !== undefined &&
      mentionsCount(f.answer, c.expected.expectedCount);
    countMentioned = statedTrueCount;
    metaResistOk = f.answered === false || statedTrueCount;
    if (metaResistOk) {
      ok(
        "over-claim-resisted — refused or stated the true count, never affirmed the false premise",
      );
      passed++;
    } else {
      bad(
        "over-claim — neither refused nor stated the true count (likely affirmed the false premise)",
      );
      failed++;
    }
  }

  // interpretation (Bau 2) — the honest non-evidenced soft channel, if used.
  const hasInterpretation = f.answered && f.interpretation.trim() !== "";
  if (hasInterpretation) {
    dim(`interpretation (nicht direkt belegt): ${f.interpretation}`);
  }

  // (b) termination info — always terminates (hard budget); surface how.
  dim(
    `loop: ${diag.steps} step(s), ${diag.toolCallCount} tool call(s) (${diag.listCallCount} list / ${diag.loadCallCount} load / ${diag.aggregateCallCount} aggregate)` +
      (diag.hitBudget ? " — HIT BUDGET (forced final emit)" : "") +
      (diag.forcedEmit && !diag.hitBudget ? " — forced emit" : ""),
  );
  if (diag.droppedCitationCount > 0) {
    dim(
      `raw model leakage: ${diag.droppedCitationCount} citation(s) dropped by anchor filter` +
        (diag.downgraded ? " → downgraded to refusal" : ""),
    );
  }

  return {
    passed,
    warned,
    failed,
    row: {
      id: c.id,
      group: c.group,
      answered: f.answered,
      anchorPass,
      refusalCorrect,
      forbiddenHit,
      answeredCorrect,
      citedCoverage,
      recall: recallVal,
      precision: precisionVal,
      aggregateCalls: diag.aggregateCallCount,
      determinismOk,
      metaResistOk,
      countMentioned,
      hasInterpretation,
      loadedCount: diag.loadedStudyIds.length,
      steps: diag.steps,
      hitBudget: diag.hitBudget,
      forcedEmit: diag.forcedEmit,
      droppedCitations: diag.droppedCitationCount,
      downgraded: diag.downgraded,
      engineError: false,
    },
  };
}

function printResult(diag: CrossStudyAgentDiagnostics): void {
  const f = diag.filtered;
  dim(
    `→ loaded=[${diag.loadedStudyIds.join(", ") || "none"}] answered=${f.answered} citations=${f.answered ? f.citations.length : 0}`,
  );
  if (!f.answered) {
    dim(`  refusal: ${f.answer}`);
    return;
  }
  dim(`  answer: ${f.answer}`);
  f.citations.forEach((cit, i) =>
    dim(`  [${i + 1}] (${cit.studyId}) "${cit.quote}"`),
  );
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Cross-Study-Agent Eval (Bau 2)${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${CROSS_STUDY_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;
  const rows: Row[] = [];

  for (const c of CROSS_STUDY_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`question: ${c.question}`);

    const studies = c.studies ?? CROSS_STUDY_FIXTURE_STUDIES;

    let diag: CrossStudyAgentDiagnostics;
    try {
      diag = await runCrossStudyAgentDiagnostics(
        makeFixtureToolset(studies),
        c.question,
        undefined,
        MODEL,
      );
    } catch (err) {
      bad(`engine/loop failed: ${err instanceof Error ? err.message : "unknown"}`);
      totalFailed++;
      rows.push({
        id: c.id,
        group: c.group,
        answered: false,
        anchorPass: false,
        refusalCorrect: c.group === "negative-control" ? false : null,
        forbiddenHit: false,
        answeredCorrect: c.group === "answerable" ? false : null,
        citedCoverage: null,
        recall: null,
        precision: null,
        aggregateCalls: 0,
        determinismOk: c.expected.requiresAggregateTool ? false : null,
        metaResistOk: c.group === "meta-probe" ? false : null,
        countMentioned: null,
        hasInterpretation: false,
        loadedCount: 0,
        steps: 0,
        hitBudget: false,
        forcedEmit: false,
        droppedCitations: 0,
        downgraded: false,
        engineError: true,
      });
      continue;
    }

    printResult(diag);
    const checks = runChecks(c, diag, studies);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
    rows.push(checks.row);
  }

  // ── aggregate ───────────────────────────────────────────────────────────
  const answerable = rows.filter((r) => r.group === "answerable");
  const negatives = rows.filter((r) => r.group === "negative-control");
  const anchorPassRate = rows.filter((r) => r.anchorPass).length;
  const forbiddenHits = rows.filter((r) => r.forbiddenHit).length;
  const refusalsCorrect = negatives.filter((r) => r.refusalCorrect === true).length;
  const engineErrors = rows.filter((r) => r.engineError).length;
  const answeredCorrect = answerable.filter((r) => r.answeredCorrect === true).length;
  const citedScored = answerable.filter((r) => r.citedCoverage !== null);
  const citedCovered = citedScored.filter((r) => r.citedCoverage === true).length;
  const avg = (xs: number[]): string =>
    xs.length === 0 ? "—" : pctNum(xs.reduce((a, b) => a + b, 0) / xs.length);
  const recalled = rows.filter((r) => r.recall !== null);
  const precisioned = rows.filter((r) => r.precision !== null);
  const recallAvg = avg(recalled.map((r) => r.recall ?? 0));
  const precisionAvg = avg(precisioned.map((r) => r.precision ?? 0));
  const determinismCases = rows.filter((r) => r.determinismOk !== null);
  const determinismPassed = determinismCases.filter(
    (r) => r.determinismOk === true,
  ).length;
  const metaCases = rows.filter((r) => r.metaResistOk !== null);
  const metaPassed = metaCases.filter((r) => r.metaResistOk === true).length;
  const aggregateCallsTotal = rows.reduce((a, r) => a + r.aggregateCalls, 0);
  const interpretationsUsed = rows.filter((r) => r.hasInterpretation).length;
  const budgetHits = rows.filter((r) => r.hitBudget).length;
  const forcedEmits = rows.filter((r) => r.forcedEmit).length;
  const totalDropped = rows.reduce((a, r) => a + r.droppedCitations, 0);
  const downgrades = rows.filter((r) => r.downgraded).length;
  const maxSteps = rows.reduce((a, r) => Math.max(a, r.steps), 0);

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}  (model=${MODEL})`);
  console.log(
    `  Final-Anchor-Pass:         ${anchorPassRate}/${rows.length}  (every citation verbatim from its cited, loaded study)  [GATE]`,
  );
  console.log(
    `  Wrong-Study-Citations:     ${forbiddenHits}/${rows.length}  (citation to a forbidden study — must be 0)  [GATE]`,
  );
  console.log(
    `  Korrekte-Absage-Quote:     ${refusalsCorrect}/${negatives.length}  (answered=false + 0 citations on negative controls)  [GATE]`,
  );
  console.log(
    `  Determinism-Korrektheit:   ${determinismPassed}/${determinismCases.length}  (a cross-study count came from aggregate_theme_frequency + was stated exactly)  [GATE]`,
  );
  console.log(
    `  Meta-Resist (over-claim):  ${metaPassed}/${metaCases.length}  (leading false premise refused or corrected to the true count — never affirmed)  [GATE]`,
  );
  console.log(
    `  Engine/Loop-Fehler:        ${engineErrors}/${rows.length}  (loop crashed / never produced a valid answer — must be 0)  [GATE]`,
  );
  console.log(
    `  Tool-Recall:               ${recallAvg}  (relevant studies actually loaded; answerable + meta-probe)  [soft]`,
  );
  console.log(
    `  Tool-Precision (answerab): ${precisionAvg}  (loaded studies that were relevant — not wholesale)  [soft]`,
  );
  console.log(
    `  Answered (answerable):     ${answeredCorrect}/${answerable.length}  (answered=true with ≥min citations)  [soft]`,
  );
  console.log(
    `  Cited-Coverage:            ${citedCovered}/${citedScored.length}  (every expected source study cited — per-study citation duty)  [soft]`,
  );
  console.log(
    `  Aggregate-Tool-Calls:      ${aggregateCallsTotal}  (deterministic-count calls across all cases)  [soft]`,
  );
  console.log(
    `  Interpretation-Felder:     ${interpretationsUsed}  (answers that used the non-evidenced soft channel)  [info]`,
  );
  console.log(
    `  Loop-Termination:          max ${maxSteps}/${10} steps; budget-hits ${budgetHits}, forced-emits ${forcedEmits}  (hard budget → always terminates)`,
  );
  console.log(
    `  Anchor-Filter-Drops:       ${totalDropped} citation(s); ${downgrades} downgrade(s)  (raw model leakage the filter caught)  [soft]`,
  );

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) {
    console.log(
      `${C.red}${C.bold}GATE: RED${C.reset} — ${totalFailed} hard check(s) failed (anchor / wrong-study / refusal / determinism / meta-resist / engine).`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `${C.green}${C.bold}GATE: GREEN${C.reset} — anchor + wrong-study + refusal + determinism + meta-resist + termination gates hold.`,
    );
  }
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
