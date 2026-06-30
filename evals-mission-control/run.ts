import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  buildMissionControlAnchorSet,
  fold,
  runMissionControlDiagnostics,
  type MissionControlAnchorSet,
} from "@/lib/mission-control/engine";
import type { MissionControlResult } from "@/lib/schemas/mission-control";
import {
  MISSION_CONTROL_EVAL_CASES,
  type MissionControlEvalCase,
} from "./dataset";

/**
 * Mission-Control / Cross-Study-Chat eval (Etappe 1). Drives
 * runMissionControlDiagnostics over hand-crafted multi-study scenarios and
 * checks the anti-hallucination gate: every surfaced statement traces to ONE
 * real synthesis, attributed to the RIGHT study, with honest refusals on
 * questions no synthesis supports.
 *
 *   env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server \
 *     evals-mission-control/run.ts
 *
 * Default model = Opus (chat-with-data parity, trust-critical). Override with
 * MISSION_CONTROL_MODEL=claude-sonnet-5 to probe the cheaper tier.
 */

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.MISSION_CONTROL_MODEL ?? CLAUDE_MODELS.opus;

// ── Tiny ANSI palette (mirror of evals/chat-with-data/run.ts) ────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};
const header = (s: string) => console.log(`\n${C.bold}▶ ${s}${C.reset}`);
const ok = (s: string) => console.log(`  ${C.green}✓${C.reset} ${s}`);
const bad = (s: string) => console.log(`  ${C.red}✗${C.reset} ${s}`);
const warn = (s: string) => console.log(`  ${C.yellow}⚠${C.reset} ${s}`);
const dim = (s: string) => console.log(`  ${C.dim}${s}${C.reset}`);

interface Row {
  id: string;
  expectedAnswered: boolean;
  negativeControl: boolean;
  gotAnswered: boolean;
  citationsRaw: number;
  citationsFiltered: number;
  rawDropped: number;
  anchorIntegrity: boolean; // every FILTERED citation anchors to its study
  knownStudy: boolean; // every FILTERED citation studyId is real
  noWrongSource: boolean | null; // filtered citations ⊆ allowedStudyIds
  refusalClean: boolean | null; // negative controls: answered=false + 0 cites
}

function anchored(
  citations: MissionControlResult["citations"],
  anchors: MissionControlAnchorSet,
): { allAnchored: boolean; allKnown: boolean; failing: number } {
  let allAnchored = true;
  let allKnown = true;
  let failing = 0;
  for (const c of citations) {
    const known = anchors.studyIds.has(c.studyId);
    const hay = anchors.haystackByStudy.get(c.studyId);
    const quoteOk = hay !== undefined && hay.includes(fold(c.quote));
    if (!known) allKnown = false;
    if (!known || !quoteOk) {
      allAnchored = false;
      failing++;
    }
  }
  return { allAnchored, allKnown, failing };
}

function runChecks(
  testCase: MissionControlEvalCase,
  diag: Awaited<ReturnType<typeof runMissionControlDiagnostics>>,
  anchors: MissionControlAnchorSet,
): { passed: number; failed: number; warned: number; row: Row } {
  const { raw, filtered } = diag;
  const negativeControl = testCase.expected.negativeControl === true;
  let passed = 0;
  let failed = 0;
  let warned = 0;

  const rawCites = raw.answered ? raw.citations : [];
  const filteredCites = filtered.answered ? filtered.citations : [];
  const rawCheck = anchored(rawCites, anchors);
  const filteredCheck = anchored(filteredCites, anchors);

  // (1) anchor-integrity [HARD] — the user-visible guarantee: every surviving
  //     citation's quote is a verbatim fold-substring of its cited study.
  if (filteredCheck.allAnchored) {
    ok("anchor-integrity — every surviving citation anchored to its cited study");
    passed++;
  } else {
    bad(`anchor-integrity — ${filteredCheck.failing} filtered citation(s) not anchored to their study`);
    failed++;
  }

  // (2) known-study [HARD] — every surviving citation names a real org study.
  if (filteredCheck.allKnown) {
    ok("known-study — every surviving citation.studyId is a real org study");
    passed++;
  } else {
    bad("known-study — a surviving citation names an unknown studyId");
    failed++;
  }

  // (3) no-wrong-source [HARD on answerable] — surviving citations stay within
  //     the studies this question may legitimately draw from.
  let noWrongSource: boolean | null = null;
  if (testCase.expected.allowedStudyIds) {
    const allowed = new Set(testCase.expected.allowedStudyIds);
    const offenders = filteredCites
      .map((c) => c.studyId)
      .filter((id) => !allowed.has(id));
    noWrongSource = offenders.length === 0;
    if (noWrongSource) {
      ok("no-wrong-source — no citation attributed to a study outside the allowed set");
      passed++;
    } else {
      bad(`no-wrong-source — cited disallowed studies: ${[...new Set(offenders)].join(", ")}`);
      failed++;
    }
  }

  // (4) refusal-clean [HARD on negative controls] — honest refusal, no cites.
  let refusalClean: boolean | null = null;
  if (negativeControl) {
    refusalClean = filtered.answered === false && filtered.citations.length === 0;
    if (refusalClean) {
      ok("refusal-clean — answered=false with zero citations (honest refusal)");
      passed++;
    } else {
      bad(`refusal-clean — expected refusal, got answered=${filtered.answered} with ${filtered.citations.length} citation(s)`);
      failed++;
    }
  }

  // ── soft signals (observability, not gates) ──────────────────────────────
  if (!negativeControl) {
    if (filtered.answered === testCase.expected.answered) {
      ok(`answered-match — ${filtered.answered} (soft)`);
    } else {
      warn(`answered-match — got ${filtered.answered}, expected ${testCase.expected.answered} (soft — model judgment)`);
      warned++;
    }
  }
  if (testCase.expected.expectStudyIds && filtered.answered) {
    const cited = new Set(filteredCites.map((c) => c.studyId));
    const missing = testCase.expected.expectStudyIds.filter((id) => !cited.has(id));
    if (missing.length === 0) {
      ok(`coverage — drew from all expected studies (soft)`);
    } else {
      warn(`coverage — did not cite: ${missing.join(", ")} (soft)`);
      warned++;
    }
  }
  if (rawCheck.failing > 0) {
    dim(`(model produced ${rawCheck.failing} unanchored/wrong-study raw citation(s) — the filter stripped them)`);
  }

  return {
    passed,
    failed,
    warned,
    row: {
      id: testCase.id,
      expectedAnswered: testCase.expected.answered,
      negativeControl,
      gotAnswered: filtered.answered,
      citationsRaw: rawCites.length,
      citationsFiltered: filteredCites.length,
      rawDropped: rawCheck.failing,
      anchorIntegrity: filteredCheck.allAnchored,
      knownStudy: filteredCheck.allKnown,
      noWrongSource,
      refusalClean,
    },
  };
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Mission-Control Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${MISSION_CONTROL_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarned = 0;
  const rows: Row[] = [];

  for (const c of MISSION_CONTROL_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`Q: ${c.question}`);

    const syntheses = c.buildSyntheses();
    const anchors = buildMissionControlAnchorSet(syntheses);

    let diag: Awaited<ReturnType<typeof runMissionControlDiagnostics>>;
    try {
      diag = await runMissionControlDiagnostics({ syntheses, question: c.question }, MODEL);
    } catch (err) {
      bad(`engine call failed: ${err instanceof Error ? err.message : "unknown"}`);
      totalFailed++;
      rows.push({
        id: c.id,
        expectedAnswered: c.expected.answered,
        negativeControl: c.expected.negativeControl === true,
        gotAnswered: false,
        citationsRaw: 0,
        citationsFiltered: 0,
        rawDropped: 0,
        anchorIntegrity: false,
        knownStudy: false,
        noWrongSource: null,
        refusalClean: null,
      });
      continue;
    }

    console.log(`  ${C.magenta}answered=${diag.filtered.answered}${C.reset}  ${C.dim}${diag.filtered.answer}${C.reset}`);
    if (diag.filtered.answered && diag.filtered.citations.length > 0) {
      for (const cite of diag.filtered.citations) {
        dim(`  • [${cite.studyId}] "${cite.quote}"`);
      }
    }
    if (diag.downgraded) dim("(downgraded: answered→refusal, all citations unanchored)");

    const checks = runChecks(c, diag, anchors);
    totalPassed += checks.passed;
    totalFailed += checks.failed;
    totalWarned += checks.warned;
    rows.push(checks.row);
  }

  // ── results table ─────────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══ RESULTS ═══${C.reset}`);
  console.log(
    `${C.dim}${"id".padEnd(24)} ${"ans".padEnd(5)} ${"cites".padStart(5)} ${"anchor".padEnd(7)} ${"source".padEnd(7)} refusal${C.reset}`,
  );
  for (const r of rows) {
    const anchorMark = r.anchorIntegrity && r.knownStudy ? `${C.green}ok ` : `${C.red}BAD`;
    const sourceMark =
      r.noWrongSource === null ? `${C.dim}n/a` : r.noWrongSource ? `${C.green}ok ` : `${C.red}BAD`;
    const refusalMark =
      r.refusalClean === null ? `${C.dim}n/a` : r.refusalClean ? `${C.green}ok ` : `${C.red}BAD`;
    console.log(
      `  ${r.id.padEnd(24)} ${String(r.gotAnswered).padEnd(5)} ${String(r.citationsFiltered).padStart(5)} ${anchorMark.padEnd(16)}${C.reset} ${sourceMark.padEnd(16)}${C.reset} ${refusalMark}${C.reset}`,
    );
  }

  // ── aggregate metrics ───────────────────────────────────────────────────────
  const answerableRows = rows.filter((r) => !r.negativeControl);
  const negativeRows = rows.filter((r) => r.negativeControl);
  const anchorOk = rows.filter((r) => r.anchorIntegrity && r.knownStudy).length;
  const sourceScored = rows.filter((r) => r.noWrongSource !== null);
  const sourceOk = sourceScored.filter((r) => r.noWrongSource === true).length;
  const refusalsOk = negativeRows.filter((r) => r.refusalClean === true).length;
  const rawCitesTotal = rows.reduce((a, r) => a + r.citationsRaw, 0);
  const rawDroppedTotal = rows.reduce((a, r) => a + r.rawDropped, 0);
  const fpr = rawCitesTotal === 0 ? 0 : rawDroppedTotal / rawCitesTotal;

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}  (model=${MODEL})`);
  console.log(`  Anchor-Pass:            ${anchorOk}/${rows.length}  (every surviving citation verbatim-anchored to its cited study)  [GATE]`);
  console.log(`  Quell-Zuordnung:        ${sourceOk}/${sourceScored.length}  (no citation attributed to a study outside the allowed set)  [GATE]`);
  console.log(`  Korrekte-Absage-Quote:  ${refusalsOk}/${negativeRows.length}  (negative controls → answered=false + 0 citations)  [GATE]`);
  console.log(`  Halluzinations-FPR:     ${(fpr * 100).toFixed(1)}%  (${rawDroppedTotal}/${rawCitesTotal} raw model citations the filter had to strip)  [observability]`);
  console.log(`  Antwortbare Cases:      ${answerableRows.length}, davon answered: ${answerableRows.filter((r) => r.gotAnswered).length}`);

  const gateGreen = anchorOk === rows.length && sourceOk === sourceScored.length && refusalsOk === negativeRows.length;

  console.log(`\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`);
  if (gateGreen && totalFailed === 0) {
    console.log(`${C.green}${C.bold}GATE: GREEN${C.reset} — cross-study anti-hallucination gate holds (anchor + source + refusal).`);
  } else {
    console.log(`${C.red}${C.bold}GATE: RED${C.reset} — a hard check failed (${totalFailed} failure(s)).`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
