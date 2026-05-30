import { z } from "zod";

import {
  MissionControlCitationSchema,
  MissionControlHistoryTurnSchema,
  MissionControlResultSchema,
  type MissionControlCitation,
  type MissionControlResult,
} from "./mission-control";

/**
 * Cross-Study-Agent schema (Bau 1 — agentischer Loop-Kern).
 *
 * The agent is the AGENTIC sibling of Mission-Control (the cross-study CHAT):
 * instead of loading ALL org syntheses into one context, it DECIDES which
 * studies to load (list_studies → load_synthesis), then answers with the SAME
 * cross-study anchor discipline. The FINAL answer therefore reuses
 * Mission-Control's result contract VERBATIM — `{ answered, answer,
 * citations:[{studyId, quote}] }` — so the engine can reuse
 * buildMissionControlAnchorSet + applyMissionControlAnchorFilter unchanged on
 * the loaded subset. The only NEW thing in Bau 1 is the research LOOP; the
 * answer + its safety guarantee are Mission-Control's.
 *
 * Result reuse (NOT a parallel shape): the emit tool is validated against
 * MissionControlResultSchema; we re-export it under cross-study names for call
 * sites that read better that way. No new fields — a divergent result shape
 * would mean a second anchor filter, which is exactly what we DON'T want.
 */

// ── Request ──────────────────────────────────────────────────────────────────

export const CrossStudyAgentRequestSchema = z.object({
  /** Org whose study syntheses the agent may list + load (org-scoped). */
  orgId: z.string().min(1).max(200),
  question: z.string().min(1).max(2000),
  /** Prior conversation turns (multi-turn). Threaded into the research-loop
   *  messages as context; NEVER folded into any anchor haystack. */
  history: z.array(MissionControlHistoryTurnSchema).max(20).optional(),
});
export type CrossStudyAgentRequest = z.infer<typeof CrossStudyAgentRequestSchema>;

// ── Result (the forced emit_cross_study_answer output) — reused from MC ───────

/** The agent's final answer shape === Mission-Control's. Re-exported so the
 *  engine + eval read in cross-study terms while the underlying schema (and
 *  thus the anchor filter) stays the single Mission-Control one. */
export const CrossStudyAgentResultSchema = MissionControlResultSchema;
export type CrossStudyAgentResult = MissionControlResult;

export const CrossStudyAgentCitationSchema = MissionControlCitationSchema;
export type CrossStudyAgentCitation = MissionControlCitation;
