/**
 * Churn-Severity Eval Runner
 * --------------------------
 * Runs analyzeHealth() over CHURN_SEVERITY_EVAL_CASES and prints the full
 * acuteSignals output per case so it can be read and judged MANUALLY —
 * that manual read is the primary evaluation. The heuristic counts the
 * runner emits are SUPPORTIVE: they surface patterns (systematic over-
 * escalation, off-by-two drift, false positives) the manual read would
 * otherwise miss across 12 cases, but they are not pass/fail gates.
 *
 * Severity is a judgment call (high vs critical, medium vs high) and the
 * model can be defensibly different on any given case. The point of
 * this eval is to see whether the model is calibrated AS A WHOLE — does
 * it cluster severities where a rater would, or does it drift in one
 * direction? The tally is built for that question.
 *
 * Heuristic checks (per case):
 *
 *   (a) type-present       — for each expected (type, severity), is the
 *                            type in the model's acuteSignals at all?
 *                            Severity is only meaningful if type is found.
 *
 *   (b) severity-exact     — matched-by-type signals where actual.severity
 *                            === expected.severity. The headline calibration
 *                            number.
 *
 *   (c) severity-distance  — |index(actual) − index(expected)| on the
 *                            4-step ladder (low=0, medium=1, high=2,
 *                            critical=3). Bucketed at 0 / 1 / 2 / 3 so the
 *                            shape of disagreement is visible. Distance
 *                            of 2 or 3 is a calibration problem; distance
 *                            of 1 is judgment noise.
 *
 *   (d) over-escalation    — matched signals where actual_idx > expected_idx.
 *                            High count here means the model cries
 *                            "critical" too readily.
 *
 *   (e) under-escalation   — matched signals where actual_idx < expected_idx.
 *                            High count means the model under-reads acute
 *                            events.
 *
 *   (f) anchored           — every signal.evidence quote appears VERBATIM
 *                            in the transcript after fold() normalization
 *                            (umlauts + smart quotes + dashes). The Health
 *                            eval already checks this on the same field;
 *                            we repeat it here so this runner stands alone.
 *
 *   (g) no-signal-on-empty — for cases marked expectsEmpty: did the model
 *                            return acuteSignals.length === 0? The two
 *                            axis-only cases live or die by this check.
 *
 *   (h) unexpected         — actual signals whose type is NOT in the case's
 *                            expected.signals. LOGGED, never gated — the
 *                            model may legitimately see a real event the
 *                            case-design overlooked, and the manual read
 *                            decides.
 *
 * Always calls the LLM (Opus by default — claude-opus-4-7 via
 * DEFAULT_HEALTH_MODEL). Override with EVAL_MODEL=<id> for a Sonnet
 * diagnostic run.
 *
 * Start it yourself, in the foreground (server-only module → needs the
 * react-server condition, mirrors PD/Save-Play invocation):
 *
 *   env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server \
 *     evals-churn-severity/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` clears an empty/shadowing shell var so
 * dotenv injects the real key from .env.local; harmless if unset.)
 */

import { config as loadEnv } from "dotenv";

import {
  CHURN_SEVERITY_EVAL_CASES,
  type ChurnSeverityEvalCase,
  type ExpectedSignal,
} from "./dataset";
import type { AcuteSignal, AcuteSignalSeverity } from "@/lib/schemas/health";
import type { HealthAnalysisResult } from "@/lib/schemas/health";

// ───── normalization (inline copy of evals/health-runner.eval.ts fold) ─────

/**
 * Folds Unicode + DE typography variants so substring checks treat smart
 * quotes, en/em-dashes, umlauts, and ß as their ASCII equivalents. Same
 * function as evals/health-runner.eval.ts, evals-product-discovery/run.ts,
 * evals-save-play/run.ts — kept inline so each runner stands alone.
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

// ───── severity ladder ─────────────────────────────────────────────────────

const SEVERITY_INDEX: Record<AcuteSignalSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function severityDistance(
  expected: AcuteSignalSeverity,
  actual: AcuteSignalSeverity,
): number {
  return Math.abs(SEVERITY_INDEX[expected] - SEVERITY_INDEX[actual]);
}

type EscalationDirection = "exact" | "over" | "under";

function escalationDirection(
  expected: AcuteSignalSeverity,
  actual: AcuteSignalSeverity,
): EscalationDirection {
  const diff = SEVERITY_INDEX[actual] - SEVERITY_INDEX[expected];
  if (diff > 0) return "over";
  if (diff < 0) return "under";
  return "exact";
}

// ───── per-signal anchored check ───────────────────────────────────────────

interface Check {
  ok: boolean;
  note: string;
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

function checkAnchored(evidence: string[], transcript: string): Check {
  if (evidence.length === 0) {
    return { ok: false, note: "no evidence (prompt requires ≥1)" };
  }
  const ft = fold(transcript);
  const orphans = evidence.filter((q) => !ft.includes(fold(q)));
  if (orphans.length > 0) {
    return {
      ok: false,
      note: `${orphans.length}/${evidence.length} orphan(s): ${orphans
        .map((o) => `"${o.slice(0, 40)}${o.length > 40 ? "…" : ""}"`)
        .join(", ")}`,
    };
  }
  return { ok: true, note: `${evidence.length}/${evidence.length} verbatim` };
}

// ───── tally ───────────────────────────────────────────────────────────────

interface Tally {
  cases: number;
  errors: number;
  expectedTotal: number;
  typePresent: number;
  severityExact: number;
  /** Distance histogram across matched-by-type pairs. distance[0] equals
   *  severityExact (kept separate for headline visibility); distance[1..3]
   *  are the off-by-N rates. */
  distance: [number, number, number, number];
  overEscalation: number;
  underEscalation: number;
  anchoredOk: number;
  anchoredTotal: number;
  emptyChecks: number;
  emptyOk: number;
  unexpectedCount: number;
  actualSeverity: Record<AcuteSignalSeverity, number>;
}

function newTally(): Tally {
  return {
    cases: 0,
    errors: 0,
    expectedTotal: 0,
    typePresent: 0,
    severityExact: 0,
    distance: [0, 0, 0, 0],
    overEscalation: 0,
    underEscalation: 0,
    anchoredOk: 0,
    anchoredTotal: 0,
    emptyChecks: 0,
    emptyOk: 0,
    unexpectedCount: 0,
    actualSeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };
}

// ───── matching ────────────────────────────────────────────────────────────

interface Matched {
  expected: ExpectedSignal;
  actual: AcuteSignal;
}

interface MatchResult {
  matched: Matched[];
  missing: ExpectedSignal[];
  unexpected: AcuteSignal[];
}

/** 1:1 pairing of expected and actual signals by `type`. The dataset is
 *  designed so each case has at most one signal per type, so this is
 *  unambiguous. If the model emits two signals of the same type (which
 *  the prompt disallows under ONE-EVENT-ONE-SIGNAL), the first one wins
 *  the pair and the second falls into `unexpected` — surfacing the rule
 *  violation in the report. */
function matchSignals(
  expected: ExpectedSignal[],
  actual: AcuteSignal[],
): MatchResult {
  const actualByType = new Map<string, AcuteSignal>();
  const surplus: AcuteSignal[] = [];
  for (const s of actual) {
    if (actualByType.has(s.type)) {
      surplus.push(s);
    } else {
      actualByType.set(s.type, s);
    }
  }

  const matched: Matched[] = [];
  const missing: ExpectedSignal[] = [];

  for (const exp of expected) {
    const act = actualByType.get(exp.type);
    if (act) {
      matched.push({ expected: exp, actual: act });
      actualByType.delete(exp.type);
    } else {
      missing.push(exp);
    }
  }

  const unexpected = [...actualByType.values(), ...surplus];
  return { matched, missing, unexpected };
}

// ───── printing ────────────────────────────────────────────────────────────

function expectedLabel(c: ChurnSeverityEvalCase): string {
  if (c.expected.expectsEmpty) return "EMPTY (axis-only)";
  return c.expected.signals
    .map((s) => `${s.type}=${s.severity}`)
    .join(", ");
}

function severityComparisonNote(matched: Matched): string {
  const dist = severityDistance(matched.expected.severity, matched.actual.severity);
  if (dist === 0) return "severity-exact";
  const dir = escalationDirection(matched.expected.severity, matched.actual.severity);
  return `off-by-${dist}, ${dir}`;
}

function printCase(
  c: ChurnSeverityEvalCase,
  result: HealthAnalysisResult,
  tally: Tally,
): void {
  console.log("\n" + "=".repeat(78));
  console.log(`${c.id} [${c.language}] ${c.description}`);
  console.log(`expected: ${expectedLabel(c)}`);
  console.log("-".repeat(78));
  console.log(`SUMMARY: ${result.summary}`);

  // ─ empty-on-empty (g) ─
  if (c.expected.expectsEmpty) {
    tally.emptyChecks += 1;
    const n = result.acuteSignals.length;
    if (n === 0) {
      tally.emptyOk += 1;
      console.log(`no-signal-on-empty: ${flag({ ok: true, note: "0 signals as expected" })}`);
    } else {
      console.log(
        `no-signal-on-empty: ${flag({
          ok: false,
          note: `${n} signal(s) emitted on empty-expected case: ${result.acuteSignals
            .map((s) => `${s.type}=${s.severity}`)
            .join(", ")}`,
        })}`,
      );
    }
  }

  // ─ matched / missing / unexpected ─
  const { matched, missing, unexpected } = matchSignals(
    c.expected.signals,
    result.acuteSignals,
  );

  tally.expectedTotal += c.expected.signals.length;
  tally.typePresent += matched.length;

  // Record severity distribution of every actual signal regardless of
  // whether it was expected.
  for (const s of result.acuteSignals) {
    tally.actualSeverity[s.severity] += 1;
  }

  matched.forEach((m, i) => {
    const dist = severityDistance(m.expected.severity, m.actual.severity);
    if (dist === 0) tally.severityExact += 1;
    tally.distance[dist] += 1;
    const dir = escalationDirection(m.expected.severity, m.actual.severity);
    if (dir === "over") tally.overEscalation += 1;
    if (dir === "under") tally.underEscalation += 1;

    const anchored = checkAnchored(m.actual.evidence, c.call.transcript);
    tally.anchoredTotal += 1;
    if (anchored.ok) tally.anchoredOk += 1;

    console.log("");
    console.log(
      `EXPECTED #${i + 1}: ${m.expected.type} = ${m.expected.severity}`,
    );
    console.log(
      `  actual: ${m.actual.type} = ${m.actual.severity}  ${
        dist === 0 ? "✓" : "⚠"
      } ${severityComparisonNote(m)}`,
    );
    console.log(`  reasoning: ${m.actual.reasoning}`);
    m.actual.evidence.forEach((ev, k) => console.log(`  ev[${k}]: "${ev}"`));
    console.log(`  anchored: ${flag(anchored)}`);
  });

  missing.forEach((exp, i) => {
    console.log("");
    console.log(
      `MISSING #${matched.length + i + 1}: ${exp.type} = ${exp.severity}  ⚠ type not in result`,
    );
  });

  if (unexpected.length > 0) {
    tally.unexpectedCount += unexpected.length;
    console.log(
      `\nUNEXPECTED (${unexpected.length}) — logged, not gated; manual read decides:`,
    );
    unexpected.forEach((s) => {
      const anchored = checkAnchored(s.evidence, c.call.transcript);
      tally.anchoredTotal += 1;
      if (anchored.ok) tally.anchoredOk += 1;
      console.log(`  ${s.type} = ${s.severity}`);
      console.log(`    reasoning: ${s.reasoning}`);
      s.evidence.forEach((ev, k) => console.log(`    ev[${k}]: "${ev}"`));
      console.log(`    anchored: ${flag(anchored)}`);
    });
  }
}

function printSummary(model: string, tally: Tally): void {
  const matchedTotal =
    tally.distance[0] + tally.distance[1] + tally.distance[2] + tally.distance[3];

  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (${tally.cases} cases, model: ${model})`);
  if (tally.errors > 0) console.log(`  errors:                ${tally.errors}`);
  console.log(`  expected signals:      ${tally.expectedTotal}`);
  console.log(
    `  type-present:          ${tally.typePresent}/${tally.expectedTotal}`,
  );
  console.log(
    `  severity-exact:        ${tally.severityExact}/${matchedTotal}  ← headline calibration`,
  );
  console.log(`  severity-distance |0|: ${tally.distance[0]}`);
  console.log(`  severity-distance |1|: ${tally.distance[1]}`);
  console.log(`  severity-distance |2|: ${tally.distance[2]}`);
  console.log(`  severity-distance |3|: ${tally.distance[3]}`);
  console.log(`  over-escalation:       ${tally.overEscalation}`);
  console.log(`  under-escalation:      ${tally.underEscalation}`);
  console.log(
    `  anchored evidence:     ${tally.anchoredOk}/${tally.anchoredTotal}`,
  );
  if (tally.emptyChecks > 0) {
    console.log(
      `  no-signal-on-empty:    ${tally.emptyOk}/${tally.emptyChecks}`,
    );
  }
  console.log(`  unexpected signals:    ${tally.unexpectedCount} (logged above)`);

  console.log("");
  console.log(
    `  Actual severity distribution:  low: ${tally.actualSeverity.low}, medium: ${tally.actualSeverity.medium}, high: ${tally.actualSeverity.high}, critical: ${tally.actualSeverity.critical}`,
  );

  console.log(
    "\nHeuristics only — the real evaluation is reading the per-case output above.\n",
  );
}

// ───── main ────────────────────────────────────────────────────────────────

async function loadClassifier() {
  try {
    return await import("@/lib/health/classifier");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Client Component|server-only/i.test(msg)) {
      console.error(
        "\nThis runner imports a server-only module. Re-run with the react-server condition:\n" +
          "  env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-churn-severity/run.ts\n",
      );
      process.exit(1);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Ensure .env.local has it and no empty shell var is shadowing it — run with: env -u ANTHROPIC_API_KEY ...",
    );
  }

  const { analyzeHealth, DEFAULT_HEALTH_MODEL } = await loadClassifier();
  const model = process.env.EVAL_MODEL ?? DEFAULT_HEALTH_MODEL;

  console.log(`\nChurn-Severity Eval — model: ${model}`);
  console.log(
    `${CHURN_SEVERITY_EVAL_CASES.length} cases · read the output, judge manually\n`,
  );

  const tally = newTally();

  for (const c of CHURN_SEVERITY_EVAL_CASES) {
    tally.cases += 1;
    try {
      const result = await analyzeHealth(
        {
          transcript: c.call.transcript,
          account: c.account,
          recordedAt: c.call.recordedAt,
        },
        model,
      );
      printCase(c, result, tally);
    } catch (err) {
      tally.errors += 1;
      console.log("\n" + "=".repeat(78));
      console.log(`${c.id} — ${c.description}`);
      console.log(
        `  ERROR: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  printSummary(model, tally);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
