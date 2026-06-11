/**
 * Turn-Signale Eval Runner (E1, Plan §4.5)
 * ─────────────────────────────────────────
 *
 * Misst den Signal-Klassifikator (analyzeTurnSignals + sealTurnSignals) gegen
 * sechs gelabelte deutsche Fixtures — jede kodiert einen Pflicht-Fall:
 * Begeisterung, höfliche Ausweiche, „alles gut"-Absenz (der wichtigste
 * False-Positive-Schutz: Kürze ≠ Ausweiche), Ironie-Falle, knapp-aber-direkt,
 * explizites Ablehnen (declined).
 *
 * Gemessen wird das, was PERSISTIERT würde (nach sealTurnSignals), plus zwei
 * Modell-Qualitätsmetriken davor:
 *
 *   (1) coverage        — jeder Teilnehmer-Turn genau einmal gelabelt?
 *   (2) quote fidelity  — wie viele non-neutrale Affekt-Labels überleben die
 *                         Substring-Härtung? (Degradierte = Modell hat kein
 *                         wörtliches Zitat geliefert → seal setzt neutral.)
 *   (3) expectations    — Affekt/Direktheit innerhalb der akzeptierten Menge
 *                         der Fixture (Mengen statt Punkt-Labels: benachbarte
 *                         Zustände sind legitime Varianz; bei n=6 Fixtures
 *                         reporten wir ehrliche per-Klasse-Trefferquoten,
 *                         kein formales Precision/Recall).
 *
 * EXIT-VERHALTEN: anders als der warn-only Saturation-Runner setzt dieser
 * Runner exitCode=1, wenn EINE Fixture-Erwartung verfehlt wird — das Eval ist
 * das Quality-Gate, bevor signals_enabled für echte Studien aktiviert wird.
 *
 * Default-Modell = PROD-Default (Haiku, resolveSignalsModel) — wir messen, was
 * ausgeliefert wird. Override:
 *   EVAL_MODEL=claude-sonnet-4-6 pnpm eval:turn-signals
 *
 * Invoke (Repo-Root):
 *   env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server \
 *     evals-turn-signals/run.ts
 */

import { config as loadEnv } from "dotenv";

import {
  analyzeTurnSignals,
  sealTurnSignals,
  DEFAULT_SIGNALS_MODEL,
} from "@/lib/research/turn-signals";
import type { TurnSignal } from "@/lib/schemas/turn-signals";
import { FIXTURES, type TurnSignalsFixture } from "./fixtures";

interface FixtureResult {
  id: string;
  pass: boolean;
  lines: string[];
}

async function runFixture(
  fixture: TurnSignalsFixture,
  model: string,
): Promise<FixtureResult> {
  const lines: string[] = [];
  let pass = true;

  const extraction = await analyzeTurnSignals(
    {
      conversation: fixture.conversation,
      language: "de",
      planTitle: fixture.planTitle,
    },
    model,
  );
  const sealed = sealTurnSignals(extraction, fixture.conversation, model);
  const byIndex = new Map<number, TurnSignal>(
    sealed.turns.map((t) => [t.index, t]),
  );

  // (1) Coverage — jeder customer-Turn genau einmal gelabelt.
  const customerIndices = fixture.conversation
    .map((t, i) => (t.role === "customer" ? i : -1))
    .filter((i) => i >= 0);
  const missing = customerIndices.filter((i) => !byIndex.has(i));
  if (missing.length > 0) {
    pass = false;
    lines.push(`  FAIL coverage: unlabeled participant turns [${missing}]`);
  } else {
    lines.push(
      `  ok   coverage: ${customerIndices.length}/${customerIndices.length} participant turns labeled`,
    );
  }

  // (2) Zitat-Treue — non-neutrale RAW-Labels vs. nach-Seal-Überleben.
  const rawNonNeutral = extraction.turns.filter(
    (t) => t.affect !== "neutral",
  ).length;
  const sealedNonNeutral = sealed.turns.filter(
    (t) => t.affect !== "neutral",
  ).length;
  const degraded = rawNonNeutral - sealedNonNeutral;
  lines.push(
    `  ${degraded > 0 ? "warn" : "ok  "} quote fidelity: ${rawNonNeutral - degraded}/${rawNonNeutral} non-neutral labels carried a verbatim quote` +
      (degraded > 0 ? ` (${degraded} degraded to neutral by seal)` : ""),
  );

  // (3) Erwartungen — auf der GESEALTEN (= persistierten) Form.
  for (const exp of fixture.expectations) {
    const got = byIndex.get(exp.index);
    if (!got) {
      pass = false;
      lines.push(`  FAIL [${exp.index}]: no signal for expected turn`);
      continue;
    }
    const affectOk = exp.affect.includes(got.affect);
    const directnessOk = exp.directness.includes(got.directness);
    if (!affectOk || !directnessOk) pass = false;
    lines.push(
      `  ${affectOk && directnessOk ? "ok  " : "FAIL"} [${exp.index}] affect=${got.affect}${affectOk ? "" : ` (expected ${exp.affect.join("|")})`} directness=${got.directness}${directnessOk ? "" : ` (expected ${exp.directness.join("|")})`} conf=${got.confidence.toFixed(2)}` +
        (got.affectEvidence ? ` evidence=„${got.affectEvidence}“` : ""),
    );
  }

  lines.push(
    `       arc: ${sealed.session.affectArc} · direct=${sealed.session.directCount} evasive=${sealed.session.evasiveCount}`,
  );
  return { id: fixture.id, pass, lines };
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "eval:turn-signals — ANTHROPIC_API_KEY missing (expected via .env.local).",
    );
    process.exitCode = 1;
    return;
  }

  const model = process.env.EVAL_MODEL ?? DEFAULT_SIGNALS_MODEL;
  console.log(
    `\nTurn-Signals Eval — ${FIXTURES.length} fixtures · model: ${model}\n`,
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
      console.log(
        `  ERROR: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (${FIXTURES.length} fixtures, model: ${model})`);
  console.log(`  pass: ${pass}`);
  console.log(`  fail: ${fail}`);
  if (model !== DEFAULT_SIGNALS_MODEL) {
    console.log(
      `  note: prod default is ${DEFAULT_SIGNALS_MODEL} — this run used an override.`,
    );
  }
  console.log(
    "\nExpectation sets are deliberately tolerant; read the per-turn lines before tightening.\n",
  );
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
