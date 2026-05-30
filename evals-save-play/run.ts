/**
 * Save-Play Eval Runner
 * ---------------------
 * Mirror of evals-solution/run.ts for the CS save-play layer. Runs
 * generateSavePlayLLM() over SAVE_PLAY_EVAL_CASES and prints the FULL output
 * per case (recommendations + next steps + evidence + overall verdict) so it
 * can be read and judged MANUALLY — that manual read is the primary evaluation.
 *
 * On top of the read, three heuristic checks are printed per recommendation as
 * supportive signals (not a score):
 *   (a) anchored   — does it cite a real quote / concrete account detail (not
 *                    just the signal name), and avoid generic CS platitudes?
 *   (b) nextStep   — is there a concrete, actionable next step (verb / timing)?
 *   (c) no-halluc  — if it presents an evidence quote, does that quote actually
 *                    appear in this account's transcript? (rough fabrication check)
 * These are heuristics; trust the text, not the PASS/WARN flags.
 *
 * Always calls the LLM (Opus by default; override with SOLUTION_MODEL — shared
 * with the solution eval on purpose, both layers share one model knob). The
 * service pulls in modules marked "server-only", so this MUST run with the
 * react-server export condition. Start it yourself, in the foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-save-play/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` clears an empty/shadowing shell var so dotenv
 * can inject the real key from .env.local; harmless if unset. Prefix with
 * `SOLUTION_MODEL=claude-sonnet-4-6` to test the cheaper model.)
 */

import { config } from "dotenv";
import { SAVE_PLAY_EVAL_CASES, type SavePlayEvalCase } from "./dataset";
import type {
  SavePlayRecommendation,
  SavePlayResult,
} from "@/lib/accounts/save-play-extractor";

// ---- heuristic checks -------------------------------------------------------

const GENERIC_PHRASES = [
  // Shared with the solution eval (sales/CS overlap):
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
  // CS-specific platitudes (round 1 additions):
  "secure the renewal",
  "renewal sichern",
  "drive expansion",
  "expansion treiben",
  "rebuild trust",
  "vertrauen zurückgewinnen",
  "ensure customer success",
  "customer success sicherstellen",
];

const ACTION_VERBS = [
  // Shared with the solution eval:
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
  // CS-specific concrete verbs (round 1 additions):
  "introduce",
  "vorstellen",
  "re-onboard",
  "neu onboarden",
  "verlängern",
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

/**
 * Fold Unicode + DE typography to ASCII equivalents so substring checks treat
 * smart quotes, en/em-dashes, umlauts, and ß as their plain ASCII forms. Both
 * the haystack and the candidate are folded before comparison, so transcript
 * "ü" matches a quote "ue" (and vice versa), `„…"` matches `'…'`, em-dashes
 * match hyphens, etc. Mirrors fold() in evals/health-runner.eval.ts so the
 * two evals stay consistent.
 *
 * Normalization:
 *  - NFKC (compose composed/decomposed forms, normalize compatibility chars)
 *  - DE umlauts → ASCII pairs (ü → ue, ä → ae, ö → oe, ß → ss)
 *  - ALL quote varieties (ASCII " ', typographic „ " " « » ' ' ‚ ‹ ›) → "
 *  - En/em-dashes (– —) → -
 *  - Whitespace collapsed, trimmed, lowercased.
 */
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

function salientTokens(s: string): string[] {
  const caps = s.match(/[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]{2,}/g) ?? [];
  const nums = s.match(/\d[\d.,]*/g) ?? [];
  const stop = new Set(["the", "der", "die", "das", "send", "confirm", "schedule"]);
  return [...caps, ...nums].filter((t) => !stop.has(t.toLowerCase()));
}

/** (a) Anchored: cites a real quote / concrete account detail, not a platitude. */
function checkAnchored(rec: SavePlayRecommendation, haystack: string): Check {
  const recNorm = fold(rec.recommendation);
  const generic = GENERIC_PHRASES.find((p) => recNorm.includes(p));
  if (generic) return { ok: false, note: `generic phrase: "${generic}"` };

  const evNorm = fold(rec.evidence);
  if (evNorm.length >= 12 && haystack.includes(evNorm)) {
    return { ok: true, note: "evidence quote found in account" };
  }

  // Fold the token too — otherwise an umlaut-bearing token (e.g., "Müller")
  // would miss its already-folded haystack counterpart ("mueller").
  const shared = salientTokens(rec.recommendation).find((tok) =>
    haystack.includes(fold(tok)),
  );
  if (shared) return { ok: true, note: `mentions account detail "${shared}"` };

  return { ok: false, note: "no quote or concrete account detail in recommendation" };
}

/** (b) Concrete next step: has an action verb (and ideally a timing/owner). */
function checkNextStep(rec: SavePlayRecommendation): Check {
  const ns = fold(rec.nextStep);
  if (ns.length < 15) return { ok: false, note: "next step too short / vague" };
  const hasVerb = ACTION_VERBS.some((v) => ns.includes(v));
  const hasTime = TIME_REFS.some((t) => ns.includes(t));
  if (hasVerb && hasTime) return { ok: true, note: "action verb + timing" };
  if (hasVerb) return { ok: true, note: "has action verb (no explicit timing)" };
  return { ok: false, note: "no clear action verb" };
}

/** (c) No obvious hallucination: every presented quote fragment must exist in the account. */
function checkNoHalluc(rec: SavePlayRecommendation, haystack: string): Check {
  const evNorm = fold(rec.evidence);
  if (evNorm.length < 6) return { ok: true, note: "no evidence quote to verify" };

  // The model sometimes stitches two genuine transcript spans together with an
  // ellipsis ("A ... B" or "A … B"). Verify EACH fragment independently so a
  // legitimate composite quote isn't flagged as fabrication — only a fragment
  // that is genuinely absent from the account is a hallucination signal. Short
  // splinters (< 10 chars) from the split are ignored as noise.
  const fragments = evNorm
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 10);

  if (fragments.length === 0) {
    return { ok: true, note: "no substantial evidence fragment to verify" };
  }

  const missing = fragments.find((f) => !haystack.includes(f));
  if (missing) {
    return {
      ok: false,
      note: "evidence fragment NOT found verbatim — verify for fabrication",
    };
  }

  return {
    ok: true,
    note:
      fragments.length > 1
        ? "all evidence fragments found in account"
        : "evidence verbatim in account",
  };
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

// ---- printing ---------------------------------------------------------------

function caseHaystack(c: SavePlayEvalCase): string {
  const quotes = c.health.signals.flatMap((s) => s.quotes).join(" ");
  return fold(`${c.transcript} ${quotes}`);
}

function valueStr(c: SavePlayEvalCase): string {
  const { mrr, currency, valueType } = c.account;
  if (mrr == null) return "value n/a";
  const amount = `${currency} ${mrr.toLocaleString()}`;
  if (valueType === "yearly") return `${amount}/yr`;
  if (valueType === "one_time") return `${amount} one-time`;
  return `${amount}/mo`;
}

interface Tally {
  recs: number;
  anchored: number;
  nextStep: number;
  noHalluc: number;
}

function printCase(c: SavePlayEvalCase, result: SavePlayResult, tally: Tally): void {
  const haystack = caseHaystack(c);
  const signalList =
    c.health.signals.map((s) => s.type).join(", ") || "none";

  console.log("\n" + "=".repeat(78));
  console.log(`${c.id} — ${c.description}`);
  console.log(
    `account: ${c.account.companyName} · sponsor: ${
      c.account.sponsorName ?? "—"
    } · ${valueStr(c)} · renewal: ${c.account.renewalDate ?? "—"}`,
  );
  console.log(
    `health: ${c.health.healthScore}/100 (${c.health.healthLevel}) · signals: ${signalList}`,
  );
  console.log("-".repeat(78));
  console.log(
    `OVERALL: salvageable=${result.overall.salvageable} — ${result.overall.reasoning}`,
  );

  if (result.recommendations.length === 0) {
    console.log("(no recommendations returned)");
    if (c.health.signals.length === 0) {
      console.log("  -> expected for a healthy account.");
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
    return await import("@/lib/accounts/save-play-extractor");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Client Component|server-only/i.test(msg)) {
      console.error(
        "\nThis runner imports a server-only module. Re-run with the react-server condition:\n" +
          "  env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-save-play/run.ts\n",
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

  const { generateSavePlayLLM, buildAccountValueLine } = await loadExtractor();
  // Reuses the Solution model knob — both layers share one model setting on purpose
  // (save-play-service.ts imports DEFAULT_SOLUTION_MODEL for the same reason).
  const { DEFAULT_SOLUTION_MODEL } = await import("@/lib/solution/extractor");
  const model = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL;

  // ---- deterministic label gate (no API) ----------------------------------
  // The motivating fix: the value line must be labeled by value_type, and a
  // one-time project value must NEVER be presented to the model as recurring
  // "MRR". Pure string check — needs no model call, so it runs every time.
  const labelGate: Array<{
    valueType: "monthly" | "yearly" | "one_time";
    prefix: string;
    forbidMrr: boolean;
  }> = [
    { valueType: "monthly", prefix: "MRR:", forbidMrr: false },
    { valueType: "yearly", prefix: "Annual contract value:", forbidMrr: true },
    { valueType: "one_time", prefix: "Project value (one-time):", forbidMrr: true },
  ];
  let labelFails = 0;
  console.log("\nLabel gate (deterministic, no API) — value_type → prompt label:");
  for (const { valueType, prefix, forbidMrr } of labelGate) {
    const line = buildAccountValueLine(valueType, 50000, "EUR");
    const okPrefix = line.startsWith(prefix);
    const okNoMrr = !forbidMrr || !/MRR/i.test(line);
    const ok = okPrefix && okNoMrr;
    if (!ok) labelFails += 1;
    console.log(
      `  ${ok ? "PASS" : "FAIL"} ${valueType.padEnd(9)} -> "${line}"` +
        (forbidMrr && !okNoMrr ? "   <-- still says MRR!" : ""),
    );
  }
  if (labelFails > 0) {
    console.log(`  ${labelFails} label FAIL(s) — the value-type fix is broken.`);
    process.exitCode = 1;
  }

  console.log(`\nSave-Play Eval — model: ${model}`);
  console.log(`${SAVE_PLAY_EVAL_CASES.length} cases · read the output, judge manually\n`);

  const tally: Tally = { recs: 0, anchored: 0, nextStep: 0, noHalluc: 0 };
  let errors = 0;

  for (const c of SAVE_PLAY_EVAL_CASES) {
    try {
      const result = await generateSavePlayLLM(
        {
          health: c.health,
          account: c.account,
          transcript: c.transcript,
        },
        model,
      );
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
  console.log(`SUMMARY (${SAVE_PLAY_EVAL_CASES.length} cases, model: ${model})`);
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
