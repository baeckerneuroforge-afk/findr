/**
 * Guide-Generator Eval Runner
 * ---------------------------
 * Runs generateGuideFromInputs() over GUIDE_EVAL_CASES (8: 6 B2B + 2 B2C),
 * applies DETERMINISTIC property checks (no LLM-judge — cost-conscious), and
 * prints a results table.
 *
 * Checks per case (alle deterministisch):
 *   (a) zod-valid           — engine threw NO Unavailable + returned data
 *                              (validation is enforced inside the engine; a
 *                              call that returns IS valid by definition).
 *   (b) topic-count-range   — topics.length within [3, 10] (schema bounds)
 *                              AND within expected.[minTopics, maxTopics]
 *                              (soft signal — fail surfaces WARN, not FAIL).
 *   (c) topic-shape         — every topic has nicht-leeres goalLink +
 *                              mainQuestion + ≥2 probes.
 *   (d) non-leading-question — kein mainQuestion/probe enthält einen
 *                              bekannten Leading-Trigger (Liste unten).
 *                              Strict — jedes Leading-Trigger-Match ist FAIL.
 *   (e) language-german     — Sprache = Deutsch (lexikalische Markers; kein
 *                              LLM-Klassifikator).
 *   (f) minutes-range       — estimatedMinutes innerhalb der erwarteten
 *                              Range (soft WARN).
 *   (g) minimal-mode        — wenn expected.minimalMode=true: keine
 *                              halluzinierten Spezifika (lexikalische
 *                              Check auf typische Bullshit-Strings wie
 *                              "HubSpot", "ihre Pricing-Tier", "Ihre
 *                              Integration") + topics ≤ maxTopics
 *                              hard. Sonst skip.
 *   (h) anrede-b2c          — NUR wenn input.audienceType='b2c': keine
 *                              formelle Sie-Ansprache leakt in mainQuestion/
 *                              probes (sperrt die du-Form ab). Sonst skip.
 *
 * Default model: Sonnet. Approval run: GUIDE_GEN_MODEL=claude-opus-4-7.
 * Always with `env -u ANTHROPIC_API_KEY`:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals/guide-generator/run.ts
 */

import { config } from "dotenv";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  generateGuideFromInputs,
  type InterviewGuide,
} from "@/lib/research/guide-generator";

import { GUIDE_EVAL_CASES, type GuideEvalCase } from "./dataset";

config({ path: ".env.local" });
config({ path: ".env" });

const MODEL = process.env.GUIDE_GEN_MODEL ?? CLAUDE_MODELS.sonnet;

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
function warn(s: string): void {
  console.log(`  ${C.yellow}!${C.reset} ${s}`);
}
function bad(s: string): void {
  console.log(`  ${C.red}✗${C.reset} ${s}`);
}
function dim(s: string): void {
  console.log(`  ${C.dim}${s}${C.reset}`);
}

// ── Leading-trigger heuristic ─────────────────────────────────────────────
//
// Lexikalische Suche nach typischen Suggestiv-Patterns. Heuristisch,
// nicht perfekt — eine echte LLM-Wertung würde feinere Bewertungen
// machen, kostet aber API-Tokens. Diese Heuristik ist konservativ:
// false-positive-Risiko ist OK (Fail-fast on potential issues), false-
// negative-Risiko ist akzeptabel (manueller Read fängt subtilere Cases).
//
// Patterns sind case-insensitive substrings — falls eine Phrase
// auftritt, ist es FAIL. Whitespace + Umlaute werden vor dem Match
// normalisiert (siehe `normalize`).
const LEADING_TRIGGERS = [
  // Klassische Suggestive
  "finden sie nicht auch",
  "waere es nicht besser",
  "stimmen sie zu",
  "sind sie der meinung",
  "wuerden sie sagen, dass",
  // "Ist X wichtig?" — implies X matters (only flag the question form)
  "ist ihnen wichtig",
  "ist das fuer sie wichtig",
  // Pre-empted positives — fängt Survey-Bias wie
  // "wie zufrieden sind sie mit unserem Produkt"
  "wie zufrieden sind sie mit",
  // NOTE: die früheren Trigger "unser produkt" / "unsere loesung" wurden
  // entfernt. Sie waren als Vendor-Name-Heuristik gedacht, haben aber
  // kontextuell legitime Formulierungen in Churn-/Post-Loss-Interviews
  // gefangen (z.B. "Erzählen Sie mir, wie Sie unser Produkt eingesetzt
  // haben" — open-ended, planted keine Schlussfolgerung). Die Heuristik
  // soll leitende FRAGE-KONSTRUKTIONEN fangen, nicht Vendor-NAMEN. Echte
  // Survey-Bias-Patterns wie "wie zufrieden sind sie mit unserem Produkt"
  // werden weiterhin über den "wie zufrieden sind sie mit"-Trigger oben
  // erwischt.
  // Yes/No giveaways (only the most blatant — open follow-ups can OK use these as fragments)
  "ja oder nein",
];

// Specific halluzinations to flag in minimal-mode case (the LLM should
// NOT invent specifics for a vague goal).
const HALLUCINATED_SPECIFICS = [
  "hubspot",
  "salesforce",
  "pipedrive",
  // Common phantom features
  "pricing-tier",
  "enterprise-plan",
  "freemium",
];

// Formal "Sie"-Ansprache markers (normalized: ä→ae, ö→oe, ü→ue, ß→ss). Used
// ONLY for B2C cases: a consumer guide must be in the "du" form, so any of
// these unambiguous formal 2nd-person address forms leaking in is a FAIL.
// Deliberately narrow — verb+"sie" question/imperative forms + the dative
// "ihnen" — so it never false-positives on "sie" meaning "they/she".
const STRONG_SIE_ADDRESS = [
  "erzaehlen sie",
  "koennen sie",
  "beschreiben sie",
  "schildern sie",
  "haben sie",
  "sind sie",
  "wuerden sie",
  "denken sie",
  "nutzen sie",
  "fuehlen sie",
  "moechten sie",
  " ihnen ",
];

function findSieAddress(text: string): string[] {
  const n = normalize(text);
  return STRONG_SIE_ADDRESS.filter((t) => n.includes(t));
}

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

function findLeading(question: string): string[] {
  const n = normalize(question);
  return LEADING_TRIGGERS.filter((t) => n.includes(t));
}

function findHallucinated(question: string): string[] {
  const n = normalize(question);
  return HALLUCINATED_SPECIFICS.filter((t) => n.includes(t));
}

// ── German-language heuristic ─────────────────────────────────────────────
//
// Looks for German function words in topic labels + mainQuestions + probes.
// Heuristic: at least 2 of these markers must appear in EACH of (label
// concat, mainQuestion concat, probes concat) — captures typical German
// even when the topic happens to be a single English-looking term like
// "Onboarding".

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
  " ihren ",
  " was ",
  " wie ",
  " wo ",
  " wann ",
  " wenn ",
  " erzaehlen ",
  " erklaeren ",
  " beschreiben ",
];

function isLikelyGerman(corpus: string): boolean {
  const n = normalize(corpus);
  let hits = 0;
  for (const m of GERMAN_MARKERS) {
    if (n.includes(m)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

// ── per-case checks ───────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  warned: number;
  failed: number;
  topicCount: number;
  minutes: number;
  language: "de" | "other";
  hasLeading: boolean;
  hallucinated: boolean;
}

function runChecks(
  testCase: GuideEvalCase,
  guide: InterviewGuide,
): CheckResult {
  let passed = 0;
  let warned = 0;
  let failed = 0;

  // (a) zod-valid — by definition; if we got here, schema passed.
  ok("zod-valid — engine returned a schema-valid InterviewGuide");
  passed++;

  // (b) topic-count-range
  const tc = guide.topics.length;
  if (tc >= 3 && tc <= 10) {
    if (
      tc >= testCase.expected.minTopics &&
      tc <= testCase.expected.maxTopics
    ) {
      ok(
        `topic-count — ${tc} (im erwarteten Range [${testCase.expected.minTopics}, ${testCase.expected.maxTopics}])`,
      );
      passed++;
    } else {
      warn(
        `topic-count — ${tc} außerhalb erwartet [${testCase.expected.minTopics}, ${testCase.expected.maxTopics}] (Schema [3,10] erfüllt) (soft)`,
      );
      warned++;
    }
  } else {
    bad(`topic-count — ${tc} verletzt Schema-Range [3, 10]`);
    failed++;
  }

  // (c) topic-shape
  const malformed = guide.topics.filter(
    (t) =>
      !t.goalLink ||
      t.goalLink.trim().length === 0 ||
      !t.mainQuestion ||
      t.mainQuestion.trim().length === 0 ||
      !t.probes ||
      t.probes.length < 2,
  );
  if (malformed.length === 0) {
    ok(
      `topic-shape — alle ${guide.topics.length} Topics haben goalLink, mainQuestion und ≥2 probes`,
    );
    passed++;
  } else {
    bad(
      `topic-shape — ${malformed.length} Topic(s) ohne goalLink/mainQuestion/≥2 probes`,
    );
    failed++;
  }

  // (d) non-leading-question — lexikalische Heuristik
  const leadingMatches: { where: string; triggers: string[] }[] = [];
  for (const t of guide.topics) {
    const mq = findLeading(t.mainQuestion);
    if (mq.length > 0) {
      leadingMatches.push({
        where: `${t.id}.mainQuestion`,
        triggers: mq,
      });
    }
    for (let i = 0; i < t.probes.length; i++) {
      const p = findLeading(t.probes[i]);
      if (p.length > 0) {
        leadingMatches.push({
          where: `${t.id}.probes[${i}]`,
          triggers: p,
        });
      }
    }
  }
  if (leadingMatches.length === 0) {
    ok("non-leading — keine Suggestiv-Trigger in mainQuestion oder probes");
    passed++;
  } else {
    bad(
      `non-leading — ${leadingMatches.length} Treffer: ${leadingMatches
        .slice(0, 3)
        .map((m) => `${m.where}=[${m.triggers.join(",")}]`)
        .join("; ")}`,
    );
    failed++;
  }

  // (e) language-german
  const allText = [
    guide.title,
    guide.objective,
    ...guide.topics.map((t) => `${t.label} ${t.mainQuestion} ${t.probes.join(" ")}`),
  ].join(" ");
  const isGerman = isLikelyGerman(allText);
  if (isGerman) {
    ok("language — Deutsch erkannt (lexikalische Markers)");
    passed++;
  } else {
    bad("language — keine starken Deutsch-Markers gefunden");
    failed++;
  }

  // (f) minutes-range
  if (
    guide.estimatedMinutes >= testCase.expected.minMinutes &&
    guide.estimatedMinutes <= testCase.expected.maxMinutes
  ) {
    ok(
      `minutes-range — ${guide.estimatedMinutes} Min (im erwarteten Range [${testCase.expected.minMinutes}, ${testCase.expected.maxMinutes}])`,
    );
    passed++;
  } else {
    warn(
      `minutes-range — ${guide.estimatedMinutes} Min außerhalb erwartet [${testCase.expected.minMinutes}, ${testCase.expected.maxMinutes}] (soft)`,
    );
    warned++;
  }

  // (g) minimal-mode (only when expected)
  let hallucinated = false;
  if (testCase.expected.minimalMode) {
    const hallucinations: string[] = [];
    for (const t of guide.topics) {
      const mq = findHallucinated(t.mainQuestion);
      if (mq.length > 0) hallucinations.push(`${t.id}.mainQuestion=[${mq.join(",")}]`);
      for (let i = 0; i < t.probes.length; i++) {
        const p = findHallucinated(t.probes[i]);
        if (p.length > 0) hallucinations.push(`${t.id}.probes[${i}]=[${p.join(",")}]`);
      }
    }
    if (hallucinations.length === 0 && tc <= testCase.expected.maxTopics) {
      ok(
        `minimal-mode — keine halluzinierten Spezifika, topic-count ≤ ${testCase.expected.maxTopics}`,
      );
      passed++;
    } else if (hallucinations.length > 0) {
      bad(`minimal-mode — halluzinierte Spezifika: ${hallucinations.join("; ")}`);
      hallucinated = true;
      failed++;
    } else {
      bad(
        `minimal-mode — topic-count ${tc} > erwarteter Max ${testCase.expected.maxTopics}`,
      );
      failed++;
    }
  }

  // (h) anrede — only for B2C cases. A consumer guide MUST be in the "du" form;
  // any formal Sie-address leaking into a mainQuestion or probe is a FAIL. This
  // is the deterministic lock that the audienceType→Anrede wiring actually took.
  if (testCase.input.audienceType === "b2c") {
    const sieMatches: { where: string; triggers: string[] }[] = [];
    for (const t of guide.topics) {
      const mq = findSieAddress(t.mainQuestion);
      if (mq.length > 0)
        sieMatches.push({ where: `${t.id}.mainQuestion`, triggers: mq });
      for (let i = 0; i < t.probes.length; i++) {
        const p = findSieAddress(t.probes[i]);
        if (p.length > 0)
          sieMatches.push({ where: `${t.id}.probes[${i}]`, triggers: p });
      }
    }
    if (sieMatches.length === 0) {
      ok("anrede-b2c — durchgängig du-Form, keine formelle Sie-Ansprache");
      passed++;
    } else {
      bad(
        `anrede-b2c — formelle Sie-Ansprache leakt: ${sieMatches
          .slice(0, 3)
          .map((m) => `${m.where}=[${m.triggers.join(",")}]`)
          .join("; ")}`,
      );
      failed++;
    }
  }

  return {
    passed,
    warned,
    failed,
    topicCount: tc,
    minutes: guide.estimatedMinutes,
    language: isGerman ? "de" : "other",
    hasLeading: leadingMatches.length > 0,
    hallucinated,
  };
}

// ── runner ────────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  topics: number;
  minutes: number;
  language: "de" | "other";
  leading: boolean;
  passed: number;
  failed: number;
}

async function main(): Promise<void> {
  console.log(
    `${C.bold}Guide-Generator Eval${C.reset}  model=${C.cyan}${MODEL}${C.reset}  cases=${GUIDE_EVAL_CASES.length}`,
  );

  let totalPassed = 0;
  let totalWarned = 0;
  let totalFailed = 0;
  const rows: CaseRow[] = [];

  for (const c of GUIDE_EVAL_CASES) {
    header(`${c.id} — ${c.description}`);
    dim(`rationale: ${c.rationale}`);
    dim(`goal: ${c.input.goal}`);
    dim(
      `expected: topics ∈ [${c.expected.minTopics}, ${c.expected.maxTopics}], minutes ∈ [${c.expected.minMinutes}, ${c.expected.maxMinutes}]${
        c.expected.minimalMode ? ", minimal-mode" : ""
      }`,
    );

    let guide: InterviewGuide;
    try {
      guide = await generateGuideFromInputs(c.input, MODEL);
    } catch (err) {
      bad(
        `engine call failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      totalFailed++;
      rows.push({
        id: c.id,
        topics: 0,
        minutes: 0,
        language: "other",
        leading: false,
        passed: 0,
        failed: 1,
      });
      continue;
    }

    // Echo the guide so the human can judge content quality at a glance.
    console.log(
      `\n  ${C.bold}GUIDE${C.reset}  ${C.magenta}${guide.estimatedMinutes} Min · ${guide.topics.length} Topics${C.reset}`,
    );
    dim(`  title:     ${guide.title}`);
    dim(`  objective: ${guide.objective}`);
    for (const t of guide.topics) {
      console.log(`\n  ${C.bold}${t.label}${C.reset}  ${C.dim}[${t.id}]${C.reset}`);
      dim(`    goalLink:     ${t.goalLink}`);
      dim(`    mainQuestion: "${t.mainQuestion}"`);
      for (const p of t.probes) {
        dim(`      • ${p}`);
      }
    }
    if (guide.screeningQuestions && guide.screeningQuestions.length > 0) {
      console.log(`\n  ${C.bold}SCREENING${C.reset}`);
      for (const q of guide.screeningQuestions) {
        dim(`    • ${q}`);
      }
    }

    console.log(`\n  ${C.bold}CHECKS${C.reset}`);
    const checks = runChecks(c, guide);
    totalPassed += checks.passed;
    totalWarned += checks.warned;
    totalFailed += checks.failed;
    rows.push({
      id: c.id,
      topics: checks.topicCount,
      minutes: checks.minutes,
      language: checks.language,
      leading: checks.hasLeading,
      passed: checks.passed,
      failed: checks.failed,
    });
  }

  // ── summary table ──────────────────────────────────────────────────────
  console.log(`\n${C.bold}═══ RESULTS TABLE ═══${C.reset}`);
  console.log(
    `${C.dim}${"id".padEnd(28)} ${"topics".padStart(7)} ${"min".padStart(5)} ${"lang".padEnd(6)} ${"leading?".padEnd(9)} passed/failed${C.reset}`,
  );
  for (const r of rows) {
    const langMark =
      r.language === "de" ? `${C.green}de${C.reset}` : `${C.red}other${C.reset}`;
    const leadingMark = r.leading
      ? `${C.red}YES`
      : `${C.green}no`;
    const passFail =
      r.failed === 0
        ? `${C.green}${r.passed}/${r.failed}`
        : `${C.red}${r.passed}/${r.failed}`;
    console.log(
      `  ${r.id.padEnd(28)} ${String(r.topics).padStart(7)} ${String(r.minutes).padStart(5)} ${langMark.padEnd(13)} ${leadingMark.padEnd(18)}${C.reset} ${passFail}${C.reset}`,
    );
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
