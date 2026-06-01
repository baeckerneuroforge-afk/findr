import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { fold, loadOrgSyntheses } from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import type { ResearchPlanStudyType } from "@/lib/research/db";

/**
 * Cross-Study-Agent tools — Bau 1: the TWO SAFE load tools; Bau 2 adds the THIRD
 * tool, aggregate_theme_frequency (deterministic counting).
 *
 * ALL three return ONLY verbatim DB strings + numbers the CODE computed — never
 * interpreted/fuzzy output. That is the anti-poisoning rule from the plan (§5): a
 * tool that returns model- or embedding-judgements would feed un-grounded
 * "observations" into the loop, and the agent's answer would no longer rest on
 * verbatim synthesis text. A fuzzy/semantic cross-study theme search is therefore
 * explicitly NOT here (plan: dangerous, only after proven need) —
 * aggregate_theme_frequency is EXACT-PHRASE fold-substring matching only.
 *
 * The agent reads studies through a CrossStudyToolset (dependency-injected) so
 * the eval can drive the loop with a fake, fixture-backed toolset (no DB) while
 * production uses createOrgToolset(orgId). aggregate_theme_frequency is a PURE
 * function over the already-loaded studies (no toolset method — it has no data
 * access of its own; it counts only what the agent has already loaded).
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
  /** Studientyp (M2) — lets list_studies show "Markt-Studie" / "Discovery-Studie"
   *  in the thin index so the agent can pick the right kind before loading.
   *  Optional: eval fixtures leave it undefined (no label); production fills it
   *  via loadOrgSyntheses. Display-only, never anchored. */
  studyType?: ResearchPlanStudyType;
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
    studyType: s.studyType,
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

export const AGGREGATE_THEME_FREQUENCY_TOOL: Anthropic.Tool = {
  name: "aggregate_theme_frequency",
  description:
    "Count — DETERMINISTICALLY, in code — in how many of the studies you have ALREADY LOADED a theme phrase appears. It does a verbatim case/diacritic-insensitive substring match of `themeQuery` over the loaded studies' emergent-theme TITLES and SUMMARIES, and returns the exact study count + the matching studyIds + one verbatim evidence string per match. ALWAYS use this for any 'in how many studies' / cross-study frequency claim — NEVER estimate such a number yourself. Use a SHORT phrase likely to appear verbatim in theme titles (e.g. 'Onboarding', not a whole sentence). It only sees studies you already loaded via load_synthesis.",
  input_schema: {
    type: "object",
    properties: {
      themeQuery: {
        type: "string",
        description:
          "A short theme phrase to count, matched verbatim (fold-substring) against loaded theme titles + summaries.",
      },
    },
    required: ["themeQuery"],
  },
};

// ── aggregate_theme_frequency — deterministic, code-computed (Bau 2) ──────────

/** One study where the theme phrase matched, with a VERBATIM evidence string
 *  (the theme title or summary that contained it — a real, citable DB string). */
export interface ThemeFrequencyMatch {
  studyId: string;
  studyTitle: string;
  /** The verbatim theme title or summary where the phrase matched. Citable. */
  evidence: string;
}

export interface ThemeFrequencyResult {
  query: string;
  /** Number of DISTINCT loaded studies whose theme titles/summaries contain the
   *  folded query phrase. This is THE deterministic count the model reports. */
  count: number;
  /** Total loaded studies the count was computed over (context for the model). */
  loadedCount: number;
  matches: ThemeFrequencyMatch[];
}

/**
 * Deterministic theme-frequency count over ALREADY-LOADED studies. Pure, no DB,
 * no model judgement: it folds `themeQuery` (the SAME normalization the anchor
 * filter uses) and substring-matches it against each loaded study's emergent-
 * theme titles + summaries. A study counts AT MOST once. Returns the exact count
 * + the matching studies + one verbatim evidence string each (so the model can
 * both report the number AND cite each contributing study).
 *
 * EXACT-PHRASE ONLY — no fuzzy/semantic matching (plan §6: that is the
 * hallucination vector we refuse to build until there is proven need).
 */
export function aggregateThemeFrequency(
  themeQuery: string,
  loadedStudies: MissionControlSynthesisInput[],
): ThemeFrequencyResult {
  const needle = fold(themeQuery);
  const matches: ThemeFrequencyMatch[] = [];
  if (needle !== "") {
    for (const s of loadedStudies) {
      let evidence: string | null = null;
      for (const t of s.emergent_themes) {
        if (fold(t.title).includes(needle)) {
          evidence = t.title;
          break;
        }
        if (fold(t.summary).includes(needle)) {
          evidence = t.summary;
          break;
        }
      }
      if (evidence !== null) {
        matches.push({
          studyId: s.studyId,
          studyTitle: s.studyTitle,
          evidence,
        });
      }
    }
  }
  return {
    query: themeQuery,
    count: matches.length,
    loadedCount: loadedStudies.length,
    matches,
  };
}

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
