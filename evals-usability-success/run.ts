/**
 * Usability-Success-Judge Eval Runner
 * ───────────────────────────────────
 *
 * Misst den ADVISORY KI-Erfolgs-Judge (judgeTaskSuccess aus
 * src/lib/research/task-success-judge.ts) gegen gelabelte synthetische
 * Usability-Transkripte. Ruft die PRODUKTIONSfunktion direkt mit synthetischem
 * Input — kein DB-Pfad, kein Sidecar, keine Migration (analog dazu, wie der
 * turn-signals-Runner analyzeTurnSignals statt runTurnSignalsSidecar ruft).
 *
 * Zwei Prüfungen pro Fixture:
 *
 *   (1) Verdikt-Korrektheit — verdict ∈ fixture.acceptedVerdicts. Erwartungen
 *       sind MENGEN (success/partial-Grenzen sind legitime Varianz). Bei
 *       Verfehlung: FAIL.
 *
 *   (2) ROTE-LINIE-GATE (das Kernstück, Muster evals-turn-signals) — für
 *       Fixtures mit redLineGate=true wird das reasoning gegen DENY_TERMS
 *       geprüft (Affekt/Emotion, Persönlichkeit/Intelligenz, Klinik, Ehrlichkeit/
 *       Täuschung, de+en). EIN Treffer → FAIL. Das ist der maschinelle Beweis,
 *       dass der Judge die rote Linie (EU AI Act, Plan L8) hält: NUR Outcome,
 *       NIE die Person.
 *
 * EXIT-VERHALTEN: process.exitCode = 1, sobald EINE Fixture failt — das Eval ist
 * das Quality-Gate, identisch zu turn-signals (nicht warn-only).
 *
 * Default-Modell = PROD-Default (Haiku, DEFAULT_TASK_SUCCESS_MODEL) — wir messen,
 * was ausgeliefert wird. Override:
 *   EVAL_MODEL=claude-sonnet-4-6 pnpm eval:usability-success
 *
 * Invoke (Repo-Root), im Vordergrund (server-only Modul → react-server-Condition,
 * spiegelt turn-signals/churn-severity):
 *   env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server \
 *     evals-usability-success/run.ts
 *
 * (`env -u ANTHROPIC_API_KEY` löscht eine leere/abschattende Shell-Var, damit
 * dotenv den echten Key aus .env.local injiziert; harmlos, falls ungesetzt.)
 *
 * HINWEIS: Dieses Eval ruft live die Anthropic-API (kostet). Ein Live-Lauf ist
 * ein separater, von André freigegebener Schritt (analog turn-signals/synthesis).
 */

import { config as loadEnv } from "dotenv";

import {
  judgeTaskSuccess,
  DEFAULT_TASK_SUCCESS_MODEL,
} from "@/lib/research/task-success-judge";
import { DENY_TERMS, FIXTURES, type UsabilitySuccessFixture } from "./fixtures";

interface FixtureResult {
  id: string;
  pass: boolean;
  lines: string[];
}

/**
 * Fold Unicode + DE-Typografie, damit der Deny-Substring-Check Umlaute/ß und
 * smarte Anführungszeichen wie ihre ASCII-Form behandelt. Inline gehalten, damit
 * der Runner allein steht (Muster: evals-churn-severity/run.ts fold()).
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll(/[‚‘’]/g, "'")
    .replaceAll(/[„“”]/g, '"')
    .replaceAll(/[–—]/g, "-");
}

/** Deny-Terme ebenfalls folden, damit Umlaut-Stämme gegen den gefoldeten
 *  reasoning-Text matchen (idempotent für bereits gefoldete Terme). */
const FOLDED_DENY = DENY_TERMS.map(fold);

function findDenyHits(reasoning: string): string[] {
  const hay = fold(reasoning);
  return DENY_TERMS.filter((_, i) => hay.includes(FOLDED_DENY[i]));
}

async function runFixture(
  fixture: UsabilitySuccessFixture,
  model: string,
): Promise<FixtureResult> {
  const lines: string[] = [];
  let pass = true;

  const extraction = await judgeTaskSuccess(
    {
      conversation: fixture.conversation,
      language: fixture.language,
      instruction: fixture.instruction,
      successCriterion: fixture.successCriterion,
      behavioural: fixture.behavioural,
      planTitle: fixture.planTitle,
    },
    model,
  );

  // (1) Verdikt-Korrektheit — Menge akzeptierter Verdikte.
  const verdictOk = fixture.acceptedVerdicts.includes(extraction.verdict);
  if (!verdictOk) pass = false;
  lines.push(
    `  ${verdictOk ? "ok  " : "FAIL"} verdict=${extraction.verdict}` +
      (verdictOk ? "" : ` (expected ${fixture.acceptedVerdicts.join("|")})`) +
      ` conf=${extraction.confidence.toFixed(2)}`,
  );

  // (2) ROTE-LINIE-GATE — reasoning frei von verbotenem Vokabular?
  if (fixture.redLineGate) {
    const hits = findDenyHits(extraction.reasoning);
    if (hits.length > 0) {
      pass = false;
      lines.push(
        `  FAIL red-line: reasoning contains forbidden term(s) [${hits.join(", ")}]`,
      );
    } else {
      lines.push(
        "  ok   red-line: reasoning free of affect/clinical/honesty terms",
      );
    }
  }

  // reasoning immer ausgeben — der manuelle Read ist Teil der Evaluation.
  lines.push(`       reasoning: ${extraction.reasoning.replaceAll("\n", " ")}`);
  return { id: fixture.id, pass, lines };
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "eval:usability-success — ANTHROPIC_API_KEY missing (expected via .env.local).",
    );
    process.exitCode = 1;
    return;
  }

  const model = process.env.EVAL_MODEL ?? DEFAULT_TASK_SUCCESS_MODEL;
  const gateCount = FIXTURES.filter((f) => f.redLineGate).length;
  console.log(
    `\nUsability-Success Eval — ${FIXTURES.length} fixtures ` +
      `(${gateCount} red-line gates) · model: ${model}\n`,
  );

  let pass = 0;
  let fail = 0;

  for (const fixture of FIXTURES) {
    console.log("=".repeat(78));
    console.log(`${fixture.id} — ${fixture.description}`);
    try {
      const result = await runFixture(fixture, model);
      for (const line of result.lines) console.log(line);
      if (result.pass) pass += 1;
      else fail += 1;
    } catch (err) {
      fail += 1;
      console.log(`  ERROR: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (${FIXTURES.length} fixtures, model: ${model})`);
  console.log(`  pass: ${pass}`);
  console.log(`  fail: ${fail}`);
  if (model !== DEFAULT_TASK_SUCCESS_MODEL) {
    console.log(
      `  note: prod default is ${DEFAULT_TASK_SUCCESS_MODEL} — this run used an override.`,
    );
  }
  console.log(
    "\nRed-line gates are the hard part: a single forbidden term in reasoning " +
      "fails the run. Read the per-fixture reasoning before loosening DENY_TERMS.\n",
  );
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
