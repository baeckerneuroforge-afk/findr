/**
 * Product Discovery Eval Runner
 * -----------------------------
 * Runs analyzeProductDiscovery() over PRODUCT_DISCOVERY_EVAL_CASES and prints
 * the FULL output per case (featureRequests + painPoints + themes + summary)
 * so it can be read and judged MANUALLY — that manual read is the primary
 * evaluation, exactly as in evals-solution/run.ts. The heuristic checks
 * printed alongside are supportive signals, not a pass/fail gate.
 *
 * Heuristic checks per item:
 *   (a) anchored   — every evidence quote appears verbatim in the transcript
 *                    after typography folding (umlauts, smart quotes, dashes).
 *                    Orphans mean paraphrased / hallucinated quotes the fold
 *                    cannot rescue.
 *   (b) no-vendor  — every source line for the evidence has a customer-side
 *                    speaker prefix (Champion / Sponsor / Customer / Kunde),
 *                    NEVER a vendor-side prefix only (AE / CSM / Rep). Tests
 *                    the prompt's "only what the CUSTOMER says counts" rule.
 *
 * Per-case checks:
 *   (c) empty-on-empty — cases marked expectsEmpty must yield empty
 *                        featureRequests AND empty painPoints. The DO-NOT-DETECT
 *                        and off-topic cases live or die by this.
 *   (d) dedup-watch    — logs WARN when a featureRequest and a painPoint share
 *                        ≥2 salient tokens. Diagnostic only (the
 *                        MISSING_FEATURE/NEW_CAPABILITY case is *expected* to
 *                        trip this; we want to see if other cases do too).
 *
 * Always calls the LLM (Opus by default; override with PRODUCT_DISCOVERY_MODEL).
 * The classifier pulls in modules marked "server-only", so this MUST run with
 * the react-server export condition. Start it yourself, in the foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-product-discovery/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` clears an empty/shadowing shell var so dotenv
 * can inject the real key from .env.local; harmless if unset. Prefix with
 * `PRODUCT_DISCOVERY_MODEL=claude-sonnet-5` to test the cheaper model.)
 */

import { config } from "dotenv";
import {
  PRODUCT_DISCOVERY_EVAL_CASES,
  type ProductDiscoveryEvalCase,
} from "./dataset";
import type {
  FeatureRequest,
  PainPoint,
  ProductDiscoveryResult,
} from "@/lib/schemas/product-discovery";

// ───── normalization ────────────────────────────────────────────────────────

/**
 * Folds Unicode + DE typography variants so substring checks treat smart
 * quotes, en/em-dashes, umlauts, and ß as their ASCII equivalents. Mirrors
 * evals/health-runner.eval.ts:244 — the same normalization the Health eval
 * uses for its verbatim check. Single source-of-truth would be nice but the
 * Health eval is a vitest file (.eval.ts); we keep an inline copy here so
 * this runner stays a self-contained tsx CLI.
 *
 * Normalization:
 *  - NFKC compose
 *  - DE umlauts → ASCII pairs (ü→ue, ä→ae, ö→oe, ß→ss); both sides folded
 *  - ALL quote varieties (" ' „ " " « » ‘ ’ ‚ ‹ ›) → '"'
 *  - en-/em-dash (– —) → '-'
 *  - whitespace collapsed, trimmed, lowercased
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

// ───── speaker detection ────────────────────────────────────────────────────

/** Lines that start with one of these are spoken by the VENDOR side and must
 *  NOT supply evidence — the prompt explicitly says only the customer counts. */
const VENDOR_SPEAKER_PREFIXES: RegExp[] = [
  /^\s*ae\s*:/i,
  /^\s*rep\s*:/i,
  /^\s*sales\s*:/i,
  /^\s*vendor\s*:/i,
  /^\s*csm\s*:/i,
  /^\s*berater(?:in)?\s*:/i,
  /^\s*verkaeufer(?:in)?\s*:/i,
];

function isVendorLine(line: string): boolean {
  return VENDOR_SPEAKER_PREFIXES.some((re) => re.test(line));
}

// ───── checks ───────────────────────────────────────────────────────────────

interface Check {
  ok: boolean;
  note: string;
}

/** (a) Every evidence quote must be a verbatim substring of the transcript
 *  after folding. Empty evidence is itself a WARN — the prompt requires ≥1. */
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

/** (b) For each evidence quote, every transcript line that CONTAINS the quote
 *  must be a customer-side line (or at least not a vendor-side line). When
 *  every match is on a vendor line, the prompt's customer-only rule was
 *  violated. */
function checkNoVendor(evidence: string[], transcript: string): Check {
  if (evidence.length === 0) return { ok: true, note: "n/a (no evidence)" };

  const lines = transcript.split("\n");
  const violations: string[] = [];

  for (const ev of evidence) {
    const fe = fold(ev);
    if (!fe) continue;
    const matchingLines = lines.filter((line) => fold(line).includes(fe));
    if (matchingLines.length === 0) continue; // anchored check reports this
    const allVendor = matchingLines.every(isVendorLine);
    if (allVendor) {
      violations.push(`"${ev.slice(0, 40)}${ev.length > 40 ? "…" : ""}"`);
    }
  }

  if (violations.length > 0) {
    return {
      ok: false,
      note: `${violations.length} vendor-only source line(s): ${violations.join(", ")}`,
    };
  }
  return { ok: true, note: "all evidence on customer-side lines" };
}

/** (c) Cases marked expectsEmpty must yield empty FR + empty PP. */
function checkEmptyOnEmpty(
  result: ProductDiscoveryResult,
  expectsEmpty: boolean | undefined,
): Check | null {
  if (!expectsEmpty) return null;
  const n = result.featureRequests.length + result.painPoints.length;
  if (n === 0) return { ok: true, note: "empty as expected" };
  return {
    ok: false,
    note: `${n} item(s) emitted (${result.featureRequests.length} FR + ${result.painPoints.length} PP) on empty-expected case`,
  };
}

/** (d) Diagnostic: detects when a featureRequest and a painPoint share
 *  ≥2 salient tokens. Always logged, never gates pass/fail — the
 *  MISSING_FEATURE ↔ NEW_CAPABILITY case is supposed to trip this; we want
 *  to see whether others do too. */
function detectDedupOverlaps(
  result: ProductDiscoveryResult,
): Array<{ frIdx: number; ppIdx: number; sharedTokens: string[] }> {
  const overlaps: Array<{
    frIdx: number;
    ppIdx: number;
    sharedTokens: string[];
  }> = [];
  for (let i = 0; i < result.featureRequests.length; i++) {
    for (let j = 0; j < result.painPoints.length; j++) {
      const fr = result.featureRequests[i];
      const pp = result.painPoints[j];
      const frTokens = new Set(salientTokens(`${fr.title} ${fr.description}`));
      const ppTokens = salientTokens(`${pp.title} ${pp.description}`);
      const shared = [...new Set(ppTokens.filter((t) => frTokens.has(t)))];
      if (shared.length >= 2) {
        overlaps.push({ frIdx: i, ppIdx: j, sharedTokens: shared.slice(0, 4) });
      }
    }
  }
  return overlaps;
}

const STOP_WORDS = new Set([
  "customer",
  "product",
  "produkt",
  "feature",
  "haben",
  "lassen",
  "koennen",
  "wuerden",
  "wollen",
  "muessen",
  "etwas",
  "every",
  "tools",
  "tool",
  "would",
  "should",
  "could",
  "users",
  "team",
  "very",
  "actually",
  "mehr",
  "nicht",
  "auch",
  "noch",
  "dass",
  "weil",
  "this",
  "that",
  "with",
  "from",
  "they",
  "their",
]);

function salientTokens(s: string): string[] {
  const folded = fold(s);
  return [
    ...new Set(
      folded
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 5 && !STOP_WORDS.has(t)),
    ),
  ];
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

// ───── tally ────────────────────────────────────────────────────────────────

interface Tally {
  cases: number;
  errors: number;
  frTotal: number;
  ppTotal: number;
  themeTotal: number;
  anchoredOk: number;
  anchoredTotal: number;
  noVendorOk: number;
  noVendorTotal: number;
  emptyChecks: number;
  emptyOk: number;
  dedupWarnings: number;
  frCats: Map<string, number>;
  ppCats: Map<string, number>;
}

function newTally(): Tally {
  return {
    cases: 0,
    errors: 0,
    frTotal: 0,
    ppTotal: 0,
    themeTotal: 0,
    anchoredOk: 0,
    anchoredTotal: 0,
    noVendorOk: 0,
    noVendorTotal: 0,
    emptyChecks: 0,
    emptyOk: 0,
    dedupWarnings: 0,
    frCats: new Map<string, number>(),
    ppCats: new Map<string, number>(),
  };
}

// ───── printing ─────────────────────────────────────────────────────────────

function describeExpected(c: ProductDiscoveryEvalCase): string {
  if (c.expectsEmpty) return "EMPTY";
  const fr = c.expected?.featureRequests?.join(", ") ?? "—";
  const pp = c.expected?.painPoints?.join(", ") ?? "—";
  return `FR=[${fr}]  PP=[${pp}]`;
}

function printItem(
  kind: "FR" | "PP",
  idx: number,
  item: FeatureRequest | PainPoint,
  transcript: string,
  tally: Tally,
): void {
  const category = item.category;
  const grade =
    kind === "FR"
      ? `intensity=${(item as FeatureRequest).intensity}`
      : `severity=${(item as PainPoint).severity}`;

  const anchored = checkAnchored(item.evidence, transcript);
  const noVendor = checkNoVendor(item.evidence, transcript);
  tally.anchoredTotal += 1;
  tally.noVendorTotal += 1;
  if (anchored.ok) tally.anchoredOk += 1;
  if (noVendor.ok) tally.noVendorOk += 1;

  if (kind === "FR") {
    tally.frCats.set(category, (tally.frCats.get(category) ?? 0) + 1);
  } else {
    tally.ppCats.set(category, (tally.ppCats.get(category) ?? 0) + 1);
  }

  console.log(
    `\n${kind} ${idx} [${category}] ${grade} conf=${item.confidence.toFixed(2)}`,
  );
  console.log(`  title: ${item.title}`);
  console.log(`  desc:  ${item.description}`);
  if (item.evidence.length === 0) {
    console.log(`  ev:    (none)`);
  } else {
    item.evidence.forEach((ev, k) => {
      console.log(`  ev[${k}]: "${ev}"`);
    });
  }
  console.log(`  checks: anchored ${flag(anchored)}`);
  console.log(`          no-vendor ${flag(noVendor)}`);
}

function printCase(
  c: ProductDiscoveryEvalCase,
  result: ProductDiscoveryResult,
  tally: Tally,
): void {
  console.log("\n" + "=".repeat(78));
  console.log(`${c.id} [${c.etappe}] — ${c.description}`);
  console.log(`expected: ${describeExpected(c)}`);
  console.log("-".repeat(78));
  console.log(`SUMMARY: ${result.summary}`);

  const ee = checkEmptyOnEmpty(result, c.expectsEmpty);
  if (ee) {
    tally.emptyChecks += 1;
    if (ee.ok) tally.emptyOk += 1;
    console.log(`empty-on-empty: ${flag(ee)}`);
  }

  if (
    result.featureRequests.length === 0 &&
    result.painPoints.length === 0 &&
    result.themes.length === 0
  ) {
    console.log("(no items, no themes)");
  }

  result.featureRequests.forEach((fr, i) => {
    tally.frTotal += 1;
    printItem("FR", i, fr, c.input.transcript, tally);
  });

  result.painPoints.forEach((pp, i) => {
    tally.ppTotal += 1;
    printItem("PP", i, pp, c.input.transcript, tally);
  });

  result.themes.forEach((t, i) => {
    tally.themeTotal += 1;
    console.log(`\nTHEME ${i}: ${t.label}`);
    console.log(`  ${t.summary}`);
    console.log(
      `  → FR indices: [${t.relatedFeatureRequestIndices.join(", ")}]  ·  PP indices: [${t.relatedPainPointIndices.join(", ")}]`,
    );
  });

  const dedups = detectDedupOverlaps(result);
  if (dedups.length > 0) {
    tally.dedupWarnings += dedups.length;
    console.log(
      `\ndedup-watch: ${dedups.length} potential overlap(s) between featureRequests and painPoints:`,
    );
    dedups.forEach((d) => {
      const fr = result.featureRequests[d.frIdx];
      const pp = result.painPoints[d.ppIdx];
      console.log(
        `  FR[${d.frIdx}] "${fr.title}"  ↔  PP[${d.ppIdx}] "${pp.title}"  (shared: ${d.sharedTokens.join(", ")})`,
      );
    });
    if (c.id === "pd_03") {
      console.log(
        "  note: pd_03 is *expected* to trip this — same content, both framings; should be linked by a Theme.",
      );
    }
  }
}

function printSummary(model: string, tally: Tally): void {
  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (${tally.cases} cases, model: ${model})`);
  if (tally.errors > 0) console.log(`  errors:                ${tally.errors}`);
  console.log(`  feature requests:      ${tally.frTotal}`);
  console.log(`  pain points:           ${tally.ppTotal}`);
  console.log(`  themes:                ${tally.themeTotal}`);
  console.log(
    `  anchored:              ${tally.anchoredOk}/${tally.anchoredTotal}`,
  );
  console.log(
    `  customer-only:         ${tally.noVendorOk}/${tally.noVendorTotal}`,
  );
  if (tally.emptyChecks > 0) {
    console.log(
      `  empty-on-empty:        ${tally.emptyOk}/${tally.emptyChecks}`,
    );
  }
  console.log(`  dedup-watch warnings:  ${tally.dedupWarnings}`);

  const printDist = (label: string, m: Map<string, number>): void => {
    if (m.size === 0) {
      console.log(`  ${label}: (none)`);
      return;
    }
    console.log(`  ${label}:`);
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  };
  console.log("");
  printDist("FR categories", tally.frCats);
  printDist("PP categories", tally.ppCats);

  console.log(
    "\nHeuristics only — the real evaluation is reading the items above.\n",
  );
}

// ───── main ─────────────────────────────────────────────────────────────────

async function loadClassifier() {
  try {
    return await import("@/lib/product-discovery/classifier");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Client Component|server-only/i.test(msg)) {
      console.error(
        "\nThis runner imports a server-only module. Re-run with the react-server condition:\n" +
          "  env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-product-discovery/run.ts\n",
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
      "ANTHROPIC_API_KEY not set. Ensure .env.local has it and no empty shell var is shadowing it — run with: env -u ANTHROPIC_API_KEY ...",
    );
  }

  const { analyzeProductDiscovery, DEFAULT_PRODUCT_DISCOVERY_MODEL } =
    await loadClassifier();
  const model =
    process.env.PRODUCT_DISCOVERY_MODEL ?? DEFAULT_PRODUCT_DISCOVERY_MODEL;

  console.log(`\nProduct Discovery Eval — model: ${model}`);
  console.log(
    `${PRODUCT_DISCOVERY_EVAL_CASES.length} cases · read the output, judge manually\n`,
  );

  const tally = newTally();

  for (const c of PRODUCT_DISCOVERY_EVAL_CASES) {
    tally.cases += 1;
    try {
      const result = await analyzeProductDiscovery(c.input, model);
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
