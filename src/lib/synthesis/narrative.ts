import "server-only";

import { z } from "zod";

import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import {
  createSynthSupabase,
  DEFAULT_SYNTHESIS_MODEL,
  StudySynthesisUnavailableError,
} from "@/lib/synthesis/engine";
import {
  getStudySynthesis,
  type StudySynthesisRecord,
} from "@/lib/synthesis/service";

/**
 * "Ausführlich"-Stufe — the OPTIONAL executive narrative. A SEPARATE stage over
 * the ALREADY-FINISHED synthesis: it never touches the core emit_study_synthesis
 * call (which stays byte-identical), it only RE-NARRATES the belegte Substanz
 * (overview + theme summaries + tension descriptions) at more length and depth,
 * then persists it into the additive detail_level / executive_narrative columns.
 *
 * HONESTY: this is prose over already-anchored material — same posture as the
 * overview (not per-sentence anchor-checked). The prompt forbids introducing any
 * new fact, number, quote, theme, or recommendation. The interpretive
 * advisory/recommendation layer is DELIBERATELY NOT part of this stage — it needs
 * its own eval coverage and lands in a later round.
 *
 * Fail-safe: writes only the two additive columns, so a failure can never corrupt
 * the base synthesis. Model failure → StudySynthesisUnavailableError (route → 500).
 */

const SynthesisNarrativeSchema = z.object({
  executive_narrative: z.string().min(1).max(4000),
});

const SYNTHESIS_NARRATIVE_SYSTEM_PROMPT = `You write the EXECUTIVE NARRATIVE of an ALREADY-FINISHED study synthesis — the longer, flowing German read-out a stakeholder reads first. You are given the finished synthesis (overview, emergent themes with their summaries, tensions). Your job is to RE-EXPRESS and CONNECT what is already there, at more length and with more narrative flow, so the synthesis reads like a really good, thorough study read-out.

STRICT GROUNDING — you are re-narrating, not adding:
- Introduce NO new fact, number, quote, theme, tension, cause, or study that is not already in the supplied synthesis.
- Give NO advice, NO recommendations, NO "you should", NO next steps — this is a richer articulation of the FINDINGS only. (Advice is a separate, clearly-labelled layer that is NOT part of your output.)
- Do NOT invent counts. If you mention how widespread something is, use only wording the synthesis already supports; prefer qualitative phrasing over numbers.
- Stay strictly within this study's material — no general market/best-practice knowledge.

STYLE:
- German prose, 4-8 sentences, flowing (not a bullet list). Connect the themes into a coherent story: what emerged, where respondents converged, where they pulled apart.
- Calm, precise analyst voice. No marketing tone, no exclamation.

OUTPUT — call the tool exactly once:
{ "executive_narrative": "<4-8 German sentences, grounded only in the supplied synthesis>" }`;

function buildNarrativeUserPrompt(record: StudySynthesisRecord): string {
  const lines: string[] = [];
  if (record.overview && record.overview.trim() !== "") {
    lines.push(`OVERVIEW: ${record.overview.trim()}`);
  }
  if (record.emergent_themes.length > 0) {
    lines.push(`\nEMERGENT THEMES (${record.emergent_themes.length}):`);
    record.emergent_themes.forEach((t, i) => {
      lines.push(`  ${i + 1}. "${t.title}" — ${t.summary}`);
    });
  }
  if (record.tensions.length > 0) {
    lines.push(`\nTENSIONS (${record.tensions.length}):`);
    record.tensions.forEach((t, i) => {
      lines.push(
        `  ${i + 1}. ${t.description} (Seite A: ${t.side_a.label} / Seite B: ${t.side_b.label})`,
      );
    });
  }
  if (lines.length === 0) {
    lines.push("(die Synthese trägt noch keine Inhalte)");
  }
  return `Hier ist die fertige Synthese. Schreibe die ausführliche Executive-Narrative NUR auf Basis dieser Inhalte:\n\n${lines.join("\n")}`;
}

export interface ExpandNarrativeResult {
  status: "expanded" | "no_synthesis";
  executiveNarrative: string | null;
}

/**
 * Generate + persist the executive narrative for a plan's existing synthesis.
 * Drives BOTH triggers: the generation toggle (route runs it after a fresh
 * ausführlich synthesis) AND the post-hoc "Ausführlicher machen" button (route
 * runs it standalone on the existing synthesis).
 *
 * AUTH: the caller MUST have verified the plan belongs to `orgId`.
 */
export async function expandSynthesisNarrative(
  orgId: string,
  planId: string,
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_SYNTHESIS_MODEL,
): Promise<ExpandNarrativeResult> {
  const record = await getStudySynthesis(orgId, planId);
  if (!record || record.synthesized_at === null) {
    return { status: "no_synthesis", executiveNarrative: null };
  }

  let narrative: string;
  try {
    const result = await callClaudeStructured({
      schema: SynthesisNarrativeSchema,
      system: SYNTHESIS_NARRATIVE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildNarrativeUserPrompt(record) }],
      model,
      maxTokens: 2000,
      timeoutMs: 120_000,
      toolName: "emit_executive_narrative",
      toolDescription:
        "Return the executive narrative — a longer German re-narration of the supplied synthesis, grounded ONLY in it, with no new facts/numbers and no recommendations.",
    });
    narrative = result.executive_narrative;
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new StudySynthesisUnavailableError(
        "Claude executive-narrative returned invalid output twice",
        err,
      );
    }
    throw new StudySynthesisUnavailableError(
      "Claude executive-narrative call failed",
      err,
    );
  }

  // Write ONLY the two additive columns — the base synthesis is never touched.
  const supabase = createSynthSupabase();
  const { error } = await supabase
    .from("study_synthesis")
    .update({ detail_level: "ausführlich", executive_narrative: narrative })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (error) {
    throw new StudySynthesisUnavailableError(
      `Failed to persist executive narrative (migration 20260727000000 applied?): ${error.message}`,
    );
  }

  return { status: "expanded", executiveNarrative: narrative };
}

/**
 * Reset to standard — clears any prior executive narrative + detail level. Run on
 * a plain (standard) re-synthesis so a narrative from a PREVIOUS „ausführlich" run
 * can never outlive the synthesis it described (the core upsert refreshes
 * overview/themes/tensions but leaves these additive columns as-is). Best-effort:
 * touches only the two additive columns, never the base synthesis.
 */
export async function resetSynthesisNarrative(
  orgId: string,
  planId: string,
): Promise<void> {
  const supabase = createSynthSupabase();
  const { error } = await supabase
    .from("study_synthesis")
    .update({ detail_level: "standard", executive_narrative: null })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (error) {
    console.warn(
      `[synthesis] narrative reset failed (migration 20260727000000 applied?): ${error.message}`,
    );
  }
}
