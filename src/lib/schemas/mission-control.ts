import { z } from "zod";

/**
 * Mission-Control / Cross-Study-Chat schema (Etappe 1 — eval-faehiger Kern).
 *
 * Sibling of schemas/research-agent.ts and the chat-with-data result schema:
 * a chat answer grounded STRICTLY in study syntheses, with verbatim citations.
 * The difference is CROSS-STUDY — the haystack is the UNION of ALL of an org's
 * study syntheses, and every citation must name the SOURCE study (`studyId`) it
 * rests on. That makes two failure modes explicit and checkable:
 *   1. attributing a finding to the WRONG study, and
 *   2. MERGING two studies' findings into a claim no single synthesis makes.
 * The engine re-checks each citation's quote against the cited study's OWN
 * folded synthesis text (per-study, not a union substring) — see
 * mission-control/engine.ts. Unanchored / wrong-study citations are dropped;
 * an answered=true whose citations all drop is downgraded to a refusal.
 *
 * JSON robustness: consumed via callClaudeStructured (forced tool-use), like
 * the migrated AI modules — no fragile text-JSON parse. The cross-study answer
 * is not a numerically-calibrated field, so tool-use is the right transport
 * (unlike Risk, where forced tool-use shifted the score calibration).
 */

// ── Multi-turn history ───────────────────────────────────────────────────────

export const MissionControlHistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type MissionControlHistoryTurn = z.infer<
  typeof MissionControlHistoryTurnSchema
>;

// ── Request ──────────────────────────────────────────────────────────────────

export const MissionControlRequestSchema = z.object({
  /** Org whose study syntheses form the cross-study haystack (org-scoped). */
  orgId: z.string().min(1).max(200),
  question: z.string().min(1).max(2000),
  /** Prior conversation turns (multi-turn). Threaded into the Anthropic
   *  messages as conversational context ONLY — NEVER folded into the anchor
   *  haystack, so a prior turn can never widen what counts as grounded. */
  history: z.array(MissionControlHistoryTurnSchema).max(20).optional(),
});
export type MissionControlRequest = z.infer<typeof MissionControlRequestSchema>;

// ── Response (the model's tool output; the engine re-checks + filters it) ─────

/** One verbatim citation. `studyId` is the plan_id of the study the claim rests
 *  on — the cross-study attribution handle the engine validates. `quote` must
 *  be a verbatim substring of THAT study's synthesis text (typography-folded). */
export const MissionControlCitationSchema = z.object({
  studyId: z.string().min(1).max(200),
  quote: z.string().min(1).max(800),
});
export type MissionControlCitation = z.infer<
  typeof MissionControlCitationSchema
>;

export const MissionControlResultSchema = z.object({
  answered: z.boolean(),
  answer: z.string().min(1).max(2500),
  citations: z.array(MissionControlCitationSchema).max(16).default([]),
});
export type MissionControlResult = z.infer<typeof MissionControlResultSchema>;
