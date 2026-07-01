import "server-only";

import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  createSynthSupabase,
  StudySynthesisUnavailableError,
} from "@/lib/synthesis/engine";
import { getStudySynthesis } from "@/lib/synthesis/service";
import { filterAnchoredImplications } from "@/lib/synthesis/advisory-checks";
import { getResearchPlan } from "@/lib/research/plans-service";
import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";
import {
  SynthesisImplicationsResultSchema,
  type SynthesisImplication,
  type SynthesisImplicationsResult,
} from "@/lib/schemas/synthesis-advisory";
import type { Json } from "@/types/database";

/**
 * Advisory generation (Runde 2) — the „Beratung"-Schicht. A SEPARATE stage over a
 * FINISHED synthesis: it reads the overview + emergent themes + tensions and
 * derives IMPLICATIONS (the „so what?") as HYPOTHESES to validate. It never
 * touches the core synthesis and never asserts facts.
 *
 * The prompt is the guardrail (this layer is interpretive, so it can't be fully
 * anchor-filtered like quotes): every implication must name the exact finding it
 * derives from, be framed as a hypothesis, carry no new numbers, and stay within
 * the study. The deterministic scan (advisory-checks.ts) + the eval judge verify
 * that afterwards. EMPTY output is correct on a thin synthesis.
 *
 * Model: Opus (trust-critical interpretation). Override via SYNTHESIS_MODEL.
 */

export const DEFAULT_ADVISORY_MODEL = CLAUDE_MODELS.opus;

export class SynthesisAdvisoryUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SynthesisAdvisoryUnavailableError";
  }
}

export interface AdvisoryInput {
  plan: { title: string; objective: string };
  overview: string | null;
  emergent_themes: EmergentTheme[];
  tensions: Tension[];
}

export const SYNTHESIS_ADVISORY_SYSTEM_PROMPT = `You are a senior research consultant. You are given a FINISHED study synthesis (an overview, emergent themes, and tensions). Your job is to derive the IMPLICATIONS — the „so what?" — that a team should take away. This is the interpretive layer of a research read-out: it is explicitly labelled to the reader as „Beratung, nicht belegt" (advice, not evidence), so it must be honest about being a hypothesis.

WHAT AN IMPLICATION IS:
- It takes ONE specific finding from the synthesis and says what it likely MEANS and what the team could DO or TEST about it.
- Deduce deeply: connect the finding to a plausible mechanism ("weil …"), and name a concrete next step or a hypothesis to validate. This is where you add analytical value beyond restating the finding.

HARD RULES (this layer is the only part not verbatim-anchored, so these are strict):
1. DERIVES FROM A REAL FINDING. Every implication must follow from a finding that is actually in the synthesis. In the "basis" field, copy the EXACT theme title OR tension description it derives from, VERBATIM. Do not invent a finding.
2. HYPOTHESIS, NEVER FACT. Frame every implication as something to validate: „deutet darauf hin", „könnte", „eine Hypothese wäre", „wäre zu prüfen, ob …". NEVER state it as an established fact, a proven cause, or a guaranteed outcome.
3. NO NEW NUMBERS / ENTITIES. Do not introduce any number, percentage, count, competitor, feature, or fact that is not already in the synthesis. If you reference how widespread something is, use only what the synthesis supports — prefer qualitative wording over numbers.
4. STAY IN THIS STUDY — the specificity test. Before you keep an implication, apply this test: „Would this still make sense if I deleted THIS study's specific finding?" If the sentence would apply to almost any product regardless of these findings (a UX/HR/marketing principle, a textbook rule, an „industry standard"), it is TOO GENERIC — drop it. A good implication is UNTHINKABLE without the exact finding it derives from: it names the specific mechanism this study surfaced, not a general truth. If the only thing you can say about a finding is generic, say nothing about it.
5. EMPTY IS CORRECT. If the synthesis is thin, contradictory, or lacks clear findings, return FEW or ZERO implications. Do NOT manufacture advice to fill space — a short honest list beats a padded one.
6. German. At most 6 implications, ordered by how strongly the finding supports them.

OUTPUT — call the tool exactly once, no markdown:
{
  "implications": [
    { "basis": "<verbatim theme title or tension description>", "hypothesis": "<1-3 German sentences: the „so what", framed as a hypothesis to validate>" }
  ]
}`;

function synthesisBlock(input: AdvisoryInput): string {
  const lines: string[] = [
    `STUDY: "${input.plan.title}" — ${input.plan.objective}`,
  ];
  if (input.overview && input.overview.trim() !== "") {
    lines.push(`\nOVERVIEW: ${input.overview.trim()}`);
  }
  if (input.emergent_themes.length > 0) {
    lines.push(`\nEMERGENT THEMES (${input.emergent_themes.length}):`);
    input.emergent_themes.forEach((t, i) => {
      lines.push(`  ${i + 1}. "${t.title}" (frequency=${t.frequency}) — ${t.summary}`);
    });
  }
  if (input.tensions.length > 0) {
    lines.push(`\nTENSIONS (${input.tensions.length}):`);
    input.tensions.forEach((t, i) => {
      lines.push(
        `  ${i + 1}. ${t.description} (Seite A: ${t.side_a.label} / Seite B: ${t.side_b.label})`,
      );
    });
  }
  if (input.emergent_themes.length === 0 && input.tensions.length === 0) {
    lines.push(
      "\n(no emergent themes or tensions — the synthesis carries no clear findings)",
    );
  }
  return lines.join("\n");
}

/** The generation user turn — the instruction + the synthesis block. */
function formatSynthesisForAdvisory(input: AdvisoryInput): string {
  return `${formatInstruction}\n\n${synthesisBlock(input)}`;
}

const formatInstruction =
  "Leite die Implikationen NUR aus den folgenden Synthese-Inhalten ab. Kopiere für 'basis' den exakten Themen-Titel bzw. die Spannungs-Beschreibung wörtlich:";

/**
 * Pure entry — generate implications from a finished synthesis. NO Supabase; the
 * eval + (later) the prod stage drive this. Fail-closed: transport/schema failure
 * throws SynthesisAdvisoryUnavailableError.
 */
export async function generateImplicationsFromInputs(
  input: AdvisoryInput,
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_ADVISORY_MODEL,
): Promise<SynthesisImplicationsResult> {
  try {
    return await callClaudeStructured({
      schema: SynthesisImplicationsResultSchema,
      system: SYNTHESIS_ADVISORY_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: formatSynthesisForAdvisory(input) },
      ],
      model,
      maxTokens: 2000,
      timeoutMs: 120_000,
      toolName: "emit_synthesis_implications",
      toolDescription:
        "Return the implications — each a hypothesis derived from a named finding (basis = verbatim theme title or tension description). No new numbers, no generic advice, empty if the synthesis is thin.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new SynthesisAdvisoryUnavailableError(
        "Claude advisory returned invalid output twice",
        err,
      );
    }
    throw new SynthesisAdvisoryUnavailableError(
      "Claude advisory call failed",
      err,
    );
  }
}

const SYNTHESIS_ADVISORY_REFINE_SYSTEM_PROMPT = `You are a strict reviewer of DRAFT implications for a research synthesis (each has a "basis" — the finding it derives from — and a "hypothesis"). You receive the finished synthesis and the draft list. Return a REFINED list, applying these rules ruthlessly — your job is to RAISE THE BAR, not to be nice:

- DROP any implication whose basis is not an actual finding present in the synthesis.
- DROP any implication that fails the SPECIFICITY test: „would this still make sense if the specific finding were deleted?" If it would apply to almost any product (a UX / HR / marketing principle, a textbook rule, an „industry standard"), it is too generic — drop it. A kept implication must be UNTHINKABLE without the exact finding it derives from.
- REWRITE a salvageable-but-soft implication so it is SHARPER and more study-specific: name the concrete mechanism THIS study surfaced, keep it framed as a hypothesis to validate (never as fact), and keep the basis verbatim.
- KEEP a strong, specific, well-framed implication unchanged.
- Do NOT invent new implications, findings, numbers, competitors, or features. You only tighten, drop, or keep.
- An EMPTY list is a correct outcome when nothing survives. German prose, best first.

Return the refined implications via the tool — same shape (basis + hypothesis).`;

/**
 * Refine pass — a second, strict review of the draft implications. It raises the
 * bar on the specificity test (the main way generic advice slips through),
 * rewrites soft ones to be study-specific, drops the irreducibly-generic /
 * untraceable, and invents nothing. This is the „hochfahren, sofern es besser
 * macht"-Hebel: one extra Opus call that trades a little cost for sharper, less
 * generic advice.
 */
export async function refineImplications(
  input: AdvisoryInput,
  draft: SynthesisImplication[],
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_ADVISORY_MODEL,
): Promise<SynthesisImplicationsResult> {
  if (draft.length === 0) return { implications: [] }; // nothing to refine
  const draftText = draft
    .map((im, i) => `[${i}] basis="${im.basis}" | hypothesis="${im.hypothesis}"`)
    .join("\n");
  try {
    return await callClaudeStructured({
      schema: SynthesisImplicationsResultSchema,
      system: SYNTHESIS_ADVISORY_REFINE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `SYNTHESE:\n${synthesisBlock(input)}\n\nENTWURF (zu prüfen):\n${draftText}`,
        },
      ],
      model,
      maxTokens: 2000,
      timeoutMs: 120_000,
      toolName: "emit_refined_implications",
      toolDescription:
        "Return the refined implications (basis + hypothesis) — drop generic/untraceable ones, sharpen soft ones, keep strong ones, invent nothing. Empty if none survive.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new SynthesisAdvisoryUnavailableError(
        "Claude advisory-refine returned invalid output twice",
        err,
      );
    }
    throw new SynthesisAdvisoryUnavailableError(
      "Claude advisory-refine call failed",
      err,
    );
  }
}

/**
 * Full advisory pipeline (the „richtig gut"-Pfad): generate a draft, then run the
 * refine pass. Two Opus calls per synthesis, on purpose — the refine pass
 * measurably sharpens the advice and cuts generic drift. This is what the eval
 * and (later) the prod stage use.
 */
export async function generateImplications(
  input: AdvisoryInput,
  model?: string,
): Promise<SynthesisImplicationsResult> {
  const draft = await generateImplicationsFromInputs(input, model);
  return refineImplications(input, draft.implications, model);
}

// ── DB-driven stage (prod) — generate → refine → GATE → persist ──────────────

export interface GenerateSynthesisImplicationsResult {
  status: "generated" | "no_synthesis";
  implications: SynthesisImplication[];
}

/**
 * Full prod advisory stage over a plan's FINISHED synthesis: generate → refine →
 * deterministic GATE (drop implications whose basis names no real finding) →
 * persist into the additive `implications` column. Never touches the core
 * synthesis; writes ONLY the kept, anchored implications.
 *
 * AUTH: the caller MUST have verified the plan belongs to `orgId`.
 */
export async function generateSynthesisImplications(
  orgId: string,
  planId: string,
  model?: string,
): Promise<GenerateSynthesisImplicationsResult> {
  const record = await getStudySynthesis(orgId, planId);
  if (!record || record.synthesized_at === null) {
    return { status: "no_synthesis", implications: [] };
  }
  const plan = await getResearchPlan(orgId, planId);
  const input: AdvisoryInput = {
    plan: { title: plan?.title ?? "Studie", objective: plan?.objective ?? "" },
    overview: record.overview,
    emergent_themes: record.emergent_themes,
    tensions: record.tensions,
  };

  const result = await generateImplications(input, model);
  // Deterministic GATE — only implications grounded in a real finding survive.
  const { kept } = filterAnchoredImplications(result.implications, input);

  const supabase = createSynthSupabase();
  const { error } = await supabase
    .from("study_synthesis")
    .update({ implications: kept as unknown as Json })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (error) {
    throw new StudySynthesisUnavailableError(
      `Failed to persist implications (migration 20260728000000 applied?): ${error.message}`,
    );
  }
  return { status: "generated", implications: kept };
}

/** Clear any persisted implications — run on a plain (standard) re-synthesis so a
 *  „Beratung" from a prior ausführlich run can't outlive the synthesis it advised.
 *  Best-effort; touches only the additive column. */
export async function resetSynthesisImplications(
  orgId: string,
  planId: string,
): Promise<void> {
  const supabase = createSynthSupabase();
  const { error } = await supabase
    .from("study_synthesis")
    .update({ implications: [] as unknown as Json })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (error) {
    console.warn(
      `[advisory] implications reset failed (migration 20260728000000 applied?): ${error.message}`,
    );
  }
}
