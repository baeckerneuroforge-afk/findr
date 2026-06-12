/**
 * Multi-Stimulus Eval Runner (E4-Abnahme)
 * ───────────────────────────────────────
 *
 * Treibt den Research-Interviewer durch ein Creative-Test-Interview mit
 * einem 3-Element-Stimulus-Set und misst, ob die E4-REGIE im echten
 * Modellverhalten ankommt (die Unit-Tests beweisen nur die Mechanik):
 *
 *   (1) allShownInOrder   — wurden ALLE Stimuli gezeigt, Erst-Reveals strikt
 *                           in Reihenfolge 1→2→3? (Kernversprechen)
 *   (2) showSentNotSaid   — kein Agent-Turn kündigt einen WECHSEL an, ohne
 *                           im selben Turn den SHOW-Header zu senden
 *                           (Heuristik über Ankündigungs-Vokabular).
 *   (3) no SHOW/WHY leak  — "show:"/"why:"-Muster im Teilnehmer-Text = HART
 *                           ROT (Parser-Härtung umgangen).
 *   (4) preferenceAsked   — nach dem letzten Reveal genau eine explizite
 *                           Präferenzfrage (E7-Datenbasis).
 *   (5) ceiling           — Modell schließt selbst, ≤ 12 Agent-Fragen
 *                           (D8: min(2 + 3×3 + 1, 14) = 12).
 *   (6) noUnshownSpoiler  — kein Stimulus-Label fällt im Agent-Text, bevor
 *                           der Stimulus gezeigt wurde.
 *
 * Teilnehmer-Simulator ist GESCRIPTET (wie evals-research-saturation): er
 * reagiert auf den AKTUELL GEZEIGTEN Stimulus (den der Eval-Loop aus den
 * SHOW-Werten der Engine selbst verfolgt — exakt die E5-Client-Logik) und
 * beantwortet die Präferenzfrage mit einer klaren Wahl.
 *
 * Default model: Sonnet (cheap). Opus-Abnahme:
 *   EVAL_MODEL=claude-opus-4-7 pnpm eval:multi-stimulus
 *
 * Invoke from the repo root:
 *   env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server \
 *     evals-multi-stimulus/run.ts
 */

import { config as loadEnv } from "dotenv";

import type {
  InterviewTurn,
  ResearchInput,
  ResearchStimulusContext,
} from "@/lib/voice-agent/interviewer";

// Eval-Schleifen-Sicherheitsnetz: deutlich über dem D8-Ceiling (12), unter
// jeder Endlosschleife.
const EVAL_AGENT_QUESTION_CAP = 16;

/** D8 für N=3: min(2 + 3×3 + 1, 14). */
const TARGET_CEILING = 12;

// ── Plan mit 3-Element-Set ──────────────────────────────────────────────────

const STIMULI: ResearchStimulusContext[] = [
  {
    position: 1,
    type: "image",
    url: "https://storage.example/variante-a.png",
    label: "Variante A",
    description: "Plakatmotiv mit blauer Farbwelt und großer Produktabbildung.",
    analysis:
      "Layout/Aufbau: Zentriertes Produktbild, Headline oben. Farbwelt: Blau-dominant, hoher Kontrast. Claim: „Einfach starten“.",
  },
  {
    position: 2,
    type: "image",
    url: "https://storage.example/variante-b.png",
    label: "Variante B",
    description:
      "Plakatmotiv mit Menschen im Mittelpunkt, Produkt nur klein im Eck.",
    analysis:
      "Layout/Aufbau: Lifestyle-Fotografie, Personen im Fokus. Farbwelt: Warm, erdig. Claim: „Für Teams, die machen“.",
  },
  {
    position: 3,
    type: "image",
    url: "https://storage.example/variante-c.png",
    label: "Variante C",
    description: "Rein typografisches Motiv ohne Bildelemente.",
    analysis:
      "Layout/Aufbau: Großtypografie auf einfarbigem Grund. Farbwelt: Schwarz/Gelb. Claim: „Weniger Tool. Mehr Arbeit, die zählt.“",
  },
];

const PLAN_INPUT: ResearchInput = {
  plan: {
    title: "Plakat-Kampagne Q3 — Creative-Test",
    objective:
      "Herausfinden, welche der drei Plakat-Varianten Botschaft und Marke am klarsten transportiert.",
    topics: [
      {
        topic: "Erster Eindruck",
        intent: "Spontane Reaktion und Blickführung je Variante verstehen.",
      },
      {
        topic: "Botschaftsklarheit",
        intent:
          "Kommt die Kernbotschaft an? Was verstehen Teilnehmer unter dem Claim?",
      },
    ],
    persona: "Marketing-affine B2B-Entscheider, 30–50",
    useCase: "creative_test",
    stimuli: STIMULI,
  },
  brand: null,
};

// ── Teilnehmer-Simulator (gescriptet, reagiert auf den gezeigten Stimulus) ──

const OPENER_REPLY =
  "Ja klar, gerne. Ich arbeite im Marketing eines Mittelständlers, bin also gespannt.";

const STIMULUS_REACTIONS: Record<number, string[]> = {
  1: [
    "Okay, das Blaue. Mir springt sofort das Produkt ins Auge, sehr aufgeräumt. Wirkt seriös, fast schon ein bisschen kühl. Die Headline les ich erst auf den zweiten Blick.",
    "Die Botschaft verstehe ich als: das Tool ist schnell eingerichtet. „Einfach starten“ — klar, aber auch austauschbar, das sagen viele.",
  ],
  2: [
    "Oh, ganz anderer Vibe. Die Menschen machen es sympathischer, wärmer. Aber ich musste das Produkt erstmal suchen — das kleine Logo im Eck hätte ich fast übersehen.",
    "Im Vergleich zum ersten wirkt das nahbarer, aber unklarer, WAS ihr eigentlich verkauft. Beim blauen wusste ich sofort, worum es geht.",
  ],
  3: [
    "Mutig! Nur Text, das fällt zwischen all den Bildplakaten sicher auf. Der Spruch hat Haltung — „Weniger Tool. Mehr Arbeit, die zählt“ bleibt hängen.",
    "Verstanden hab ich's sofort: ihr nehmt mir Verwaltungskram ab. Das ist die klarste Botschaft von den dreien, finde ich.",
  ],
};

const PREFERENCE_REPLY =
  "Wenn ich wählen müsste: Variante C. Der Spruch bleibt hängen und ich verstehe sofort den Nutzen — bei A ist es austauschbar und bei B such ich das Produkt. Den Ausschlag gibt die Klarheit.";

const FALLBACK_REPLY =
  "Hm, da fällt mir gerade nicht mehr zu ein als das, was ich schon gesagt habe.";

const PREFERENCE_PATTERN =
  /bevorzug|präferenz|präferier|favorit|am (?:besten|meisten|ehesten)|welche.*(?:variante|motiv|plakat).*(?:wähl|entscheid|überzeugt|gefällt)|entscheiden müsst|wählen müsst|ausschlag/i;

interface ParticipantState {
  openerDone: boolean;
  reactionIndex: Record<number, number>;
  preferenceAnswered: boolean;
}

function simulateParticipant(
  state: ParticipantState,
  agentMessage: string,
  currentlyShown: number | null,
): string {
  if (!state.openerDone) {
    state.openerDone = true;
    return OPENER_REPLY;
  }
  if (!state.preferenceAnswered && PREFERENCE_PATTERN.test(agentMessage)) {
    state.preferenceAnswered = true;
    return PREFERENCE_REPLY;
  }
  if (currentlyShown !== null && STIMULUS_REACTIONS[currentlyShown]) {
    const idx = state.reactionIndex[currentlyShown] ?? 0;
    state.reactionIndex[currentlyShown] = idx + 1;
    const answers = STIMULUS_REACTIONS[currentlyShown];
    return answers[Math.min(idx, answers.length - 1)];
  }
  return FALLBACK_REPLY;
}

// ── eval loop ────────────────────────────────────────────────────────────────

interface CaseResult {
  agentQuestionCount: number;
  closedByModel: boolean;
  /** Erst-Reveal-Reihenfolge, z. B. [1, 2, 3]. Re-Shows (Vergleich) zählen
   *  hier nicht — die misst `allShows`. */
  firstReveals: number[];
  allShows: number[];
  whyLeaks: number;
  showLeaks: number;
  /** Agent-Turns, die einen Wechsel ANKÜNDIGEN, ohne SHOW zu senden. */
  announcedWithoutShow: number;
  /** Agent-Turns, die ein Label eines noch UNGEZEIGTEN Stimulus nennen. */
  unshownSpoilers: number;
  preferenceAsked: boolean;
  history: InterviewTurn[];
}

const ANNOUNCE_PATTERN =
  /nächste[sn]? (?:bild|motiv|plakat|variante)|zweite[sn]? (?:bild|motiv|variante)|dritte[sn]? (?:bild|motiv|variante)|schauen sie sich (?:jetzt|nun|bitte)|zeige ich ihnen (?:jetzt|nun)|blenden? .* ein/i;

async function runCase(model: string): Promise<CaseResult> {
  const { nextResearchMessage } = await import("@/lib/voice-agent/interviewer");

  const history: InterviewTurn[] = [];
  const state: ParticipantState = {
    openerDone: false,
    reactionIndex: {},
    preferenceAnswered: false,
  };
  const firstReveals: number[] = [];
  const allShows: number[] = [];
  let currentlyShown: number | null = null;
  let closedByModel = false;
  let whyLeaks = 0;
  let showLeaks = 0;
  let announcedWithoutShow = 0;
  let unshownSpoilers = 0;
  let preferenceAsked = false;

  while (
    history.filter((t) => t.role === "agent").length < EVAL_AGENT_QUESTION_CAP
  ) {
    const { done, message, why, showStimulusPosition } =
      await nextResearchMessage(PLAN_INPUT, history, "de", model);

    // Harte Leak-Assertions: `message` ist exakt der Teilnehmer-Text.
    if (/why\s*:/i.test(message)) whyLeaks += 1;
    if (/show\s*:/i.test(message)) showLeaks += 1;

    if (showStimulusPosition !== null) {
      allShows.push(showStimulusPosition);
      if (!firstReveals.includes(showStimulusPosition)) {
        firstReveals.push(showStimulusPosition);
      }
      currentlyShown = showStimulusPosition;
    } else if (ANNOUNCE_PATTERN.test(message) && firstReveals.length < 3) {
      // Wechsel angekündigt, aber kein SHOW im selben Turn — genau der
      // Fehlermodus „Teilnehmer sitzt vor unverändertem Panel".
      announcedWithoutShow += 1;
    }

    // Spoiler-Check: Label eines noch nicht gezeigten Stimulus im Agent-Text.
    for (const item of STIMULI) {
      if (
        item.label &&
        !firstReveals.includes(item.position) &&
        message.includes(item.label)
      ) {
        unshownSpoilers += 1;
      }
    }

    if (PREFERENCE_PATTERN.test(message)) preferenceAsked = true;

    history.push(
      buildEvalAgentTurn(message, why, showStimulusPosition),
    );

    if (done) {
      closedByModel = true;
      break;
    }
    history.push({
      role: "customer",
      text: simulateParticipant(state, message, currentlyShown),
    });
  }

  return {
    agentQuestionCount: history.filter((t) => t.role === "agent").length,
    closedByModel,
    firstReveals,
    allShows,
    whyLeaks,
    showLeaks,
    announcedWithoutShow,
    unshownSpoilers,
    preferenceAsked,
    history,
  };
}

/** Spiegel von session-service buildAgentTurn — der Eval persistiert die
 *  Marker exakt wie die Produktion, damit die COUNTERS-Berechnung der Engine
 *  (buildResearchTail) im Eval dieselben Werte sieht wie im echten Pfad. */
function buildEvalAgentTurn(
  text: string,
  why: string | null,
  shownStimulusPosition: number | null,
): InterviewTurn {
  return {
    role: "agent",
    text,
    ...(why !== null ? { why } : {}),
    ...(shownStimulusPosition !== null ? { shownStimulusPosition } : {}),
  };
}

// ── checks ───────────────────────────────────────────────────────────────────

interface Check {
  ok: boolean;
  note: string;
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

function printResult(result: CaseResult): boolean {
  const checks: Array<[string, Check]> = [
    [
      "all shown in order ",
      {
        ok:
          result.firstReveals.length === STIMULI.length &&
          result.firstReveals.every((p, i) => p === i + 1),
        note: `first reveals: [${result.firstReveals.join(", ")}]`,
      },
    ],
    [
      "show sent not said ",
      {
        ok: result.announcedWithoutShow === 0,
        note: `${result.announcedWithoutShow} announced-without-SHOW turns`,
      },
    ],
    [
      "no SHOW leak (HART)",
      { ok: result.showLeaks === 0, note: `${result.showLeaks} leaks` },
    ],
    [
      "no WHY leak (HART) ",
      { ok: result.whyLeaks === 0, note: `${result.whyLeaks} leaks` },
    ],
    [
      "preference asked   ",
      {
        ok: result.preferenceAsked,
        note: result.preferenceAsked ? "explicit preference probe found" : "NOT found",
      },
    ],
    [
      "no unshown spoiler ",
      {
        ok: result.unshownSpoilers === 0,
        note: `${result.unshownSpoilers} spoiler turns`,
      },
    ],
    [
      "closed by model    ",
      {
        ok: result.closedByModel,
        note: result.closedByModel ? "done: true from model" : "EVAL CAP fired",
      },
    ],
    [
      `ceiling ≤ ${TARGET_CEILING}       `,
      {
        ok: result.agentQuestionCount <= TARGET_CEILING,
        note: `${result.agentQuestionCount} agent questions`,
      },
    ],
  ];

  console.log("\n" + "=".repeat(78));
  console.log("multi-stimulus creative-test — 3 Varianten, gescripteter Teilnehmer");
  for (const [label, check] of checks) {
    console.log(`  ${label}: ${flag(check)}`);
  }
  const allPass = checks.every(([, c]) => c.ok);
  console.log(`  ${"verdict".padEnd(19)}: ${allPass ? "✓ PASS" : "✗ WARN"}`);

  console.log("\n  transcript (SHOW-Marker inline):");
  for (const turn of result.history) {
    const marker =
      turn.role === "agent" && turn.shownStimulusPosition !== undefined
        ? ` [SHOW: ${turn.shownStimulusPosition}]`
        : "";
    const who = turn.role === "agent" ? "AGENT" : "TEILN";
    console.log(`  ${who}${marker}: ${turn.text.replace(/\n/g, " ")}`);
  }
  return allPass;
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Run with: env -u ANTHROPIC_API_KEY ...",
    );
  }

  const model = process.env.EVAL_MODEL ?? "claude-sonnet-4-6";
  const rounds = Number.parseInt(process.env.EVAL_ROUNDS ?? "1", 10) || 1;

  console.log(`\nMulti-Stimulus Eval — model: ${model}, rounds: ${rounds}`);
  console.log(
    `set size = ${STIMULI.length} · eval cap = ${EVAL_AGENT_QUESTION_CAP} · D8 ceiling = ${TARGET_CEILING}\n`,
  );

  let pass = 0;
  let warn = 0;
  for (let i = 0; i < rounds; i++) {
    try {
      if (printResult(await runCase(model))) pass += 1;
      else warn += 1;
    } catch (err) {
      warn += 1;
      console.log(
        `\n  ERROR: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`SUMMARY (model: ${model})  pass: ${pass}  warn: ${warn}`);
  console.log(
    "\nHeuristics only — die echte Abnahme ist das Transkript-Lesen oben.\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
