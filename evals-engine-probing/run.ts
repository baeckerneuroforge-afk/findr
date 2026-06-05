/**
 * Engine-Probing Eval
 * -------------------
 * Drives the REAL research interviewer (nextResearchMessage) on small simulated
 * conversation states, then scores the next AI question with:
 *
 *   1. deterministic hard checks where the failure is obvious
 *      (no leading Warum/Why, no closed yes/no probe, one short probe, etc.)
 *   2. an Opus LLM judge for the actual research-method judgement
 *      (grounded, open, non-leading, use-case-appropriate, expected behavior).
 *
 * Foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-engine-probing/run.ts
 *
 * Optional:
 *   ENGINE_PROBING_AGENT_MODEL=claude-sonnet-4-6 ...
 *   ENGINE_PROBING_JUDGE_MODEL=claude-opus-4-7 ...
 *   ENGINE_PROBING_CASES=ep_01_vague_needs_example,ep_06_general_survey_hypothesis_trap ...
 */

import { config } from "dotenv";
import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import {
  DEFAULT_VOICE_MODEL,
  nextResearchMessage,
} from "@/lib/voice-agent/interviewer";
import {
  ENGINE_PROBING_EVAL_CASES,
  type EngineProbingEvalCase,
  type ExpectedAction,
  type ForbiddenPattern,
} from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const AGENT_MODEL =
  process.env.ENGINE_PROBING_AGENT_MODEL ??
  process.env.VOICE_MODEL ??
  DEFAULT_VOICE_MODEL;
const JUDGE_MODEL =
  process.env.ENGINE_PROBING_JUDGE_MODEL ?? CLAUDE_MODELS.opus;

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
const header = (m: string) => console.log(`\n${C.bold}${m}${C.reset}`);

const JudgeSchema = z.object({
  score: z.number().int().min(1).max(5),
  pass: z.boolean(),
  criteria: z.object({
    oneFocusedQuestion: z.boolean(),
    openNonLeading: z.boolean(),
    noWhyProbe: z.boolean(),
    groundedInPreviousAnswer: z.boolean(),
    expectedBehavior: z.boolean(),
    useCaseFit: z.boolean(),
    noFabrication: z.boolean(),
    concise: z.boolean(),
    noOverProbing: z.boolean(),
    actionFit: z.boolean(),
  }),
  violations: z
    .array(
      z.object({
        type: z.enum([
          "suggestive_or_leading",
          "hidden_why_or_causal_pressure",
          "double_question",
          "over_probing",
          "puts_words_in_mouth",
          "use_case_miss",
          "wrong_action",
          "closed_question",
          "too_verbose",
          "off_plan",
          "other",
        ]),
        evidence: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .default([]),
  rationale: z.string().min(1),
  betterQuestion: z.string().default(""),
});
type JudgeResult = z.infer<typeof JudgeSchema>;

const JUDGE_SYSTEM = `Du bist ein adversarialer Methodik-Auditor für Research-Interviews.
Deine Aufgabe ist NICHT, großzügig gute Absichten zu erkennen. Deine Aufgabe ist, die nächste KI-Nachricht aktiv auf methodische Verstöße zu prüfen.

Bewerte AUSSCHLIESSLICH die MODEL NEXT MESSAGE im gegebenen Interviewzustand. Nutze EXPECTED ACTION / EXPECTED BEHAVIOR / SHOULD / AVOID als harte Fall-Spezifikation.

Prüfe aktiv auf diese Verstöße:
- suggestive_or_leading: Antwortoptionen, Bestätigungsfragen, Hypothese validieren, Teilnehmende in eine Richtung schieben.
- hidden_why_or_causal_pressure: getarntes Warum / Rechtfertigungsdruck ("was hat dazu geführt", "woran lag es", "wieso genau").
- double_question: zwei Nachfragen oder Probe + eigentliche Frage im selben Turn, auch wenn nur ein Fragezeichen vorkommt.
- over_probing: weiter in ein erschöpftes Thema bohren, obwohl laut Fall move_on_or_close oder close richtig ist.
- puts_words_in_mouth: Worte verstärken, Motive/Details/Beispiele unterstellen, Teilnehmeraussage überinterpretieren.
- use_case_miss: falsche Research-Logik für den Use Case (General Survey braucht Verhalten/Vergangenheit; Brand bleibt bei Assoziation/Wahrnehmung und wird flach gehalten; Creative höchstens ein Nachhaken zu Asset/Botschaft/Wirkung; Concept zuerst Verständnis in eigenen Worten, danach Relevanz/Nutzen).
- wrong_action: falsche Aktion relativ zur erwarteten Aktion (probe vs move_on_or_close vs close).
- closed_question: Ja/Nein-Frage statt offener Probe.
- too_verbose: unnötiger langer Turn, Re-Intro, Erklärblock oder mehrere Sätze ohne Not.
- off_plan: neues Thema außerhalb des Plans.

Wenn du einen Verstoß findest, MUSST du ihn in violations mit type, wörtlicher evidence aus der MODEL NEXT MESSAGE und kurzer explanation nennen.
Im Zweifel FAIL, nicht Pass. pass=true nur, wenn keine relevante Verletzung vorliegt und die Aktion zum Fall passt.
Score: 5 = stark, keine relevanten Verstöße. 4 = brauchbar, kleine Schwäche ohne Methodenbruch. 3 = gemischt/schwach, mindestens ein relevanter Verstoß oder falscher Schwerpunkt. 2 = klar falsch. 1 = gravierender Methodenfehler.

Return ONLY the structured judgement.`;

interface DeterministicCheck {
  label: string;
  pass: boolean;
  detail?: string;
}

interface Row {
  id: string;
  group: EngineProbingEvalCase["group"];
  deterministicPass: boolean;
  deterministicFailures: string[];
  judgePass: boolean;
  score: number;
  finalPass: boolean;
  done: boolean;
  message: string;
  rationale: string;
  violations: JudgeResult["violations"];
  betterQuestion: string;
  error: boolean;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function questionMarkCount(text: string): number {
  return text.match(/\?/g)?.length ?? 0;
}

function startsWithWhyProbe(text: string): boolean {
  return /(^|[.!?]\s+)(warum|wieso|weshalb|why)\b/i.test(text.trim());
}

function hasQuestionOrProbe(text: string): boolean {
  return (
    questionMarkCount(text) > 0 ||
    /\b(erzählen|erzaehlen|beschreiben|schildern|gehen sie|nehmen sie|walk me|tell me)\b/i.test(
      text,
    )
  );
}

function likelyClosedYesNo(text: string): boolean {
  const firstClause = text.trim().split(/[?!.]/)[0] ?? text;
  const startsClosed =
    /^(haben|hat|hast|ist|sind|war|waren|wäre|waere|würden|wuerden|würde|wuerde|kann|können|koennen|gibt es|finden sie|glauben sie|denken sie)\b/i.test(
      firstClause.trim(),
    );
  if (!startsClosed) return false;

  // Conventional open probes such as "Haben Sie ein konkretes Beispiel?" are
  // allowed; the point is to catch closed confirmations and hypotheticals.
  const openCue =
    /\b(was|wie|welche|welcher|welches|woran|beispiel|konkret|genau|mehr|erzählen|erzaehlen|beschreiben|schildern|in eigenen worten|noch etwas)\b/i.test(
      firstClause,
    );
  return !openCue;
}

function hasGenericSuggestion(text: string): boolean {
  return /\b(liegt es daran|meinen sie damit, dass|meinst du damit, dass|also war|also ist|wahrscheinlich|vermutlich|ich nehme an|klingt so, als|ist es eher\b.*\boder)\b/i.test(
    text,
  );
}

function compileForbidden(p: ForbiddenPattern): RegExp {
  return new RegExp(p.pattern, p.flags);
}

function expectedAction(c: EngineProbingEvalCase): ExpectedAction {
  return c.expected.action ?? "probe";
}

function deterministicChecks(
  c: EngineProbingEvalCase,
  done: boolean,
  message: string,
): DeterministicCheck[] {
  const marks = questionMarkCount(message);
  const words = countWords(message);
  const action = expectedAction(c);
  const expectsProbe = action === "probe";
  const expectsClose = action === "close";
  const checks: DeterministicCheck[] = [
    {
      label:
        action === "probe"
          ? "passende Aktion: weiterfragen"
          : action === "close"
            ? "passende Aktion: abschließen"
            : "passende Aktion: wechseln oder abschließen",
      pass:
        action === "probe"
          ? !done
          : action === "close"
            ? done
            : true,
      detail: `expected=${action}, done=${done}`,
    },
    {
      label: expectsClose
        ? "Closing ohne neue Frage"
        : "eine fokussierte Frage/Probe, kein Fragekatalog",
      pass: expectsClose ? marks === 0 : marks <= 1,
      detail: `${marks} Fragezeichen`,
    },
    {
      label: "kein führendes Warum/Wieso/Weshalb/Why",
      pass: !startsWithWhyProbe(message),
    },
    {
      label: "keine geschlossene Ja/Nein-Nachfrage",
      pass: marks === 0 || !likelyClosedYesNo(message),
    },
    {
      label: "keine generische Suggestiv-Erklärung",
      pass: !hasGenericSuggestion(message),
    },
    {
      label: "kurz genug für Interview-Turn",
      pass: words <= 55,
      detail: `${words} Wörter`,
    },
  ];

  if (expectsProbe) {
    checks.push({
      label: "Nachfrage/Probe erkennbar",
      pass: hasQuestionOrProbe(message),
    });
  }

  for (const required of c.expected.requiredPatterns ?? []) {
    const shouldApply = !done;
    checks.push({
      label: required.label,
      pass: !shouldApply || compileForbidden(required).test(message),
    });
  }

  for (const forbidden of c.expected.forbiddenPatterns ?? []) {
    checks.push({
      label: forbidden.label,
      pass: !compileForbidden(forbidden).test(message),
    });
  }

  return checks;
}

function formatHistory(c: EngineProbingEvalCase): string {
  return c.history
    .map((t) => `${t.role === "agent" ? "Interviewer" : "Teilnehmer"}: ${t.text}`)
    .join("\n");
}

function buildJudgePrompt(
  c: EngineProbingEvalCase,
  done: boolean,
  message: string,
): string {
  return `CASE: ${c.id}
GROUP: ${c.group}
DESCRIPTION: ${c.description}

USE CASE: ${c.input.plan.useCase ?? "none/base prompt only"}
OBJECTIVE: ${c.input.plan.objective}
TOPICS:
${c.input.plan.topics.map((t) => `- ${t.topic}: ${t.intent}`).join("\n")}

CONVERSATION SO FAR:
${formatHistory(c)}

MODEL NEXT MESSAGE:
done=${done}
message=${message}

EXPECTED ACTION:
${expectedAction(c)}

EXPECTED BEHAVIOR:
${c.expected.behavior}

SHOULD:
${c.expected.should.map((s) => `- ${s}`).join("\n")}

AVOID:
${c.expected.avoid.map((s) => `- ${s}`).join("\n")}

CASE-SPECIFIC REQUIRED PATTERNS:
${(c.expected.requiredPatterns ?? []).map((p) => `- ${p.label}: /${p.pattern}/${p.flags ?? ""}`).join("\n") || "- none"}

CASE-SPECIFIC FORBIDDEN PATTERNS:
${(c.expected.forbiddenPatterns ?? []).map((p) => `- ${p.label}: /${p.pattern}/${p.flags ?? ""}`).join("\n") || "- none"}

Judge whether the MODEL NEXT MESSAGE is a good next interviewer question for this exact case.`;
}

async function judgeCase(
  c: EngineProbingEvalCase,
  done: boolean,
  message: string,
): Promise<JudgeResult> {
  return callClaudeStructured({
    schema: JudgeSchema,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: buildJudgePrompt(c, done, message) }],
    model: JUDGE_MODEL,
    maxTokens: 1200,
    maxRetries: 2,
    toolName: "emit_engine_probing_judgement",
    toolDescription:
      "Return the structured judgement for this research interview probing eval case.",
  });
}

function pct(hits: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((hits / total) * 100)}%`;
}

function truncate(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function selectedCases(): EngineProbingEvalCase[] {
  const raw =
    process.env.ENGINE_PROBING_CASES ??
    process.argv.slice(2).filter((arg) => !arg.startsWith("--")).join(",");
  if (!raw.trim()) return ENGINE_PROBING_EVAL_CASES;

  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selected = ENGINE_PROBING_EVAL_CASES.filter((c) => ids.includes(c.id));
  const missing = ids.filter((id) => !selected.some((c) => c.id === id));
  if (missing.length > 0) {
    throw new Error(`Unknown ENGINE_PROBING_CASES id(s): ${missing.join(", ")}`);
  }
  return selected;
}

function printJudge(judge: JudgeResult): void {
  dim(`judge score=${judge.score}/5 pass=${judge.pass}`);
  if (judge.violations.length > 0) {
    for (const violation of judge.violations) {
      bad(
        `judge violation ${violation.type}: "${truncate(
          violation.evidence,
          80,
        )}" — ${truncate(violation.explanation, 120)}`,
      );
    }
  } else {
    ok("judge violations: none");
  }
  dim(`judge rationale: ${truncate(judge.rationale)}`);
  if (judge.betterQuestion.trim()) {
    dim(`better: ${truncate(judge.betterQuestion)}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. For this eval, ensure .env.local has it and run with env -u ANTHROPIC_API_KEY ... if an empty shell var shadows it.",
    );
  }

  const cases = selectedCases();
  console.log(
    `${C.bold}Engine-Probing Eval${C.reset}  agent=${C.cyan}${AGENT_MODEL}${C.reset}  judge=${C.cyan}${JUDGE_MODEL}${C.reset}  cases=${cases.length}`,
  );
  console.log(
    "Gate: deterministic hard checks must all pass; quality gate is ≥80% final passes and avg judge score ≥3.8. Failures are listed with judge rationale.",
  );

  const rows: Row[] = [];

  for (const c of cases) {
    header(`${c.id} — ${c.description}`);
    dim(`expected: ${c.expected.behavior}`);
    dim(`history:\n${formatHistory(c)}`);

    try {
      const { done, message } = await nextResearchMessage(
        c.input,
        c.history,
        "de",
        AGENT_MODEL,
      );
      console.log(`  → done=${done} message=${message}`);

      const checks = deterministicChecks(c, done, message);
      const deterministicPass = checks.every((check) => check.pass);
      const deterministicFailures = checks
        .filter((check) => !check.pass)
        .map((check) => check.label);
      for (const check of checks) {
        const detail = check.detail ? ` (${check.detail})` : "";
        if (check.pass) ok(`${check.label}${detail}`);
        else bad(`${check.label}${detail}`);
      }

      const judge = await judgeCase(c, done, message);
      printJudge(judge);

      const judgePass = judge.pass && judge.score >= 4;
      if (judgePass) ok("LLM-Judge Qualitätscheck");
      else bad("LLM-Judge Qualitätscheck");

      const finalPass = deterministicPass && judgePass;
      if (finalPass) ok("CASE PASS");
      else bad("CASE FAIL");

      rows.push({
        id: c.id,
        group: c.group,
        deterministicPass,
        deterministicFailures,
        judgePass,
        score: judge.score,
        finalPass,
        done,
        message,
        rationale: judge.rationale,
        violations: judge.violations,
        betterQuestion: judge.betterQuestion,
        error: false,
      });
    } catch (err) {
      bad(`case failed to run: ${err instanceof Error ? err.message : "unknown"}`);
      rows.push({
        id: c.id,
        group: c.group,
        deterministicPass: false,
        deterministicFailures: ["runner/model error"],
        judgePass: false,
        score: 0,
        finalPass: false,
        done: true,
        message: "",
        rationale: err instanceof Error ? err.message : "unknown runner error",
        violations: [],
        betterQuestion: "",
        error: true,
      });
    }
  }

  const total = rows.length;
  const deterministicHits = rows.filter((r) => r.deterministicPass).length;
  const judgeHits = rows.filter((r) => r.judgePass).length;
  const finalHits = rows.filter((r) => r.finalPass).length;
  const errors = rows.filter((r) => r.error).length;
  const avgScore =
    total === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.score, 0) / total;
  const requiredFinalPasses = Math.ceil(total * 0.8);
  const requiredAvgScore = 3.8;
  const groups = Array.from(new Set(rows.map((r) => r.group)));

  console.log(`\n${C.bold}═══ METRICS ═══${C.reset}`);
  console.log(
    `  Deterministic hard checks: ${deterministicHits}/${total} (${pct(deterministicHits, total)})  [GATE: all cases]`,
  );
  console.log(
    `  LLM-Judge quality pass:    ${judgeHits}/${total} (${pct(judgeHits, total)})  [info]`,
  );
  console.log(
    `  Final case pass:           ${finalHits}/${total} (${pct(finalHits, total)})  [GATE: ≥${requiredFinalPasses}/${total} = 80%]`,
  );
  console.log(
    `  Avg judge score:           ${avgScore.toFixed(2)}/5  [GATE: ≥${requiredAvgScore.toFixed(2)}]`,
  );
  console.log(`  Runner/model errors:        ${errors}/${total}  [GATE: 0]`);
  for (const group of groups) {
    const groupRows = rows.filter((r) => r.group === group);
    const groupHits = groupRows.filter((r) => r.finalPass).length;
    console.log(
      `  ${group.padEnd(24)} ${groupHits}/${groupRows.length} (${pct(
        groupHits,
        groupRows.length,
      )})`,
    );
  }

  const gateGreen =
    errors === 0 &&
    deterministicHits === total &&
    finalHits >= requiredFinalPasses &&
    avgScore >= requiredAvgScore;

  const failures = rows.filter((r) => !r.finalPass);
  console.log(`\n${C.bold}FAILURES${C.reset}`);
  if (failures.length === 0) {
    console.log("  none");
  } else {
    for (const row of failures) {
      bad(
        `${row.id} (${row.group}) score=${row.score}/5 done=${row.done} message="${truncate(
          row.message,
          160,
        )}"`,
      );
      if (row.deterministicFailures.length > 0) {
        dim(`  deterministic: ${row.deterministicFailures.join("; ")}`);
      }
      if (row.violations.length > 0) {
        for (const violation of row.violations) {
          dim(
            `  judge violation ${violation.type}: "${truncate(
              violation.evidence,
              80,
            )}" — ${truncate(violation.explanation, 140)}`,
          );
        }
      }
      dim(`  judge rationale: ${truncate(row.rationale, 220)}`);
      if (row.betterQuestion.trim()) {
        dim(`  better: ${truncate(row.betterQuestion, 180)}`);
      }
    }
  }

  if (gateGreen) {
    console.log(
      `\n${C.green}${C.bold}GATE: GREEN${C.reset} — probing discipline holds on this run.`,
    );
  } else {
    console.log(
      `\n${C.red}${C.bold}GATE: RED${C.reset} — at least one probing gate failed.`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
