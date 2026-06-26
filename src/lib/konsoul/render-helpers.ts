import type { KonsoulResult } from "@/lib/schemas/konsoul-agent";

/**
 * Konsoul P5 — PURE client-safe render helpers (no React, no DB), extracted so
 * the honesty-grammar rules they encode can be unit-tested without a React
 * render harness. Both rules are load-bearing for the brand moat.
 */

export interface HydratedTurn {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Assistant turns get a NEUTRAL guidance envelope so a restored answer is
   *  never re-grounded (no green „belegt" pip, no stale citations). */
  result?: KonsoulResult;
}

/**
 * Hydrate restored {role, content} turns into view turns. A persisted answer is
 * intentionally NOT re-anchored, so every assistant turn becomes `guidance`
 * (calm, never green); only a LIVE turn can earn the grounded face. Numbers
 * re-compute fresh if the user continues the thread.
 */
export function hydrateThreadTurns(
  initial: { role: "user" | "assistant"; content: string }[] | undefined,
): HydratedTurn[] {
  if (!initial) return [];
  return initial.map((turn, i) => ({
    id: i + 1,
    role: turn.role,
    content: turn.content,
    result:
      turn.role === "assistant"
        ? { kind: "guidance", answered: true, answer: turn.content }
        : undefined,
  }));
}

/**
 * The chip tone for an inline answer kind. GREEN („grounded") only for a live
 * grounded answer; amber („soft") for interpretation; nothing for guidance /
 * refusal / proposal. This is the structural green-only-for-grounded grammar.
 */
export function chipToneForKind(
  kind: KonsoulResult["kind"],
): "grounded" | "soft" | null {
  if (kind === "grounded") return "grounded";
  if (kind === "interpretation") return "soft";
  return null;
}
