/**
 * Voice-Agent Eval Runner (text, simulated customer)
 * --------------------------------------------------
 * For each case: a second LLM role-plays the buyer per the hidden persona, the
 * interview agent (interviewer.ts) drives a multi-round conversation until it
 * closes, then the loss reason is extracted. Prints the full simulated
 * conversation for MANUAL reading plus heuristic checks:
 *   (a) gotReal  — did the agent surface the hidden REAL reason?
 *   (b) probed   — for surface-answer-first personas, did the agent ask a
 *                  follow-up instead of accepting the first polite answer?
 *   (c) length   — did it close on its own within a sane number of questions?
 * Plus whether matchedRiskPrediction lines up with the case's expectation.
 *
 * Always calls the LLM (Opus agent + Sonnet simulated customer by default). The
 * interviewer pulls in "server-only", so run with the react-server condition.
 * Start it yourself, in the foreground:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-voice-agent/run.ts
 *
 * (env -u clears an empty/shadowing shell var so dotenv loads the real key.
 * VOICE_MODEL overrides the agent model; VOICE_CUSTOMER_MODEL the simulated
 * buyer. e.g. VOICE_MODEL=claude-sonnet-4-6 for a cheap run.)
 */

import { config } from "dotenv";
import { VOICE_EVAL_CASES, type VoiceEvalCase } from "./dataset";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

const MAX_ROUNDS = 7;

interface Check {
  ok: boolean;
  note: string;
}

function flag(c: Check): string {
  return `${c.ok ? "PASS" : "WARN"} (${c.note})`;
}

function buildCustomerSystem(c: VoiceEvalCase): string {
  const lang = c.persona.language === "de" ? "German" : "English";
  const surfaceRule = c.persona.surfaceAnswerFirst
    ? "Do NOT volunteer your real reason up front. Give your polite surface reason first, and reveal the real reason ONLY if the agent asks an empathetic, specific follow-up."
    : "You can be fairly open about the real reason when asked.";
  return `You are role-playing a B2B buyer in DACH whose company decided NOT to move forward with a deal from a vendor called findr. A research agent is reaching out to understand why. Reply as this buyer — naturally and briefly (1-3 sentences), in ${lang}.

DEAL: ${c.deal.dealName} · ${c.deal.company} (you are ${c.deal.contactName}).

HOW YOU BEHAVE (your private truth + style):
${c.persona.behavior}

RULES:
- Stay fully in character. Reply ONLY with what the buyer says — no narration, no labels, no surrounding quotes.
- Be realistic: polite, a little busy.
- ${surfaceRule}
- Never break character or mention being an AI.`;
}

function historyText(history: InterviewTurn[]): string {
  return history
    .map((t) => `${t.role === "agent" ? "Agent" : "Buyer"}: ${t.text}`)
    .join("\n");
}

async function main(): Promise<void> {
  config({ path: ".env.local" });
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Ensure .env.local has it and no empty shell " +
        "var is shadowing it — run with: env -u ANTHROPIC_API_KEY ...",
    );
  }

  let interviewerMod: typeof import("@/lib/voice-agent/interviewer");
  let anthropicMod: typeof import("@/lib/anthropic/client");
  try {
    interviewerMod = await import("@/lib/voice-agent/interviewer");
    anthropicMod = await import("@/lib/anthropic/client");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Client Component|server-only/i.test(msg)) {
      console.error(
        "\nThis runner imports a server-only module. Re-run with the react-server condition:\n" +
          "  env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server evals-voice-agent/run.ts\n",
      );
      process.exit(1);
    }
    throw err;
  }

  const { nextInterviewMessage, extractLossReasonFromInterview, DEFAULT_VOICE_MODEL } =
    interviewerMod;
  const { getAnthropicClient, CLAUDE_MODELS } = anthropicMod;

  const agentModel = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const customerModel = process.env.VOICE_CUSTOMER_MODEL ?? CLAUDE_MODELS.sonnet;

  async function simulateCustomer(
    c: VoiceEvalCase,
    history: InterviewTurn[],
  ): Promise<string> {
    const client = getAnthropicClient();
    const response = await client.messages.create(
      {
        model: customerModel,
        max_tokens: 400,
        system: buildCustomerSystem(c),
        messages: [
          {
            role: "user",
            content: `CONVERSATION SO FAR:\n${historyText(history)}\n\nThe agent just sent the last "Agent:" line above. Write your reply as the buyer (one short message).`,
          },
        ],
      },
      { timeout: 60_000, maxRetries: 2 },
    );
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text"
      ? textBlock.text.trim()
      : "(no response)";
  }

  console.log(
    `\nVoice-Agent Eval — agent: ${agentModel} · simulated customer: ${customerModel}`,
  );
  console.log(`${VOICE_EVAL_CASES.length} cases · read the conversations, judge manually\n`);

  const tally = { gotReal: 0, matchPred: 0, probed: 0, probedTotal: 0, length: 0 };
  let errors = 0;

  for (const c of VOICE_EVAL_CASES) {
    console.log("\n" + "=".repeat(80));
    console.log(`${c.id} — ${c.description}`);
    console.log(
      `deal: ${c.deal.dealName} · ${c.deal.company} · ${c.deal.currency} ${c.deal.amount.toLocaleString()} · lang ${c.persona.language}`,
    );
    console.log(
      `risk predicted: ${c.riskAnalysis.signals.map((s) => s.type).join(", ") || "none"} · hidden real reason: ${c.persona.realReason} · expected match: ${c.persona.expectedMatch}`,
    );

    try {
      const input = { deal: c.deal, riskAnalysis: c.riskAnalysis };
      const history: InterviewTurn[] = [];
      let agentQuestions = 0;
      let closed = false;

      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const { done, message } = await nextInterviewMessage(
          input,
          history,
          agentModel,
        );
        history.push({ role: "agent", text: message });
        if (done) {
          closed = true;
          break;
        }
        agentQuestions += 1;
        const reply = await simulateCustomer(c, history);
        history.push({ role: "customer", text: reply });
      }

      const result = await extractLossReasonFromInterview(
        input,
        history,
        agentModel,
      );

      console.log(
        `--- conversation (${agentQuestions} agent questions · closed=${closed}) ---`,
      );
      for (const t of history) {
        console.log(`${t.role === "agent" ? "Agent" : "Buyer"}: ${t.text}`);
      }

      const gotReal = result.extractedReason === c.persona.realReason;
      const matchPred = result.matchedRiskPrediction === c.persona.expectedMatch;
      const probeApplies = c.persona.surfaceAnswerFirst;
      const probed: Check = probeApplies
        ? {
            ok: agentQuestions >= 2,
            note:
              agentQuestions >= 2
                ? "asked a follow-up past the surface answer"
                : "accepted the first surface answer (no follow-up)",
          }
        : { ok: true, note: "n/a — buyer was open" };
      const length: Check = {
        ok: closed && agentQuestions >= 1 && agentQuestions <= 5,
        note: !closed
          ? `did not close within ${MAX_ROUNDS} rounds`
          : `${agentQuestions} questions`,
      };

      console.log(`--- extraction ---`);
      console.log(
        `extractedReason: ${result.extractedReason}  (real: ${c.persona.realReason})  -> ${gotReal ? "MATCH" : "MISS"}`,
      );
      console.log(
        `matchedRiskPrediction: ${result.matchedRiskPrediction}  (expected: ${c.persona.expectedMatch})  -> ${matchPred ? "ok" : "mismatch"}`,
      );
      console.log(`evidence: ${result.evidence ? `"${result.evidence}"` : "(none)"}`);
      console.log(`reasoning: ${result.reasoning}`);
      console.log(
        `checks: gotReal ${gotReal ? "PASS" : "WARN"} | probed ${flag(probed)} | length ${flag(length)} | matchPred ${matchPred ? "PASS" : "WARN"}`,
      );

      if (gotReal) tally.gotReal += 1;
      if (matchPred) tally.matchPred += 1;
      if (probeApplies) {
        tally.probedTotal += 1;
        if (probed.ok) tally.probed += 1;
      }
      if (length.ok) tally.length += 1;
    } catch (err) {
      errors += 1;
      console.log(
        `  ERROR: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  const n = VOICE_EVAL_CASES.length;
  console.log("\n" + "=".repeat(80));
  console.log(`SUMMARY (${n} cases · agent ${agentModel} · customer ${customerModel})`);
  if (errors > 0) console.log(`  errors:                 ${errors}`);
  console.log(`  got real reason:        ${tally.gotReal}/${n}`);
  console.log(`  risk-match correct:     ${tally.matchPred}/${n}`);
  console.log(`  probed (surface cases): ${tally.probed}/${tally.probedTotal}`);
  console.log(`  sane length + closed:   ${tally.length}/${n}`);
  console.log(
    "\nHeuristics only — the real evaluation is reading the conversations above.\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
