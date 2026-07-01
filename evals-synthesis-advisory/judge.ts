import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import type { AdvisoryInput } from "@/lib/synthesis/advisory";
import type { SynthesisImplication } from "@/lib/schemas/synthesis-advisory";

/**
 * Advisory-grounding judge (Runde 2). Sonnet reads the synthesis + the generated
 * implications and, PER implication, judges three interpretive properties the
 * deterministic checks can't: does it genuinely follow from its finding, is it
 * framed as a hypothesis (not asserted fact), and does it avoid generic best-
 * practice. It ADVISES (WARN) — it never gates, matching the codebase's Tier-2a
 * „Judge berät, gatet nicht" principle.
 */

export const DEFAULT_JUDGE_MODEL = CLAUDE_MODELS.sonnet;

const AdvisoryJudgeSchema = z.object({
  verdicts: z.array(
    z.object({
      index: z.number().int(),
      /** Does the hypothesis genuinely follow from the named finding, and is that
       *  finding actually in the synthesis? */
      traceable: z.boolean(),
      /** Framed as a hypothesis/possibility to validate, NOT asserted as fact? */
      hypothesis_framed: z.boolean(),
      /** Specific to THIS study, not generic textbook/industry best-practice? */
      avoids_generic: z.boolean(),
      note: z.string().max(500),
    }),
  ),
});
export type AdvisoryJudgeResult = z.infer<typeof AdvisoryJudgeSchema>;

const JUDGE_SYSTEM = `You audit the ADVISORY („Beratung") layer of a research synthesis — a list of implications, each a hypothesis derived from a finding. This layer is explicitly labelled to the reader as advice, not evidence, so hold it to a strict interpretive bar. For EACH implication (by its 0-based index) judge three booleans, defaulting to FALSE when unsure:

- traceable: does the hypothesis genuinely FOLLOW from the finding named in its "basis", AND is that finding really present in the supplied synthesis? (false if the basis names a finding that isn't there, or the leap from finding to hypothesis is unsupported.)
- hypothesis_framed: is it framed as a hypothesis / possibility to validate — NOT stated as an established fact, a proven cause, or a guaranteed outcome?
- avoids_generic: is it specific to THIS study's findings — NOT generic best-practice or textbook advice that would apply to any product regardless of these findings?

Add a short German note per implication naming the single biggest issue (or „ok"). You ADVISE — you never block. Return one verdict per implication via the tool, using the exact 0-based indices.`;

function formatSynthesis(input: AdvisoryInput): string {
  const lines = [`STUDY: "${input.plan.title}" — ${input.plan.objective}`];
  if (input.overview) lines.push(`OVERVIEW: ${input.overview}`);
  input.emergent_themes.forEach((t, i) =>
    lines.push(`THEME ${i + 1}: "${t.title}" — ${t.summary}`),
  );
  input.tensions.forEach((t, i) =>
    lines.push(
      `TENSION ${i + 1}: ${t.description} (A: ${t.side_a.label} / B: ${t.side_b.label})`,
    ),
  );
  return lines.join("\n");
}

export async function judgeImplications(
  input: AdvisoryInput,
  implications: SynthesisImplication[],
  model: string = process.env.SYNTHESIS_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL,
): Promise<AdvisoryJudgeResult> {
  if (implications.length === 0) return { verdicts: [] };
  const implText = implications
    .map(
      (im, i) => `[${i}] basis="${im.basis}" | hypothesis="${im.hypothesis}"`,
    )
    .join("\n");
  return callClaudeStructured({
    schema: AdvisoryJudgeSchema,
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `SYNTHESIS:\n${formatSynthesis(input)}\n\nIMPLICATIONS:\n${implText}`,
      },
    ],
    model,
    maxTokens: 1500,
    toolName: "emit_advisory_verdicts",
    toolDescription:
      "Return one verdict per implication (by 0-based index): traceable, hypothesis_framed, avoids_generic, and a short note.",
  });
}
