import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import {
  buildResearchPrompt,
  buildResearchSystemPrompt,
  DEFAULT_VOICE_MODEL,
  type InterviewTurn,
  type ResearchInput,
} from "@/lib/voice-agent/interviewer";

/**
 * B0-Spike (Etappe B, Perf-Roadmap): Streaming-Mechanik für Interview-Turns.
 * ---------------------------------------------------------------------------
 * Misst gegen den ECHTEN Research-Interviewer-Prompt (gleiches System/User-
 * Prompt-Paar, gleiches Modell, gleiche maxTokens wie production callJson),
 * was der Teilnehmer heute fühlt und was die zwei Streaming-Varianten bringen:
 *
 *   BASELINE   — production-identisch: forced tool-use, non-streaming.
 *                Teilnehmer sieht NICHTS bis zum Schluss (TTFC = total).
 *   V1 TOOL    — gleicher Request, aber .stream(): input_json_delta wird
 *                akkumuliert, die message-Chars werden aus dem partiellen
 *                JSON extrahiert, sobald `"message":"` vorbeigezogen ist.
 *                Engine-Struktur (Zod, forced tool) bleibt unverändert.
 *   V2 PLAIN   — Output-Vertrag umgestellt: Zeile 1 `DONE: true|false`,
 *                Leerzeile, dann die Nachricht als Plain-Text. Text streamt
 *                nativ; kein Tool, kein JSON-Escaping im Streampfad.
 *
 * Kennzahlen pro Lauf: TTFE (erster Stream-Event), TTFC (erster sichtbarer
 * Message-Char — die UX-Zahl), TOTAL, Output-Tokens, done-Flag, Validierung.
 *
 * Lauf:  pnpm exec tsx --conditions=react-server scripts/spike-streaming-b0.ts
 * Kein App-Code wird angefasst; das Skript ist Wegwerf-Artefakt des Spikes.
 */

const MODEL = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
const RUNS_PER_VARIANT = 3;
const MAX_TOKENS = 1024; // identisch zu callJson (interviewer.ts)

const NextMessageSchema = z.object({
  done: z.boolean(),
  message: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Szenario: realistisches MR-Interview MITTEN im Gespräch (3 Agent-Turns,
// 2 Teilnehmer-Antworten) — so trägt der Prompt schon echte History-Last.
// ---------------------------------------------------------------------------

const input: ResearchInput = {
  plan: {
    title: "Kaufentscheidung Bio-Hafermilch",
    objective:
      "Verstehen, wie Konsument:innen im Supermarkt zwischen Hafermilch-Marken entscheiden und welche Rolle Preis vs. Marke spielt.",
    persona:
      "Konsument:innen 25-45, kaufen mind. 1x pro Woche Pflanzenmilch im Supermarkt.",
    useCase: "general_survey",
    topics: [
      {
        topic: "Letzter Kauf",
        intent:
          "Den konkreten letzten Kauf rekonstruieren: Wo, welche Marke, was lag daneben im Regal.",
      },
      {
        topic: "Markenwechsel",
        intent:
          "Ob und wann schon einmal die Marke gewechselt wurde und was der Auslöser war.",
        hypotheses: ["Preisaktionen lösen die meisten Wechsel aus"],
      },
      {
        topic: "Preisschwelle",
        intent:
          "Ab welchem Preisunterschied zur Eigenmarke die Markentreue kippt.",
      },
    ],
  },
  brand: null,
};

const history: InterviewTurn[] = [
  {
    role: "agent",
    text: "Hallo! Ich bin ein KI-Forschungsassistent und führe heute ein kurzes vertrauliches Interview darüber, wie Menschen im Supermarkt Hafermilch auswählen. Es gibt keine falschen Antworten. Zum Einstieg: Erinnern Sie sich an Ihren letzten Hafermilch-Kauf — wie ist der abgelaufen?",
  },
  {
    role: "customer",
    text: "Ja, das war letzten Samstag im Rewe. Ich hab wie immer zur Oatly Barista gegriffen, die stand auf Augenhöhe. Daneben gab es noch die Rewe-Eigenmarke und Alpro, glaube ich.",
  },
  {
    role: "agent",
    text: "Danke, das ist ein schönes konkretes Bild. Sie sagen 'wie immer' — erzählen Sie mir mehr darüber, wie es dazu kam, dass Oatly Barista Ihre Standardwahl wurde.",
  },
  {
    role: "customer",
    text: "Hm, angefangen hat das im Café, da schmeckte der Cappuccino mit Oatly einfach am besten. Irgendwann hab ich sie dann selbst gekauft und bin dabei geblieben. Die Eigenmarke hab ich einmal probiert, die ist beim Aufschäumen geronnen.",
  },
  {
    role: "agent",
    text: "Das Aufschäumen scheint für Sie ein echtes Qualitätskriterium zu sein. Was ist da beim Versuch mit der Eigenmarke konkret passiert — und was haben Sie danach gemacht?",
  },
  {
    role: "customer",
    text: "Der Schaum ist einfach zusammengefallen und es gab so Flocken im Kaffee. Ich hab den Rest dann nur noch ins Müsli getan und bin direkt wieder zu Oatly zurück, auch wenn die fast einen Euro mehr kostet.",
  },
];

const system = buildResearchSystemPrompt(input.plan.useCase, false);
const userPrompt = buildResearchPrompt(input, history, "de");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120_000,
  maxRetries: 1,
});

const tool: Anthropic.Tool = {
  name: "emit_voice_result",
  description:
    "Return the structured result for this interview turn or extraction as the fields of this tool.",
  input_schema: {
    type: "object",
    properties: {
      done: { type: "boolean" },
      message: { type: "string" },
    },
    required: ["done", "message"],
  },
};

interface RunResult {
  variant: string;
  ttfeMs: number | null; // erster Stream-Event (null bei non-streaming)
  ttfcMs: number | null; // erster sichtbarer Message-Char
  totalMs: number;
  outputTokens: number;
  done: boolean;
  valid: boolean;
  messagePreview: string;
}

// ---------------------------------------------------------------------------
// BASELINE — production-identisch (structured.ts-Form), non-streaming
// ---------------------------------------------------------------------------

async function runBaseline(): Promise<RunResult> {
  const t0 = performance.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: userPrompt }],
    tools: [tool],
    tool_choice: { type: "tool", name: "emit_voice_result" },
  });
  const totalMs = performance.now() - t0;
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  const parsed = NextMessageSchema.safeParse(toolUse?.input);
  return {
    variant: "BASELINE (heute)",
    ttfeMs: null,
    ttfcMs: totalMs, // Teilnehmer sieht erst am Ende etwas
    totalMs,
    outputTokens: response.usage.output_tokens,
    done: parsed.success ? parsed.data.done : false,
    valid: parsed.success,
    messagePreview: parsed.success ? parsed.data.message.slice(0, 80) : "(invalid)",
  };
}

// ---------------------------------------------------------------------------
// V1 — forced tool-use, aber gestreamt: message-Chars aus input_json_delta
// ---------------------------------------------------------------------------

/** Findet im akkumulierten partiellen Tool-JSON den Beginn des message-Werts. */
const MESSAGE_VALUE_RE = /"message"\s*:\s*"/;

async function runToolStream(): Promise<RunResult> {
  const t0 = performance.now();
  let ttfeMs: number | null = null;
  let ttfcMs: number | null = null;
  let acc = "";
  let msgStart = -1;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: userPrompt }],
    tools: [tool],
    tool_choice: { type: "tool", name: "emit_voice_result" },
  });

  for await (const event of stream) {
    if (ttfeMs === null) ttfeMs = performance.now() - t0;
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "input_json_delta"
    ) {
      acc += event.delta.partial_json;
      if (msgStart < 0) {
        const m = MESSAGE_VALUE_RE.exec(acc);
        if (m) msgStart = m.index + m[0].length;
      }
      // Erster Char NACH dem öffnenden Quote des message-Werts = erster
      // sichtbarer Teilnehmer-Char. (Display bräuchte inkrementelles
      // Unescaping — für die Messung zählt der Zeitpunkt.)
      if (msgStart >= 0 && acc.length > msgStart && ttfcMs === null) {
        ttfcMs = performance.now() - t0;
      }
    }
  }

  const final = await stream.finalMessage();
  const totalMs = performance.now() - t0;
  const toolUse = final.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  const parsed = NextMessageSchema.safeParse(toolUse?.input);
  return {
    variant: "V1 tool-stream",
    ttfeMs,
    ttfcMs,
    totalMs,
    outputTokens: final.usage.output_tokens,
    done: parsed.success ? parsed.data.done : false,
    valid: parsed.success,
    messagePreview: parsed.success ? parsed.data.message.slice(0, 80) : "(invalid)",
  };
}

// ---------------------------------------------------------------------------
// V2 — Plain-Text-Turn: `DONE: bool` + Leerzeile + Nachricht, nativ gestreamt
// ---------------------------------------------------------------------------

const PLAIN_OUTPUT_CONTRACT = `

OUTPUT FORMAT — OVERRIDE (supersedes EVERY earlier output instruction in this prompt):
Do NOT return JSON. Reply as PLAIN TEXT in exactly this shape:
Line 1: \`DONE: false\` while you still want to ask another question, or \`DONE: true\` when wrapping up.
Line 2: empty.
From line 3: your next message to the participant — plain text, no JSON, no markdown, no quotes around it.`;

async function runPlainStream(): Promise<RunResult> {
  const t0 = performance.now();
  let ttfeMs: number | null = null;
  let ttfcMs: number | null = null;
  let text = "";
  let headerConsumed = false;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: system + PLAIN_OUTPUT_CONTRACT,
    messages: [
      {
        role: "user",
        content: userPrompt.replace(
          "Write your next message as JSON only.",
          "Write your next message as plain text, following the OUTPUT FORMAT exactly.",
        ),
      },
    ],
  });

  for await (const event of stream) {
    if (ttfeMs === null) ttfeMs = performance.now() - t0;
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      text += event.delta.text;
      if (!headerConsumed) {
        // Header = Zeile 1 + Leerzeile. Sobald danach Inhalt kommt, streamt
        // die sichtbare Nachricht.
        const headerEnd = text.indexOf("\n\n");
        if (headerEnd >= 0 && text.length > headerEnd + 2) {
          headerConsumed = true;
          if (ttfcMs === null) ttfcMs = performance.now() - t0;
        }
      }
    }
  }

  const final = await stream.finalMessage();
  const totalMs = performance.now() - t0;

  const headerMatch = /^DONE:\s*(true|false)\s*\n\n([\s\S]+)$/.exec(text.trim());
  const valid = headerMatch !== null;
  return {
    variant: "V2 plain-text",
    ttfeMs,
    ttfcMs,
    totalMs,
    outputTokens: final.usage.output_tokens,
    done: valid ? headerMatch![1] === "true" : false,
    valid,
    messagePreview: valid ? headerMatch![2].slice(0, 80) : text.slice(0, 80),
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function fmt(ms: number | null): string {
  return ms === null ? "    —" : `${Math.round(ms).toString().padStart(5)}`;
}

async function main() {
  console.log(`B0-Spike — Modell: ${MODEL}, ${RUNS_PER_VARIANT} Läufe/Variante`);
  console.log(`System-Prompt: ${system.length} Chars · User-Prompt: ${userPrompt.length} Chars\n`);

  const variants: Array<[string, () => Promise<RunResult>]> = [
    ["BASELINE", runBaseline],
    ["V1", runToolStream],
    ["V2", runPlainStream],
  ];

  const all: RunResult[] = [];
  for (const [label, fn] of variants) {
    for (let i = 0; i < RUNS_PER_VARIANT; i++) {
      try {
        const r = await fn();
        all.push(r);
        console.log(
          `${r.variant.padEnd(17)} #${i + 1}  TTFE ${fmt(r.ttfeMs)}ms  TTFC ${fmt(r.ttfcMs)}ms  TOTAL ${fmt(r.totalMs)}ms  ${String(r.outputTokens).padStart(4)} tok  done=${r.done}  valid=${r.valid}`,
        );
        console.log(`${"".padEnd(21)}» ${r.messagePreview}…`);
      } catch (err) {
        console.error(`${label} #${i + 1} FEHLGESCHLAGEN:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log("\n— Mittelwerte (nur valide Läufe) —");
  for (const v of ["BASELINE (heute)", "V1 tool-stream", "V2 plain-text"]) {
    const runs = all.filter((r) => r.variant === v && r.valid);
    if (runs.length === 0) {
      console.log(`${v.padEnd(17)} keine validen Läufe`);
      continue;
    }
    const avg = (sel: (r: RunResult) => number | null) => {
      const xs = runs.map(sel).filter((x): x is number => x !== null);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    console.log(
      `${v.padEnd(17)} TTFC Ø ${fmt(avg((r) => r.ttfcMs))}ms  TOTAL Ø ${fmt(avg((r) => r.totalMs))}ms  (${runs.length}/${RUNS_PER_VARIANT} valide)`,
    );
  }
}

main().catch((err) => {
  console.error("Spike abgebrochen:", err);
  process.exit(1);
});
