/**
 * Study-Synthesis Eval Runner
 * ---------------------------
 * Runs synthesizeFromInputs() over SYNTHESIS_EVAL_CASES, applies four
 * property checks per case, and prints the full output so it can be
 * judged MANUALLY. Manual read is the primary evaluation (same posture
 * as evals-product-discovery/run.ts); the heuristic checks are
 * supportive pass/warn signals.
 *
 * Checks per case:
 *   (a) anchored        — every sourceInsightId in the output is one
 *                          of the input insight IDs. Engine-side
 *                          filter should have dropped the rest; if a
 *                          fail surfaces here it means the schema
 *                          allowed something through.
 *   (b) frequency-honest — each emergent_theme.frequency equals
 *                          unique(sourceInsightIds).length. The engine
 *                          OVERRIDES the model's number to this, so a
 *                          mismatch here is a bug in applyAnchoredFilter
 *                          (or the test data is malformed).
 *   (c) no-fake-tension  — if expected.tensions === 0, the output must
 *                          have tensions.length === 0. Anti-balance-
 *                          bias. (For >0 expectations we only require
 *                          tensions.length > 0 — the EXACT count is a
 *                          manual judgment.)
 *   (d) theme-count      — emergent_themes.length is within
 *                          [expected.minThemes, expected.maxThemes].
 *                          Bounds are advisory; a fail prints WARN.
 *
 * Tier-2a Grounding-Messung (Spec docs/specs/synthese-tier2a-spec.md):
 *   (h) number-fidelity  — A2, DETERMINISTISCH: erfundene Ganzzahlen in der
 *                          Freitext-Prosa. Nach Live-Kalibrierung ÜBERALL WARN
 *                          (vormals FAIL in overview/tension.description) — gatet
 *                          aktuell nicht. Allowlist deckt zusätzlich Plan-Titel/
 *                          Objective-Zahlen (z.B. „Q3").
 *   (i) quote-coverage   — A4, DETERMINISTISCH, WARN: Themen/Tension-Seiten
 *                          ohne wörtliches Zitat.
 *   JUDGE (A1+A3)        — ein LIVE Sonnet-Judge je Fall (claude-sonnet-4-6,
 *                          Override SYNTHESIS_JUDGE_MODEL) prüft Prosa-Grounding
 *                          und vergibt Methoden-Kategorien. Beide Befundarten
 *                          sind IMMER WARN — der Judge gatet nirgends (Spec §3:
 *                          deterministisch gatet, Judge berät). Reine Logik in
 *                          src/lib/synthesis/eval-checks.ts (dort unit-getestet).
 *
 * Always calls the LLM. Default model is the PRODUCTION synthesis model
 * (DEFAULT_SYNTHESIS_MODEL = Opus) so the standard run validates real prod
 * behaviour. For cheap repeated iteration, override with
 * SYNTHESIS_MODEL=claude-sonnet-4-6. Run it yourself, foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-synthesis/run.ts
 */

import { config } from "dotenv";
import {
  buildAnchorSet,
  DEFAULT_SYNTHESIS_MODEL,
  synthesizeFromInputs,
} from "@/lib/synthesis/engine";
import { clusterPersonasFromInputs } from "@/lib/synthesis/audience-personas";
import type {
  EmergentTheme,
  EnrichedAudiencePersona,
  StudySynthesisResult,
  Tension,
} from "@/lib/schemas/synthesis";
import {
  judgeResultToFindings,
  numberFidelityScan,
  personaDeterministicChecks,
  quoteCoverageScan,
} from "@/lib/synthesis/eval-checks";
import {
  PERSONA_EVAL_CASES,
  SYNTHESIS_EVAL_CASES,
  type SynthesisEvalCase,
} from "./dataset";
import {
  DEFAULT_JUDGE_MODEL,
  judgePersonas,
  judgeSynthesis,
} from "./judge";

config({ path: ".env.local" });
config({ path: ".env" });

// Default to the PRODUCTION synthesis model (Opus via DEFAULT_SYNTHESIS_MODEL)
// so the standard eval run validates prod behaviour, not a cheaper proxy.
// For cheap iteration, override: SYNTHESIS_MODEL=claude-sonnet-4-6.
const MODEL = process.env.SYNTHESIS_MODEL ?? DEFAULT_SYNTHESIS_MODEL;

// Tier-2a A3 — günstiger Grounding-Judge (Sonnet 4.6 Default; Override via
// SYNTHESIS_JUDGE_MODEL). NUR im echten Eval-Lauf live; seine Befunde sind
// immer WARN.
const JUDGE_MODEL = process.env.SYNTHESIS_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;

// ── pretty-print helpers ────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
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

function printTheme(t: EmergentTheme, idx: number): void {
  console.log(
    `  ${C.bold}Theme ${idx + 1}:${C.reset} ${t.title}  ${C.dim}freq=${t.frequency} · ids=[${t.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  dim(t.summary);
  for (const q of t.quotes) dim(`  • ${q}`);
}

function printTension(t: Tension, idx: number): void {
  console.log(
    `  ${C.bold}Tension ${idx + 1}:${C.reset} ${t.description}`,
  );
  console.log(
    `  ${C.dim}side_a${C.reset} ${t.side_a.label}  ${C.dim}ids=[${t.side_a.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  for (const q of t.side_a.quotes) dim(`    • ${q}`);
  console.log(
    `  ${C.dim}side_b${C.reset} ${t.side_b.label}  ${C.dim}ids=[${t.side_b.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  for (const q of t.side_b.quotes) dim(`    • ${q}`);
}

function printPersona(p: EnrichedAudiencePersona, idx: number): void {
  console.log(
    `  ${C.bold}Persona ${idx + 1}:${C.reset} ${p.name}  ${C.dim}share=${p.sharePercent}% (${p.shareCount}) · role=${p.roleLabel ?? "—"} · ids=[${p.sourceInsightIds.join(", ")}]${C.reset}`,
  );
  if (p.goals.length > 0) dim(`  goals: ${p.goals.join(" | ")}`);
  if (p.pains.length > 0) dim(`  pains: ${p.pains.join(" | ")}`);
  if (p.behavior.length > 0) dim(`  behavior: ${p.behavior.join(" | ")}`);
  if (p.motivation) dim(`  motivation: ${p.motivation}`);
  if (p.leadQuote) dim(`  • „${p.leadQuote}“`);
}

// ── checks ──────────────────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
}

function runChecks(
  testCase: SynthesisEvalCase,
  result: StudySynthesisResult,
): CheckResult {
  const inputIds = new Set(testCase.input.insights.map((i) => i.id));
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) anchored
  const unknownIds: string[] = [];
  for (const theme of result.emergent_themes) {
    for (const id of theme.sourceInsightIds) {
      if (!inputIds.has(id)) unknownIds.push(`theme:${id}`);
    }
  }
  for (const t of result.tensions) {
    for (const id of t.side_a.sourceInsightIds) {
      if (!inputIds.has(id)) unknownIds.push(`tension.a:${id}`);
    }
    for (const id of t.side_b.sourceInsightIds) {
      if (!inputIds.has(id)) unknownIds.push(`tension.b:${id}`);
    }
  }
  if (unknownIds.length === 0) {
    ok("anchored — every sourceInsightId is in the input set");
    passed++;
  } else {
    bad(`anchored — ${unknownIds.length} unknown id refs: ${unknownIds.slice(0, 5).join(", ")}`);
    failed++;
  }

  // (b) frequency-honest
  let freqMismatches = 0;
  for (const theme of result.emergent_themes) {
    const unique = new Set(theme.sourceInsightIds).size;
    if (theme.frequency !== unique) freqMismatches++;
  }
  if (freqMismatches === 0) {
    ok("frequency-honest — frequency == unique(sourceInsightIds) on every theme");
    passed++;
  } else {
    bad(`frequency-honest — ${freqMismatches} theme(s) with mismatched frequency`);
    failed++;
  }

  // (c) no-fake-tension (only enforced when expected === 0)
  if (testCase.expected.tensions === 0) {
    if (result.tensions.length === 0) {
      ok("no-fake-tension — tensions are empty as expected (full consensus)");
      passed++;
    } else {
      bad(
        `no-fake-tension — got ${result.tensions.length} tensions but expected 0 (consensus case)`,
      );
      failed++;
    }
  } else {
    // expected > 0 — just require non-empty; exact count is a manual judgment.
    if (result.tensions.length > 0) {
      ok(`tension-present — ${result.tensions.length} tension(s) surfaced (expected ${testCase.expected.tensions})`);
      passed++;
    } else {
      warn(
        `tension-present — got 0 tensions, expected ${testCase.expected.tensions} (manual judgment)`,
      );
      warned++;
    }
  }

  // (d) theme-count bounds
  const tc = result.emergent_themes.length;
  if (tc >= testCase.expected.minThemes && tc <= testCase.expected.maxThemes) {
    ok(`theme-count — ${tc} (within [${testCase.expected.minThemes}, ${testCase.expected.maxThemes}])`);
    passed++;
  } else {
    warn(
      `theme-count — ${tc} outside expected [${testCase.expected.minThemes}, ${testCase.expected.maxThemes}]`,
    );
    warned++;
  }

  // (e) max-frequency (only checked if expected provides a ceiling)
  if (testCase.expected.maxThemeFrequency !== undefined) {
    const maxFreq = result.emergent_themes.reduce(
      (m, t) => Math.max(m, t.frequency),
      0,
    );
    if (maxFreq <= testCase.expected.maxThemeFrequency) {
      ok(
        `max-frequency — ${maxFreq} ≤ ${testCase.expected.maxThemeFrequency} (no over-counting respondents)`,
      );
      passed++;
    } else {
      bad(
        `max-frequency — ${maxFreq} > ${testCase.expected.maxThemeFrequency} (theme cites more respondents than possible)`,
      );
      failed++;
    }
  }

  // (f) E4 methodology-gate — HART für Cases ohne Rationales (Server-Guard
  // sealSynthesisExtras muss nullen; LLM-unabhängig), WARN-Qualität für
  // Cases mit Rationales (Modell soll liefern; null = Qualitätssignal).
  const hadRationales = Boolean(
    testCase.input.rationales && testCase.input.rationales.length > 0,
  );
  if (!hadRationales) {
    if (result.methodology === null) {
      ok("methodology-gate — null without a rationales block (guard holds)");
      passed++;
    } else {
      bad("methodology-gate — methodology present WITHOUT a rationales block (guard breached)");
      failed++;
    }
  } else if (testCase.expected.expectMethodology) {
    if (result.methodology !== null) {
      ok(
        `methodology — present (${result.methodology.themes.length} theme line(s)${result.methodology.coverageNote ? ", coverage note set" : ""})`,
      );
      passed++;
    } else {
      warn("methodology — null despite supplied rationales (model quality)");
      warned++;
    }
  }

  // (g) E4 signal-observations-gate — spiegelbildlich: HART leer ohne
  // Faktenblock; mit Block 1–3 erwartet + Zahlen-Treue als WARN-Heuristik
  // (jede Zahl in einer Observation muss im Faktenblock vorkommen).
  const hadSignals = Boolean(testCase.input.signals);
  if (!hadSignals) {
    if (result.signal_observations.length === 0) {
      ok("signal-observations-gate — empty without a signals block (guard holds)");
      passed++;
    } else {
      bad("signal-observations-gate — observations WITHOUT a signals block (guard breached)");
      failed++;
    }
  } else if (testCase.expected.expectSignalObservations) {
    const obs = result.signal_observations;
    if (obs.length >= 1 && obs.length <= 3) {
      const s = testCase.input.signals!.summary;
      const allowedNumbers = new Set(
        [
          s.totalSessions,
          s.signalSessions,
          s.totalAnswers,
          s.direct,
          s.partial,
          s.evasive,
          s.declined,
          s.whySessions,
          ...Object.values(s.affects),
        ].map(String),
      );
      const strayNumbers = obs.flatMap(
        (o) => (o.match(/\d+/g) ?? []).filter((n) => !allowedNumbers.has(n)),
      );
      if (strayNumbers.length === 0) {
        ok(`signal-observations — ${obs.length} observation(s), all counts verbatim from the facts block`);
        passed++;
      } else {
        warn(
          `signal-observations — ${obs.length} observation(s), but number(s) not in the facts block: ${strayNumbers.slice(0, 4).join(", ")}`,
        );
        warned++;
      }
      for (const o of obs) dim(`  ◦ ${o}`);
    } else {
      warn(
        `signal-observations — got ${obs.length}, expected 1–3 despite supplied facts block (model quality)`,
      );
      warned++;
    }
  }

  // (h) A2 — Prosa-Zahlentreue (DETERMINISTISCH, aktuell WARN — nach Live-
  // Kalibrierung herabgestuft, s. eval-checks.ts). Allowlist = Server-Zahlen ∪
  // Haystack-Zahlen ∪ Plan-Titel/Objective-Zahlen. Der Haystack ist exakt der,
  // gegen den die Engine Zitate ankert (buildAnchorSet inkl. Stimulus-Ausschnitten).
  const stimulusExcerpts =
    testCase.input.stimuli?.excerpts.flatMap((e) => e.excerpts) ?? [];
  const inputHaystack = buildAnchorSet(
    testCase.input.insights,
    stimulusExcerpts,
  ).foldedHaystack;
  const numberFindings = numberFidelityScan(result, {
    inputHaystack,
    basedOnCount: testCase.input.insights.length,
    planContext: `${testCase.input.plan.title} ${testCase.input.plan.objective}`,
  });
  if (numberFindings.length === 0) {
    ok("number-fidelity — keine ungedeckten Zahlen in der Freitext-Prosa");
    passed++;
  } else {
    for (const f of numberFindings) {
      if (f.severity === "fail") {
        bad(`number-fidelity [${f.field}] — ${f.message}`);
        failed++;
      } else {
        warn(`number-fidelity [${f.field}] — ${f.message}`);
        warned++;
      }
    }
  }

  // (i) A4 — Belegpflicht (DETERMINISTISCH, WARN): Themen/Tension-Seiten ohne
  // wörtliches Zitat. Reine Messung — der Prod-Pfad bleibt unverändert (2b).
  const quoteFindings = quoteCoverageScan(result);
  if (quoteFindings.length === 0) {
    ok("quote-coverage — jedes Theme/jede Tension-Seite trägt ≥1 Zitat");
    passed++;
  } else {
    for (const f of quoteFindings) {
      warn(`quote-coverage [${f.field}] — ${f.message}`);
      warned++;
    }
  }

  return { passed, warned, failed };
}

// ── runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `${C.bold}Study-Synthesis Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${SYNTHESIS_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;

  for (const c of SYNTHESIS_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(
      `expected: themes ∈ [${c.expected.minThemes}, ${c.expected.maxThemes}], tensions = ${c.expected.tensions}${
        c.expected.maxThemeFrequency !== undefined
          ? `, maxThemeFrequency ≤ ${c.expected.maxThemeFrequency}`
          : ""
      }${
        c.expected.expectCongruent
          ? " · A1-Negativprovokation: Synthese muss methodenkongruent bleiben"
          : ""
      }`,
    );

    let result: StudySynthesisResult;
    try {
      result = await synthesizeFromInputs(c.input, MODEL);
    } catch (err) {
      bad(`engine call failed: ${err instanceof Error ? err.message : "unknown"}`);
      totalFailed++;
      continue;
    }

    console.log(`\n  ${C.bold}OVERVIEW${C.reset}`);
    dim(`  ${result.overview}`);

    if (result.emergent_themes.length > 0) {
      console.log(`\n  ${C.bold}EMERGENT THEMES (${result.emergent_themes.length})${C.reset}`);
      result.emergent_themes.forEach(printTheme);
    } else {
      dim(`\n  (no emergent themes)`);
    }

    if (result.tensions.length > 0) {
      console.log(`\n  ${C.bold}TENSIONS (${result.tensions.length})${C.reset}`);
      result.tensions.forEach(printTension);
    } else {
      dim(`\n  (no tensions)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, result);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;

    // A1 + A3 — LLM-Judge (LIVE; nur hier, nie in vitest run src). Befunde sind
    // IMMER WARN (Spec §3: der nicht-deterministische Judge gatet nirgends).
    console.log(
      `\n  ${C.bold}JUDGE${C.reset} ${C.dim}(A1 Kongruenz + A3 Grounding · ${JUDGE_MODEL})${C.reset}`,
    );
    try {
      const judged = await judgeSynthesis(c.input, result, JUDGE_MODEL);
      const judgeFindings = judgeResultToFindings(judged, {
        studyType: c.input.plan.studyType,
        useCase: c.input.plan.useCase,
      });
      if (judgeFindings.length === 0) {
        ok("judge — alle Freitext-Felder grounded & methodenkonform");
        totalPassed++;
      } else {
        for (const f of judgeFindings) {
          warn(`${f.check} [${f.field}] — ${f.message}`);
          totalWarned++;
        }
      }
    } catch (err) {
      warn(
        `judge unavailable (continuing): ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  // ── Personas (Spec §8): eigener Abschnitt. clusterPersonasFromInputs →
  // deterministische Gates (HART, eval-checks.ts) + Persona-Grounding-Judge
  // (immer WARN). Reiner LLM-Lauf wie der Synthese-Teil.
  if (PERSONA_EVAL_CASES.length > 0) {
    console.log(
      `\n${C.bold}${C.cyan}════════ PERSONAS (${PERSONA_EVAL_CASES.length} cases) ════════${C.reset}`,
    );
  }
  for (const c of PERSONA_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(
      `expected: personas ∈ [${c.expected.minPersonas}, ${c.expected.maxPersonas}]`,
    );

    let personas: EnrichedAudiencePersona[];
    let totalInsights: number;
    try {
      const out = await clusterPersonasFromInputs(c.input, MODEL);
      personas = out.personas;
      totalInsights = out.summary.totalInsights;
    } catch (err) {
      bad(
        `persona clustering failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      totalFailed++;
      continue;
    }

    if (personas.length > 0) {
      console.log(`\n  ${C.bold}PERSONAS (${personas.length})${C.reset}`);
      personas.forEach(printPersona);
    } else {
      dim(`\n  (no personas)`);
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);

    // persona-count (advisory bounds)
    if (
      personas.length >= c.expected.minPersonas &&
      personas.length <= c.expected.maxPersonas
    ) {
      ok(
        `persona-count — ${personas.length} (within [${c.expected.minPersonas}, ${c.expected.maxPersonas}])`,
      );
      totalPassed++;
    } else {
      warn(
        `persona-count — ${personas.length} outside [${c.expected.minPersonas}, ${c.expected.maxPersonas}]`,
      );
      totalWarned++;
    }

    // deterministische Vertrauens-Gates (HART)
    const personaFindings = personaDeterministicChecks(personas, totalInsights);
    if (personaFindings.length === 0) {
      ok(
        "persona-gates — share-honest / min-cluster / disjoint / field-evidence / quote-coverage clean",
      );
      totalPassed++;
    } else {
      for (const f of personaFindings) {
        bad(`${f.check} [${f.field}] — ${f.message}`);
        totalFailed++;
      }
    }

    // Persona-Grounding-Judge (LIVE; immer WARN — der Judge gatet nicht).
    console.log(
      `\n  ${C.bold}JUDGE${C.reset} ${C.dim}(Persona-Grounding · ${JUDGE_MODEL})${C.reset}`,
    );
    if (personas.length === 0) {
      dim("  (no personas to judge)");
    } else {
      try {
        const judged = await judgePersonas(c.input, personas, JUDGE_MODEL);
        const unsupported = judged.personas.filter(
          (p) => p.verdict === "unsupported_claim",
        );
        if (unsupported.length === 0) {
          ok("persona-judge — alle Personas grounded");
          totalPassed++;
        } else {
          for (const u of unsupported) {
            warn(
              `persona-grounding [persona[${u.index}]] — Traits nicht durch die Mitglieder gedeckt`,
            );
            totalWarned++;
          }
        }
      } catch (err) {
        warn(
          `persona judge unavailable (continuing): ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }
  }

  console.log(
    `\n${C.bold}SUMMARY${C.reset}  ${C.green}passed=${totalPassed}${C.reset}  ${C.yellow}warned=${totalWarned}${C.reset}  ${C.red}failed=${totalFailed}${C.reset}`,
  );
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
