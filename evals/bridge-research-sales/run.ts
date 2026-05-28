/**
 * Bridge Research→Sales Eval Runner
 * ---------------------------------
 * Runs deriveRiskCandidateFromTheme() over RESEARCH_RISK_EVAL_CASES
 * (EXACTLY 6), applies DETERMINISTIC property checks (no LLM-judge),
 * prints a table.
 *
 * Checks per case:
 *   (a) derivable-match  — result.derivable === expected.derivable
 *                          (anti-hallu gate on the non-risk-relevant case).
 *   (b) candidate-name   — bei derivable=true: candidateName nicht null
 *                          + ≥8 Zeichen. Bei derivable=false: candidateName
 *                          === null + mappedRiskType === null + reasoning
 *                          === null (Engine-Downgrade-Regel; Schema-Engine
 *                          setzt das schon deterministisch).
 *   (c) anchored         — bei derivable=true: candidateName + reasoning
 *                          enthält MINDESTENS EINEN der erwarteten
 *                          anchorTerms (PREFIX-Match nach Umlaut-Folding —
 *                          robust gegen Nomen-Form-Varianten).
 *   (d) risk-type        — bei derivable=true: mappedRiskType ∈
 *                          RISK_SIGNAL_TYPES ∪ {"UNKLASSIFIZIERT"} und
 *                          (falls expected.allowedRiskTypes gesetzt) ∈
 *                          allowedRiskTypes.
 *   (e) caution-on-thin  — bei dünnen Fällen (expected.cautionTerms gesetzt):
 *                          candidateName ODER reasoning enthält
 *                          mindestens ein Vorsichtswort.
 *   (f) no-hallucinations — Strings in expected.forbiddenTerms dürfen
 *                          NICHT in (candidateName + reasoning) auftauchen.
 *   (g) language-german  — combined (candidateName + reasoning) ist auf
 *                          Deutsch (lexikalische Markers).
 *
 * Default model: Sonnet. Approval run: BRIDGE_MODEL=claude-opus-4-7.
 * Pflicht: `env -u ANTHROPIC_API_KEY`:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals/bridge-research-sales/run.ts
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  deriveRiskCandidateFromTheme,
  type RiskCandidate,
  RISK_SIGNAL_TYPES,
  UNCLASSIFIED_MARKER,
} from "@/lib/bridge/research-to-sales";

import {
  RESEARCH_RISK_EVAL_CASES,
  type ResearchRiskEvalCase,
} from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.BRIDGE_MODEL ?? CLAUDE_MODELS.sonnet;

// ── pretty-print helpers ───────────────────────────────────────────────────

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
function bad(s: string): void {
  console.log(`  ${C.red}✗${C.reset} ${s}`);
}
function dim(s: string): void {
  console.log(`  ${C.dim}${s}${C.reset}`);
}

// ── normalize (mirror of synthesis/chat/guide eval normalize) ──────────────

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/ä/g, "ae")
    .replace(/Ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/Ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const GERMAN_MARKERS = [
  " der ",
  " die ",
  " das ",
  " sie ",
  " und ",
  " mit ",
  " ist ",
  " ihr ",
  " ihre ",
  " was ",
  " wie ",
  " wo ",
  " wann ",
  " wenn ",
  " warum ",
  " auf ",
  " bei ",
  " von ",
  " den ",
  " ein ",
  " eine ",
  " sich ",
];

function isLikelyGerman(corpus: string): boolean {
  const n = " " + normalize(corpus) + " ";
  let hits = 0;
  for (const m of GERMAN_MARKERS) {
    if (n.includes(m)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

const ALLOWED_RISK_TYPE_SET: ReadonlySet<string> = new Set<string>([
  ...RISK_SIGNAL_TYPES,
  UNCLASSIFIED_MARKER,
]);

// ── per-case checks ───────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  failed: number;
  derivableMatch: boolean;
  anchored: boolean | null;
  germanLang: boolean;
  hallucinations: string[];
  mappedRiskType: string | null;
}

function runChecks(
  testCase: ResearchRiskEvalCase,
  result: RiskCandidate,
): CheckResult {
  let passed = 0;
  let failed = 0;
  const ex = testCase.expected;

  const combined =
    (result.candidateName ?? "") + " " + (result.reasoning ?? "");

  // (a) derivable-match
  const derivableMatch = result.derivable === ex.derivable;
  if (derivableMatch) {
    ok(
      `derivable-match — got ${result.derivable}, expected ${ex.derivable}`,
    );
    passed++;
  } else {
    bad(
      `derivable-match — got ${result.derivable}, expected ${ex.derivable}`,
    );
    failed++;
  }

  // (b) candidate-name shape
  if (ex.derivable === true) {
    if (
      result.candidateName !== null &&
      result.candidateName.trim().length >= 8
    ) {
      ok(`candidate-name — ${result.candidateName.length} Zeichen`);
      passed++;
    } else {
      bad(
        `candidate-name — erwartet >=8 Zeichen, got ${result.candidateName === null ? "null" : `"${result.candidateName}"`}`,
      );
      failed++;
    }
  } else {
    // derivable=false → alle drei Felder MÜSSEN null sein.
    if (
      result.candidateName === null &&
      result.mappedRiskType === null &&
      result.reasoning === null
    ) {
      ok("refusal-shape — candidateName/mappedRiskType/reasoning sind null");
      passed++;
    } else {
      bad(
        `refusal-shape — bei derivable=false MÜSSEN alle drei Felder null sein, got candidateName=${result.candidateName === null ? "null" : `"${result.candidateName?.slice(0, 60)}…"`}, mappedRiskType=${result.mappedRiskType ?? "null"}, reasoning=${result.reasoning === null ? "null" : "(non-null)"}`,
      );
      failed++;
    }
  }

  // (c) anchored — combined text MUSS einen anchorTerm enthalten (PREFIX-Match)
  let anchored: boolean | null = null;
  if (
    ex.derivable === true &&
    ex.anchorTerms &&
    ex.anchorTerms.length > 0 &&
    combined.trim().length > 0
  ) {
    const folded = normalize(combined);
    const matchedTerm = ex.anchorTerms.find((t) => folded.includes(normalize(t)));
    if (matchedTerm) {
      ok(
        `anchored — (candidateName+reasoning) referenziert "${matchedTerm}" (aus anchorTerms)`,
      );
      passed++;
      anchored = true;
    } else {
      bad(
        `anchored — weder candidateName noch reasoning enthält einen der erwarteten anchorTerms [${ex.anchorTerms.join(", ")}]`,
      );
      failed++;
      anchored = false;
    }
  }

  // (d) risk-type
  if (ex.derivable === true) {
    const mapped = result.mappedRiskType;
    if (!mapped || !ALLOWED_RISK_TYPE_SET.has(mapped)) {
      bad(
        `risk-type — mappedRiskType "${mapped}" liegt nicht in RISK_SIGNAL_TYPES ∪ {${UNCLASSIFIED_MARKER}}`,
      );
      failed++;
    } else if (
      ex.allowedRiskTypes &&
      ex.allowedRiskTypes.length > 0 &&
      !ex.allowedRiskTypes.includes(mapped)
    ) {
      bad(
        `risk-type — mappedRiskType "${mapped}" liegt zwar im Schema, aber nicht in den für diesen Case zulässigen Werten [${ex.allowedRiskTypes.join(", ")}]`,
      );
      failed++;
    } else {
      ok(`risk-type — mappedRiskType="${mapped}" akzeptabel`);
      passed++;
    }
  }

  // (e) caution-on-thin
  if (
    ex.derivable === true &&
    ex.cautionTerms &&
    ex.cautionTerms.length > 0 &&
    combined.trim().length > 0
  ) {
    const folded = normalize(combined);
    const matchedCaution = ex.cautionTerms.find((t) =>
      folded.includes(normalize(t)),
    );
    if (matchedCaution) {
      ok(
        `caution-on-thin — (candidateName+reasoning) enthält "${matchedCaution}" (Vorsicht reflektiert)`,
      );
      passed++;
    } else {
      bad(
        `caution-on-thin — kleine Fallzahl nicht reflektiert (keiner der cautionTerms [${ex.cautionTerms.join(", ")}] gefunden)`,
      );
      failed++;
    }
  }

  // (f) no-hallucinations
  let hallucinations: string[] = [];
  if (
    ex.forbiddenTerms &&
    ex.forbiddenTerms.length > 0 &&
    combined.trim().length > 0
  ) {
    const folded = normalize(combined);
    hallucinations = ex.forbiddenTerms.filter((t) =>
      folded.includes(normalize(t)),
    );
    if (hallucinations.length === 0) {
      ok("no-hallucinations — keine verbotenen Spezifika in der Ausgabe");
      passed++;
    } else {
      bad(
        `no-hallucinations — verbotene Begriffe gefunden: ${hallucinations.join(", ")}`,
      );
      failed++;
    }
  }

  // (g) language-german — only when there's output to check
  let germanLang = true;
  if (combined.trim().length >= 12) {
    germanLang = isLikelyGerman(combined);
    if (germanLang) {
      ok("language — Deutsch erkannt (lexikalische Markers)");
      passed++;
    } else {
      bad("language — keine starken Deutsch-Markers in der Ausgabe");
      failed++;
    }
  }

  return {
    passed,
    failed,
    derivableMatch,
    anchored,
    germanLang,
    hallucinations,
    mappedRiskType: result.mappedRiskType ?? null,
  };
}

// ── runner ────────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  expected: boolean;
  got: boolean;
  candidateLen: number;
  mappedRiskType: string;
  anchored: string;
  hallucinated: boolean;
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Bridge Research→Sales Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${RESEARCH_RISK_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalFailed = 0;
  const rows: CaseRow[] = [];

  for (const c of RESEARCH_RISK_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(
      `input: themeTitle="${c.input.themeTitle.slice(0, 60)}…", frequency=${c.input.frequency}${c.input.studyTitle ? `, studyTitle="${c.input.studyTitle}"` : ""}`,
    );
    dim(
      `expected: derivable=${c.expected.derivable}${
        c.expected.anchorTerms
          ? `, anchorTerms=[${c.expected.anchorTerms.join("|")}]`
          : ""
      }${
        c.expected.cautionTerms
          ? `, cautionTerms=[${c.expected.cautionTerms.join("|")}]`
          : ""
      }${
        c.expected.allowedRiskTypes
          ? `, allowedRiskTypes=[${c.expected.allowedRiskTypes.join("|")}]`
          : ""
      }`,
    );

    let result: RiskCandidate;
    try {
      result = await deriveRiskCandidateFromTheme(c.input, MODEL);
    } catch (err) {
      bad(
        `engine call failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      totalFailed++;
      rows.push({
        id: c.id,
        expected: c.expected.derivable,
        got: false,
        candidateLen: 0,
        mappedRiskType: "—",
        anchored: "n/a",
        hallucinated: false,
      });
      continue;
    }

    console.log(
      `\n  ${C.bold}RESULT${C.reset}  ${C.magenta}derivable=${result.derivable}${C.reset}  ${C.dim}mappedRiskType=${result.mappedRiskType ?? "null"}${C.reset}`,
    );
    if (result.candidateName) dim(`  candidateName: ${result.candidateName}`);
    if (result.reasoning) dim(`  reasoning:     ${result.reasoning}`);
    if (!result.candidateName && !result.reasoning) {
      dim(`  (refusal — alle Felder null)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, result);
    totalPassed += checks.passed;
    totalFailed += checks.failed;
    rows.push({
      id: c.id,
      expected: c.expected.derivable,
      got: result.derivable,
      candidateLen: result.candidateName?.length ?? 0,
      mappedRiskType: result.mappedRiskType ?? "—",
      anchored:
        checks.anchored === null
          ? "n/a"
          : checks.anchored
            ? "yes"
            : "no",
      hallucinated: checks.hallucinations.length > 0,
    });
  }

  // ── summary table ──────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══ RESULTS TABLE ═══${C.reset}`);
  console.log(
    `${C.dim}${"id".padEnd(40)} ${"expected".padEnd(10)} ${"got".padEnd(8)} ${"name".padStart(6)} ${"mapped".padEnd(24)} ${"anchored".padEnd(9)} hallucinated${C.reset}`,
  );
  for (const r of rows) {
    const mark = r.expected === r.got ? `${C.green}✓` : `${C.red}✗`;
    const anchored =
      r.anchored === "n/a"
        ? `${C.dim}n/a${C.reset}`
        : r.anchored === "yes"
          ? `${C.green}yes${C.reset}`
          : `${C.red}no${C.reset}`;
    const hallucinated = r.hallucinated
      ? `${C.red}YES${C.reset}`
      : `${C.green}no${C.reset}`;
    console.log(
      `  ${r.id.padEnd(40)} ${String(r.expected).padEnd(10)} ${mark} ${String(r.got).padEnd(6)}${C.reset} ${String(r.candidateLen).padStart(6)} ${r.mappedRiskType.padEnd(24)} ${anchored.padEnd(18)} ${hallucinated}`,
    );
  }

  // ── aggregate metrics ──────────────────────────────────────────────────
  const total = rows.length;
  const derivableMatches = rows.filter((r) => r.expected === r.got).length;
  const anchoredCount = rows.filter((r) => r.anchored === "yes").length;
  const expectedAnchored = rows.filter((r) => r.anchored !== "n/a").length;
  const hallucinated = rows.filter((r) => r.hallucinated).length;

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}`);
  console.log(
    `  Derivable-Match:        ${derivableMatches}/${total}  (derivable matches expected)`,
  );
  console.log(
    `  Anchored-Quote:         ${anchoredCount}/${expectedAnchored}  (anchorTerm in candidateName+reasoning, bei Cases mit anchorTerms)`,
  );
  console.log(
    `  Halluzinationen:        ${hallucinated}/${total}  (forbiddenTerms in der Ausgabe — SOLLTE 0 sein)`,
  );

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
