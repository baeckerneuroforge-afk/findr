import { z } from "zod";

import {
  MissionControlCitationSchema,
  MissionControlHistoryTurnSchema,
  MissionControlResultSchema,
  type MissionControlCitation,
} from "./mission-control";

/**
 * Cross-Study-Agent schema (Bau 1 — agentischer Loop-Kern).
 *
 * The agent is the AGENTIC sibling of Mission-Control (the cross-study CHAT):
 * instead of loading ALL org syntheses into one context, it DECIDES which
 * studies to load (list_studies → load_synthesis), then answers with the SAME
 * cross-study anchor discipline. The FINAL answer reuses Mission-Control's
 * result contract — `{ answered, answer, citations:[{studyId, quote}] }` — so
 * the engine reuses buildMissionControlAnchorSet + applyMissionControlAnchorFilter
 * unchanged on the loaded subset. The research LOOP (Bau 1) is the only new
 * control flow; the answer + its citation guarantee are Mission-Control's.
 *
 * Bau 2 adds ONE additive field on top of that contract: `interpretation`. The
 * anchor filter guards CITATIONS, not PROSE (plan §6) — so a soft cross-study
 * observation ("the trend seems to…") that can be backed by NEITHER an exact
 * aggregate_theme_frequency count NOR per-study citations has no honest home in
 * the grounded `answer`. Rather than let it masquerade as fact there (or be
 * silently dropped), it goes in `interpretation`, which the UI (Bau 3) renders
 * as "Interpretation (nicht direkt belegt)". It is OPTIONAL and the agent prefers
 * leaving it empty / refusing over speculating. It is NOT anchored — it is the
 * honestly-labeled soft channel the plan calls "ehrlich begrenzt", never a
 * place for invented counts (those come only from the deterministic tool).
 *
 * The {answered, answer, citations} subset is still a valid MissionControlResult
 * (interpretation is additive), so applyMissionControlAnchorFilter keeps working
 * verbatim; the engine re-attaches interpretation around it.
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

// ── Result (the forced emit_cross_study_answer output) ───────────────────────

/** The agent's final answer = Mission-Control's `{answered, answer, citations}`
 *  PLUS one additive, NON-anchored field: `interpretation`. The grounded part is
 *  unchanged (so the anchor filter is reused verbatim); `interpretation` is the
 *  honestly-labeled soft channel (plan §6). */
export const CrossStudyAgentResultSchema = MissionControlResultSchema.extend({
  /** OPTIONAL cross-study interpretation the agent could back with NEITHER an
   *  exact aggregate_theme_frequency count NOR per-study citations — a soft
   *  observation, NOT a grounded claim. Rendered to the user as "Interpretation
   *  (nicht direkt belegt)", never as fact. Empty by default; the agent prefers
   *  refusing over speculating. MUST NOT contain frequency/"in N studies"
   *  numbers — those come ONLY from the deterministic tool, in `answer` with
   *  citations. NOT checked against any anchor haystack (it is, by definition,
   *  the un-anchored space). */
  interpretation: z.string().max(1500).default(""),
});
export type CrossStudyAgentResult = z.infer<typeof CrossStudyAgentResultSchema>;

export const CrossStudyAgentCitationSchema = MissionControlCitationSchema;
export type CrossStudyAgentCitation = MissionControlCitation;
