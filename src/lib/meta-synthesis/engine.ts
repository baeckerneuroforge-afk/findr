import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import {
  buildMissionControlAnchorSet,
  fold,
  loadOrgSyntheses,
  type MissionControlAnchorSet,
} from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import type { MissionControlCitation } from "@/lib/schemas/mission-control";
import {
  MetaSynthesisResultSchema,
  type MetaSynthesisConvergentTheme,
  type MetaSynthesisContribution,
  type MetaSynthesisDivergence,
  type MetaSynthesisResult,
} from "@/lib/schemas/meta-synthesis";
import {
  buildMetaSynthesisSystemPrompt,
  buildMetaSynthesisTaskPrompt,
  type MetaSynthesisFromInputs,
} from "./prompts";

/**
 * Meta-Synthesis engine — a "synthesis of syntheses". Unlike the Cross-Study
 * AGENT (which loops to DISCOVER which studies to load), a meta-synthesis is
 * given its study set up front, so it is a SINGLE forced-tool call
 * (callClaudeStructured), exactly like a single study_synthesis — just at the
 * cross-study level. The trust guarantee is the SAME per-study anchor discipline
 * Mission-Control established: buildMissionControlAnchorSet + fold are reused
 * verbatim; the only new thing is applyMetaSynthesisAnchorFilter, which walks the
 * structured sections (convergent themes / divergences / contributions) and drops
 * every citation that isn't verbatim in its CITED study — then drops any element
 * whose surviving evidence no longer supports it.
 *
 * Model: Opus by default (parity with study_synthesis + Mission-Control —
 * trust-critical). Override via META_SYNTHESIS_MODEL.
 *
 * Fail-closed: a transport failure, or output that won't validate after one
 * forced retry, throws MetaSynthesisUnavailableError. It NEVER returns
 * un-anchored content.
 */

export const DEFAULT_META_SYNTHESIS_MODEL = CLAUDE_MODELS.opus;

/** A meta-synthesis is meaningless below this many studies. */
export const MIN_META_SYNTHESIS_STUDIES = 2;

/** Cross-study synthesis is long-form; match study_synthesis's ceiling. */
const MAX_TOKENS = 10_000;
const TIMEOUT_MS = 180_000;

export class MetaSynthesisUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MetaSynthesisUnavailableError";
  }
}

/** Precondition failure the CALLER can fix (fewer than MIN studies actually have
 *  a synthesis) — distinct from MetaSynthesisUnavailableError (model/transport)
 *  so the route can map it to a 422, not a 500. */
export class MetaSynthesisInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaSynthesisInputError";
  }
}

// ── Anchor filter (the cross-study trust guarantee, per section) ─────────────

/** Keep only citations whose studyId is known AND whose quote is a verbatim
 *  (folded) substring of THAT study's synthesis — never the union. Identical
 *  rule to applyMissionControlAnchorFilter, applied per structured element. */
function anchoredCitations(
  citations: MissionControlCitation[],
  anchors: MissionControlAnchorSet,
): MissionControlCitation[] {
  return citations.filter((c) => {
    const hay = anchors.haystackByStudy.get(c.studyId);
    return hay !== undefined && hay.includes(fold(c.quote));
  });
}

function distinctStudyIds(citations: MissionControlCitation[]): string[] {
  return [...new Set(citations.map((c) => c.studyId))];
}

/**
 * Walk every section, drop mis-attributed / paraphrased citations, then drop any
 * element the surviving evidence can no longer support:
 *  - convergent theme: needs citations spanning ≥2 DISTINCT studies (that is what
 *    makes it convergent); study_frequency is overridden to that count.
 *  - divergence: each position needs ≥1 surviving citation; the divergence needs
 *    ≥2 surviving positions spanning ≥2 distinct studies.
 *  - study contribution: single-study by definition — its citations must cite ITS
 *    OWN studyId; needs ≥1 surviving.
 * overview + interpretation are prose (not per-sentence anchored), same posture
 * as the single-synthesis overview and the Cross-Study-Agent interpretation.
 */
export function applyMetaSynthesisAnchorFilter(
  raw: MetaSynthesisResult,
  anchors: MissionControlAnchorSet,
): MetaSynthesisResult {
  const convergent_themes: MetaSynthesisConvergentTheme[] = [];
  for (const theme of raw.convergent_themes) {
    const cits = anchoredCitations(theme.citations, anchors);
    const studies = distinctStudyIds(cits);
    if (studies.length < 2) continue; // not convergent once verified
    convergent_themes.push({
      ...theme,
      study_frequency: studies.length,
      citations: cits,
    });
  }

  const divergences: MetaSynthesisDivergence[] = [];
  for (const divergence of raw.divergences) {
    const positions = divergence.positions
      .map((pos) => {
        const cits = anchoredCitations(pos.citations, anchors);
        return { ...pos, studyIds: distinctStudyIds(cits), citations: cits };
      })
      .filter((pos) => pos.citations.length > 0);
    const studies = new Set(positions.flatMap((p) => p.studyIds));
    // ≥2 positions AND ≥2 distinct studies → a genuine CROSS-study divergence.
    if (positions.length >= 2 && studies.size >= 2) {
      divergences.push({ ...divergence, positions });
    }
  }

  const study_contributions: MetaSynthesisContribution[] = [];
  for (const contribution of raw.study_contributions) {
    // A contribution is single-study: only citations to ITS OWN study count.
    const cits = anchoredCitations(contribution.citations, anchors).filter(
      (c) => c.studyId === contribution.studyId,
    );
    if (cits.length === 0) continue;
    study_contributions.push({ ...contribution, citations: cits });
  }

  return {
    overview: raw.overview,
    convergent_themes,
    divergences,
    study_contributions,
    // Prose channels — not per-sentence anchored (grounded by the prompt), so
    // carried through verbatim, same as overview.
    executive_narrative: raw.executive_narrative,
    interpretation: raw.interpretation,
  };
}

// ── Diagnostics entry (the eval drives this) ────────────────────────────────

export interface MetaSynthesisDiagnostics {
  /** Raw model output BEFORE the anchor filter. */
  raw: MetaSynthesisResult;
  /** The anchor-filtered artifact — the guarantee handed to the user. */
  filtered: MetaSynthesisResult;
  /** Citations the per-study anchor check rejected across all sections. */
  droppedCitationCount: number;
  /** Convergent themes dropped because their surviving citations spanned <2
   *  distinct studies. */
  droppedConvergentThemeCount: number;
  /** Divergences dropped because <2 positions (over ≥2 studies) survived. */
  droppedDivergenceCount: number;
  /** Study contributions dropped because no citation to their own study
   *  survived. */
  droppedContributionCount: number;
}

function totalCitationCount(result: MetaSynthesisResult): number {
  return (
    result.convergent_themes.reduce((n, t) => n + t.citations.length, 0) +
    result.divergences.reduce(
      (n, d) => n + d.positions.reduce((m, p) => m + p.citations.length, 0),
      0,
    ) +
    result.study_contributions.reduce((n, c) => n + c.citations.length, 0)
  );
}

/**
 * Pure entry — pass the SELECTED syntheses + optional focus explicitly, get BOTH
 * the raw model output and the anchor-filtered artifact plus filter stats. NO
 * Supabase. The eval harness drives this so hand-crafted multi-study scenarios
 * run without seeding the DB.
 */
export async function runMetaSynthesisDiagnostics(
  input: MetaSynthesisFromInputs,
  model: string = process.env.META_SYNTHESIS_MODEL ??
    DEFAULT_META_SYNTHESIS_MODEL,
): Promise<MetaSynthesisDiagnostics> {
  if (input.syntheses.length < MIN_META_SYNTHESIS_STUDIES) {
    throw new MetaSynthesisInputError(
      `A meta-synthesis needs at least ${MIN_META_SYNTHESIS_STUDIES} studies (got ${input.syntheses.length}).`,
    );
  }

  const systemPrompt = buildMetaSynthesisSystemPrompt(input.syntheses);
  const anchors = buildMissionControlAnchorSet(input.syntheses);

  let raw: MetaSynthesisResult;
  try {
    raw = await callClaudeStructured({
      schema: MetaSynthesisResultSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: buildMetaSynthesisTaskPrompt(input.focus, input.detailLevel),
        },
      ],
      model,
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
      toolName: "emit_meta_synthesis",
      toolDescription:
        "Return the meta-synthesis — a German overview, convergent_themes (each cited from ≥2 studies), divergences (positions cited from their own studies), optional study_contributions, and an optional non-evidenced interpretation. Every citation is { studyId, quote } drawn ONLY from the named study's synthesis. Call exactly once.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new MetaSynthesisUnavailableError(
        "Claude meta-synthesis returned invalid output twice",
        err,
      );
    }
    throw new MetaSynthesisUnavailableError(
      "Claude meta-synthesis call failed",
      err,
    );
  }

  const filtered = applyMetaSynthesisAnchorFilter(raw, anchors);
  return {
    raw,
    filtered,
    droppedCitationCount: totalCitationCount(raw) - totalCitationCount(filtered),
    droppedConvergentThemeCount:
      raw.convergent_themes.length - filtered.convergent_themes.length,
    droppedDivergenceCount: raw.divergences.length - filtered.divergences.length,
    droppedContributionCount:
      raw.study_contributions.length - filtered.study_contributions.length,
  };
}

/** Production-facing pure entry — the filtered guarantee only. */
export async function runMetaSynthesisFromInputs(
  input: MetaSynthesisFromInputs,
  model?: string,
): Promise<MetaSynthesisResult> {
  return (await runMetaSynthesisDiagnostics(input, model)).filtered;
}

// ── Org entry (loads the org's syntheses, selects the requested subset) ───────

/** The selected syntheses + the generated artifact — the org entry returns both
 *  so the E2 service can persist the source set, the interview-count snapshot and
 *  a title without re-loading. */
export interface MetaSynthesisRun {
  result: MetaSynthesisResult;
  /** The syntheses actually used (the requested studyIds that HAD a synthesis),
   *  in load order. length ≥ MIN_META_SYNTHESIS_STUDIES. */
  usedStudies: MissionControlSynthesisInput[];
}

/**
 * Org entry — load the org's syntheses, keep the requested subset, run the
 * meta-synthesis. Read-only; persists nothing (that is the E2 service).
 *
 * AUTH CONTRACT: the caller MUST have authenticated the user against `orgId`
 * before calling — loadOrgSyntheses is an org-scoped trust boundary.
 */
export async function runMetaSynthesis(
  orgId: string,
  studyIds: string[],
  focus?: string,
  model?: string,
  detailLevel: "standard" | "ausführlich" = "standard",
): Promise<MetaSynthesisRun> {
  const requested = new Set(studyIds);
  const all = await loadOrgSyntheses(orgId);
  // Preserve loadOrgSyntheses order (deterministic) rather than the request
  // order, and dedupe implicitly via the Set membership test.
  const usedStudies = all.filter((s) => requested.has(s.studyId));

  if (usedStudies.length < MIN_META_SYNTHESIS_STUDIES) {
    throw new MetaSynthesisInputError(
      `Fewer than ${MIN_META_SYNTHESIS_STUDIES} of the requested studies have a synthesis (found ${usedStudies.length}).`,
    );
  }

  const result = await runMetaSynthesisFromInputs(
    { syntheses: usedStudies, focus, detailLevel },
    model,
  );
  return { result, usedStudies };
}
