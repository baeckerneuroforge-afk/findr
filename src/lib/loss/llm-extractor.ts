import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import type { CallWithSegments, DetectorInput } from "@/lib/risk/types";
import {
  extractLossReason,
  type LossAnalysis,
  type LossReasonType,
} from "./extractor";

/**
 * LLM-based loss-reason extractor.
 * --------------------------------
 * Drop-in alternative to the regex `extractLossReason`: SAME input
 * (`DetectorInput`) and SAME output (`LossAnalysis`), so the two can be swapped
 * behind a single call site once the eval proves the LLM is the better choice.
 *
 * PRODUCTION uses this extractor (see `src/lib/loss/service.ts`). The eval
 * justified the switch: regex scored 33% (4/12), the LLM 100% (12/12) — see
 * `evals-loss/llm-comparison.md`.
 *
 * MODEL — Sonnet by default (claude-sonnet-4-6). At the 12 eval cases Opus had
 * NO measurable advantage over Sonnet (both 100%), so we run the ~5x cheaper
 * Sonnet: loss analysis tolerates lower stakes than risk analysis. Overridable
 * via `LOSS_MODEL` (analogous to `EVAL_MODEL` in the risk eval).
 * RE-TEST TRIGGER: 12 hand-crafted cases is a thin basis. Once 50-100 REAL loss
 * cases exist, re-run the Opus-vs-Sonnet comparison before trusting Sonnet at
 * scale — if Opus pulls ahead there, reconsider this default:
 *   LOSS_MODEL=claude-opus-4-7 env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server evals-loss/run.ts llm
 *
 * Robustness: on ANY failure of the LLM path (network/SDK error, missing text,
 * no JSON, invalid JSON, schema mismatch) the function falls back to the regex
 * `extractLossReason`. A successful LLM call is tagged `extraction_method: "ai"`;
 * a fallback keeps the regex's `extraction_method: "heuristic"`, so the caller
 * can always tell which engine produced a given result.
 */

/**
 * Default analysis model: Sonnet 4.6 — see the MODEL / RE-TEST TRIGGER note
 * above. Sonnet because Opus showed no measurable gain at 12 eval cases and is
 * ~5x cheaper; revisit at 50-100 real cases via LOSS_MODEL=claude-opus-4-7.
 */
export const DEFAULT_LOSS_MODEL = CLAUDE_MODELS.sonnet;

/**
 * The 10 valid loss-reason categories as a literal tuple, used both for the
 * runtime JSON validation below and (implicitly) to keep this list in lockstep
 * with `LossReasonType` — `satisfies` makes a typo or a stale entry a tsc error.
 */
const LOSS_CATEGORIES = [
  "pricing",
  "compliance",
  "competitor",
  "timing",
  "budget",
  "champion_lost",
  "feature_gap",
  "no_decision",
  "internal_priority",
  "other",
] as const satisfies readonly LossReasonType[];

/** Strict shape we require back from the model. */
const LlmLossOutputSchema = z.object({
  category: z.enum(LOSS_CATEGORIES),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

export const LOSS_EXTRACTOR_SYSTEM_PROMPT = `You are an expert at diagnosing WHY a B2B SaaS deal was lost. You work with DACH (Germany / Austria / Switzerland) sales conversations, in German and English.

You receive the transcript(s) of a LOST deal. Classify the SINGLE primary reason the deal was lost into EXACTLY ONE of these 10 categories:

- pricing — the PRICE / cost itself is the blocker: too expensive, above the price cap, the value is not worth the price, a discount was needed. The objection is the PRICE LEVEL.
- budget — AVAILABILITY OF FUNDS is the blocker: no budget, budget frozen or not approved, CFO/finance declined, money only available next fiscal year. The objection is whether the MONEY EXISTS, not the price level.
- competitor — the buyer chose, or is choosing, a COMPETING vendor INSTEAD of us in this deal.
- feature_gap — a missing capability, feature, or integration blocked the deal.
- compliance — legal / security / data-protection blockers: GDPR/DSGVO, SOC 2, ISO 27001, Betriebsrat, legal review, security audit.
- timing — wrong time, INDEPENDENT of money: "not now", next quarter/year, revisit later, project parked for timing (not because funds are missing).
- champion_lost — the internal advocate left, changed role, or was replaced by someone who restarts the evaluation.
- no_decision — the buyer never actually decided: it stalled, slipped, fizzled out, "we never got around to it", no concrete reason given.
- internal_priority — deprioritized for OTHER internal initiatives: reorg/restructuring, focus shifted elsewhere, other projects come first.
- other — none of the above genuinely fit.

HOW TO CLASSIFY:

1. Identify the REAL underlying reason, even when it is only PARAPHRASED and uses none of the obvious keywords. Read for the mechanism, not surface words. Examples:
   - "Die Budgetfreigabe wurde am Ende verweigert." => budget (NOT no_decision: a decision WAS made — to refuse the funds).
   - "Für das, was es leisten soll, lässt sich die Investition gerade nicht rechtfertigen, wir müssten an anderer Stelle kürzen." => pricing (a price-vs-value objection, with no keyword).
   - "Wir kamen einfach nie dazu, eine Entscheidung zu treffen, und dann war das Quartal vorbei." => no_decision.

2. Tool / vendor names (Salesforce, HubSpot, Gong, Clari, Outreach, …) are NOT automatically a competitor. A tool named as the buyer's EXISTING system or as a WANTED integration is NOT a competitor. Classify "competitor" ONLY when a RIVAL vendor is winning or being chosen instead of us. Examples:
   - "Wir nutzen Salesforce sehr intensiv, die native Anbindung daran ist für uns Pflicht — genau die fehlt euch." => feature_gap (a missing integration). Salesforce here is the buyer's system, not a competitor.
   - "Wir haben uns am Ende für Gong entschieden." => competitor.

3. budget vs timing: if the blocker is whether the MONEY exists (no/late funds) => budget. If the blocker is purely WHEN, regardless of money => timing.

4. Choose the single best PRIMARY category. Only use "other" if nothing genuinely fits.

OUTPUT:
Return ONLY a JSON object — no markdown, no code fences, no preamble, no explanation:

{
  "category": "<one of the 10 category strings above>",
  "evidence": "<a short verbatim quote from the transcript that supports the choice>",
  "confidence": <a number from 0 to 1>
}`;

/** Flatten the calls into a simple "speaker: text" transcript for the prompt. */
function buildTranscript(calls: CallWithSegments[]): string {
  const lines: string[] = [];
  for (const call of calls) {
    for (const segment of call.segments) {
      const speaker =
        segment.speaker_name ??
        segment.speaker_role ??
        segment.speaker_id ??
        "speaker";
      const text = segment.text?.trim();
      if (text) lines.push(`${speaker}: ${text}`);
    }
  }
  return lines.join("\n");
}

function buildLossPrompt(input: DetectorInput): string {
  const transcript = buildTranscript(input.calls);
  return `This deal was LOST (stage: ${input.deal_stage}). Determine the PRIMARY loss reason from the transcript below.

TRANSCRIPT:
${transcript || "(no transcript available)"}

Return your answer as JSON only.`;
}

/**
 * LLM equivalent of `extractLossReason`. Same signature (the optional `model`
 * arg only adds an override; calling `extractLossReasonLLM(input)` is a true
 * drop-in for `extractLossReason(input)`).
 *
 * Robust transport: forced tool-use via callClaudeStructured — the output comes
 * back as a parsed tool input (no text-JSON regex/parse). Fail-closed UNCHANGED:
 * ANY failure (transport, schema, StructuredOutputError) is caught below and
 * degrades to the regex heuristic with extraction_method "heuristic".
 */
export async function extractLossReasonLLM(
  input: DetectorInput,
  model: string = process.env.LOSS_MODEL ?? DEFAULT_LOSS_MODEL,
): Promise<LossAnalysis> {
  try {
    const output = await callClaudeStructured({
      schema: LlmLossOutputSchema,
      system: LOSS_EXTRACTOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildLossPrompt(input) }],
      model,
      maxTokens: 512,
      toolName: "emit_loss_reason",
      toolDescription:
        "Return the single primary loss reason — the category, a verbatim evidence quote from the transcript, and a 0-1 confidence.",
    });

    const callId = input.calls[0]?.id ?? "";
    const evidence = output.evidence.trim();

    return {
      deal_id: input.deal_id,
      primary_reason: output.category,
      secondary_reasons: [],
      confidence: output.confidence,
      evidence_quotes: evidence
        ? [
            {
              call_id: callId,
              speaker: "unknown",
              quote: evidence,
              pattern_matched: "llm",
            },
          ]
        : [],
      extraction_method: "ai",
      extracted_at: new Date().toISOString(),
    };
  } catch (err) {
    // Any LLM-path failure degrades gracefully to the regex heuristic. The
    // returned analysis keeps extraction_method: "heuristic" so the caller can
    // see the fallback happened.
    console.warn(
      `[loss] LLM extraction failed (${
        err instanceof Error ? err.message : "unknown"
      }); falling back to regex heuristic.`,
    );
    return extractLossReason(input);
  }
}
