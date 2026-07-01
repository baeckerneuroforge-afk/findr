/**
 * Study-Synthesis Grounding-Judge (Tier-2a, A3 + A1-Input)
 * --------------------------------------------------------
 * Ein günstiger LLM-Judge (Default Sonnet 5), der die FREITEXT-PROSA einer
 * fertigen Synthese gegen das Eingabe-Material prüft und jedes Theme/jede
 * Tension in eine Methoden-Kategorie einordnet. Beide Ergebnisse kommen in
 * GETRENNTEN strukturierten Feldern zurück (Spec A3.2) — Grounding-Verdikt und
 * Kategorie werden nie zu einem Prosa-Urteil verschmolzen.
 *
 * Reine MESSUNG: dieser Judge läuft NUR im manuellen Eval-Lauf
 * (`pnpm eval:synthesis`), nie im Prod-Pfad und nie in `vitest run src`. Die
 * Abbildung des Ergebnisses auf WARN-Befunde (judgeResultToFindings) ist pur
 * und in src/lib/synthesis/eval-checks.ts deterministisch getestet.
 *
 * Modell: claude-sonnet-5 (Default), Override via SYNTHESIS_JUDGE_MODEL.
 * Der `effort`-Parameter wird NICHT gesetzt — callClaudeStructured kennt ihn
 * nicht, und Haiku 4.5 (möglicher Override) lehnt effort per 400 ab; der
 * Override-Pfad bleibt damit gefahrlos.
 */

import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import type {
  EnrichedAudiencePersona,
  StudySynthesisResult,
} from "@/lib/schemas/synthesis";
import {
  SYNTHESIS_CATEGORIES,
  type SynthesisJudgeResult,
} from "@/lib/synthesis/eval-checks";
import {
  buildAudiencePersonasUserPrompt,
  buildSynthesisUserPrompt,
  type SynthesisInput,
} from "@/lib/synthesis/prompts";

export const DEFAULT_JUDGE_MODEL = CLAUDE_MODELS.sonnet;

const VerdictEnum = z.enum(["grounded", "unsupported_claim"]);
const CategoryEnum = z.enum(SYNTHESIS_CATEGORIES);

/** GETRENNTE Felder: Grounding-Verdikt UND Methoden-Kategorie je Eintrag,
 *  nie verschmolzen (Spec A3.2). */
const JudgeResultSchema = z.object({
  overview: z.object({
    verdict: VerdictEnum.describe(
      "grounded = the overview asserts only what the input material supports; unsupported_claim = it states an invented number/share, a sentiment, or a fact not present in the inputs.",
    ),
  }),
  themes: z
    .array(
      z.object({
        index: z
          .number()
          .int()
          .describe("0-based index of the theme, exactly as labelled."),
        summaryVerdict: VerdictEnum,
        category: CategoryEnum.describe(
          "The dominant substantive category of this theme (neutral classification of WHAT it is about).",
        ),
      }),
    )
    .default([]),
  tensions: z
    .array(
      z.object({
        index: z
          .number()
          .int()
          .describe("0-based index of the tension, exactly as labelled."),
        descriptionVerdict: VerdictEnum,
        category: CategoryEnum,
      }),
    )
    .default([]),
});

const JUDGE_SYSTEM_PROMPT = `You are a strict GROUNDING AUDITOR for a research-synthesis system. You receive (1) the INPUT MATERIAL fed to a synthesizer (per-interview coded findings) and (2) the SYNTHESIS the model produced (an overview, numbered emergent themes, numbered tensions). You do TWO separate jobs and return them in SEPARATE fields — never merge them.

JOB 1 — GROUNDING (per free-text field). Decide whether each piece of prose asserts ONLY things the input material supports:
- "grounded": every checkable claim (counts, shares, sentiments, facts, positions) is traceable to the inputs.
- "unsupported_claim": the prose asserts something NOT in the inputs — an invented number or share ("8 von 10", "die Mehrheit"), a sentiment the inputs do not show, a competitor/segment/figure nobody stated.
Judge the overview, each theme.summary (by its index), and each tension.description (by its index). Be CONSERVATIVE: flag only a clear, checkable claim the inputs do not support. Do NOT flag legitimate paraphrase, framing, or qualitative synthesis language.

JOB 2 — METHOD CATEGORY (per theme, per tension). Classify the DOMINANT substantive category of each theme and each tension into EXACTLY ONE of:
- price (willingness-to-pay, price thresholds, price lagers)
- purchase_intent (intent to buy / switch / adopt)
- pain (a product/usage friction or problem)
- segment_need (an unmet need at the population/market level)
- brand_perception (image, associations, feelings about a brand/concept)
- competitive (how respondents see competitors / the category)
- message_effect (clarity, first impression, effect of a creative/message)
- concept_understanding (how a concept is understood / misunderstood)
- feature (a concrete product feature request/capability)
- other (none of the above fits)
This is a NEUTRAL classification of what the theme/tension is ABOUT — not a quality judgment. A downstream rule decides whether the category fits the study method; that is NOT your concern.

Return your judgment via the tool, with the grounding verdict and the category in their OWN fields. Use the exact 0-based indices shown in the synthesis.`;

function renderSynthesisForJudge(result: StudySynthesisResult): string {
  const lines: string[] = ["SYNTHESIS TO AUDIT", "", `OVERVIEW: ${result.overview}`];

  lines.push("", `EMERGENT THEMES (${result.emergent_themes.length}):`);
  result.emergent_themes.forEach((t, i) => {
    lines.push(
      `  [theme index ${i}] title: ${t.title}`,
      `    summary: ${t.summary}`,
    );
  });
  if (result.emergent_themes.length === 0) lines.push("  (none)");

  lines.push("", `TENSIONS (${result.tensions.length}):`);
  result.tensions.forEach((t, i) => {
    lines.push(
      `  [tension index ${i}] description: ${t.description}`,
      `    side_a: ${t.side_a.label}`,
      `    side_b: ${t.side_b.label}`,
    );
  });
  if (result.tensions.length === 0) lines.push("  (none)");

  return lines.join("\n");
}

/**
 * Live LLM-Judge-Aufruf. Wirft (StructuredOutputError o.ä.) bei Modellfehler —
 * der Runner fängt das und meldet „judge unavailable", ohne den Lauf
 * abzubrechen. Gibt das strukturierte, GETRENNTE Verdikt zurück.
 */
export async function judgeSynthesis(
  input: SynthesisInput,
  result: StudySynthesisResult,
  model: string = process.env.SYNTHESIS_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL,
): Promise<SynthesisJudgeResult> {
  // Der Judge sieht GENAU das Material, das der Synthesizer sah …
  const inputBlock = buildSynthesisUserPrompt(input);
  // … plus die erzeugte Synthese mit expliziten Indizes.
  const userPrompt = `${inputBlock}\n\n────────────────────\n\n${renderSynthesisForJudge(
    result,
  )}`;

  return callClaudeStructured({
    schema: JudgeResultSchema,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    model,
    maxTokens: 4_000,
    timeoutMs: 120_000,
    toolName: "emit_grounding_judgment",
    toolDescription:
      "Return the grounding verdict per free-text field and the method category per theme/tension, in their separate fields.",
  });
}

// ── Persona-Grounding-Judge (Spec §8) ────────────────────────────────────────
//
// Ergänzt die DETERMINISTISCHEN Persona-Gates (eval-checks.ts) um eine
// Prosa-Prüfung: die Gates erzwingen, dass JEDES befüllte Trait-Feld ein
// verankertes Zitat trägt — der Judge prüft zusätzlich, ob die FORMULIERUNG der
// Ziele/Pains/Verhalten/Motivation dem Material der Mitglieder treu bleibt
// (keine erfundene Deutung trotz vorhandenem Zitat). Reine MESSUNG, nur im
// manuellen Lauf; das Ergebnis ist im Runner IMMER WARN (der Judge gatet nie).

export interface PersonaJudgeResult {
  personas: Array<{
    index: number;
    verdict: "grounded" | "unsupported_claim";
  }>;
}

const PersonaJudgeSchema = z.object({
  personas: z
    .array(
      z.object({
        index: z
          .number()
          .int()
          .describe("0-based index of the persona, exactly as labelled."),
        verdict: VerdictEnum.describe(
          "grounded = the persona's goals/pains/behavior/motivation are all traceable to its member respondents' coded findings; unsupported_claim = it asserts a goal/pain/behavior/motivation/segment trait the inputs do not support.",
        ),
      }),
    )
    .default([]),
});

const PERSONA_JUDGE_SYSTEM_PROMPT = `You are a strict GROUNDING AUDITOR for an audience-persona system. You receive (1) the INPUT MATERIAL fed to the clustering model (per-interview coded MARKET findings) and (2) the PERSONAS the model produced. Each persona names a segment and lists goals, pains, behavior, a motivation and the member respondent ids it rests on.

For EACH persona decide whether its prose asserts ONLY traits its MEMBER respondents' findings support:
- "grounded": every goal / pain / behavior / motivation is traceable to the coded findings of the persona's own member ids.
- "unsupported_claim": the persona asserts a goal/pain/behavior/motivation/segment trait that its members' inputs do not show — an invented disposition, a borrowed trait from a different segment, or a fabricated number/share.
Be CONSERVATIVE: flag only a clear, checkable trait the member inputs do not support. Do NOT flag legitimate paraphrase or composite framing. Use the exact 0-based indices shown.

Return your judgment via the tool, one verdict per persona.`;

function renderPersonasForJudge(personas: EnrichedAudiencePersona[]): string {
  const lines: string[] = [`PERSONAS TO AUDIT (${personas.length}):`];
  personas.forEach((p, i) => {
    lines.push(
      "",
      `[persona index ${i}] ${p.name}  members=[${p.sourceInsightIds.join(", ")}]`,
      `  goals: ${p.goals.join(" | ") || "(none)"}`,
      `  pains: ${p.pains.join(" | ") || "(none)"}`,
      `  behavior: ${p.behavior.join(" | ") || "(none)"}`,
      `  motivation: ${p.motivation || "(none)"}`,
    );
  });
  if (personas.length === 0) lines.push("  (none)");
  return lines.join("\n");
}

/**
 * Live Persona-Judge-Aufruf (nur manueller Lauf). Wirft bei Modellfehler — der
 * Runner fängt das und meldet „judge unavailable". Verdikt-Mapping (→ WARN)
 * macht der Runner; der Judge gatet nicht.
 */
export async function judgePersonas(
  input: SynthesisInput,
  personas: EnrichedAudiencePersona[],
  model: string = process.env.SYNTHESIS_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL,
): Promise<PersonaJudgeResult> {
  const inputBlock = buildAudiencePersonasUserPrompt(input);
  const userPrompt = `${inputBlock}\n\n────────────────────\n\n${renderPersonasForJudge(
    personas,
  )}`;

  return callClaudeStructured({
    schema: PersonaJudgeSchema,
    system: PERSONA_JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    model,
    maxTokens: 2_000,
    timeoutMs: 120_000,
    toolName: "emit_persona_grounding",
    toolDescription:
      "Return one grounding verdict per persona (by 0-based index).",
  });
}
