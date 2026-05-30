import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";

/**
 * Cross-Study-Agent tools (Bau 1) — the TWO SAFE load tools.
 *
 * Both return ONLY verbatim DB strings — never interpreted/fuzzy output. That is
 * the anti-poisoning rule from the plan (§5): a tool that returns model- or
 * embedding-judgements would feed un-grounded "observations" into the loop, and
 * the agent's answer would no longer rest on verbatim synthesis text. A fuzzy
 * cross-study theme search is therefore explicitly NOT here (plan: dangerous,
 * only after proven need).
 *
 * The agent reads studies through a CrossStudyToolset (dependency-injected) so
 * the eval can drive the loop with a fake, fixture-backed toolset (no DB) while
 * production uses createOrgToolset(orgId).
 */

/** One thin index row — list_studies. NO quotes/summaries (cheap, scales to
 *  hundreds of studies). Theme TITLES only, so the model can judge relevance. */
export interface StudyIndexEntry {
  studyId: string;
  title: string;
  /** NOTE (Bau 1): the canonical loadOrgSyntheses does not surface persona /
   *  createdAt yet, so production leaves these null. They are in the shape for
   *  forward-compatibility — Bau 2 (temporal / persona binning) enriches the
   *  loader when those queries actually arrive. */
  persona: string | null;
  createdAt: string | null;
  basedOnCount: number;
  themeTitles: string[];
  tensionCount: number;
}

/**
 * The seam between the agent loop and the data. Both methods return verbatim DB
 * content (or its fixture stand-in in the eval). loadSynthesis returns the RAW
 * synthesis input so the engine can BOTH format it for the model AND fold it
 * into that study's anchor haystack from the same strings.
 */
export interface CrossStudyToolset {
  /** Thin index of every study the org has a synthesis for. */
  listStudies(): Promise<StudyIndexEntry[]> | StudyIndexEntry[];
  /** Full synthesis of one study, or null for an unknown id. */
  loadSynthesis(
    studyId: string,
  ):
    | Promise<MissionControlSynthesisInput | null>
    | MissionControlSynthesisInput
    | null;
}

/** Project a full synthesis down to its thin index row (drops quotes/summaries). */
export function toIndexEntry(s: MissionControlSynthesisInput): StudyIndexEntry {
  return {
    studyId: s.studyId,
    title: s.studyTitle,
    persona: null,
    createdAt: null,
    basedOnCount: s.basedOnCount,
    themeTitles: s.emergent_themes.map((t) => t.title),
    tensionCount: s.tensions.length,
  };
}

// ── Anthropic tool definitions (the loop offers these) ───────────────────────

export const LIST_STUDIES_TOOL: Anthropic.Tool = {
  name: "list_studies",
  description:
    "List every study this organization has a finished synthesis for — a thin index (id, title, emergent-theme TITLES, interview + tension counts), WITHOUT quotes or summaries. Call this FIRST to decide which studies are relevant. Takes no arguments.",
  input_schema: { type: "object", properties: {} },
};

export const LOAD_SYNTHESIS_TOOL: Anthropic.Tool = {
  name: "load_synthesis",
  description:
    "Load the FULL synthesis (overview + emergent themes with quotes + tensions) of ONE study by its id. Only after loading can you quote a study verbatim. Load every study that could plausibly hold evidence for the question.",
  input_schema: {
    type: "object",
    properties: {
      studyId: {
        type: "string",
        description: "The id=<studyId> of a study from the list_studies index.",
      },
    },
    required: ["studyId"],
  },
};

// ── Production toolset (org-backed, read-only) ───────────────────────────────

/**
 * Production toolset for one org. Loads ALL org syntheses ONCE via the canonical
 * loadOrgSyntheses (kein paralleler Datenpfad), keeps them in memory, and serves
 * the thin index + per-study blocks from that snapshot.
 *
 * Honest tradeoff (plan §4): list_studies is "thin" toward the MODEL (it only
 * sees titles), but internally we still loaded everything — fine at Bau-1 scale.
 * A dedicated thin loader (a second read path) is deferred until study counts
 * make the full load itself the bottleneck.
 *
 * AUTH CONTRACT: the caller MUST have authenticated the user against `orgId`
 * before constructing this — loadOrgSyntheses is an org-scoped trust boundary.
 */
export async function createOrgToolset(orgId: string): Promise<CrossStudyToolset> {
  const syntheses = await loadOrgSyntheses(orgId);
  const byId = new Map(syntheses.map((s) => [s.studyId, s]));
  return {
    listStudies: () => syntheses.map(toIndexEntry),
    loadSynthesis: (studyId: string) => byId.get(studyId) ?? null,
  };
}
