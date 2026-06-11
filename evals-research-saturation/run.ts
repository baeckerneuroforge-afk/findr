/**
 * Research-Saturation Eval Runner
 * ────────────────────────────────
 *
 * KNOWN HEURISTIC WARN (not a regression):
 *   Case 3 on Opus typically lands at 7 total agent turns (opener +
 *   2 Onboarding + 2 Reporting + 1 Mobile + close) and the opener
 *   often mentions topic names ("Onboarding, Reporting, mobile Nutzung").
 *   This trips two eval HEURISTICS without indicating a real failure:
 *   (a) the per-topic counter attributes the opener to Onboarding,
 *       making it look like Onboarding=3 even though the agent only
 *       asked 2 Onboarding questions in real terms; (b) the ≤6 ceiling
 *       check counts opener+close as 2 of the 6, leaving only 4 slots
 *       for real questions — too tight when all 3 topics get probed.
 *   Always READ the transcript before reading the WARN. Substance-wise
 *   the agent is correct: 2-2-1 per-topic distribution, all closings
 *   from the model, no Cap firings. Tighten the heuristic only if a
 *   future change actually breaks the agent's behavior.
 *
 * Drives the research interviewer through three scripted participant
 * personas and measures whether the new stop-ceiling + saturation rules
 * land. Specifically checks:
 *
 *   (1) closedByModel       — did the model emit `done: true` BY ITSELF,
 *                             or did the eval's own safety cap fire
 *                             (the latter being the production-side
 *                             forceCapClose failure mode)?
 *   (2) agentQuestionCount  — total agent questions asked at close.
 *                             Target ≤ 6 per the new ABSOLUTE STOP
 *                             CEILING; the safety-net hardcap in
 *                             session-service is at ~8.
 *   (3) maxPerTopic         — never 3+ agent questions on the same
 *                             plan topic (matches the new SATURATION
 *                             rule's last bullet).
 *   (4) topicCoverage       — substantial case only: every plan topic
 *                             touched at least once.
 *
 * Participant simulator is SCRIPTED, not LLM-driven — we want the AGENT
 * model to be the only variable. Each persona has canned text that
 * exhibits its behaviour regardless of what the agent asks; for the
 * substantial persona, a tiny topic-keyword matcher picks the right
 * concrete answer when the agent's question mentions a known topic.
 *
 * Default model: Sonnet (cheap for measurement). Override with
 *   EVAL_MODEL=claude-opus-4-7 pnpm eval:research-saturation
 * for Opus acceptance runs. Mirrors the env-var convention used by
 * evals-churn-severity and evals-product-discovery.
 *
 * Invoke from the repo root:
 *   env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server \
 *     evals-research-saturation/run.ts
 */

import { config as loadEnv } from "dotenv";

import type {
  InterviewLanguage,
  InterviewTurn,
  ResearchInput,
} from "@/lib/voice-agent/interviewer";

// ── safety net for the eval loop itself ────────────────────────────────────
// 10 agent questions = ~20 total turns, comfortably past the production
// hardcap (16). If the agent reaches this without saying done=true, that's
// a clean failure signal: in prod the safety net would have fired earlier.
const EVAL_AGENT_QUESTION_CAP = 10;

/** New ABSOLUTE STOP CEILING from the system prompt — 5 wind-down, 6 done. */
const TARGET_CEILING = 6;

/** No drilling past 2 agent questions on the same topic (new SATURATION
 *  rule's last bullet). */
const MAX_PER_TOPIC = 2;

// ── Plan (same across all 3 cases — only the participant varies) ────────────

const PLAN_TOPICS = [
  {
    topic: "Onboarding",
    intent:
      "Learn how new users get to first value: where they get stuck, what they actually do in their first hour with the product, who walks them through it.",
    hypotheses: ["First-day docs are stale", "No champion at customer side"],
    // Expanded to catch the agent's paraphrases for "new-user-first-touch":
    // case 3 round 1 missed because the agent said "neues Teammitglied … zum
    // ersten Mal ein SaaS-Tool öffnet" — literal "onboarding" / "neuer
    // Kollege" weren't in the message.
    keywords: [
      "onboarding",
      "einarbeit",
      "ersten tag",
      "ersten mal", // Genitiv / dative ("zum ersten Mal")
      "erste mal",  // Akkusativ ("das erste Mal mit dem Tool")
      "erstmal",
      "neuer kollege",
      "neuer mitarbeiter",
      "neue person",
      "jemand neues",
      "teammitglied",
      "tool öffnet",
      "übernommen hat",
      "anleitung",
    ],
  },
  {
    topic: "Reporting",
    intent:
      "How do they report up the chain today? Manual exports? Dashboards? What's the painful step?",
    hypotheses: ["Excel-based weekly", "No CFO-grade view"],
    keywords: ["reporting", "report", "dashboard", "excel", "zahlen", "cfo"],
  },
  {
    topic: "Mobile",
    intent:
      "Field / mobile usage — do they use the product away from a desk? What breaks?",
    hypotheses: ["No native app", "Browser view fails on phone"],
    keywords: ["mobile", "handy", "smartphone", "unterwegs", "app", "außendienst"],
  },
] as const;

const PLAN_INPUT: ResearchInput = {
  plan: {
    title: "B2B-SaaS Adoption Discovery",
    objective:
      "Understand how mid-market B2B-SaaS customers actually use the product day-to-day: where adoption stalls, what manual workarounds exist, and what would unlock the next wave.",
    topics: PLAN_TOPICS.map((t) => ({
      topic: t.topic,
      intent: t.intent,
      hypotheses: [...t.hypotheses],
    })),
    persona: "VP Sales / Head of RevOps at mid-market B2B-SaaS",
  },
  brand: null,
};

// ── Participant simulator ──────────────────────────────────────────────────

type Persona = "eloquent_empty" | "terse_absence" | "substantial";

const ELOQUENT_EMPTY_RESPONSES = [
  "Mmh, gute Frage. Also wir machen das eigentlich so wie alle anderen auch, würde ich sagen. Mal so, mal so. Es kommt natürlich immer drauf an, in welcher Phase wir gerade sind. Manchmal läuft's, manchmal weniger. Schwer zu sagen wirklich.",
  "Hmm, das ist tricky. Im Grunde haben wir das schon, aber eben nicht so dass ich's jetzt ganz konkret beschreiben könnte. Es variiert von Tag zu Tag, von Projekt zu Projekt. Manchmal mehr, manchmal weniger relevant für uns.",
  "Ja, so unterschiedlich. Mal gut, mal schlecht. Da gibt's keine klare Linie. Wir handhaben das eher pragmatisch — was halt gerade passt. Ich könnte da jetzt keine generelle Aussage zu treffen.",
  "Schwer zu beantworten ehrlich gesagt. Ich glaube es kommt halt drauf an. Manche Themen sind klarer, andere weniger. Bei uns variiert das ziemlich. Mal hat man da ein Gefühl für, mal nicht.",
  "Doch doch, da haben wir schon einiges. Aber so im Detail ist das schwer zusammenzufassen. Es ist halt so eine Mischung aus verschiedenen Dingen, die zusammenkommen. Schwer auf einen Nenner zu bringen.",
  "Also ich würde sagen das ist so ein Thema wo's halt drauf ankommt. Verschiedene Leute, verschiedene Sichtweisen. Bei uns im Team auch — der eine sieht's so, der andere anders.",
];

const TERSE_ABSENCE_RESPONSES = [
  "Kann ich ehrlich nicht sagen.",
  "Da hab ich keine konkrete Erfahrung.",
  "Alles gut bei uns, eigentlich.",
  "Nichts Konkretes dazu.",
  "War fine.",
  "Hatten wir nicht.",
  "Weiß ich nicht.",
];

const SUBSTANTIAL_OPENER =
  "Ja gerne, danke für die Zeit. Ich bin Vertriebsleiter bei einem mittelständischen B2B-SaaS, betreuen ca. 200 Kunden im DACH-Raum.";

const SUBSTANTIAL_TOPIC_ANSWERS: Record<string, string[]> = {
  Onboarding: [
    "Letzten Monat hatten wir genau das. Der neue Vertriebs-Kollege hat 3 Wochen gebraucht bis er sich zurechtfand. Die Anleitung war an mehreren Stellen veraltet — Screenshots zeigten Buttons, die's nicht mehr gibt. Ich musste ihm jeden Tag eine Stunde lang Sachen einzeln zeigen.",
    "Und das hat uns konkret Geld gekostet: er hätte in der Zeit zwei Kunden onboarden können, hat aber zwei davon verschoben weil er noch nicht sicher war wie er die Reports korrekt aufsetzt.",
  ],
  Reporting: [
    "Mein CFO bekommt jede Woche manuell zusammengestellte Reports von mir. 4 Stunden Excel-Frickelei jeden Montagmorgen. Wäre wirklich Gold wert wenn das automatisch ginge mit den Zahlen die ihm wichtig sind: ARR, Pipeline-Geschwindigkeit, Win-Rate pro Segment.",
    "Im letzten Quartal hat uns das eine Board-Diskussion gekostet weil ich Pipeline-Zahlen verspätet rausgegeben hab — am Dienstag statt Montag. Der CFO hat im Meeting nachgefragt und ich konnte nicht souverän antworten.",
  ],
  Mobile: [
    "Mein Außendienst will das auf dem Handy nutzen aber der Browser-View ist eine Katastrophe. Schriften winzig, Filter-Menü nicht erreichbar. Letzte Woche hat ein Kollege im Auto eine Kundennummer von Hand abgetippt — keiner macht das. Wir bräuchten eine echte App.",
    "Und Offline-Modus wäre auch wichtig. Funkloch im Industriegebiet beim Kundentermin, dann sind die Notizen weg. Letzten Monat zweimal passiert.",
  ],
};

const SUBSTANTIAL_FALLBACK =
  "Hm, lass mich überlegen — dazu hab ich konkret nicht so viel zu erzählen.";

function findMatchedTopic(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of PLAN_TOPICS) {
    if (t.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return t.topic;
    }
  }
  return null;
}

interface ParticipantState {
  persona: Persona;
  /** Round-robin index for eloquent_empty / terse_absence response cycling. */
  rotation: number;
  /** Per-topic answer index for substantial — picks the first answer the first
   *  time a topic is touched, the second on the follow-up, then falls back. */
  topicAnswerIndex: Record<string, number>;
  /** True once the substantial persona has emitted its opener. */
  openerEmitted: boolean;
}

function simulateParticipant(
  state: ParticipantState,
  agentMessage: string,
): string {
  if (state.persona === "eloquent_empty") {
    const text =
      ELOQUENT_EMPTY_RESPONSES[
        state.rotation % ELOQUENT_EMPTY_RESPONSES.length
      ];
    state.rotation += 1;
    return text;
  }
  if (state.persona === "terse_absence") {
    const text =
      TERSE_ABSENCE_RESPONSES[
        state.rotation % TERSE_ABSENCE_RESPONSES.length
      ];
    state.rotation += 1;
    return text;
  }
  // substantial
  if (!state.openerEmitted) {
    state.openerEmitted = true;
    return SUBSTANTIAL_OPENER;
  }
  const topic = findMatchedTopic(agentMessage);
  if (topic && SUBSTANTIAL_TOPIC_ANSWERS[topic]) {
    const idx = state.topicAnswerIndex[topic] ?? 0;
    const answers = SUBSTANTIAL_TOPIC_ANSWERS[topic];
    state.topicAnswerIndex[topic] = idx + 1;
    return answers[Math.min(idx, answers.length - 1)];
  }
  return SUBSTANTIAL_FALLBACK;
}

// ── eval loop ──────────────────────────────────────────────────────────────

interface CaseResult {
  caseId: string;
  agentQuestionCount: number;
  closedByModel: boolean;
  perTopic: Record<string, number>;
  uncategorizedAgentQuestions: number;
  totalTurns: number;
  history: InterviewTurn[];
  /** E3 — wie viele Agent-Turns eine WHY-Rationale trugen (Präsenz-Messung;
   *  fail-open heißt: fehlt sie, gibt es keinen Fehler, aber auch keinen
   *  Wert — genau das muss sichtbar sein). */
  whyCount: number;
  /** E3 — Teilnehmer-NACHRICHTEN, die ein "why:"-Muster enthalten. Muss 0
   *  sein: das wäre ein Leak der Interviewer-Interna (harte Assertion). */
  whyLeaks: number;
}

async function runCase(
  caseId: string,
  language: InterviewLanguage,
  persona: Persona,
  model: string,
): Promise<CaseResult> {
  const { nextResearchMessage } = await import("@/lib/voice-agent/interviewer");

  const history: InterviewTurn[] = [];
  const state: ParticipantState = {
    persona,
    rotation: 0,
    topicAnswerIndex: {},
    openerEmitted: false,
  };
  const perTopic: Record<string, number> = {};
  let uncategorized = 0;
  let closedByModel = false;
  let whyCount = 0;
  let whyLeaks = 0;

  // First iteration produces the agent's OPENING message (history is empty).
  // The simulator then replies and the loop continues until done or cap.
  while (
    history.filter((t) => t.role === "agent").length < EVAL_AGENT_QUESTION_CAP
  ) {
    const { done, message, why } = await nextResearchMessage(
      PLAN_INPUT,
      history,
      language,
      model,
    );
    // E3 — Rationale-Telemetrie + Leak-Assertion: `message` ist exakt der
    // Text, den ein Teilnehmer sähe; ein "why:"-Muster darin wäre ein Leak
    // der Interna (Parser-Härtung umgangen) und macht den Case hart rot.
    if (why !== null) whyCount += 1;
    if (/why\s*:/i.test(message)) whyLeaks += 1;
    history.push(
      why !== null
        ? { role: "agent", text: message, why }
        : { role: "agent", text: message },
    );

    // Tag this agent turn against a plan topic (best-effort heuristic).
    // Opening + closing messages typically won't match any topic — that's
    // fine, they get bucketed under uncategorized and don't count toward
    // the "max 2 per topic" rule.
    const topic = findMatchedTopic(message);
    if (topic) {
      perTopic[topic] = (perTopic[topic] ?? 0) + 1;
    } else {
      uncategorized += 1;
    }

    if (done) {
      closedByModel = true;
      break;
    }
    history.push({ role: "customer", text: simulateParticipant(state, message) });
  }

  return {
    caseId,
    agentQuestionCount: history.filter((t) => t.role === "agent").length,
    closedByModel,
    perTopic,
    uncategorizedAgentQuestions: uncategorized,
    totalTurns: history.length,
    history,
    whyCount,
    whyLeaks,
  };
}

// ── checks (heuristic, manual-read primary) ────────────────────────────────

interface Check {
  ok: boolean;
  note: string;
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

function checkClosedByModel(r: CaseResult): Check {
  return r.closedByModel
    ? { ok: true, note: "model emitted done=true" }
    : {
        ok: false,
        note: `eval safety cap fired at ${EVAL_AGENT_QUESTION_CAP} agent questions — production hardcap would have closed this too`,
      };
}

function checkAgentQuestionCount(r: CaseResult): Check {
  if (r.agentQuestionCount <= TARGET_CEILING) {
    return {
      ok: true,
      note: `${r.agentQuestionCount} ≤ ${TARGET_CEILING} (ceiling)`,
    };
  }
  return {
    ok: false,
    note: `${r.agentQuestionCount} > ${TARGET_CEILING} — overshot the ceiling`,
  };
}

function checkMaxPerTopic(r: CaseResult): Check {
  const offenders = Object.entries(r.perTopic).filter(
    ([, n]) => n > MAX_PER_TOPIC,
  );
  if (offenders.length === 0) {
    return {
      ok: true,
      note: `no topic > ${MAX_PER_TOPIC} agent questions`,
    };
  }
  return {
    ok: false,
    note: `${offenders
      .map(([t, n]) => `${t}=${n}`)
      .join(", ")} exceeded ${MAX_PER_TOPIC}`,
  };
}

function checkTopicCoverage(r: CaseResult): Check {
  const covered = Object.keys(r.perTopic);
  const missing = PLAN_TOPICS.map((t) => t.topic).filter(
    (t) => !covered.includes(t),
  );
  if (missing.length === 0) {
    return { ok: true, note: "all 3 topics touched" };
  }
  return {
    ok: false,
    note: `missing: ${missing.join(", ")}`,
  };
}

/** E3 — Präsenz der WHY-Rationale. Fail-open macht fehlende Zeilen lautlos;
 *  unter 80 % Abdeckung ist das Feature praktisch löchrig → WARN (Prompt
 *  nachschärfen), kein Hard-Fail (eine einzelne Auslassung ist Modell-Varianz). */
function checkWhyCoverage(r: CaseResult): Check {
  const rate =
    r.agentQuestionCount === 0 ? 0 : r.whyCount / r.agentQuestionCount;
  const note = `${r.whyCount}/${r.agentQuestionCount} agent turns carried a rationale`;
  return rate >= 0.8 ? { ok: true, note } : { ok: false, note };
}

/** E3 — Leak-Assertion: KEINE Teilnehmer-Nachricht darf ein "why:"-Muster
 *  tragen (Interna). Hartes Kriterium — ein Leak ist nie akzeptabel. */
function checkNoWhyLeak(r: CaseResult): Check {
  return r.whyLeaks === 0
    ? { ok: true, note: "no participant-visible message contains a why: pattern" }
    : { ok: false, note: `${r.whyLeaks} message(s) leaked a why: pattern` };
}

// ── printing ───────────────────────────────────────────────────────────────

function printCase(
  caseId: string,
  description: string,
  expectsCoverage: boolean,
  result: CaseResult,
): { allPass: boolean } {
  console.log("\n" + "=".repeat(78));
  console.log(`${caseId} — ${description}`);
  console.log("-".repeat(78));

  // Conversation transcript (truncated to keep output readable).
  result.history.forEach((turn, i) => {
    const prefix = turn.role === "agent" ? "AGENT" : "PART ";
    const head = turn.text.replace(/\s+/g, " ").trim();
    const preview = head.length > 200 ? head.slice(0, 200) + " …" : head;
    console.log(`  ${String(i + 1).padStart(2, " ")}. ${prefix}: ${preview}`);
    // E3 — die (nur Forschern sichtbare) Rationale unter dem Agent-Turn, fürs
    // manuelle Lesen: trägt sie Substanz (Thema/Vertiefung), nicht Floskeln?
    if (turn.role === "agent" && turn.why) {
      const whyHead = turn.why.replace(/\s+/g, " ").trim();
      console.log(
        `        ↳ why: ${whyHead.length > 160 ? whyHead.slice(0, 160) + " …" : whyHead}`,
      );
    }
  });

  // Per-topic tally.
  console.log("");
  console.log(`  agentQuestionCount:    ${result.agentQuestionCount}`);
  console.log(`  totalTurns:            ${result.totalTurns}`);
  console.log(`  uncategorized agent Q: ${result.uncategorizedAgentQuestions}`);
  console.log(`  per-topic agent Q:     ${
    Object.entries(result.perTopic)
      .map(([t, n]) => `${t}=${n}`)
      .join(", ") || "(none matched)"
  }`);

  // Checks.
  const checks: Array<[string, Check]> = [
    ["closed-by-model    ", checkClosedByModel(result)],
    ["≤ ceiling (6)      ", checkAgentQuestionCount(result)],
    ["no 3+ per topic    ", checkMaxPerTopic(result)],
    ["WHY coverage ≥80%  ", checkWhyCoverage(result)],
    ["no WHY leak        ", checkNoWhyLeak(result)],
  ];
  if (expectsCoverage) {
    checks.push(["all topics covered ", checkTopicCoverage(result)]);
  }

  console.log("");
  let allPass = true;
  for (const [name, check] of checks) {
    console.log(`  ${name}: ${flag(check)}`);
    if (!check.ok) allPass = false;
  }
  console.log(`  ${"verdict".padEnd(19)}: ${allPass ? "✓ PASS" : "✗ WARN"}`);

  return { allPass };
}

// ── main ───────────────────────────────────────────────────────────────────

interface CaseSpec {
  id: string;
  description: string;
  language: InterviewLanguage;
  persona: Persona;
  expectsCoverage: boolean;
}

const CASES: CaseSpec[] = [
  {
    id: "rs_eloquent_01",
    description:
      "Eloquent participant — verbose but no new substance per turn. MUST close by saturation, not by hardcap.",
    language: "de",
    persona: "eloquent_empty",
    expectsCoverage: false,
  },
  {
    id: "rs_terse_02",
    description:
      "Terse participant — absence signals only. Should close early, treat each topic as PROBED-NO-SIGNAL after one reply.",
    language: "de",
    persona: "terse_absence",
    expectsCoverage: false,
  },
  {
    id: "rs_substantial_03",
    description:
      "Substantial participant — one concrete story per topic. Should cover all topics and close around the ceiling.",
    language: "de",
    persona: "substantial",
    expectsCoverage: true,
  },
];

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Run with: env -u ANTHROPIC_API_KEY ...",
    );
  }

  // Default to Sonnet for cost; override with EVAL_MODEL for an Opus
  // acceptance run. NOTE: do NOT use VOICE_MODEL — that's the prod default
  // for the interview path, and we want the eval to be insulated from it.
  const model = process.env.EVAL_MODEL ?? "claude-sonnet-4-6";

  console.log(`\nResearch-Saturation Eval — model: ${model}`);
  console.log(
    `${CASES.length} cases · eval safety cap = ${EVAL_AGENT_QUESTION_CAP} agent questions · target ceiling = ${TARGET_CEILING}\n`,
  );

  let pass = 0;
  let warn = 0;

  for (const spec of CASES) {
    try {
      const result = await runCase(
        spec.id,
        spec.language,
        spec.persona,
        model,
      );
      const { allPass } = printCase(
        spec.id,
        spec.description,
        spec.expectsCoverage,
        result,
      );
      if (allPass) pass += 1;
      else warn += 1;
    } catch (err) {
      warn += 1;
      console.log("\n" + "=".repeat(78));
      console.log(`${spec.id} — ${spec.description}`);
      console.log(
        `  ERROR: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (${CASES.length} cases, model: ${model})`);
  console.log(`  pass: ${pass}`);
  console.log(`  warn: ${warn}`);
  console.log(
    `\nHeuristics only — the real evaluation is reading the conversation transcripts above.\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
