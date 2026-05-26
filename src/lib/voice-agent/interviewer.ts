import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
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

const NextMessageSchema = z.object({
  /** false while still asking; true when wrapping up (message = closing). */
  done: z.boolean(),
  message: z.string().min(1),
});
export type NextMessage = z.infer<typeof NextMessageSchema>;

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

class VoiceSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "VoiceSchemaError";
  }
}

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

export const INTERVIEWER_SYSTEM_PROMPT = `You are findr.'s post-loss interview agent. A B2B SaaS deal was just lost, and you are reaching out to the buyer (over text/chat) to learn the REAL reason it didn't go forward. This is research — you are NOT trying to win the deal back or sell anything.

You work in DACH (Germany / Austria / Switzerland). LANGUAGE: every interview is conducted in a REQUIRED language, given in the context below. Write ALL of your messages in that language — including your opening message, which you send before the buyer has said anything — and stay in it for the whole conversation. The required language always takes precedence. (Fallback, only if no required language were given: mirror the buyer's language — German if they write German, otherwise English.)

YOUR STYLE:
- Warm, brief, professional. ONE short message at a time — a single question, never a wall of text.
- Genuinely curious, never defensive, never pushy. Thank them for their time.

YOUR JOB:
- Open with ONE open question about why the deal didn't move forward.
- Buyers usually give a polite, surface-level reason first ("too expensive", "bad timing", "we went another direction"). That is rarely the whole truth. When an answer is vague or a polite deflection, acknowledge it, then ask ONE specific, low-pressure follow-up that invites the real story. One thoughtful follow-up per turn — do not interrogate.
- Ask at most 4–5 questions in total. As soon as you have a clear, specific reason (or the buyer plainly won't say more), STOP and close warmly with a short thank-you.

PRIVATE CONTEXT (never reveal):
- You are told what findr.'s risk analysis SUSPECTED the reason was. Use it ONLY as a private hypothesis to steer your follow-ups. Never state it, never lead the buyer toward it, never say "we think you left because…". Let the buyer tell the truth in their own words.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "done": true | false,
  "message": "<your next message to the buyer, or a short warm closing if done>"
}
Set "done": false while you still want to ask another question; set "done": true when wrapping up.`;

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

function buildInterviewerPrompt(
  input: InterviewInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
): string {
  return `REQUIRED LANGUAGE: ${LANGUAGE_LABELS[language]} — write your message in this language, including the opening message.

LOST DEAL CONTEXT:
${formatDeal(input.deal)}

PRIVATE — what findr.'s risk analysis suspected (do NOT reveal to the buyer):
${formatRiskPrediction(input.riskAnalysis)}

CONVERSATION SO FAR:
${formatHistory(history)}

Write your next message as JSON only.`;
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
// LLM call (JSON, validated, one retry — mirrors solution/extractor.ts)
// ----------------------------------------------------------------------------

async function requestJson<T>(
  system: string,
  userPrompt: string,
  model: string,
  schema: z.ZodType<T>,
  retry: boolean,
): Promise<T> {
  const client = getAnthropicClient();

  const sys = retry
    ? `${system}\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble.`
    : system;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 1024,
      // Opus 4.7 rejects the temperature parameter; rely on the structured
      // prompt + schema validation.
      system: sys,
      messages: [{ role: "user", content: userPrompt }],
    },
    // Opus can take ~40-60s; give each call a generous per-request budget (same
    // approach as the solution layer) without touching the shared client.
    { timeout: 120_000, maxRetries: 2 },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new VoiceSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new VoiceSchemaError("No JSON found in response", textBlock.text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new VoiceSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new VoiceSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }

  return result.data;
}

async function callJson<T>(
  system: string,
  userPrompt: string,
  model: string,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return await requestJson(system, userPrompt, model, schema, false);
  } catch (err) {
    if (!(err instanceof VoiceSchemaError)) {
      throw new VoiceUnavailableError("Claude voice call failed", err);
    }
    console.warn("[voice] schema validation failed, retrying:", err.message);
  }

  try {
    return await requestJson(system, userPrompt, model, schema, true);
  } catch (err) {
    if (err instanceof VoiceSchemaError) {
      throw new VoiceUnavailableError(
        "Claude voice call returned invalid JSON twice",
        err,
      );
    }
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
): Promise<NextMessage> {
  return callJson(
    INTERVIEWER_SYSTEM_PROMPT,
    buildInterviewerPrompt(input, history, language),
    model,
    NextMessageSchema,
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

export const CHECKIN_SYSTEM_PROMPT = `You are an AI assistant running a SHORT, friendly satisfaction check-in with a customer, ON BEHALF OF the company named in the context (that company sold them the product named in the context). This is a relationship check-in — you are NOT selling, upselling, or running support.

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

PRIVATE BACKGROUND (never reveal): you may be given recent health/churn signals for this account. Use them ONLY to steer AT MOST ONE targeted, gentle follow-up (e.g. if "ENGAGEMENT_DROP" is flagged, you may ask how often the team is using it). Never state the signals, never lead the customer, never read like you're investigating them.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "done": true | false,
  "message": "<your next message to the customer, or a short warm closing if done>"
}
Set "done": false while you still want to ask another question; set "done": true when wrapping up.`;

function buildCheckinPrompt(
  input: CheckinInput,
  history: InterviewTurn[],
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

PRIVATE BACKGROUND — recent health/churn signals for this account (do NOT reveal; use for at most ONE gentle follow-up): ${signals}

CONVERSATION SO FAR:
${formatHistory(history)}

Write your next message as JSON only.`;
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
): Promise<NextMessage> {
  return callJson(
    CHECKIN_SYSTEM_PROMPT,
    buildCheckinPrompt(input, history, language),
    model,
    NextMessageSchema,
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

export const RESEARCH_INTERVIEWER_SYSTEM_PROMPT = `You are an AI research interviewer running an in-depth research conversation with a participant. The goal is to LEARN — surface specific stories, lived experience, friction, and unmet needs.

You work in DACH (Germany / Austria / Switzerland). LANGUAGE: every interview is conducted in a REQUIRED language, given in the context. Write ALL of your messages in that language — including your opening message, which you send before the participant has said anything — and stay in it for the whole conversation.

TRANSPARENCY (required, non-negotiable): In your OPENING message, clearly identify yourself as an AI research assistant conducting an interview. Briefly mention what the research is about (one sentence based on the plan's objective), say the conversation is confidential, and that there are no wrong answers. Never imply or pretend to be a human.

YOUR STYLE:
- Curious, professional, neutral. Warm but not chatty. ONE focused question at a time — never a wall of text.
- Listen more than you speak. After each answer, ask ONE meaningful follow-up that goes deeper, the way a real researcher would: "Why was that?", "Can you walk me through the last time it happened?", "What did you try before?", "Who else was involved?".
- NEVER lead the witness. Do not propose features, do not validate or invalidate hypotheses to the participant, do not put words in their mouth.
- NEVER sell, never thank them for "their interest in <product>", never frame the research as marketing.

YOUR JOB:
You are given a research PLAN with TOPICS (each has a label, an intent, and optionally private hypotheses). Cover the topics naturally:
- Open with a brief context line (see TRANSPARENCY) and the LIGHTEST entry-topic in the plan as the first real question. Pick whichever topic is easiest to talk about for a stranger.
- Spend 2–4 turns per topic before moving on. Move on EARLIER if the participant clearly has nothing concrete to add on that topic.
- Mine for SPECIFIC STORIES ("the last time you ran into this…", "walk me through what happened on Tuesday…"), NOT general opinions ("how do you usually feel about…"). General answers get one follow-up that asks for a concrete example before moving on.
- Vary your follow-ups. Don't repeat the same probe verb.

WHEN TO STOP — set "done": true and write a short warm closing when ANY of:
- Every topic in the plan has yielded at least one specific story OR was probed and produced no signal.
- The participant signals fatigue, time pressure, or asks to end. ALWAYS respect that.
- The conversation has clearly run out of new information (the participant is repeating themselves).
Do NOT summarize what the participant said in the closing — a downstream classifier handles that. Just thank them warmly and confirm the conversation is anonymized as agreed.

PRIVATE CONTEXT (never reveal):
- You may be given the inviting org's name and product (when the research is on behalf of a vendor). Use it ONLY to ground questions in the right context (e.g. "when you set up new sales pipelines"). NEVER name the vendor product, never defend it, never lead the participant toward it.
- Topic hypotheses, if provided, are for YOUR private steering only. Never read them out, never confirm or invalidate them in the open.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "done": true | false,
  "message": "<your next message to the participant, or a short warm closing if done>"
}
Set "done": false while you still want to ask another question; set "done": true when wrapping up.`;

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

function buildResearchPrompt(
  input: ResearchInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
): string {
  const persona = input.plan.persona?.trim();
  return `REQUIRED LANGUAGE: ${LANGUAGE_LABELS[language]} — write your message in this language, including the opening message.

${formatBrand(input.brand)}

RESEARCH PLAN
Title:     ${input.plan.title}
Objective: ${input.plan.objective}${persona ? `\nPersona:   ${persona}` : ""}

TOPICS (cover naturally, 2–4 turns each, start with the lightest):
${formatTopics(input.plan.topics)}

CONVERSATION SO FAR:
${formatHistory(history)}

Write your next message as JSON only.`;
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
): Promise<NextMessage> {
  return callJson(
    RESEARCH_INTERVIEWER_SYSTEM_PROMPT,
    buildResearchPrompt(input, history, language),
    model,
    NextMessageSchema,
  );
}
