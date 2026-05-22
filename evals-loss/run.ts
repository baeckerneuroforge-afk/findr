/**
 * Loss-Analysis Eval Runner — Regex vs LLM
 * ----------------------------------------
 * Runs an extractor over every case in LOSS_EVAL_CASES, compares the extracted
 * primary_reason against expected.primary, and reports accuracy overall and
 * sliced by difficulty (easy / paraphrased / trap) so each mode is directly
 * comparable to the regex baseline (33%, easy 4/7, paraphrased 0/4, trap 0/1).
 *
 * Two modes, selected by argv[2] OR the LOSS_EVAL_MODE env var (default: regex):
 *
 *   regex  — the existing heuristic `extractLossReason`. No LLM, no API, no key.
 *            Run with:  pnpm exec tsx evals-loss/run.ts            (or: ... regex)
 *
 *   llm    — the new `extractLossReasonLLM` (Opus by default, override LOSS_MODEL).
 *            Makes one Anthropic call per case (12 calls). Because it pulls in
 *            modules marked "server-only", it MUST be run with the react-server
 *            export condition so that marker resolves to its no-op:
 *
 *              env -u ANTHROPIC_API_KEY \
 *                pnpm exec tsx --conditions=react-server evals-loss/run.ts llm
 *
 *            (`env -u ANTHROPIC_API_KEY` clears an empty/shadowing shell var so
 *            dotenv can inject the real key from .env.local; harmless if unset.
 *            Add LOSS_MODEL=claude-sonnet-4-6 in front to test a cheaper model.)
 *
 * The LLM extractor is imported DYNAMICALLY inside llm mode only, so regex mode
 * never loads "server-only" and keeps running under plain tsx with no flag.
 *
 * This file auto-runs main() when executed, but it NEVER calls the API unless
 * mode === "llm" is explicitly selected — running it with no arguments performs
 * the safe, free regex eval.
 */

import { extractLossReason } from "@/lib/loss/extractor";
import type { LossAnalysis } from "@/lib/loss/extractor";
import type { DetectorInput } from "@/lib/risk/types";
import { LOSS_EVAL_CASES, type LossEvalCase } from "./dataset";

type Difficulty = LossEvalCase["difficulty"];
type Mode = "regex" | "llm";

const DIFFICULTIES: Difficulty[] = ["easy", "paraphrased", "trap"];

interface CaseOutput {
  got: LossAnalysis["primary_reason"];
  evidence: string;
  method: LossAnalysis["extraction_method"];
}

/** A function that runs one case through the active extractor. */
type CaseRunner = (c: LossEvalCase) => Promise<CaseOutput>;

/**
 * Wrap a single transcript string into the DetectorInput shape the extractors
 * expect (one call, one segment carrying the whole transcript). Only the fields
 * the extractors read matter; the rest are minimal valid placeholders.
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

function toCaseOutput(analysis: LossAnalysis): CaseOutput {
  return {
    got: analysis.primary_reason,
    evidence: analysis.evidence_quotes[0]?.quote ?? "",
    method: analysis.extraction_method,
  };
}

function parseMode(): Mode {
  const raw = (
    process.argv[2] ??
    process.env.LOSS_EVAL_MODE ??
    "regex"
  ).toLowerCase();
  if (raw === "regex" || raw === "llm") return raw;
  throw new Error(`Unknown mode "${raw}". Use "regex" or "llm".`);
}

/**
 * Build the case runner for a mode. The LLM extractor is imported here, lazily,
 * so regex mode never touches "server-only". Returns the runner plus a label of
 * the active model for the report header.
 */
async function buildRunner(
  mode: Mode,
): Promise<{ run: CaseRunner; modelLabel: string }> {
  if (mode === "llm") {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY not set. For llm mode, ensure .env.local has it and " +
          "no empty shell var is shadowing it — run with: env -u ANTHROPIC_API_KEY ...",
      );
    }

    const { extractLossReasonLLM, DEFAULT_LOSS_MODEL } = await import(
      "@/lib/loss/llm-extractor"
    );

    return {
      run: async (c) => toCaseOutput(await extractLossReasonLLM(toDetectorInput(c))),
      modelLabel: process.env.LOSS_MODEL ?? DEFAULT_LOSS_MODEL,
    };
  }

  return {
    run: async (c) => toCaseOutput(await extractLossReason(toDetectorInput(c))),
    modelLabel: "regex heuristic (no model)",
  };
}

function pct(hits: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((hits / total) * 100)}%`;
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

async function main(): Promise<void> {
  const mode = parseMode();
  const { run, modelLabel } = await buildRunner(mode);

  const tally: Record<Difficulty, { hits: number; total: number }> = {
    easy: { hits: 0, total: 0 },
    paraphrased: { hits: 0, total: 0 },
    trap: { hits: 0, total: 0 },
  };
  let overallHits = 0;

  const title =
    mode === "llm"
      ? `LLM (${modelLabel})`
      : "Regex Heuristic (no LLM, no API)";
  console.log(`\nLoss-Analysis Eval — ${title}\n`);
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
    const { got, evidence, method } = await run(c);
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

    // In llm mode, surface the model's evidence quote and flag any silent
    // fallback to the regex heuristic (a failed LLM call) so it is never hidden.
    if (mode === "llm") {
      if (method === "heuristic") {
        console.log("         [fallback: regex heuristic — LLM call failed]");
      }
      if (evidence) {
        console.log(`         evidence: "${truncate(evidence, 96)}"`);
      }
    }
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
