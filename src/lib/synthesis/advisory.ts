import "server-only";

import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";
import {
  SynthesisImplicationsResultSchema,
  type SynthesisImplicationsResult,
} from "@/lib/schemas/synthesis-advisory";

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
4. STAY IN THIS STUDY. No generic best-practice, no textbook advice, no „industry standard" that isn't derivable from THIS study's findings. If the only thing you can say is generic, don't say it.
5. EMPTY IS CORRECT. If the synthesis is thin, contradictory, or lacks clear findings, return FEW or ZERO implications. Do NOT manufacture advice to fill space — a short honest list beats a padded one.
6. German. At most 6 implications, ordered by how strongly the finding supports them.

OUTPUT — call the tool exactly once, no markdown:
{
  "implications": [
    { "basis": "<verbatim theme title or tension description>", "hypothesis": "<1-3 German sentences: the „so what", framed as a hypothesis to validate>" }
  ]
}`;

function formatSynthesisForAdvisory(input: AdvisoryInput): string {
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
  return `${formatInstruction}\n\n${lines.join("\n")}`;
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
