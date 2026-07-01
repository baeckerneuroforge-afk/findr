import { z } from "zod";

/**
 * Advisory / "Beratung" layer (Runde 2) — the interpretive „so what?" over a
 * FINISHED synthesis. UNLIKE the anchored themes/quotes, an implication is
 * NOT a verbatim fact — it is a HYPOTHESIS derived from a finding. That makes it
 * the one part of the synthesis that can drift, so it is fenced by:
 *   1. schema — every implication names the exact finding it derives from
 *      (`basis` = a verbatim theme title / tension description), so grounding to
 *      a finding is deterministically checkable;
 *   2. engine/eval — a deterministic scan drops implications whose `basis` is not
 *      an actual finding + flags hypotheses that introduce numbers absent from the
 *      synthesis; an LLM judge (advisory-grounding) advises but never gates.
 *
 * The UI/export label it „Beratung, nicht belegt" — never as fact.
 */

export const SynthesisImplicationSchema = z.object({
  /** The finding this implication follows from — a VERBATIM theme title OR
   *  tension description copied from the synthesis. Makes the „derives from a
   *  real finding" rule deterministically checkable (fold-substring match). */
  basis: z.string().min(3).max(240),
  /** The interpretation: what the finding could mean / what the team could do
   *  about it, framed as a HYPOTHESIS to validate — never asserted as fact,
   *  never carrying a number not already in the synthesis. */
  hypothesis: z.string().min(10).max(600),
});
export type SynthesisImplication = z.infer<typeof SynthesisImplicationSchema>;

export const SynthesisImplicationsResultSchema = z.object({
  /** ≤6 implications. EMPTY is a valid, correct answer when the synthesis is
   *  thin / contradictory / lacks clear findings — the model must NOT manufacture
   *  advice to fill space (same posture as themes/tensions). */
  implications: z.array(SynthesisImplicationSchema).max(6).default([]),
});
export type SynthesisImplicationsResult = z.infer<
  typeof SynthesisImplicationsResultSchema
>;

/** Normalize persisted `implications` JSONB into honest SynthesisImplication[].
 *  Defensive map (never throws) — mirrors normalizeEmergentThemes: legacy/partial
 *  rows drop to [] rather than crashing a read. */
export function normalizeImplications(value: unknown): SynthesisImplication[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.basis !== "string" || typeof e.hypothesis !== "string") {
      return [];
    }
    return [{ basis: e.basis, hypothesis: e.hypothesis }];
  });
}
