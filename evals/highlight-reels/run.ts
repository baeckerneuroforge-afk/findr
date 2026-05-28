/**
 * Highlight-Reels Eval Runner
 * ---------------------------
 * Runs generateReelFromInputs() over REEL_EVAL_CASES, applies deterministic
 * property checks per case, and prints a results table. Mirrors the posture
 * of evals/chat-with-data/run.ts and evals/bridge-research-sales/run.ts —
 * NO LLM judge, just structural checks against the fixture.
 *
 * Checks per case:
 *
 *   (a) anchored-quote   — every highlight.quote is a fold-substring of the
 *                          input haystack (condensation evidence + summary +
 *                          themes + synthesis-theme quotes). Same fold as
 *                          the engine.
 *
 *   (b) anchored-id      — every highlight.interviewId is in the set of
 *                          condensation.id values.
 *
 *   (c) anchored-theme   — every highlight.themeRef equals a title in
 *                          synthesis.emergent_themes (set membership).
 *
 *   (d) german-caption   — every caption contains a German function-word OR
 *                          a German-specific character (ä/ö/ü/ß). Robust
 *                          across short and long captions; no lexical
 *                          whitelist of nouns or per-case anchors.
 *
 *   (e) diverse-themes   — when expected.requireThemeDiversity = true AND
 *                          the result has ≥2 highlights, the highlights span
 *                          ≥2 distinct themeRefs. Vacuous (skipped) for
 *                          single-theme fixtures and 0/1-highlight results.
 *
 *   (f) expected-bound   — highlights.length within
 *                          [minHighlights, maxHighlights] from the case
 *                          definition. The strict-empty case
 *                          (mustBeEmpty=true) lands here as 0..0.
 *
 * Anchor robustness lesson from Bridge #1/#3: the checks operate against the
 * fixture's OWN haystack (substring) and OWN id/title sets (membership) —
 * never against a per-case "must contain noun form X" whitelist. The model
 * is free to pick any valid quote/id/theme; the eval just verifies the
 * structural anti-hallu contract.
 *
 * Default model: Sonnet (cheap, for iteration). Approval runs:
 *   HIGHLIGHT_MODEL=claude-opus-4-7
 *
 * Invocation (always with `env -u ANTHROPIC_API_KEY` so an exported shadow
 * key doesn't ghost-override .env.local):
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals/highlight-reels/run.ts
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  generateReelFromInputs,
  type HighlightReel,
} from "@/lib/research/highlight-reels";

import { REEL_EVAL_CASES, type ReelEvalCase } from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.HIGHLIGHT_MODEL ?? CLAUDE_MODELS.sonnet;

// ── pretty-print helpers ────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
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

// ── fold (mirrors engine fold) ─────────────────────────────────────────────

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
    .replace(/["'„""«»''‚‹›]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectStrings(value: unknown, sink: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, sink);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, sink);
    }
  }
}

interface AnchorSet {
  ids: Set<string>;
  themeTitles: Set<string>;
  foldedHaystack: string;
}

function buildAnchorSet(input: ReturnType<ReelEvalCase["buildInput"]>): AnchorSet {
  const ids = new Set<string>();
  const themeTitles = new Set<string>();
  const parts: string[] = [];
  for (const c of input.condensations) {
    ids.add(c.id);
    if (c.summary) parts.push(c.summary);
    collectStrings(c.featureRequests, parts);
    collectStrings(c.painPoints, parts);
    collectStrings(c.themes, parts);
  }
  for (const t of input.synthesis.emergent_themes) {
    themeTitles.add(t.title);
    for (const q of t.quotes) parts.push(q);
  }
  return {
    ids,
    themeTitles,
    foldedHaystack: fold(parts.join(" \n ")),
  };
}

// ── German-caption heuristic (robust, no per-case lexical whitelist) ───────

const GERMAN_FUNCTION_WORDS =
  /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|und|oder|aber|dass|wenn|weil|wie|wo|wann|wer|was|sind|ist|war|waren|sein|werden|wurde|wurden|sich|nicht|auch|fuer|für|von|mit|bei|aus|über|ueber|zur|zum|im|am|um|kein|keine|noch|nur|schon|mehr|viel|viele|wenig|als)\b/i;

function looksGerman(s: string): boolean {
  if (GERMAN_FUNCTION_WORDS.test(s)) return true;
  if (/[äöüÄÖÜß]/.test(s)) return true;
  return false;
}

// ── per-case checks ────────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
  highlightCount: number;
  anchoredAllQuotes: boolean;
  anchoredAllIds: boolean;
  anchoredAllThemes: boolean;
  germanAllCaptions: boolean;
  diverseThemes: boolean | null;
  boundOk: boolean;
}

function runChecks(
  testCase: ReelEvalCase,
  result: HighlightReel,
): CheckResult {
  const input = testCase.buildInput();
  const anchors = buildAnchorSet(input);
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) anchored-quote
  const paraphrased = result.highlights.filter(
    (h) => !anchors.foldedHaystack.includes(fold(h.quote)),
  );
  if (paraphrased.length === 0) {
    ok("anchored-quote — every highlight.quote is a verbatim substring");
    passed++;
  } else {
    bad(
      `anchored-quote — ${paraphrased.length} paraphrased quote(s): ${paraphrased
        .slice(0, 2)
        .map((h) => `"${h.quote.slice(0, 60)}…"`)
        .join("; ")}`,
    );
    failed++;
  }

  // (b) anchored-id
  const unknownIds = result.highlights
    .map((h) => h.interviewId)
    .filter((id) => !anchors.ids.has(id));
  if (unknownIds.length === 0) {
    ok("anchored-id — every interviewId is in the condensation set");
    passed++;
  } else {
    bad(
      `anchored-id — ${unknownIds.length} unknown id(s): ${unknownIds
        .slice(0, 3)
        .join(", ")}`,
    );
    failed++;
  }

  // (c) anchored-theme
  const unknownThemes = result.highlights
    .map((h) => h.themeRef)
    .filter((t) => !anchors.themeTitles.has(t));
  if (unknownThemes.length === 0) {
    ok("anchored-theme — every themeRef matches a synthesis title");
    passed++;
  } else {
    bad(
      `anchored-theme — ${unknownThemes.length} unknown theme ref(s): ${unknownThemes
        .slice(0, 2)
        .map((t) => `"${t.slice(0, 40)}…"`)
        .join("; ")}`,
    );
    failed++;
  }

  // (d) german-caption
  const notGerman = result.highlights.filter((h) => !looksGerman(h.caption));
  // For empty reels the check is vacuous — no captions to inspect.
  if (result.highlights.length === 0) {
    dim("german-caption — n/a (no highlights)");
  } else if (notGerman.length === 0) {
    ok("german-caption — every caption looks German");
    passed++;
  } else {
    bad(
      `german-caption — ${notGerman.length} non-German caption(s): ${notGerman
        .slice(0, 2)
        .map((h) => `"${h.caption.slice(0, 60)}…"`)
        .join("; ")}`,
    );
    failed++;
  }

  // (e) diverse-themes (skip when only 1 fixture theme OR <2 highlights)
  let diverseThemes: boolean | null = null;
  if (
    testCase.expected.requireThemeDiversity === true &&
    result.highlights.length >= 2
  ) {
    const distinctRefs = new Set(result.highlights.map((h) => h.themeRef));
    diverseThemes = distinctRefs.size >= 2;
    if (diverseThemes) {
      ok(
        `diverse-themes — ${distinctRefs.size} distinct themeRef(s) across ${result.highlights.length} highlights`,
      );
      passed++;
    } else {
      bad(
        `diverse-themes — all ${result.highlights.length} highlights collapsed onto 1 theme ("${[...distinctRefs][0]}")`,
      );
      failed++;
    }
  } else {
    dim("diverse-themes — n/a");
  }

  // (f) expected-bound
  const lo = testCase.expected.minHighlights;
  const hi = testCase.expected.maxHighlights;
  const boundOk = result.highlights.length >= lo && result.highlights.length <= hi;
  if (boundOk) {
    ok(`expected-bound — ${result.highlights.length} ∈ [${lo}, ${hi}]`);
    passed++;
  } else {
    bad(
      `expected-bound — ${result.highlights.length} outside [${lo}, ${hi}]`,
    );
    failed++;
  }

  // Strict-empty contract for case 6: hard-fail if highlights > 0.
  // (Already covered by expected-bound when min=max=0; this is the dedicated
  // log line that makes the anti-hallu intent explicit in the runner output.)
  if (testCase.expected.mustBeEmpty === true) {
    if (result.highlights.length === 0) {
      ok(
        "strict-empty — short-circuit / honest empty preserved (no fabricated reel)",
      );
      passed++;
    } else {
      bad(
        `strict-empty — expected empty reel, got ${result.highlights.length} highlight(s)`,
      );
      failed++;
    }
  }

  return {
    passed,
    warned,
    failed,
    highlightCount: result.highlights.length,
    anchoredAllQuotes: paraphrased.length === 0,
    anchoredAllIds: unknownIds.length === 0,
    anchoredAllThemes: unknownThemes.length === 0,
    germanAllCaptions:
      result.highlights.length === 0 ? true : notGerman.length === 0,
    diverseThemes,
    boundOk,
  };
}

// ── runner ─────────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  hl: number;
  bound: string;
  quoteOk: boolean;
  idOk: boolean;
  themeOk: boolean;
  germanOk: boolean;
  diverse: boolean | null;
  boundOk: boolean;
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Highlight-Reels Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${REEL_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;
  const rows: CaseRow[] = [];

  for (const c of REEL_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(
      `expected: highlights ∈ [${c.expected.minHighlights}, ${c.expected.maxHighlights}]${
        c.expected.mustBeEmpty ? " · mustBeEmpty" : ""
      }${
        c.expected.requireThemeDiversity ? " · diversity required" : ""
      }`,
    );

    let result: HighlightReel;
    try {
      result = await generateReelFromInputs(c.buildInput(), MODEL);
    } catch (err) {
      bad(
        `engine call failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      totalFailed++;
      rows.push({
        id: c.id,
        hl: 0,
        bound: `–`,
        quoteOk: false,
        idOk: false,
        themeOk: false,
        germanOk: false,
        diverse: null,
        boundOk: false,
      });
      continue;
    }

    // Print the actual reel content so a human can judge quality at a glance.
    console.log(
      `\n  ${C.bold}REEL${C.reset}  ${C.magenta}highlights=${result.highlights.length}${C.reset}`,
    );
    if (result.summary) {
      dim(`  summary: ${result.summary}`);
    }
    if (result.highlights.length > 0) {
      for (let i = 0; i < result.highlights.length; i++) {
        const h = result.highlights[i];
        console.log(
          `\n  ${C.bold}#${i + 1}${C.reset} ${C.dim}[${h.interviewId} · ${h.themeRef}]${C.reset}`,
        );
        dim(`    quote:   "${h.quote}"`);
        dim(`    caption: ${h.caption}`);
      }
    } else {
      dim(`  (no highlights)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, result);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
    rows.push({
      id: c.id,
      hl: checks.highlightCount,
      bound: `${c.expected.minHighlights}..${c.expected.maxHighlights}`,
      quoteOk: checks.anchoredAllQuotes,
      idOk: checks.anchoredAllIds,
      themeOk: checks.anchoredAllThemes,
      germanOk: checks.germanAllCaptions,
      diverse: checks.diverseThemes,
      boundOk: checks.boundOk,
    });
  }

  // ── summary table ────────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══ RESULTS TABLE ═══${C.reset}`);
  console.log(
    `${C.dim}${"id".padEnd(28)} ${"hl".padStart(3)} ${"bound".padEnd(7)} ${"quote".padEnd(6)} ${"id".padEnd(4)} ${"theme".padEnd(6)} ${"deu".padEnd(4)} ${"div".padEnd(4)} bound${C.reset}`,
  );
  for (const r of rows) {
    const mark = (b: boolean) => (b ? `${C.green}yes` : `${C.red}no `);
    const div =
      r.diverse === null ? `${C.dim}n/a` : r.diverse ? `${C.green}yes` : `${C.red}no `;
    console.log(
      `  ${r.id.padEnd(28)} ${String(r.hl).padStart(3)} ${r.bound.padEnd(7)} ${mark(r.quoteOk)}${C.reset}    ${mark(r.idOk)}${C.reset}  ${mark(r.themeOk)}${C.reset}   ${mark(r.germanOk)}${C.reset}  ${div}${C.reset}  ${mark(r.boundOk)}${C.reset}`,
    );
  }

  // ── aggregate metrics ────────────────────────────────────────────────────
  const total = rows.length;
  const anchoredAllRows = rows.filter(
    (r) => r.quoteOk && r.idOk && r.themeOk,
  ).length;
  const germanRows = rows.filter((r) => r.germanOk).length;
  const boundRows = rows.filter((r) => r.boundOk).length;
  const totalHighlights = rows.reduce((acc, r) => acc + r.hl, 0);

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}`);
  console.log(
    `  Verankerungs-Quote:        ${anchoredAllRows}/${total}  (quote + id + theme alle valid pro Case)`,
  );
  console.log(
    `  Deutsche-Captions-Quote:   ${germanRows}/${total}  (alle captions enthalten dt. Funktionswort/Umlaut)`,
  );
  console.log(
    `  Erwartungs-Bound-Quote:    ${boundRows}/${total}  (highlights.length in erwartetem Intervall)`,
  );
  console.log(
    `  Highlights gesamt:         ${totalHighlights}  (Summe ueber alle Cases)`,
  );

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
