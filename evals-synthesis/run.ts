/**
 * Study-Synthesis Eval Runner
 * ---------------------------
 * Runs synthesizeFromInputs() over SYNTHESIS_EVAL_CASES, applies four
 * property checks per case, and prints the full output so it can be
 * judged MANUALLY. Manual read is the primary evaluation (same posture
 * as evals-product-discovery/run.ts); the heuristic checks are
 * supportive pass/warn signals.
 *
 * Checks per case:
 *   (a) anchored        — every sourceInsightId in the output is one
 *                          of the input insight IDs. Engine-side
 *                          filter should have dropped the rest; if a
 *                          fail surfaces here it means the schema
 *                          allowed something through.
 *   (b) frequency-honest — each emergent_theme.frequency equals
 *                          unique(sourceInsightIds).length. The engine
 *                          OVERRIDES the model's number to this, so a
 *                          mismatch here is a bug in applyAnchoredFilter
 *                          (or the test data is malformed).
 *   (c) no-fake-tension  — if expected.tensions === 0, the output must
 *                          have tensions.length === 0. Anti-balance-
 *                          bias. (For >0 expectations we only require
 *                          tensions.length > 0 — the EXACT count is a
 *                          manual judgment.)
 *   (d) theme-count      — emergent_themes.length is within
 *                          [expected.minThemes, expected.maxThemes].
 *                          Bounds are advisory; a fail prints WARN.
 *
 * Always calls the LLM. Default model is Sonnet (cheap, for repeated
 * iteration); production approval should re-run with SYNTHESIS_MODEL=
 * claude-opus-4-7. Run it yourself, foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-synthesis/run.ts
 */

import { config } from "dotenv";
import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { synthesizeFromInputs } from "@/lib/synthesis/engine";
import type {
  EmergentTheme,
  StudySynthesisResult,
  Tension,
} from "@/lib/schemas/synthesis";
import {
  SYNTHESIS_EVAL_CASES,
  type SynthesisEvalCase,
} from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

// Default to Sonnet for cheap repeated iteration; flip to Opus for the
// approval run via SYNTHESIS_MODEL=claude-opus-4-7.
const MODEL = process.env.SYNTHESIS_MODEL ?? CLAUDE_MODELS.sonnet;

// ── pretty-print helpers ────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
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

function printTheme(t: EmergentTheme, idx: number): void {
  console.log(
    `  ${C.bold}Theme ${idx + 1}:${C.reset} ${t.title}  ${C.dim}freq=${t.frequency} · ids=[${t.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  dim(t.summary);
  for (const q of t.quotes) dim(`  • ${q}`);
}

function printTension(t: Tension, idx: number): void {
  console.log(
    `  ${C.bold}Tension ${idx + 1}:${C.reset} ${t.description}`,
  );
  console.log(
    `  ${C.dim}side_a${C.reset} ${t.side_a.label}  ${C.dim}ids=[${t.side_a.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  for (const q of t.side_a.quotes) dim(`    • ${q}`);
  console.log(
    `  ${C.dim}side_b${C.reset} ${t.side_b.label}  ${C.dim}ids=[${t.side_b.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  for (const q of t.side_b.quotes) dim(`    • ${q}`);
}

// ── checks ──────────────────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
}

function runChecks(
  testCase: SynthesisEvalCase,
  result: StudySynthesisResult,
): CheckResult {
  const inputIds = new Set(testCase.input.insights.map((i) => i.id));
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) anchored
  let unknownIds: string[] = [];
  for (const theme of result.emergent_themes) {
    for (const id of theme.sourceInsightIds) {
      if (!inputIds.has(id)) unknownIds.push(`theme:${id}`);
    }
  }
  for (const t of result.tensions) {
    for (const id of t.side_a.sourceInsightIds) {
      if (!inputIds.has(id)) unknownIds.push(`tension.a:${id}`);
    }
    for (const id of t.side_b.sourceInsightIds) {
      if (!inputIds.has(id)) unknownIds.push(`tension.b:${id}`);
    }
  }
  if (unknownIds.length === 0) {
    ok("anchored — every sourceInsightId is in the input set");
    passed++;
  } else {
    bad(`anchored — ${unknownIds.length} unknown id refs: ${unknownIds.slice(0, 5).join(", ")}`);
    failed++;
  }

  // (b) frequency-honest
  let freqMismatches = 0;
  for (const theme of result.emergent_themes) {
    const unique = new Set(theme.sourceInsightIds).size;
    if (theme.frequency !== unique) freqMismatches++;
  }
  if (freqMismatches === 0) {
    ok("frequency-honest — frequency == unique(sourceInsightIds) on every theme");
    passed++;
  } else {
    bad(`frequency-honest — ${freqMismatches} theme(s) with mismatched frequency`);
    failed++;
  }

  // (c) no-fake-tension (only enforced when expected === 0)
  if (testCase.expected.tensions === 0) {
    if (result.tensions.length === 0) {
      ok("no-fake-tension — tensions are empty as expected (full consensus)");
      passed++;
    } else {
      bad(
        `no-fake-tension — got ${result.tensions.length} tensions but expected 0 (consensus case)`,
      );
      failed++;
    }
  } else {
    // expected > 0 — just require non-empty; exact count is a manual judgment.
    if (result.tensions.length > 0) {
      ok(`tension-present — ${result.tensions.length} tension(s) surfaced (expected ${testCase.expected.tensions})`);
      passed++;
    } else {
      warn(
        `tension-present — got 0 tensions, expected ${testCase.expected.tensions} (manual judgment)`,
      );
      warned++;
    }
  }

  // (d) theme-count bounds
  const tc = result.emergent_themes.length;
  if (tc >= testCase.expected.minThemes && tc <= testCase.expected.maxThemes) {
    ok(`theme-count — ${tc} (within [${testCase.expected.minThemes}, ${testCase.expected.maxThemes}])`);
    passed++;
  } else {
    warn(
      `theme-count — ${tc} outside expected [${testCase.expected.minThemes}, ${testCase.expected.maxThemes}]`,
    );
    warned++;
  }

  // (e) max-frequency (only checked if expected provides a ceiling)
  if (testCase.expected.maxThemeFrequency !== undefined) {
    const maxFreq = result.emergent_themes.reduce(
      (m, t) => Math.max(m, t.frequency),
      0,
    );
    if (maxFreq <= testCase.expected.maxThemeFrequency) {
      ok(
        `max-frequency — ${maxFreq} ≤ ${testCase.expected.maxThemeFrequency} (no over-counting respondents)`,
      );
      passed++;
    } else {
      bad(
        `max-frequency — ${maxFreq} > ${testCase.expected.maxThemeFrequency} (theme cites more respondents than possible)`,
      );
      failed++;
    }
  }

  // (f) E4 methodology-gate — HART für Cases ohne Rationales (Server-Guard
  // sealSynthesisExtras muss nullen; LLM-unabhängig), WARN-Qualität für
  // Cases mit Rationales (Modell soll liefern; null = Qualitätssignal).
  const hadRationales = Boolean(
    testCase.input.rationales && testCase.input.rationales.length > 0,
  );
  if (!hadRationales) {
    if (result.methodology === null) {
      ok("methodology-gate — null without a rationales block (guard holds)");
      passed++;
    } else {
      bad("methodology-gate — methodology present WITHOUT a rationales block (guard breached)");
      failed++;
    }
  } else if (testCase.expected.expectMethodology) {
    if (result.methodology !== null) {
      ok(
        `methodology — present (${result.methodology.themes.length} theme line(s)${result.methodology.coverageNote ? ", coverage note set" : ""})`,
      );
      passed++;
    } else {
      warn("methodology — null despite supplied rationales (model quality)");
      warned++;
    }
  }

  // (g) E4 signal-observations-gate — spiegelbildlich: HART leer ohne
  // Faktenblock; mit Block 1–3 erwartet + Zahlen-Treue als WARN-Heuristik
  // (jede Zahl in einer Observation muss im Faktenblock vorkommen).
  const hadSignals = Boolean(testCase.input.signals);
  if (!hadSignals) {
    if (result.signal_observations.length === 0) {
      ok("signal-observations-gate — empty without a signals block (guard holds)");
      passed++;
    } else {
      bad("signal-observations-gate — observations WITHOUT a signals block (guard breached)");
      failed++;
    }
  } else if (testCase.expected.expectSignalObservations) {
    const obs = result.signal_observations;
    if (obs.length >= 1 && obs.length <= 3) {
      const s = testCase.input.signals!.summary;
      const allowedNumbers = new Set(
        [
          s.totalSessions,
          s.signalSessions,
          s.totalAnswers,
          s.direct,
          s.partial,
          s.evasive,
          s.declined,
          s.whySessions,
          ...Object.values(s.affects),
        ].map(String),
      );
      const strayNumbers = obs.flatMap(
        (o) => (o.match(/\d+/g) ?? []).filter((n) => !allowedNumbers.has(n)),
      );
      if (strayNumbers.length === 0) {
        ok(`signal-observations — ${obs.length} observation(s), all counts verbatim from the facts block`);
        passed++;
      } else {
        warn(
          `signal-observations — ${obs.length} observation(s), but number(s) not in the facts block: ${strayNumbers.slice(0, 4).join(", ")}`,
        );
        warned++;
      }
      for (const o of obs) dim(`  ◦ ${o}`);
    } else {
      warn(
        `signal-observations — got ${obs.length}, expected 1–3 despite supplied facts block (model quality)`,
      );
      warned++;
    }
  }

  return { passed, warned, failed };
}

// ── runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `${C.bold}Study-Synthesis Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${SYNTHESIS_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;

  for (const c of SYNTHESIS_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(
      `expected: themes ∈ [${c.expected.minThemes}, ${c.expected.maxThemes}], tensions = ${c.expected.tensions}${
        c.expected.maxThemeFrequency !== undefined
          ? `, maxThemeFrequency ≤ ${c.expected.maxThemeFrequency}`
          : ""
      }`,
    );

    let result: StudySynthesisResult;
    try {
      result = await synthesizeFromInputs(c.input, MODEL);
    } catch (err) {
      bad(`engine call failed: ${err instanceof Error ? err.message : "unknown"}`);
      totalFailed++;
      continue;
    }

    console.log(`\n  ${C.bold}OVERVIEW${C.reset}`);
    dim(`  ${result.overview}`);

    if (result.emergent_themes.length > 0) {
      console.log(`\n  ${C.bold}EMERGENT THEMES (${result.emergent_themes.length})${C.reset}`);
      result.emergent_themes.forEach(printTheme);
    } else {
      dim(`\n  (no emergent themes)`);
    }

    if (result.tensions.length > 0) {
      console.log(`\n  ${C.bold}TENSIONS (${result.tensions.length})${C.reset}`);
      result.tensions.forEach(printTension);
    } else {
      dim(`\n  (no tensions)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, result);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
  }

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
