/**
 * Solution-Layer Eval Runner
 * --------------------------
 * Runs generateSolution() over SOLUTION_EVAL_CASES and prints the FULL output
 * per case (recommendations + next steps + evidence + overall verdict) so it can
 * be read and judged MANUALLY — that manual read is the primary evaluation.
 *
 * On top of the read, three heuristic checks are printed per recommendation as
 * supportive signals (not a score):
 *   (a) anchored   — does it cite a real quote / concrete deal detail (not just
 *                    the signal name), and avoid generic sales platitudes?
 *   (b) nextStep   — is there a concrete, actionable next step (verb / timing)?
 *   (c) no-halluc  — if it presents an evidence quote, does that quote actually
 *                    appear in this deal? (rough fabrication check)
 * These are heuristics; trust the text, not the PASS/WARN flags.
 *
 * Always calls the LLM (Opus by default; override with SOLUTION_MODEL). The
 * extractor pulls in modules marked "server-only", so this MUST run with the
 * react-server export condition. Start it yourself, in the foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-solution/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` clears an empty/shadowing shell var so dotenv can
 * inject the real key from .env.local; harmless if unset. Prefix with
 * `SOLUTION_MODEL=claude-sonnet-4-6` to test the cheaper model.)
 */

import { config } from "dotenv";
import { SOLUTION_EVAL_CASES, type SolutionEvalCase } from "./dataset";
import type {
  SolutionRecommendation,
  SolutionResult,
} from "@/lib/solution/extractor";

// ---- heuristic checks -------------------------------------------------------

const GENERIC_PHRASES = [
  "build a relationship",
  "build relationship",
  "build rapport",
  "communicate value",
  "communicate the value",
  "demonstrate value",
  "add value",
  "build trust",
  "stay in touch",
  "be proactive",
  "align stakeholders",
  "align with stakeholders",
  "follow up regularly",
  "beziehung aufbauen",
  "mehrwert kommunizieren",
  "vertrauen aufbauen",
  "am ball bleiben",
  "proaktiv sein",
];

const ACTION_VERBS = [
  "send",
  "schedule",
  "book",
  "call",
  "email",
  "share",
  "propose",
  "present",
  "invite",
  "ask",
  "confirm",
  "draft",
  "prepare",
  "arrange",
  "escalate",
  "loop",
  "set up",
  "follow up",
  "walk",
  "map",
  "build",
  "offer",
  "senden",
  "schicken",
  "vereinbaren",
  "planen",
  "anrufen",
  "vorbereiten",
  "einladen",
  "bestätigen",
  "erstellen",
  "eskalieren",
  "aufsetzen",
  "durchgehen",
  "anbieten",
];

const TIME_REFS = [
  "by ",
  "before ",
  "until ",
  "ahead of",
  "this week",
  "next ",
  "tomorrow",
  "within ",
  "bis ",
  "vor ",
  "nächste",
  "diese woche",
  "morgen",
  "am ",
];

interface Check {
  ok: boolean;
  note: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function salientTokens(s: string): string[] {
  const caps = s.match(/[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]{2,}/g) ?? [];
  const nums = s.match(/\d[\d.,]*/g) ?? [];
  const stop = new Set(["the", "der", "die", "das", "send", "confirm", "schedule"]);
  return [...caps, ...nums].filter((t) => !stop.has(t.toLowerCase()));
}

/** (a) Anchored: cites a real quote / concrete deal detail, not a platitude. */
function checkAnchored(rec: SolutionRecommendation, haystack: string): Check {
  const recNorm = normalize(rec.recommendation);
  const generic = GENERIC_PHRASES.find((p) => recNorm.includes(p));
  if (generic) return { ok: false, note: `generic phrase: "${generic}"` };

  const evNorm = normalize(rec.evidence);
  if (evNorm.length >= 12 && haystack.includes(evNorm)) {
    return { ok: true, note: "evidence quote found in deal" };
  }

  const shared = salientTokens(rec.recommendation).find((tok) =>
    haystack.includes(tok.toLowerCase()),
  );
  if (shared) return { ok: true, note: `mentions deal detail "${shared}"` };

  return { ok: false, note: "no quote or concrete deal detail in recommendation" };
}

/** (b) Concrete next step: has an action verb (and ideally a timing/owner). */
function checkNextStep(rec: SolutionRecommendation): Check {
  const ns = normalize(rec.nextStep);
  if (ns.length < 15) return { ok: false, note: "next step too short / vague" };
  const hasVerb = ACTION_VERBS.some((v) => ns.includes(v));
  const hasTime = TIME_REFS.some((t) => ns.includes(t));
  if (hasVerb && hasTime) return { ok: true, note: "action verb + timing" };
  if (hasVerb) return { ok: true, note: "has action verb (no explicit timing)" };
  return { ok: false, note: "no clear action verb" };
}

/** (c) No obvious hallucination: a presented quote must exist in the deal. */
function checkNoHalluc(rec: SolutionRecommendation, haystack: string): Check {
  const evNorm = normalize(rec.evidence);
  if (evNorm.length < 6) return { ok: true, note: "no evidence quote to verify" };
  if (haystack.includes(evNorm)) {
    return { ok: true, note: "evidence verbatim in deal" };
  }
  return { ok: false, note: "evidence NOT found verbatim — verify for fabrication" };
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

// ---- printing ---------------------------------------------------------------

function caseHaystack(c: SolutionEvalCase): string {
  const quotes = c.riskAnalysis.signals.flatMap((s) => s.quotes).join(" ");
  return normalize(`${c.transcript} ${quotes}`);
}

function amountStr(c: SolutionEvalCase): string {
  const { amount, currency } = c.deal;
  if (amount == null) return "amount n/a";
  return `${currency ? `${currency} ` : ""}${amount.toLocaleString()}`;
}

interface Tally {
  recs: number;
  anchored: number;
  nextStep: number;
  noHalluc: number;
}

function printCase(c: SolutionEvalCase, result: SolutionResult, tally: Tally): void {
  const haystack = caseHaystack(c);
  const signalList =
    c.riskAnalysis.signals.map((s) => s.type).join(", ") || "none";

  console.log("\n" + "=".repeat(78));
  console.log(`${c.id} — ${c.description}`);
  console.log(
    `deal: ${c.deal.stage} · ${amountStr(c)} · ${c.deal.callsCount} calls · ${
      c.deal.industry ?? "n/a"
    }`,
  );
  console.log(
    `risk: ${c.riskAnalysis.riskScore}/100 (${c.riskAnalysis.riskLevel}) · signals: ${signalList}`,
  );
  console.log("-".repeat(78));
  console.log(
    `OVERALL: salvageable=${result.overall.salvageable} — ${result.overall.reasoning}`,
  );

  if (result.recommendations.length === 0) {
    console.log("(no recommendations returned)");
    if (c.riskAnalysis.signals.length === 0) {
      console.log("  -> expected for a healthy deal.");
    } else {
      console.log("  -> WARN: signals were present but no recommendations came back.");
    }
    return;
  }

  result.recommendations.forEach((rec, i) => {
    const anchored = checkAnchored(rec, haystack);
    const nextStep = checkNextStep(rec);
    const noHalluc = checkNoHalluc(rec, haystack);

    tally.recs += 1;
    if (anchored.ok) tally.anchored += 1;
    if (nextStep.ok) tally.nextStep += 1;
    if (noHalluc.ok) tally.noHalluc += 1;

    console.log(`\nREC ${i + 1} [${rec.signal}]`);
    console.log(`  recommendation: ${rec.recommendation}`);
    console.log(`  next step:      ${rec.nextStep}`);
    console.log(`  evidence:       ${rec.evidence ? `"${rec.evidence}"` : "(none)"}`);
    console.log(
      `  checks: anchored ${flag(anchored)} | nextStep ${flag(
        nextStep,
      )} | no-halluc ${flag(noHalluc)}`,
    );
  });
}

// ---- main -------------------------------------------------------------------

async function loadExtractor() {
  try {
    return await import("@/lib/solution/extractor");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Client Component|server-only/i.test(msg)) {
      console.error(
        "\nThis runner imports a server-only module. Re-run with the react-server condition:\n" +
          "  env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-solution/run.ts\n",
      );
      process.exit(1);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  config({ path: ".env.local" });

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Ensure .env.local has it and no empty shell var " +
        "is shadowing it — run with: env -u ANTHROPIC_API_KEY ...",
    );
  }

  const { generateSolution, DEFAULT_SOLUTION_MODEL } = await loadExtractor();
  const model = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL;

  console.log(`\nSolution-Layer Eval — model: ${model}`);
  console.log(`${SOLUTION_EVAL_CASES.length} cases · read the output, judge manually\n`);

  const tally: Tally = { recs: 0, anchored: 0, nextStep: 0, noHalluc: 0 };
  let errors = 0;

  for (const c of SOLUTION_EVAL_CASES) {
    try {
      const result = await generateSolution({
        riskAnalysis: c.riskAnalysis,
        deal: c.deal,
        transcript: c.transcript,
      });
      printCase(c, result, tally);
    } catch (err) {
      errors += 1;
      console.log("\n" + "=".repeat(78));
      console.log(`${c.id} — ${c.description}`);
      console.log(
        `  ERROR: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (${SOLUTION_EVAL_CASES.length} cases, model: ${model})`);
  if (errors > 0) console.log(`  errors:               ${errors}`);
  console.log(`  total recommendations: ${tally.recs}`);
  console.log(`  anchored:              ${tally.anchored}/${tally.recs}`);
  console.log(`  concrete next step:    ${tally.nextStep}/${tally.recs}`);
  console.log(`  no obvious halluc.:    ${tally.noHalluc}/${tally.recs}`);
  console.log(
    "\nHeuristics only — the real evaluation is reading the recommendations above.\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
