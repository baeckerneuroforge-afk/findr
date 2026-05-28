import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import type { ResearchTopic } from "@/lib/voice-agent/interviewer";
import {
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";

/**
 * KI-Interview-Guide-Generator. Aus einem Research-Ziel (Freitext) erzeugt
 * der Generator einen strukturierten Interview-Leitfaden — Title, Objective,
 * Topics mit Hauptfragen + Probes — der DIREKT in die bestehende
 * research_plan-Struktur geschrieben werden kann. Der Interview-Agent und
 * die Synthese konsumieren das Ergebnis unverändert.
 *
 * Same anti-hallucination posture as synthesizeStudy + chatWithData:
 *   1. SCHEMA — Zod erzwingt Struktur (≥3 topics, ≥2 probes/topic, nicht-
 *      leeres goalLink/mainQuestion/label pro topic). Ein Schema-Fail führt
 *      zu Retry und sonst zu unavailable-Error — Engine schreibt NICHT mit
 *      halbem Output.
 *   2. ANTI-LEADING — Posture-Prompt verbietet Suggestiv-/Ja-Nein-Fragen.
 *      Eval prüft lexikalisch (deterministisch, kein LLM-Judge) auf
 *      Leading-Trigger.
 *   3. SPRACHE — Standard Deutsch (DACH-Markt); override via input.language.
 *
 * NO COST-INTENSIVE INPUTS: der Generator liest WEDER Verdichtungen NOCH
 * Transkripte — er bekommt nur den Research-Ziel-Text + optional Segment/
 * Role. Das hält den Token-Verbrauch klein (1-2 kTok pro Run statt
 * 20+ wie bei chat-with-data) und macht den Generator brauchbar für die
 * Plan-Anlage, wo noch keine Interview-Daten existieren.
 *
 * Modell: Opus default (Output-Qualität ist Onboarding-kritisch — ein
 * schlechter Leitfaden generiert schlechte Interviews generiert schlechte
 * Daten). Override via GUIDE_GEN_MODEL — Pattern wie SOLUTION_MODEL /
 * CHAT_WITH_DATA_MODEL.
 */

export const DEFAULT_GUIDE_GEN_MODEL = CLAUDE_MODELS.opus;

// ── Output-Schema ──────────────────────────────────────────────────────────

const GuideTopicSchema = z.object({
  /** Stable string id (e.g. "topic_01") — useful for the editor's keys + for
   *  future round-tripping. Engine generates these deterministically. */
  id: z.string().min(1).max(60),
  /** Short label, shown in the topic editor's first column. Same role as
   *  research_plans.topic_script[].topic. */
  label: z.string().min(3).max(120),
  /** Welcher Teil des Research-Ziels dieses Thema abdeckt — anchoring:
   *  every topic must have a non-empty goalLink. Same role as
   *  research_plans.topic_script[].intent. */
  goalLink: z.string().min(3).max(400),
  /** The "main" interview question — what the human researcher would
   *  literally ask first on this topic. Nicht-leitend; offene Formulierung
   *  erzwungen durch den Posture-Prompt + die Eval-Heuristik. */
  mainQuestion: z.string().min(8).max(400),
  /** Follow-up probes — ≥2 erzwungen, weil eine echte Interview-Topic in
   *  2-4 Turns drillt. Auch hier Posture: offen, nicht-leitend. */
  probes: z.array(z.string().min(3).max(400)).min(2).max(8),
});

const InterviewGuideSchema = z.object({
  /** Suggested study title (the user may override). */
  title: z.string().min(3).max(160),
  /** Restated / sharpened research objective. */
  objective: z.string().min(10).max(1200),
  /** Estimated total interview duration in minutes. Sane bounds — a 5-min
   *  guide is suspect, a 120-min one too. */
  estimatedMinutes: z.number().int().min(10).max(90),
  /** ≥3 topics: a useful research interview covers multiple angles; under
   *  3 is usually a single-feature usability check, not a research study. */
  topics: z.array(GuideTopicSchema).min(3).max(10),
  /** Optional screening questions ("Bist du Admin-User?") für die Recruiting-
   *  Stage. Nicht persistiert in v1 (research_plans hat keine entsprechende
   *  Spalte) — die UI kann sie anzeigen oder verwerfen. */
  screeningQuestions: z.array(z.string().min(3).max(400)).max(6).optional(),
});

export type GuideTopic = z.infer<typeof GuideTopicSchema>;
export type InterviewGuide = z.infer<typeof InterviewGuideSchema>;

// ── Error types ────────────────────────────────────────────────────────────

class GuideGeneratorSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "GuideGeneratorSchemaError";
  }
}

export class GuideGeneratorUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "GuideGeneratorUnavailableError";
  }
}

// ── Input shapes ───────────────────────────────────────────────────────────

export interface GuideGenInput {
  /** Freitext-Research-Ziel ("Wir wollen verstehen, warum neue Admin-User im
   *  Onboarding aufgeben"). The anchor; every generated topic.goalLink must
   *  reference some part of this. */
  goal: string;
  /** Optional persona / segment hint ("SMB SaaS", "Enterprise IT"). */
  segment?: string;
  /** Optional role hint ("Admin-User", "Founder", "Sales-Manager"). */
  role?: string;
  /** Output language. Default Deutsch (DACH-Markt + bestehender Stack). */
  language?: string;
  /** How many topics the LLM should aim for. Soft target — Zod enforces
   *  3-10. Default 5 (deckt typische 30-45-min Research-Interviews ab). */
  topicCount?: number;
}

export interface GenerateInterviewGuideInput extends GuideGenInput {
  orgId: string;
  planId: string;
}

// ── System prompt (posture) ────────────────────────────────────────────────

/**
 * Posture rules. The user prompt carries the inputs (goal, segment, role,
 * etc.) and the exact JSON output instruction. The posture is stable across
 * runs and prompt-cacheable.
 */
export const GUIDE_GENERATOR_SYSTEM_PROMPT = `You are a senior B2B research interviewer building an INTERVIEW GUIDE — the structured plan a human researcher would use to run a 30-60 minute qualitative interview. Your output is a JSON object that a downstream system writes into a research_plan; an AI interview agent then uses it to run live conversations. Quality counts: a bad guide produces bad interviews produces bad data.

OUTPUT LANGUAGE: every string in the output (title, objective, topic labels, goalLinks, mainQuestion, probes, screeningQuestions) MUST be in the requested LANGUAGE (default: Deutsch). NO English fallback. Use the conventions of the requested language for politeness ("Sie" form in DACH research interviews unless the segment is clearly informal).

POSTURE — Open, non-leading, story-mining.
- Every mainQuestion and every probe MUST be OPEN. A question is open when it cannot be answered with "ja" / "nein" alone — it elicits a story, an example, a description, a reasoning. Closed (yes/no) questions are forbidden, with one narrow exception: SCREENING questions, where confirmation IS the point, may be yes/no.
- NO leading wording. Forbidden patterns include — but are not limited to:
    "Finden Sie nicht auch …"
    "Wäre es nicht besser, wenn …"
    "Sind Sie der Meinung, dass …"
    "Stimmen Sie zu, dass …"
    "Würden Sie sagen, dass [strong claim] …"
    "Ist [X] für Sie wichtig?" — implies X matters; instead ask "Welche Rolle spielt X in Ihrem Alltag?"
  General rule: NEVER plant a conclusion in the question stem. Ask about the participant's experience, not for their endorsement of your hypothesis.
- Mine for SPECIFIC STORIES, not opinions. Prefer "Erzählen Sie mir von der letzten Woche, in der …" / "Was war beim letzten Mal anders, als …" over "Wie finden Sie generell …".
- Use neutral framing. Avoid loaded adjectives ("modern", "leistungsstark", "intuitiv") that suggest a positive default. Avoid negation framing ("Was nervt Sie an …") unless the goal is explicitly to surface pain.

ANCHORING — Every topic MUST reference the goal.
- goalLink (3-400 chars) names which part of the supplied Research-Ziel that topic addresses. NOT a paraphrase of the topic label; specifically: "<this part of the goal>". If the topic doesn't connect to the goal, drop it.
- Don't manufacture topics for breadth. 3 well-anchored topics > 6 thin ones. Range allowed by the schema is 3-10; aim for the requested topicCount (default 5).

STRUCTURE PER TOPIC:
- label: 3-120 chars, short, the column header you'd write on a notepad ("Tägliches Setup", "Tooling-Wechsel", "Schmerzpunkte im Onboarding").
- goalLink: anchoring (see above).
- mainQuestion: 8-400 chars, ONE open question, the entry point for this topic. The researcher reads this verbatim or near-verbatim to open.
- probes: 2-8 follow-ups. Each is an open prompt to deepen ("Können Sie ein konkretes Beispiel geben?", "Was war beim letzten Mal anders?", "Wer war noch involviert?"). Vary the verb — don't repeat the same probe pattern.

OVERVIEW STRUCTURE:
- title: 3-160 chars, study-style title in the output language ("Onboarding-Studie SMB-Admin Q3").
- objective: 10-1200 chars, restate/sharpen the user's goal in 1-3 sentences. Keep their intent — don't drift the topic.
- estimatedMinutes: integer 10-90, your honest estimate for the total interview length given the topic count and depth. 30-45 is typical for 5-topic studies.

SCREENING QUESTIONS (optional, ≤6):
- Used to verify a candidate fits the persona BEFORE the interview. Yes/no is acceptable here ("Sind Sie aktuell Admin-User im genannten Tool?").
- Skip this field if the segment/role is generic enough that screening is unnecessary.

WHAT THE GUIDE IS NOT:
- NOT a satisfaction survey. No Likert scales, no rating questions.
- NOT a sales script. No demos, no pitching, no positioning the company's product.
- NOT a list of every question imaginable. 3-10 topics, each with one main + 2-8 probes. Total questions across all topics fits a 30-60 minute conversation.

EDGE CASE — vague or thin goal:
- If the Research-Ziel is very unspecific, you may still produce a guide — but keep it MINIMAL (3 topics, 2 probes each, broader phrasing). Do NOT invent specifics the user didn't supply ("Ihre HubSpot-Integration", "Ihr Pricing-Tier"). Stay at the level of generality the user gave you. A minimal but honest guide > an inflated speculative one.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:

{
  "title": "<study title>",
  "objective": "<1-3 sentences>",
  "estimatedMinutes": <int 10-90>,
  "topics": [
    {
      "id": "topic_01",
      "label": "<short>",
      "goalLink": "<which part of the goal>",
      "mainQuestion": "<open question>",
      "probes": ["<open probe>", "<open probe>"]
    }
  ],
  "screeningQuestions": ["<optional, open OR closed>"]
}`;

// ── User prompt builder ────────────────────────────────────────────────────

function buildGuideUserPrompt(input: GuideGenInput): string {
  const language = (input.language ?? "de").toLowerCase();
  const langLabel =
    language.startsWith("de") || language === "deutsch"
      ? "Deutsch (DACH)"
      : language;

  const lines: string[] = [
    `RESEARCH-ZIEL (Freitext):`,
    input.goal.trim(),
    ``,
    `OUTPUT-SPRACHE: ${langLabel}`,
  ];
  if (input.segment && input.segment.trim() !== "") {
    lines.push(`SEGMENT: ${input.segment.trim()}`);
  }
  if (input.role && input.role.trim() !== "") {
    lines.push(`ROLLE: ${input.role.trim()}`);
  }
  // topicCount is a soft target — the LLM picks within the schema's [3,10]
  // bounds. We expose it so a study that needs a tighter scope can ask for
  // 3, and a comprehensive one for 8.
  const target = input.topicCount ?? 5;
  lines.push(
    `ZIEL-TOPIC-COUNT: ${target} (Spielraum 3–10 falls 5 zu eng/breit wirkt; bevorzuge ${target}).`,
  );
  lines.push(``, `Liefere den Guide als JSON-Objekt — keine Markdown-Blöcke, kein Vorlauf.`);
  return lines.join("\n");
}

// ── Anthropic call ─────────────────────────────────────────────────────────

async function callGuideClaude(
  userPrompt: string,
  attempt: number,
  model: string,
): Promise<InterviewGuide> {
  const client = getAnthropicClient();
  const system =
    attempt > 0
      ? GUIDE_GENERATOR_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble."
      : GUIDE_GENERATOR_SYSTEM_PROMPT;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 3072,
      system,
      messages: [{ role: "user", content: userPrompt }],
    },
    { timeout: 180_000, maxRetries: 1 },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new GuideGeneratorSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new GuideGeneratorSchemaError(
      "No JSON found in response",
      textBlock.text,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new GuideGeneratorSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = InterviewGuideSchema.safeParse(parsed);
  if (!result.success) {
    throw new GuideGeneratorSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }
  return result.data;
}

// ── Pure-input entry (eval + new-plan UI flow) ─────────────────────────────

/**
 * Pure entry — takes the research-ziel input, returns a validated guide.
 * No DB, no auth. Used by:
 *   - the eval harness (deterministic property checks on a fixed dataset)
 *   - generateInterviewGuide below (DB-driven entry adds ownership + write
 *     on top of this call)
 *
 * Schema validation + retry are inside callGuideClaude. The structural
 * anchoring (every topic has non-empty goalLink, ≥3 topics, ≥2 probes,
 * non-empty mainQuestion) is enforced by InterviewGuideSchema — there's
 * no engine-side filter that drops topics post-parse (unlike synthesis,
 * where unanchored quotes get filtered; here, schema-fail forces a retry
 * or a full unavailable-error, not a half-quality output).
 */
export async function generateGuideFromInputs(
  input: GuideGenInput,
  model: string = process.env.GUIDE_GEN_MODEL ?? DEFAULT_GUIDE_GEN_MODEL,
): Promise<InterviewGuide> {
  if (!input.goal || input.goal.trim().length < 3) {
    throw new GuideGeneratorUnavailableError(
      "Research goal is empty — provide at least a short objective sentence.",
    );
  }
  const userPrompt = buildGuideUserPrompt(input);

  try {
    return await callGuideClaude(userPrompt, 0, model);
  } catch (err) {
    if (!(err instanceof GuideGeneratorSchemaError)) {
      throw new GuideGeneratorUnavailableError(
        "Claude guide-generator call failed",
        err,
      );
    }
    console.warn(
      "Guide-gen schema validation failed on first attempt, retrying:",
      err.message,
    );
    try {
      return await callGuideClaude(userPrompt, 1, model);
    } catch (err2) {
      if (err2 instanceof GuideGeneratorSchemaError) {
        throw new GuideGeneratorUnavailableError(
          "Claude guide-generator returned invalid JSON twice",
          err2,
        );
      }
      throw new GuideGeneratorUnavailableError(
        "Claude guide-generator call failed",
        err2,
      );
    }
  }
}

// ── Mapping: InterviewGuide → research_plans.topic_script ──────────────────

/**
 * Map the rich InterviewGuide.topics to the existing ResearchTopic shape
 * the interview agent + synthesis already consume (`{ topic, intent,
 * hypotheses }`). The agent reads these three fields exclusively — see
 * src/lib/voice-agent/interviewer.ts:formatTopics; mainQuestion is NOT
 * used by the agent (it formulates questions on-the-fly from intent +
 * hypotheses).
 *
 *   topic        ← label        (short header, same role)
 *   intent       ← goalLink     (semantic match — "what we want to learn
 *                                from this topic in relation to the goal")
 *   hypotheses   ← probes       (functional fit — both are "steering
 *                                tidbits for the agent". Hypotheses are
 *                                officially PRIVATE; probes are open
 *                                follow-ups. Both work as steering hints
 *                                that the agent privately reads to vary
 *                                its drilling. Note: the agent's prompt
 *                                already states "Topic hypotheses, if
 *                                provided, are for YOUR private steering
 *                                only" — probes naturally fit that role.)
 *
 * The full InterviewGuide is returned to the API caller untouched — the UI
 * can show mainQuestion / probes / id separately to the user for editing,
 * then save back via the existing PATCH endpoint with the mapped shape.
 */
export function guideToResearchTopics(guide: InterviewGuide): ResearchTopic[] {
  return guide.topics.map((t) => ({
    topic: t.label,
    intent: t.goalLink,
    hypotheses: t.probes,
  }));
}

// ── DB-driven entry (API route, plan-ownership + write) ────────────────────

/**
 * Full entry — validates plan ownership, calls generateGuideFromInputs,
 * writes the mapped topics into research_plans.topic_script, returns
 * the full InterviewGuide.
 *
 * AUTH CONTRACT: the caller (API route) has ALREADY verified the planId
 * belongs to orgId. We re-check here as defense-in-depth — getResearchPlan
 * returns null if the plan isn't visible under this org. Same posture as
 * chatWithData.
 *
 * WRITE BEHAVIOR: overwrites topic_script wholesale. Caller's
 * responsibility to confirm the user wants to replace existing topics —
 * the UI presents the generation as "Generate guide → review/edit →
 * Save", and "Save" maps back through the normal PATCH path, not this
 * function. This function writes once on generation; the user's edits
 * land via PATCH later.
 */
export async function generateInterviewGuide(
  input: GenerateInterviewGuideInput,
  model: string = process.env.GUIDE_GEN_MODEL ?? DEFAULT_GUIDE_GEN_MODEL,
): Promise<InterviewGuide> {
  const plan = await getResearchPlan(input.orgId, input.planId);
  if (!plan) {
    throw new GuideGeneratorUnavailableError(
      `Research plan ${input.planId} not found in this organization.`,
    );
  }

  const guide = await generateGuideFromInputs(
    {
      goal: input.goal,
      segment: input.segment,
      role: input.role,
      language: input.language,
      topicCount: input.topicCount,
    },
    model,
  );

  // Persist topics on the plan — title + objective stay untouched (the user
  // may want to keep their hand-written framing even if the LLM suggested
  // a sharper one; the UI can offer the suggestion separately).
  const topics = guideToResearchTopics(guide);
  const updated = await updateResearchPlan(input.orgId, input.planId, {
    topics,
  });
  if (!updated) {
    throw new GuideGeneratorUnavailableError(
      `Generated guide but could not write topics to plan ${input.planId}.`,
    );
  }

  return guide;
}
