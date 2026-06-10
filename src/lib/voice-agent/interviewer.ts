import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import type { ResearchPlanUseCase } from "@/lib/research/db";
import type { LossReasonType } from "@/lib/loss/extractor";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";

/**
 * Voice Agent core — the post-loss interview (TEXT version).
 * ---------------------------------------------------------
 * The fourth AI building block: after a deal is lost, this agent runs a short,
 * empathetic interview to surface the REAL reason — past the polite surface
 * answer ("too expensive", "bad timing") — and then maps it to a loss category
 * and checks it against what the risk analysis had predicted.
 *
 * NOT WIRED INTO PRODUCTION. No telephony, no voice, no UI — just the
 * conversation core + extraction, built next to the product for eval (like the
 * loss + solution layers were). Mirrors src/lib/solution/extractor.ts
 * conventions: structured JSON output, Zod validation, one retry, typed errors.
 *
 * Model: Opus by default (claude-opus-4-7). Override via VOICE_MODEL.
 */

export const DEFAULT_VOICE_MODEL = CLAUDE_MODELS.opus;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface VoiceDealContext {
  dealName: string;
  company: string;
  contactName: string;
  amount: number;
  currency: string;
}

export interface InterviewInput {
  deal: VoiceDealContext;
  /** What the risk analysis predicted — used only as a private hypothesis. */
  riskAnalysis: RiskAnalysisResult;
}

export type InterviewRole = "agent" | "customer";

export interface InterviewTurn {
  role: InterviewRole;
  text: string;
}

/** Buyer-facing conversation language for a session. */
export type InterviewLanguage = "de" | "en";

/** Used when a session doesn't specify one (matches the DB column default). */
export const DEFAULT_INTERVIEW_LANGUAGE: InterviewLanguage = "en";

/** How each language is named to the model in the prompt. */
const LANGUAGE_LABELS: Record<InterviewLanguage, string> = {
  de: "German (Deutsch)",
  en: "English",
};

/** The 10 valid loss-reason categories (kept in lockstep with LossReasonType). */
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

/** One conversation turn from the agent. Formerly a Zod schema enforced via
 *  forced tool-use; since B1 the plain-text DONE-header contract is parsed
 *  (fail-open) by createDoneHeaderParser, so no runtime schema remains. */
export interface NextMessage {
  /** false while still asking; true when wrapping up (message = closing). */
  done: boolean;
  message: string;
}

const InterviewResultSchema = z.object({
  extractedReason: z.enum(LOSS_CATEGORIES),
  evidence: z.string().default(""),
  matchedRiskPrediction: z.enum(["yes", "no", "partial"]),
  reasoning: z.string().min(1),
});
export type InterviewResult = z.infer<typeof InterviewResultSchema>;

// ----------------------------------------------------------------------------
// Errors (mirror solution/extractor.ts)
// ----------------------------------------------------------------------------

export class VoiceUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "VoiceUnavailableError";
  }
}

// ----------------------------------------------------------------------------
// Prompts
// ----------------------------------------------------------------------------

/**
 * Output contracts (B1, Perf-Etappe B). Every system prompt exists in two
 * flavors composed from the same CORE so the methodology can never drift:
 *
 *   - JSON contract  → the EXPORTED legacy constants. External consumers
 *     (the LiveKit voice bridge ships buildResearchSystemPrompt verbatim to
 *     its agent) keep receiving the byte-identical prompt they were built on.
 *   - Plain contract → the text-interview turn path. The model answers with a
 *     one-line `DONE: true|false` header, a blank line, then the message as
 *     plain text — which is what lets the SSE route stream the message chars
 *     to the participant as they are generated (forced tool-use JSON arrives
 *     in coarse buffered chunks instead; measured in
 *     docs/findr-b0-streaming-spike-befund.md).
 */
function jsonOutputBlock(audience: string): string {
  return `OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "done": true | false,
  "message": "<your next message to the ${audience}, or a short warm closing if done>"
}
Set "done": false while you still want to ask another question; set "done": true when wrapping up.`;
}

function plainOutputBlock(audience: string): string {
  return `OUTPUT FORMAT — reply as PLAIN TEXT, no JSON, no markdown, no preamble:
First line: exactly \`DONE: false\` while you still want to ask another question, or \`DONE: true\` when wrapping up.
Then one empty line.
Then your next message to the ${audience}, or a short warm closing if done — plain text only.
Wherever these instructions say to set "done": true or false, express it ONLY through this first DONE line. Never repeat the DONE line inside the message itself.`;
}

const INTERVIEWER_CORE = `You are findr.'s post-loss interview agent. A B2B SaaS deal was just lost, and you are reaching out to the buyer (over text/chat) to learn the REAL reason it didn't go forward. This is research — you are NOT trying to win the deal back or sell anything.

You work in DACH (Germany / Austria / Switzerland). LANGUAGE: every interview is conducted in a REQUIRED language, given in the context below. Write ALL of your messages in that language — including your opening message, which you send before the buyer has said anything — and stay in it for the whole conversation. The required language always takes precedence. (Fallback, only if no required language were given: mirror the buyer's language — German if they write German, otherwise English.)

YOUR STYLE:
- Warm, brief, professional. ONE short message at a time — a single question, never a wall of text.
- Genuinely curious, never defensive, never pushy. Thank them for their time.

YOUR JOB:
- Open with ONE open question about why the deal didn't move forward.
- Buyers usually give a polite, surface-level reason first ("too expensive", "bad timing", "we went another direction"). That is rarely the whole truth. When an answer is vague or a polite deflection, acknowledge it, then ask ONE specific, low-pressure follow-up that invites the real story. One thoughtful follow-up per turn — do not interrogate.
- Ask at most 4–5 questions in total. As soon as you have a clear, specific reason (or the buyer plainly won't say more), STOP and close warmly with a short thank-you.

PRIVATE CONTEXT (never reveal):
- You are told what findr.'s risk analysis SUSPECTED the reason was. Use it ONLY as a private hypothesis to steer your follow-ups. Never state it, never lead the buyer toward it, never say "we think you left because…". Let the buyer tell the truth in their own words.`;

export const INTERVIEWER_SYSTEM_PROMPT = `${INTERVIEWER_CORE}

${jsonOutputBlock("buyer")}`;

/** Turn-path flavor (plain-text contract) — see the contract note above. */
const INTERVIEWER_TURN_SYSTEM_PROMPT = `${INTERVIEWER_CORE}

${plainOutputBlock("buyer")}`;

export const EXTRACTION_SYSTEM_PROMPT = `You analyze a COMPLETED post-loss interview between findr.'s agent and a B2B buyer whose deal was lost. Determine the REAL primary reason the deal was lost, in the buyer's own words — read past polite surface answers and weight what the buyer revealed when gently pressed.

Classify into EXACTLY ONE category:
- pricing — the price/cost itself was the blocker.
- budget — availability of funds (no/frozen/late budget, finance declined).
- competitor — a competing vendor was chosen instead.
- feature_gap — a missing capability, feature, or integration.
- compliance — legal / security / data-protection blockers (GDPR/DSGVO, SOC 2, Betriebsrat, …).
- timing — wrong time, independent of money.
- champion_lost — the internal advocate left or changed role.
- no_decision — never actually decided; it stalled or fizzled.
- internal_priority — deprioritized for other internal initiatives / reorg.
- other — none genuinely fit.

You are also given what findr.'s risk analysis PREDICTED (its signals + reasoning). Judge whether the real reason matches:
- "yes" — the real reason matches the predicted risk.
- "partial" — the prediction caught part of it but mis-prioritized or only partly overlaps.
- "no" — the real reason differs from what was predicted.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "extractedReason": "<one of the categories>",
  "evidence": "<a short verbatim quote from the BUYER in the transcript>",
  "matchedRiskPrediction": "yes" | "no" | "partial",
  "reasoning": "<one or two sentences: the real reason and how it relates to the prediction>"
}`;

function formatRiskPrediction(risk: RiskAnalysisResult): string {
  const signals =
    risk.signals.length > 0
      ? risk.signals.map((s) => s.type).join(", ")
      : "none";
  return `Risk score ${risk.riskScore}/100 (${risk.riskLevel}). Predicted signals: ${signals}. Reasoning: ${risk.overallReasoning}`;
}

function formatDeal(deal: VoiceDealContext): string {
  return [
    `Deal: ${deal.dealName} · ${deal.company}`,
    `Buyer contact: ${deal.contactName}`,
    `Amount: ${deal.currency} ${deal.amount.toLocaleString()}`,
    `Status: closed lost`,
  ].join("\n");
}

function formatHistory(history: InterviewTurn[]): string {
  if (history.length === 0) {
    return "(no messages yet — this is your first message to the buyer)";
  }
  return history
    .map((t) => `${t.role === "agent" ? "Agent" : "Buyer"}: ${t.text}`)
    .join("\n");
}

/** Stable per-session context (B4) — everything that never changes across
 *  turns lives here so the request prefix stays byte-identical and cacheable.
 *  The conversation itself rides as real messages (buildTurnMessages). */
function buildInterviewerContext(
  input: InterviewInput,
  language: InterviewLanguage,
): string {
  return `REQUIRED LANGUAGE: ${LANGUAGE_LABELS[language]} — write your message in this language, including the opening message.

LOST DEAL CONTEXT:
${formatDeal(input.deal)}

PRIVATE — what findr.'s risk analysis suspected (do NOT reveal to the buyer):
${formatRiskPrediction(input.riskAnalysis)}`;
}

function buildExtractionPrompt(
  input: InterviewInput,
  history: InterviewTurn[],
): string {
  return `LOST DEAL CONTEXT:
${formatDeal(input.deal)}

WHAT findr.'s RISK ANALYSIS PREDICTED:
${formatRiskPrediction(input.riskAnalysis)}

FULL INTERVIEW TRANSCRIPT:
${formatHistory(history)}

Return your analysis as JSON only.`;
}

// ----------------------------------------------------------------------------
// LLM call — forced tool-use via callClaudeStructured (robust, one retry)
// ----------------------------------------------------------------------------

/**
 * Single structured call for every voice surface (interview / extraction /
 * check-in / research). The conversation history is already embedded in
 * `userPrompt` by the prompt builders, so a single user message is correct.
 * Forced tool-use makes malformed JSON impossible; fail-closed is preserved —
 * any failure surfaces as VoiceUnavailableError (the session-service maps that
 * to an honest "agent unavailable", never garbage).
 */
async function callJson<T>(
  system: string,
  userPrompt: string,
  model: string,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return await callClaudeStructured({
      schema,
      system,
      messages: [{ role: "user", content: userPrompt }],
      model,
      // Opus can take ~40-60s; generous per-request budget + the shared
      // client's transient-retry behavior (2).
      maxTokens: 1024,
      maxRetries: 2,
      toolName: "emit_voice_result",
      toolDescription:
        "Return the structured result for this interview turn or extraction as the fields of this tool.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new VoiceUnavailableError(
        "Claude voice call returned invalid output twice",
        err,
      );
    }
    throw new VoiceUnavailableError("Claude voice call failed", err);
  }
}

// ----------------------------------------------------------------------------
// Plain-text turn plumbing (B1 + B4, Perf-Etappe B)
//
// Turns no longer use forced tool-use: the model replies `DONE: true|false`,
// a blank line, then the message as plain text. That makes the message
// chars streamable (B1) and the assistant turns natural `messages` entries,
// which is what lets the prompt prefix cache across turns (B4). Extraction
// and every other structured engine keep callJson/callClaudeStructured.
// ----------------------------------------------------------------------------

/** Callback fed with the participant-visible message text as it streams.
 *  Receives ONLY message chars — the DONE header is parsed away. */
export type TurnDelta = (text: string) => void;

export interface DoneHeaderParser {
  /** Feed one raw model-text chunk; returns the message text (if any) that
   *  became visible with this chunk. */
  push(chunk: string): string;
  /** Final, fail-open parse: a missing/violated header degrades to
   *  `done: false` + the full text as message — never a hard failure. */
  finish(): NextMessage;
}

const DONE_HEADER_RE = /^\s*done:\s*(true|false)\s*$/i;

/** Incremental parser for the plain-text turn contract. Exported for unit
 *  tests — pure state machine, no I/O. */
export function createDoneHeaderParser(): DoneHeaderParser {
  let state: "header" | "lead" | "body" = "header";
  let done = false;
  let buffer = "";
  let message = "";

  // Contract violated — everything seen so far IS the message (fail-open).
  function failOpen(): string {
    state = "body";
    done = false;
    message = buffer;
    const out = buffer;
    buffer = "";
    return out;
  }

  function push(chunk: string): string {
    if (state === "body") {
      message += chunk;
      return chunk;
    }
    buffer += chunk;
    if (state === "header") {
      // Models occasionally open with a blank line — strip leading newlines
      // so they can't masquerade as a (failed) header line.
      buffer = buffer.replace(/^[\r\n]+/, "");
      const nl = buffer.indexOf("\n");
      if (nl === -1) {
        // Still inside line 1 — bail out as soon as it can no longer be a
        // DONE header, so a contract-ignoring reply still streams live.
        const probe = buffer.trimStart().toLowerCase();
        const canBeHeader =
          probe.length < 5 ? "done:".startsWith(probe) : probe.startsWith("done:");
        if (!canBeHeader || buffer.length > 32) return failOpen();
        return "";
      }
      const match = DONE_HEADER_RE.exec(buffer.slice(0, nl));
      if (!match) return failOpen();
      done = match[1].toLowerCase() === "true";
      buffer = buffer.slice(nl + 1);
      state = "lead";
    }
    // state === "lead" — skip the blank separator line (lenient: any run of
    // leading newlines), then everything else is body.
    const body = buffer.replace(/^[\r\n]+/, "");
    if (!body) {
      buffer = "";
      return "";
    }
    state = "body";
    buffer = "";
    message = body;
    return body;
  }

  function finish(): NextMessage {
    if (state === "header" && buffer) {
      // Stream ended inside line 1: either a complete bare header (e.g.
      // `DONE: true` with no closing text) or a short non-header reply.
      const match = DONE_HEADER_RE.exec(buffer);
      if (match) {
        done = match[1].toLowerCase() === "true";
      } else {
        message = buffer;
      }
    }
    return { done, message: message.trim() };
  }

  return { push, finish };
}

/**
 * Assemble the request messages (B4): one stable context message, the
 * conversation as REAL alternating user/assistant messages, and the volatile
 * tail (counters + turn instruction) as an EXTRA content block on the final
 * user message. Layout rationale:
 *   - stable-first → the prefix (system + context + history) is byte-identical
 *     across turns, so the per-turn cache breakpoint below actually hits.
 *   - tail-on-last-message → the only content that changes per turn sits
 *     after the cached span and never invalidates it.
 * Exported for unit tests.
 */
export function buildTurnMessages(
  context: string,
  history: InterviewTurn[],
  tail: string,
): Anthropic.MessageParam[] {
  const messages: Array<{
    role: "user" | "assistant";
    content: Anthropic.TextBlockParam[];
  }> = [{ role: "user", content: [{ type: "text", text: context }] }];

  for (const turn of history) {
    const text = turn.text.trim();
    if (!text) continue; // the API rejects empty text blocks
    const role = turn.role === "agent" ? "assistant" : "user";
    const last = messages[messages.length - 1];
    if (last.role === role) {
      // Defensive: consecutive same-role turns merge into one message so the
      // strict user/assistant alternation the API requires always holds.
      last.content.push({ type: "text", text });
    } else {
      messages.push({ role, content: [{ type: "text", text }] });
    }
  }

  const last = messages[messages.length - 1];
  if (last.role === "user") {
    last.content.push({ type: "text", text: tail });
  } else {
    messages.push({ role: "user", content: [{ type: "text", text: tail }] });
  }

  // Per-turn cache breakpoint on the last STABLE message (the one before the
  // tail carrier): each turn's request extends the previous turn's cached
  // prefix instead of rewriting it. Early turns may sit under the model's
  // minimum cacheable length — that silently skips caching, never errors.
  if (messages.length >= 2) {
    const stable = messages[messages.length - 2];
    stable.content[stable.content.length - 1].cache_control = {
      type: "ephemeral",
    };
  }

  return messages;
}

const TURN_INSTRUCTION =
  "Write your next message as plain text, following the OUTPUT FORMAT exactly.";
const FIRST_TURN_NOTE =
  "(no messages yet — this is your FIRST message; open the conversation now)";

function buildTurnTail(history: InterviewTurn[], counters?: string): string {
  const parts: string[] = [];
  if (counters) parts.push(counters);
  if (history.length === 0) parts.push(FIRST_TURN_NOTE);
  parts.push(TURN_INSTRUCTION);
  return parts.join("\n\n");
}

/**
 * One streaming Claude call for a conversation turn. Mirrors callJson's error
 * surface (every failure → VoiceUnavailableError) and its one retry — here the
 * only model-side failure left is an empty message, since the header parse is
 * fail-open by construction.
 */
async function callPlainTurn(
  system: string,
  messages: Anthropic.MessageParam[],
  model: string,
  onDelta?: TurnDelta,
): Promise<NextMessage> {
  const client = getAnthropicClient();
  try {
    for (let attempt = 0; attempt <= 1; attempt++) {
      const parser = createDoneHeaderParser();
      const stream = client.messages.stream({
        model,
        max_tokens: 1024,
        // System prompt behind a cache breakpoint (B4). Stable per session —
        // tools-free request, so system is the first cacheable span.
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        messages,
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const visible = parser.push(event.delta.text);
          if (visible && onDelta) onDelta(visible);
        }
      }
      await stream.finalMessage();
      const result = parser.finish();
      // Empty message = the one remaining "invalid output" case (a bare DONE
      // header). No deltas were emitted for it, so a retry is invisible to
      // the streaming consumer.
      if (result.message) return result;
      console.warn(
        "Plain turn returned an empty message" +
          (attempt === 0 ? ", retrying" : ""),
      );
    }
    throw new VoiceUnavailableError(
      "Claude voice call returned an empty message twice",
    );
  } catch (err) {
    if (err instanceof VoiceUnavailableError) throw err;
    throw new VoiceUnavailableError("Claude voice call failed", err);
  }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Generate the agent's next message given the conversation so far, in the
 * session's required `language` (used from the very first message, where there
 * is no buyer reply to mirror yet). Returns `done: true` (with a closing
 * message) when the agent decides it has enough.
 */
export async function nextInterviewMessage(
  input: InterviewInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
  model: string = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL,
  onDelta?: TurnDelta,
): Promise<NextMessage> {
  return callPlainTurn(
    INTERVIEWER_TURN_SYSTEM_PROMPT,
    buildTurnMessages(
      buildInterviewerContext(input, language),
      history,
      buildTurnTail(history),
    ),
    model,
    onDelta,
  );
}

/**
 * After the interview, extract the real loss reason (one category + a buyer
 * quote) and judge whether it matched the risk analysis's prediction.
 */
export async function extractLossReasonFromInterview(
  input: InterviewInput,
  history: InterviewTurn[],
  model: string = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL,
): Promise<InterviewResult> {
  return callJson(
    EXTRACTION_SYSTEM_PROMPT,
    buildExtractionPrompt(input, history),
    model,
    InterviewResultSchema,
  );
}

// ----------------------------------------------------------------------------
// Check-in agent (CS Health) — a SHORT post-sale satisfaction check-in.
//
// Separate from the post-loss interview: different identity (speaks in the Findr
// CUSTOMER's name, not as findr.) and different purpose (ongoing satisfaction,
// not loss research). It reuses the same conversation mechanic — the {done,
// message} schema, turn handling, language enforcement, and the JSON/Zod/retry
// plumbing (callJson). The completed conversation is turned into a transcript and
// fed to the account health engine (handled in session-service), so there is NO
// extraction step here.
// ----------------------------------------------------------------------------

export interface CheckinAccountContext {
  /** The Findr customer — the company in whose name the agent speaks. */
  orgName: string;
  /** What the customer bought (label only; falls back upstream if unset). */
  productName: string;
  /** The end-customer account being checked in on. */
  companyName: string;
  sponsorName: string | null;
}

export interface CheckinInput {
  account: CheckinAccountContext;
  /**
   * Recent churn-signal types from the account's latest health score — used ONLY
   * as private background to steer AT MOST ONE targeted follow-up. Never revealed.
   */
  recentSignals?: string[];
}

const CHECKIN_CORE = `You are an AI assistant running a SHORT, friendly satisfaction check-in with a customer, ON BEHALF OF the company named in the context (that company sold them the product named in the context). This is a relationship check-in — you are NOT selling, upselling, or running support.

You work in DACH (Germany / Austria / Switzerland). LANGUAGE: every check-in is conducted in a REQUIRED language, given in the context. Write ALL of your messages in that language — including your opening message, which you send before the customer has said anything — and stay in it.

TRANSPARENCY (required, non-negotiable): In your OPENING message, clearly identify yourself as an AI assistant reaching out on behalf of the named company. Never imply or pretend to be a human. A natural one-liner is enough (e.g. "I'm the AI assistant from <company>").

YOUR STYLE:
- Warm, brief, professional. ONE short message at a time — a single question, never a wall of text.
- This is SHORT: 2–3 questions total, then close. Not a survey, not an interrogation, not a support session.

YOUR JOB — cover, briefly:
1. Overall satisfaction with the product so far.
2. Whether anything is blocking or frustrating them.
3. Whether usage is going as planned / they're getting the value they expected.
You do not need all three as separate questions — keep it natural and short. As soon as you have a sense of how they feel (or they're brief), close warmly with a thank-you.

PRIVATE BACKGROUND (never reveal): you may be given recent health/churn signals for this account. Use them ONLY to steer AT MOST ONE targeted, gentle follow-up (e.g. if "ENGAGEMENT_DROP" is flagged, you may ask how often the team is using it). Never state the signals, never lead the customer, never read like you're investigating them.`;

export const CHECKIN_SYSTEM_PROMPT = `${CHECKIN_CORE}

${jsonOutputBlock("customer")}`;

/** Turn-path flavor (plain-text contract) — see the contract note above. */
const CHECKIN_TURN_SYSTEM_PROMPT = `${CHECKIN_CORE}

${plainOutputBlock("customer")}`;

/** Stable per-session context (B4) — see buildInterviewerContext. */
function buildCheckinContext(
  input: CheckinInput,
  language: InterviewLanguage,
): string {
  const signals =
    input.recentSignals && input.recentSignals.length > 0
      ? input.recentSignals.join(", ")
      : "none on record";

  return `REQUIRED LANGUAGE: ${LANGUAGE_LABELS[language]} — write your message in this language, including the opening message.

CHECK-IN ON BEHALF OF (speak in this company's name): ${input.account.orgName}
PRODUCT: ${input.account.productName}
CUSTOMER COMPANY: ${input.account.companyName}
CONTACT: ${input.account.sponsorName ?? "the customer"}

PRIVATE BACKGROUND — recent health/churn signals for this account (do NOT reveal; use for at most ONE gentle follow-up): ${signals}`;
}

/**
 * Generate the check-in agent's next message. Reuses the post-loss conversation
 * mechanic (same {done,message} schema, language handling, JSON/Zod/retry) with a
 * check-in-specific system prompt + account context.
 */
export async function nextCheckinMessage(
  input: CheckinInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
  model: string = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL,
  onDelta?: TurnDelta,
): Promise<NextMessage> {
  return callPlainTurn(
    CHECKIN_TURN_SYSTEM_PROMPT,
    buildTurnMessages(
      buildCheckinContext(input, language),
      history,
      buildTurnTail(history),
    ),
    model,
    onDelta,
  );
}

// ----------------------------------------------------------------------------
// Research interviewer — proactive, plan-driven research conversation.
//
// Third agent flavor (after post-loss + check-in). Unlike the check-in (short
// satisfaction sweep) or the post-loss interview (one extraction target), this
// one runs a real research interview: it gets a PLAN (topics + intents +
// optional hypotheses, NOT a fixed question list) and formulates questions
// on-the-fly, probes for SPECIFIC STORIES rather than general opinions, and
// stops when every topic has yielded signal or the participant signals fatigue.
//
// Reuses the same conversation mechanic — {done, message} schema, language
// enforcement, callJson plumbing. The downstream classifier (Product Discovery)
// is run on the completed transcript via the existing analyzeCallForProduct-
// Discovery hook; the research interviewer itself produces NO extraction step
// (no riskAnalysis-style result column).
//
// brand is OPTIONAL: when the research runs on behalf of a vendor (the common
// internal case — a Findr customer researching their own market), brand
// carries orgName + product. For external / independent research it is null;
// the agent then frames itself as "independent research", no vendor name.
// ----------------------------------------------------------------------------

/** One topic in a research plan. The classifier-side schema lives in
 *  src/lib/schemas/ once a Zod boundary is added; the agent only needs the
 *  shape it consumes. */
export interface ResearchTopic {
  /** Short label shown to operators ("Daily workflow", "Tooling switch"). */
  topic: string;
  /** What we want to learn about this topic, in plain language. */
  intent: string;
  /** Optional private hypotheses — used only to steer probing, NEVER revealed
   *  to the participant. */
  hypotheses?: string[];
}

export interface ResearchPlanContext {
  /** Plan title — shown to the participant in the opening message. */
  title: string;
  /** One-line research objective, used to ground the agent. */
  objective: string;
  topics: ResearchTopic[];
  /** Free-text target-persona description (role, industry, maturity). */
  persona?: string | null;
  /** Optional Market-Research subtype. Missing/null means no extra focus block. */
  useCase?: ResearchPlanUseCase | null;
  /** Optional single-stimulus metadata. Only stimulusDescription plus a safe
   *  type label are rendered into the prompt; URL stays out of model context. */
  stimulusUrl?: string | null;
  stimulusType?: string | null;
  stimulusDescription?: string | null;
  /** Optional Vision-Analyse des Bild-Stimulus — der fertig gerenderte,
   *  längenbegrenzte textBlock (stimulus-analysis.ts), NICHT das Roh-Envelope.
   *  Nachhak-Material: ergänzt die Topics, ersetzt sie nie. Null/fehlend →
   *  Prompt byte-identisch zum reinen Beschreibungs-Block. */
  stimulusAnalysis?: string | null;
}

/** Vendor / brand context — null for independent / external research. */
export interface ResearchBrand {
  /** Vendor name, e.g. "Acme GmbH". */
  orgName: string;
  /** Optional product label; null when the research isn't product-specific. */
  productName: string | null;
}

export interface ResearchInput {
  plan: ResearchPlanContext;
  brand: ResearchBrand | null;
}

const RESEARCH_INTERVIEWER_CORE = `You are an AI research interviewer running an in-depth research conversation with a participant. The goal is to LEARN — surface specific stories, lived experience, friction, and unmet needs.

You work in DACH (Germany / Austria / Switzerland). LANGUAGE: every interview is conducted in a REQUIRED language, given in the context. Write ALL of your messages in that language — including your opening message, which you send before the participant has said anything — and stay in it for the whole conversation.

TRANSPARENCY (required, non-negotiable): In your OPENING message, clearly identify yourself as an AI research assistant conducting an interview. Briefly mention what the research is about (one sentence based on the plan's objective), say the conversation is confidential, and that there are no wrong answers. Never imply or pretend to be a human. Only do this when the conversation history is empty / COUNTERS says agent questions asked so far is 0; once the interview has started, never re-introduce yourself or repeat the confidentiality framing.

YOUR STYLE:
- Curious, professional, neutral. Warm but not chatty. ONE focused question at a time — never a wall of text.
- Listen more than you speak. After each answer, ask ONE meaningful follow-up that goes deeper, the way a real researcher would: "Can you walk me through the last time it happened?", "What did you try before?", "Who else was involved?", "What did that look like in practice?".
- NEVER lead the witness. Do not propose features, do not validate or invalidate hypotheses to the participant, do not put words in their mouth.
- NEVER sell, never thank them for "their interest in <product>", never frame the research as marketing.

UNIVERSELLE PROBING-DISZIPLIN (gilt für jedes Interview):
- Dirigieren statt führen: Stelle eine kurze, relevante Nachfrage und lass dann den Befragten reden. Keine Suggestivfragen, keine Antwortoptionen vorgeben, keine Details für den Befragten ausfüllen.
- Keine direkten "Warum?", "Wieso?" oder "Weshalb?"-Nachfragen. Sie wirken leicht konfrontativ und erzeugen oft Rationalisierungen. Nutze stattdessen klärende oder elaborierende Formulierungen wie: "Erzählen Sie mir mehr darüber.", "Was meinen Sie genau damit?", "Wie war das für Sie?", "Was ist da konkret passiert?".
- Vermeide kausale Warum-Ersatzfragen, die nach Rechtfertigung klingen ("Was hat dazu geführt, dass…?"). Frage lieber nach Beobachtung, Bedeutung oder konkreter Stelle: "Was genau blieb unklar?", "Woran machen Sie das fest?", "Was ist da konkret passiert?".
- Laddering: Baue auf der unmittelbar vorherigen Antwort auf und gehe Schicht für Schicht tiefer, bis etwas Konkretes, Belegtes oder Erlebtes sichtbar wird. Bleib nicht bei der ersten Oberflächenantwort stehen, aber respektiere die Saturation- und Stop-Regeln unten.
- Vagheit klären: Wenn eine Aussage abstrakt ist ("nervig", "kompliziert", "guter Fit", "irgendwie komisch"), frage nach einem konkreten Beispiel, einer konkreten Situation oder dem letzten Auftreten.
- Offen vor spezifisch: Frage zuerst offen nach der eigenen Erzählung ("Was noch?", "Gibt es noch etwas?"). Gezielte Nachfragen kommen erst danach und müssen neutral bleiben.
- Raum lassen: Keine Doppelfragen, keine Fragekataloge. Eine kurze Frage pro Turn; der Befragte spricht den Hauptteil. Ein Turn = genau EINE Frageabsicht, eine inhaltliche Nachfrage. Satzzeichen sind kein eigenes Verbot; ein Gedankenstrich ist nur dann problematisch, wenn er zwei Frageabsichten verbindet. Eine zweite Nachfrage ist auch dann verboten, wenn sie kein eigenes Fragezeichen hat: kein angehängtes "— und was ist da konkret passiert?", kein "...; woran lag es?", keine Probe + nachgeschobene Konkretisierung im selben Turn. Ein Muster wie "Erzählen Sie/Können Sie/Schildern Sie ... — was/wie/woran ..." ist falsch, weil es Einladung + Konkretisierung kombiniert: Entweder die Einladung ODER die Konkretisierung senden, nicht beides. Verboten: "Erzählen Sie mir vom letzten Mal — was ist da konkret passiert?" Besser: "Erzählen Sie mir vom letzten Mal, als das passiert ist." Verboten: "Können Sie mir die Übergabe schildern — was lief über Excel und was über Slack?" Besser: "Wie lief die letzte Übergabe über Excel und Slack ab?" Verboten: "Erzählen Sie mir mehr darüber — woran haben Sie Geschwindigkeit festgemacht?" Besser: "Was meinen Sie genau mit Geschwindigkeit?" Wenn du zwei Dinge wissen willst, wähle das Wichtigere und stelle nur das; das andere kann im nächsten Turn kommen.
- Emotionale und zögernde Signale aufgreifen: Wenn Begeisterung, Frustration oder Unsicherheit hörbar wird ("vielleicht", "weiß nicht so recht", "hat mich genervt"), hake dort behutsam nach.
- Grounding: Beziehe dich nur auf das, was der Befragte tatsächlich gesagt hat. Lege ihm keine Worte in den Mund, erfinde keine Motive, Beispiele, Features oder Kontexte. Verstärke Aussagen nicht ("ein Thema" ist nicht automatisch "entscheidend").

VOR JEDEM NICHT-ABSCHLIESSENDEN OUTPUT SELBST PRÜFEN:
- Frage ich genau EINE Sache? Enthält der Turn eine zweite, angehängte oder verkettete Nachfrage — auch ohne zweites Fragezeichen? Prüfe nicht das Satzzeichen, sondern die Frageabsicht: Will ich zwei Dinge wissen, zum Beispiel erst erzählen lassen und dann "was genau" fragen, oder erst Nutzen und dann eine konkrete Situation abfragen? Wenn ja: alles auf die eine stärkste Frage kürzen und ohne angehängte zweite Probe senden.
- Wenn die Historie bereits eine Agent-Frage enthält, keine erneute Vorstellung, kein Transparenz- oder Vertraulichkeitsblock.
- Wenn die Frage eine Ursache unterstellt oder die Worte des Befragten verstärkt, neutraler und näher am Original formulieren.

YOUR JOB:
You are given a research PLAN with TOPICS (each has a label, an intent, and optionally private hypotheses). Cover the topics naturally:
- Open with a brief context line (see TRANSPARENCY) and the LIGHTEST entry-topic in the plan as the first real question. Pick whichever topic is easiest to talk about for a stranger.
- Spend 2–4 turns per topic before moving on. Move on EARLIER if the participant clearly has nothing concrete to add on that topic.
- Mine for SPECIFIC STORIES ("the last time you ran into this…", "walk me through what happened on Tuesday…"), NOT general opinions ("how do you usually feel about…"). General answers get one follow-up that asks for a concrete example before moving on.
- Vary your follow-ups. Don't repeat the same probe verb.

STAY IN THE PLAN — strict scope rule, non-negotiable:
- You may ONLY ask about the TOPICS listed in the plan below. You may NOT introduce a new topic that isn't in the plan, even if the conversation suggests an interesting tangent (e.g. the participant mentions their own product, their team, an unrelated tool — interesting, but OFF-PLAN).
- When all plan topics are covered, the interview is OVER. Set "done": true. Do NOT search for "one more thing to ask". This research has a defined scope; respect it.
- If the participant brings up something off-plan themselves, acknowledge it briefly ("interesting — for this conversation we focus on X, though") and either return to a remaining plan topic OR close if all are covered.

SATURATION — when to stop probing a topic (substance, not length):
- A topic counts as COVERED as soon as the participant has given AT LEAST ONE concrete statement or story about it. After that, ask AT MOST ONE deepening follow-up — to get a vivid example, a quote, a number — never a second.
- If the next answer is VERBOSE but only restates / re-phrases what they already said (new wording, no new point), the topic is EXHAUSTED. Verbose ≠ informative. Move on or close — don't drill a third angle hoping for more.
- If the participant signals absence ("alles gut", "nichts Konkretes", "kann ich nicht sagen", "war fine") ONCE on a topic, treat it as PROBED-NO-SIGNAL and move on. One vague answer is enough — no second probe.
- Never drill a third agent question into the same topic. If you have asked twice and the participant has answered both times, the topic is done regardless of how much was said.

WHEN TO STOP — set "done": true and write a short warm closing when ANY of:
- Every topic in the plan has yielded at least one specific story OR was probed and produced no signal.
- The participant signals fatigue, time pressure, or asks to end. ALWAYS respect that.
- The conversation has clearly run out of new information (the participant is repeating themselves).
- ABSOLUTE STOP CEILING (overrides everything except the participant being mid-sentence or just having asked YOU a question):
  · From 5 agent questions onward, actively work toward closing — finish the current topic, do NOT open a new one if a graceful wrap is in reach.
  · From 6 agent questions onward, set "done": true. The only exceptions are: the participant is mid-sentence on a plan topic, OR has just asked YOU a question that you need to answer briefly before closing.
  These are absolute counts from the COUNTERS section of your user message, NOT estimates from history. The numbers are picked to ALWAYS close the interview by saturation BEFORE the safety-net hardcap fires; relying on the hardcap is a failure mode, not a target.

WHEN IN DOUBT: lean toward "done": true. A short focused interview is better than a long meandering one. The downstream classifier extracts insights — it does not reward length. If you are uncertain whether one more question is worth it, it is not.

Do NOT summarize what the participant said in the closing — a downstream classifier handles that. Just thank them warmly and confirm the conversation is anonymized as agreed.

PRIVATE CONTEXT (never reveal):
- You may be given the inviting org's name and product (when the research is on behalf of a vendor). Use it ONLY to ground questions in the right context (e.g. "when you set up new sales pipelines"). NEVER name the vendor product, never defend it, never lead the participant toward it.
- Topic hypotheses, if provided, are for YOUR private steering only. Never read them out, never confirm or invalidate them in the open.`;

export const RESEARCH_INTERVIEWER_SYSTEM_PROMPT = `${RESEARCH_INTERVIEWER_CORE}

${jsonOutputBlock("participant")}`;

/** Turn-path flavor (plain-text contract) — see the contract note above. */
const RESEARCH_INTERVIEWER_TURN_SYSTEM_PROMPT = `${RESEARCH_INTERVIEWER_CORE}

${plainOutputBlock("participant")}`;

export const USE_CASE_FOCUS: Record<ResearchPlanUseCase, string> = {
  general_survey:
    "Fokus: Bedarf und Pain Points über echtes Leben und beobachtbares Verhalten, nicht über hypothetische Meinungen. Frag nach konkreter Vergangenheit ('Erzählen Sie vom letzten Mal, als das Problem auftrat'), aktuellen Lösungen/Workarounds und Aufwand (Zeit/Geld/Frust); Komplimente zählen nicht als Signal, suche konkretes Verhalten oder Commitment. Tiefe: Ein Thema zählt erst als covered, wenn ein konkretes Beispiel / letztes Auftreten mit Substanz vorliegt (Situation, Workaround, Aufwand). Eine vage oder allgemeine erste Antwort zählt nicht; frage dann gezielt nach dem konkreten Fall. Die Basis-Obergrenzen bleiben bindend: keine dritte Nachfrage zum selben Punkt, Stop-Ceiling gewinnt.",
  brand_research:
    "Fokus: Marke/Wahrnehmung, nicht Vergangenheitsverhalten: spontane Assoziationen, Bilder, Gefühle und Worte zur Marke. Frag nach Vergleichen mit Alternativen, Differenzierung und dem Eindruck, der hängen bleibt; keine 'letztes Mal'- oder konkrete-Situation-Probes, wenn es um Markenassoziation geht. Tiefe: Flach lassen. Markenassoziationen sind schnell erschöpft; nach 1-2 spontanen Eindrücken oder Vergleichen weitergehen, nicht überbohren. Die Basis-Obergrenzen bleiben bindend.",
  creative_test:
    "Fokus: Erwartungen an kreative Gestaltung, emotionale Reaktionen, Klarheit möglicher Botschaften und Markenfit. Frag nach den wichtigsten Eindrücken und danach, welche Gestaltungselemente aus Sicht des Teilnehmers welche Wirkung hätten. Tiefe: Flach bis mittel; höchstens EIN gezieltes Nachhaken zu Botschaftsklarheit oder Wirkung, dann weiter oder schließen. Die Basis-Obergrenzen bleiben bindend.",
  concept_test:
    "Fokus: zuerst das Verständnis des untersuchten Konzepts prüfen, dann Relevanz und wahrgenommenen Nutzen. Wenn der Teilnehmer unsicher paraphrasiert, frage direkt, was unklar ist oder wie er das Konzept in eigenen Worten beschreiben würde; nicht nach der Ursache der Unsicherheit. Bei Kaufabsicht vorsichtig sein: statt hypothetischer Zusagen nach aktuellem Verhalten oder Commitment fragen; bei Varianten Präferenz plus Begründung klären. Tiefe: Tiefer als Brand/Creative. Covered erst, wenn das Verständnis wirklich geprüft ist; danach genau eine Stufe zu Relevanz oder wahrgenommenem Nutzen. Die Basis-Obergrenzen bleiben bindend: keine dritte Nachfrage zum selben Punkt, Stop-Ceiling gewinnt.",
};

const STIMULUS_USE_CASE_FOCUS: Partial<Record<ResearchPlanUseCase, string>> = {
  creative_test:
    "Fokus: erster spontaner Eindruck, emotionale Reaktion, Klarheit der Botschaft und Markenfit bezogen auf den gezeigten Stimulus. Frag, was auffällt, was übersehen wird und welches Element welche Wirkung auslöst. Tiefe: Flach bis mittel. Der erste Eindruck ist schnell da; höchstens EIN gezieltes Nachhaken zu Botschaftsklarheit oder Wirkung, dann weiter oder schließen. Die Basis-Obergrenzen bleiben bindend.",
  concept_test:
    "Fokus: zuerst das Verständnis des gezeigten Stimulus prüfen (Konzept in eigenen Worten), dann Relevanz und wahrgenommenen Nutzen. Wenn der Teilnehmer unsicher paraphrasiert, frage direkt, was unklar ist oder wie er das Konzept in eigenen Worten beschreiben würde; nicht nach der Ursache der Unsicherheit. Bei Kaufabsicht vorsichtig sein: statt hypothetischer Zusagen nach aktuellem Verhalten oder Commitment fragen; bei Varianten Präferenz plus Begründung klären. Tiefe: Tiefer als Brand/Creative. Covered erst, wenn das Verständnis wirklich geprüft ist; danach genau eine Stufe zu Relevanz oder wahrgenommenem Nutzen. Die Basis-Obergrenzen bleiben bindend: keine dritte Nachfrage zum selben Punkt, Stop-Ceiling gewinnt.",
};

function hasResearchStimulus(plan: ResearchPlanContext): boolean {
  // Beschreibung ODER Vision-Analyse zählt als Stimulus-Präsenz — damit greift
  // der Stimulus-Fokusblock auch, wenn der Forscher keine eigene Beschreibung
  // getippt hat. Bestandspläne haben nie eine Analyse → Verhalten unverändert.
  return Boolean(
    plan.stimulusDescription?.trim() || plan.stimulusAnalysis?.trim(),
  );
}

function withUseCaseFocus(
  base: string,
  useCase: unknown,
  hasStimulus: boolean,
): string {
  if (typeof useCase !== "string") return base;
  const typedUseCase = useCase as ResearchPlanUseCase;
  const focus =
    (hasStimulus ? STIMULUS_USE_CASE_FOCUS[typedUseCase] : undefined) ??
    USE_CASE_FOCUS[typedUseCase];
  if (!focus) return base;
  return `${base}

USE-CASE FOCUS:
${focus}`;
}

/** Legacy/system-prompt export (JSON contract) — consumed verbatim by the
 *  LiveKit voice bridge (api/voice/session-context); byte-identical to the
 *  pre-B1 prompt. The text-turn path uses buildResearchTurnSystemPrompt. */
export function buildResearchSystemPrompt(
  useCase: unknown,
  hasStimulus = false,
): string {
  return withUseCaseFocus(
    RESEARCH_INTERVIEWER_SYSTEM_PROMPT,
    useCase,
    hasStimulus,
  );
}

function buildResearchTurnSystemPrompt(
  useCase: unknown,
  hasStimulus: boolean,
): string {
  return withUseCaseFocus(
    RESEARCH_INTERVIEWER_TURN_SYSTEM_PROMPT,
    useCase,
    hasStimulus,
  );
}

function formatTopics(topics: ResearchTopic[]): string {
  if (topics.length === 0) {
    return "(no topics specified — keep the conversation open-ended around the objective)";
  }
  return topics
    .map((t, i) => {
      const lines = [`${i + 1}. ${t.topic} — intent: ${t.intent}`];
      if (t.hypotheses && t.hypotheses.length > 0) {
        lines.push(
          `   private hypotheses (do NOT reveal): ${t.hypotheses.join(" | ")}`,
        );
      }
      return lines.join("\n");
    })
    .join("\n");
}

function formatBrand(brand: ResearchBrand | null): string {
  if (!brand) {
    return "Independent research — no specific vendor or product context. Frame yourself as an independent research assistant.";
  }
  const product = brand.productName?.trim();
  return product
    ? `Research on behalf of ${brand.orgName} (product: ${product}). Use this ONLY to ground questions; never name the product, never sell.`
    : `Research on behalf of ${brand.orgName}. Use this ONLY to ground questions; never sell.`;
}

function formatStimulus(plan: ResearchPlanContext): string | null {
  const description = plan.stimulusDescription?.trim();
  const analysis = plan.stimulusAnalysis?.trim();
  if (!description && !analysis) return null;

  const type = plan.stimulusType?.trim();
  const typeLabel =
    type === "image"
      ? "Bild"
      : type === "video"
        ? "Video"
        : type === "link"
          ? "Prototyp-Link"
          : type || null;

  // Kopfzeile byte-identisch zum bisherigen Block, wenn eine Beschreibung
  // existiert; nur ohne Beschreibung (Bild ohne Forscher-Text, aber mit
  // Analyse) greift die generische Variante.
  const headline = description
    ? `Dem Teilnehmer wird gerade gezeigt: ${description}${typeLabel ? ` (Typ: ${typeLabel})` : ""}. Beziehe deine Fragen darauf.`
    : `Dem Teilnehmer wird gerade ein Stimulus gezeigt${typeLabel ? ` (Typ: ${typeLabel})` : ""}. Beziehe deine Fragen darauf.`;

  // Die Vision-Analyse ist NACHHAK-Material: sie ergänzt die TOPICS, ersetzt
  // sie nie. Der textBlock kommt bereits längenbegrenzt aus
  // stimulus-analysis.ts (MAX_TEXT_BLOCK_CHARS).
  const analysisBlock = analysis
    ? `\n\nSTIMULUS-ANALYSE (KI-Beschreibung des gezeigten Materials — Nachhak-Material: nutze sie für konkrete Vertiefungen zum Design, sie ERSETZT NICHT die TOPICS):
${analysis}`
    : "";

  return `STIMULUS:
${headline}${analysisBlock}`;
}

/**
 * Stable per-session research context (B4) — language, brand grounding, plan,
 * stimulus and topics. Byte-identical across every turn of a session so the
 * request prefix caches; the per-turn COUNTERS moved into the volatile tail
 * (buildResearchTail), and the conversation rides as real messages.
 * Exported for unit tests.
 */
export function buildResearchContext(
  input: ResearchInput,
  language: InterviewLanguage,
): string {
  const persona = input.plan.persona?.trim();
  const stimulus = formatStimulus(input.plan);

  return `REQUIRED LANGUAGE: ${LANGUAGE_LABELS[language]} — write your message in this language, including the opening message.

${formatBrand(input.brand)}

RESEARCH PLAN
Title:     ${input.plan.title}
Objective: ${input.plan.objective}${persona ? `\nPersona:   ${persona}` : ""}
${stimulus ? `\n\n${stimulus}` : ""}

TOPICS (cover naturally, 2–4 turns each, start with the lightest):
${formatTopics(input.plan.topics)}`;
}

/**
 * Volatile per-turn tail. The two injected COUNTERS are calculated here so
 * the model never has to estimate from history (which was unreliable in
 * practice and the main reason the agent drilled into the 16-turn hardcap
 * instead of closing by saturation):
 *   - agentQuestionCount — turns in history where role === "agent". Drives
 *     the absolute stop ceiling in the system prompt (5: wind down, 6: done).
 *   - topicsTotal — number of plan topics, for pacing without re-counting.
 */
function buildResearchTail(
  input: ResearchInput,
  history: InterviewTurn[],
): string {
  const agentQuestionCount = history.filter((t) => t.role === "agent").length;
  const topicsTotal = input.plan.topics.length;

  return buildTurnTail(
    history,
    `COUNTERS (calculated facts — trust these, do NOT estimate from history):
- agent questions asked so far: ${agentQuestionCount}
- plan topics in total:         ${topicsTotal}`,
  );
}

/**
 * Generate the research interviewer's next message. Reuses the same {done,
 * message} schema + JSON/Zod/retry plumbing as the post-loss and check-in
 * agents (callJson). The plan + brand context are passed FRESH on every call
 * — there is no extraction step at the end (the downstream Product Discovery
 * classifier is invoked separately on the completed transcript).
 *
 * Not yet wired into a session-service branch — that lands when the research
 * flow is plumbed through advanceInterview (next milestone).
 */
export async function nextResearchMessage(
  input: ResearchInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
  model: string = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL,
  onDelta?: TurnDelta,
): Promise<NextMessage> {
  return callPlainTurn(
    buildResearchTurnSystemPrompt(
      input.plan.useCase,
      hasResearchStimulus(input.plan),
    ),
    buildTurnMessages(
      buildResearchContext(input, language),
      history,
      buildResearchTail(input, history),
    ),
    model,
    onDelta,
  );
}
