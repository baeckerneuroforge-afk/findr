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
import type { DeliverableItem } from "@/lib/schemas/research-agent";
import {
  buildResearchInput,
  RESEARCH_AGENT_FIXTURE,
  RESEARCH_AGENT_EVAL_CASES,
  type ResearchAgentCaseGroup,
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

// ── prose-scan helpers (anchor-channel-independent discriminators) ───────────
// The hardened discriminators scan an item's FOLDED heading+text (its prose) or
// its surfaced quotes — NOT its themeRefs[]. The system prompt explicitly lets a
// model anchor via a quote alone and put the theme NAME in `heading`, so a
// themeRefs-keyed check would false-fail a correct, prompt-endorsed answer.

/** An item's prose for marker scanning: folded heading + text. */
function foldedProseOf(item: DeliverableItem): string {
  return fold(`${item.heading}\n${item.text}`);
}

/** Folded prose of every surfaced item, joined — the union haystack. */
function surfacedProse(items: DeliverableItem[]): string {
  return items.map(foldedProseOf).join(" \n ");
}

/** Every surfaced quote, folded — for required/forbidden-quote attribution. */
function surfacedQuotesFolded(items: DeliverableItem[]): string[] {
  return items.flatMap((it) => it.quotes.map(fold));
}

/** Standalone integers appearing in surfaced prose (heading+text) — for the
 *  exact-count fidelity checks. Anchored quotes are excluded (a count inside a
 *  verbatim quote would be the synthesis's own words, not the model's claim). */
function surfacedNumbers(items: DeliverableItem[]): number[] {
  const out: number[] = [];
  for (const it of items) {
    const m = `${it.heading} ${it.text}`.match(/\d+/g);
    if (m) for (const n of m) out.push(Number(n));
  }
  return out;
}

/** Discriminator axes — the soft instruction/attribution-fidelity signals that
 *  drive the Sonnet-vs-Opus comparison (NOT the anti-hallucination gate). */
type DiscAxis = "instruction" | "attribution" | "count";
interface Disc {
  axis: DiscAxis;
  label: string;
  passed: boolean;
}

/** A case's coarse bucket: explicit `group`, else inferred from fulfilled. */
function caseGroup(c: ResearchAgentEvalCase): ResearchAgentCaseGroup {
  return c.group ?? (c.expected.fulfilled ? "answerable" : "negative-control");
}

// ── per-case checks ─────────────────────────────────────────────────────────

interface Row {
  id: string;
  group: ResearchAgentCaseGroup;
  expectedFulfilled: boolean;
  gotFulfilled: boolean;
  anchorPass: boolean;
  impossibleNumber: boolean;
  refusalCorrect: boolean | null;
  modelRefusedDirectly: boolean | null;
  instructionMatch: boolean | null;
  rawLeakage: number;
  downgraded: boolean;
  /** Hardened soft discriminators scored on this case (empty for cases that set
   *  none, or that wrongly produced no deliverable). */
  discriminators: Disc[];
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
  const discs: Disc[] = [];
  // A soft discriminator: prints ok/warn, feeds the fidelity axes, and — like
  // the existing instruction-following signal — nudges passed/warned, but NEVER
  // `failed` (the anti-hallucination gate stays the original anchor-pass /
  // impossible-number / refusal-correct trio).
  const disc = (
    axis: DiscAxis,
    label: string,
    pass: boolean,
    okMsg: string,
    warnMsg: string,
  ): void => {
    discs.push({ axis, label, passed: pass });
    if (pass) {
      ok(okMsg);
      passed++;
    } else {
      warn(warnMsg);
      warned++;
    }
  };

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

    // (g) hardened discriminators [SOFT] — instruction + attribution + count
    //     fidelity. Only scored when the model actually produced a deliverable
    //     (a wrong refusal is already surfaced by non-empty above; scanning
    //     prose markers on empty output would be noise, not signal).
    const e = testCase.expected;
    if (f.fulfilled && f.items.length > 0) {
      const prose = surfacedProse(f.items);
      const quotes = surfacedQuotesFolded(f.items);
      const numbers = surfacedNumbers(f.items);

      if (e.maxItems !== undefined) {
        disc(
          "instruction",
          "max-items",
          f.items.length <= e.maxItems,
          `max-items — ${f.items.length} ≤ ${e.maxItems}`,
          `max-items — ${f.items.length} > ${e.maxItems} (named extra themes)`,
        );
      }
      if (e.proseSequence) {
        const ordered = e.proseSequence.every(
          (m, i) =>
            i < f.items.length && foldedProseOf(f.items[i]).includes(fold(m)),
        );
        disc(
          "instruction",
          "ranking-order",
          ordered,
          "ranking-order — items in the expected sequence",
          `ranking-order — sequence ≠ ${e.proseSequence.join(" → ")}`,
        );
      }
      if (e.requireInProse) {
        const missing = e.requireInProse.filter((m) => !prose.includes(fold(m)));
        disc(
          "instruction",
          "require-in-prose",
          missing.length === 0,
          "require-in-prose — all required markers present",
          `require-in-prose — missing: ${missing.join(", ")}`,
        );
      }
      if (e.forbidInProse) {
        const leaked = e.forbidInProse.filter((m) => prose.includes(fold(m)));
        disc(
          "instruction",
          "forbid-in-prose",
          leaked.length === 0,
          "forbid-in-prose — no excluded marker leaked",
          `forbid-in-prose — leaked: ${leaked.join(", ")}`,
        );
      }
      if (e.requiredQuotes) {
        const missing = e.requiredQuotes.filter(
          (q) => !quotes.some((fq) => fq.includes(fold(q))),
        );
        disc(
          "attribution",
          "required-quote",
          missing.length === 0,
          "required-quote — the correct quote was cited",
          `required-quote — missing: ${missing.map((q) => `"${q}"`).join(", ")}`,
        );
      }
      if (e.forbiddenQuotes) {
        const cited = e.forbiddenQuotes.filter((q) =>
          quotes.some((fq) => fq.includes(fold(q))),
        );
        disc(
          "attribution",
          "forbidden-quote",
          cited.length === 0,
          "forbidden-quote — no mis-attributed quote cited",
          `forbidden-quote — MIS-ATTRIBUTED: ${cited
            .map((q) => `"${q}"`)
            .join(", ")}`,
        );
      }
      if (e.expectedCount !== undefined) {
        disc(
          "count",
          "expected-count",
          numbers.includes(e.expectedCount),
          `expected-count — ${e.expectedCount} present`,
          `expected-count — ${e.expectedCount} absent (prose numbers: ${
            numbers.join(", ") || "none"
          })`,
        );
      }
      if (e.forbiddenCounts) {
        const wrong = e.forbiddenCounts.filter((n) => numbers.includes(n));
        disc(
          "count",
          "forbidden-count",
          wrong.length === 0,
          "forbidden-count — no wrong respondent count surfaced",
          `forbidden-count — WRONG count present: ${wrong.join(", ")}`,
        );
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
      group: caseGroup(testCase),
      expectedFulfilled: testCase.expected.fulfilled,
      gotFulfilled: f.fulfilled,
      anchorPass,
      impossibleNumber,
      refusalCorrect,
      modelRefusedDirectly,
      instructionMatch,
      rawLeakage,
      downgraded: diag.downgraded,
      discriminators: discs,
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
        group: caseGroup(c),
        expectedFulfilled: c.expected.fulfilled,
        gotFulfilled: false,
        anchorPass: false,
        impossibleNumber: false,
        refusalCorrect: c.expected.fulfilled === false ? false : null,
        modelRefusedDirectly: null,
        instructionMatch: null,
        rawLeakage: 0,
        downgraded: false,
        discriminators: [],
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

  // ── hardened breakdown (Etappe-1.5) — splits the refusal gate into the easy
  //    keyword-absent controls vs the adversarial-anchor cases (real anchor
  //    present, only judgement guards), and aggregates the soft fidelity axes
  //    that drive the Sonnet-vs-Opus decision. ──
  const controls = negatives.filter((r) => r.group === "negative-control");
  const adversarial = negatives.filter((r) => r.group === "adversarial-anchor");
  const controlRefusals = controls.filter((r) => r.refusalCorrect === true).length;
  const adversarialRefusals = adversarial.filter(
    (r) => r.refusalCorrect === true,
  ).length;
  const allDiscs = rows.flatMap((r) => r.discriminators);
  const axisScore = (axis: DiscAxis): { passed: number; total: number } => {
    const d = allDiscs.filter((x) => x.axis === axis);
    return { passed: d.filter((x) => x.passed).length, total: d.length };
  };
  const instrFidelity = axisScore("instruction");
  const attrFidelity = axisScore("attribution");
  const countFidelity = axisScore("count");
  const pct = (n: number, d: number): string =>
    d === 0 ? "—" : `${Math.round((100 * n) / d)}%`;

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

  console.log(`\n${C.bold}─── HARDENED AXES ───${C.reset}  (model=${MODEL})`);
  console.log(
    `  Absage · Kontrollen:       ${controlRefusals}/${controls.length}  (easy negatives — keyword simply absent)  [GATE]`,
  );
  console.log(
    `  Absage · adversarial:      ${adversarialRefusals}/${adversarial.length}  (real anchor present — only model judgement refuses; a fabrication anchored to a true quote slips the anchor filter)  [GATE]`,
  );
  console.log(
    `  Instruction-Fidelity:      ${instrFidelity.passed}/${instrFidelity.total}  (${pct(
      instrFidelity.passed,
      instrFidelity.total,
    )})  (max-items / ranking-order / require / forbid in prose)  [soft]`,
  );
  console.log(
    `  Attribution-Fidelity:      ${attrFidelity.passed}/${attrFidelity.total}  (${pct(
      attrFidelity.passed,
      attrFidelity.total,
    )})  (right quote / no mis-attributed quote — the anchor-filter blind spot)  [soft]`,
  );
  console.log(
    `  Exact-Count-Fidelity:      ${countFidelity.passed}/${countFidelity.total}  (${pct(
      countFidelity.passed,
      countFidelity.total,
    )})  (correct frequency, no wrong ≤based_on count the gate misses)  [soft]`,
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
