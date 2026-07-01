/**
 * Advisory („Beratung") eval (Runde 2). Runs generateImplicationsFromInputs over
 * ADVISORY_EVAL_CASES and, per case, reports:
 *   • the generated implications (basis + hypothesis),
 *   • count vs. expectation (deduction quality + restraint),
 *   • the deterministic GATE (basis anchored in a real finding — dropped if not),
 *   • the number-fidelity WARN (no invented numbers),
 *   • the advisory-grounding judge (traceable / hypothesis-framed / avoids-generic).
 *
 * By design this PRINTS a report — it does not hard-fail — so a human reads „what
 * ran well / what didn't" after each run (André's checkpoint-per-run workflow).
 *
 * Run: env -u ANTHROPIC_API_KEY tsx --conditions=react-server evals-synthesis-advisory/run.ts
 * (dotenv below loads the real key from .env.local).
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { generateImplicationsFromInputs } from "@/lib/synthesis/advisory";
import {
  filterAnchoredImplications,
  numberFidelityScan,
} from "@/lib/synthesis/advisory-checks";
import { ADVISORY_EVAL_CASES } from "./dataset";
import { judgeImplications } from "./judge";

const MODEL = process.env.SYNTHESIS_MODEL; // undefined → Opus (advisory default)
const JUDGE_MODEL = process.env.SYNTHESIS_JUDGE_MODEL;

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
};
const header = (s: string) => console.log(`\n${C.bold}${C.cyan}${s}${C.reset}`);
const ok = (s: string) => console.log(`  ${C.green}✓${C.reset} ${s}`);
const warn = (s: string) => console.log(`  ${C.yellow}!${C.reset} ${s}`);
const bad = (s: string) => console.log(`  ${C.red}✗${C.reset} ${s}`);
const dim = (s: string) => console.log(`  ${C.dim}${s}${C.reset}`);

async function main(): Promise<void> {
  let totalGen = 0;
  let totalDropped = 0;
  let totalNumberWarn = 0;
  let countIssues = 0;
  let judgeIssues = 0;

  for (const c of ADVISORY_EVAL_CASES) {
    header(`CASE: ${c.name}`);
    dim(`erwartet: ${c.expected.note}`);

    let implications;
    try {
      const result = await generateImplicationsFromInputs(c.input, MODEL);
      implications = result.implications;
    } catch (err) {
      bad(`Generierung fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    totalGen += implications.length;

    if (implications.length === 0) {
      dim("(keine Implikationen)");
    } else {
      implications.forEach((im, i) => {
        console.log(`  ${C.bold}[${i}]${C.reset} ${C.dim}← ${im.basis}${C.reset}`);
        console.log(`      ${im.hypothesis}`);
      });
    }

    // Count vs. expectation (deduction quality on rich cases, restraint on thin).
    if (
      implications.length >= c.expected.minImplications &&
      implications.length <= c.expected.maxImplications
    ) {
      ok(
        `count — ${implications.length} in [${c.expected.minImplications}, ${c.expected.maxImplications}]`,
      );
    } else {
      bad(
        `count — ${implications.length} außerhalb [${c.expected.minImplications}, ${c.expected.maxImplications}]`,
      );
      countIssues += 1;
    }

    // GATE — basis must name a real finding.
    const { dropped } = filterAnchoredImplications(implications, c.input);
    if (dropped.length === 0) {
      ok("basis-anchored — alle Implikationen leiten sich aus echten Befunden ab");
    } else {
      bad(
        `basis-anchored — ${dropped.length} mit erfundenem Befund (würden in Prod gedroppt):`,
      );
      dropped.forEach((d) => dim(`    basis="${d.basis}"`));
      totalDropped += dropped.length;
    }

    // WARN — no invented numbers.
    const numFindings = numberFidelityScan(implications, c.input);
    if (numFindings.length === 0) {
      ok("number-fidelity — keine erfundenen Zahlen");
    } else {
      numFindings.forEach((f) => warn(`number-fidelity [${f.index}] — ${f.message}`));
      totalNumberWarn += numFindings.length;
    }

    // Advisory-grounding judge (advises only).
    if (implications.length > 0) {
      try {
        const judged = await judgeImplications(c.input, implications, JUDGE_MODEL);
        judged.verdicts.forEach((v) => {
          const issues: string[] = [];
          if (!v.traceable) issues.push("nicht rückführbar");
          if (!v.hypothesis_framed) issues.push("als Fakt formuliert");
          if (!v.avoids_generic) issues.push("generisch");
          if (issues.length === 0) {
            ok(`judge [${v.index}] — ok`);
          } else {
            warn(`judge [${v.index}] — ${issues.join(", ")}: ${v.note}`);
            judgeIssues += 1;
          }
        });
      } catch (err) {
        warn(`Judge fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  header("SUMMARY");
  console.log(`  Implikationen gesamt: ${totalGen}`);
  console.log(
    `  ${countIssues === 0 ? C.green : C.red}Count-Abweichungen: ${countIssues}${C.reset}`,
  );
  console.log(
    `  ${totalDropped === 0 ? C.green : C.red}Erfundene Befunde (gedroppt): ${totalDropped}${C.reset}`,
  );
  console.log(`  ${C.yellow}Zahlen-Warnungen: ${totalNumberWarn}${C.reset}`);
  console.log(`  ${C.yellow}Judge-Hinweise: ${judgeIssues}${C.reset}`);
  console.log(
    `\n  ${C.dim}Modell: ${MODEL ?? "Opus (default)"} · Judge: ${JUDGE_MODEL ?? "Sonnet (default)"}${C.reset}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
