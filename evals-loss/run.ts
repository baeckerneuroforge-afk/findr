/**
 * Loss-Analysis Eval Runner — Regex Heuristic
 * -------------------------------------------
 * Runs the EXISTING regex extractor (extractLossReason) over every case in
 * LOSS_EVAL_CASES, compares the extracted primary_reason against
 * expected.primary, and reports accuracy overall and sliced by difficulty.
 *
 * Pure regex — NO LLM, NO API calls, NO network.
 *
 * Run with:  pnpm exec tsx evals-loss/run.ts
 */

import { extractLossReason } from "@/lib/loss/extractor";
import type { DetectorInput } from "@/lib/risk/types";
import { LOSS_EVAL_CASES, type LossEvalCase } from "./dataset";

type Difficulty = LossEvalCase["difficulty"];

const DIFFICULTIES: Difficulty[] = ["easy", "paraphrased", "trap"];

/**
 * Wrap a single transcript string into the DetectorInput shape the extractor
 * expects (one call, one segment carrying the whole transcript). Only the
 * fields the extractor reads matter; the rest are minimal valid placeholders.
 */
function toDetectorInput(c: LossEvalCase): DetectorInput {
  return {
    deal_id: c.id,
    org_id: "eval",
    deal_stage: "closed_lost",
    calls: [
      {
        id: `${c.id}-call`,
        recorded_at: "2024-01-01T00:00:00.000Z",
        duration_seconds: 0,
        segments: [{ text: c.transcript, start_seconds: 0, end_seconds: 0 }],
      },
    ],
  };
}

function pct(hits: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((hits / total) * 100)}%`;
}

async function main(): Promise<void> {
  const tally: Record<Difficulty, { hits: number; total: number }> = {
    easy: { hits: 0, total: 0 },
    paraphrased: { hits: 0, total: 0 },
    trap: { hits: 0, total: 0 },
  };
  let overallHits = 0;

  console.log("\nLoss-Analysis Eval — Regex Heuristic (no LLM, no API)\n");
  console.log(
    "ID".padEnd(9) +
      "LANG".padEnd(6) +
      "DIFFICULTY".padEnd(14) +
      "EXPECTED".padEnd(19) +
      "GOT".padEnd(19) +
      "HIT",
  );
  console.log("-".repeat(70));

  for (const c of LOSS_EVAL_CASES) {
    const analysis = await extractLossReason(toDetectorInput(c));
    const got = analysis.primary_reason;
    const hit = got === c.expected.primary;

    tally[c.difficulty].total += 1;
    if (hit) {
      tally[c.difficulty].hits += 1;
      overallHits += 1;
    }

    console.log(
      c.id.padEnd(9) +
        c.lang.padEnd(6) +
        c.difficulty.padEnd(14) +
        c.expected.primary.padEnd(19) +
        got.padEnd(19) +
        (hit ? "PASS" : "MISS"),
    );
  }

  const total = LOSS_EVAL_CASES.length;
  console.log("-".repeat(70));
  console.log(`\nOverall:        ${overallHits}/${total} (${pct(overallHits, total)})`);
  for (const d of DIFFICULTIES) {
    const { hits, total: t } = tally[d];
    console.log(`  ${d.padEnd(13)} ${hits}/${t} (${pct(hits, t)})`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
